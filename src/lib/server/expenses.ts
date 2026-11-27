import type { Expense as DbExpense, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { badRequest, notFound } from "./http";
import { dateKeyToUTC, isValidDateKey, utcToDateKey } from "@/lib/dates";
import { fromMinor, roundMoney, toMinor } from "@/lib/money";
import { expenseBatchSchema, expenseInputSchema } from "@/lib/validation";
import type { Expense, ExpensePoint, Paginated } from "@/lib/types";

const IS_POSTGRES = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");

export function serializeExpense(e: DbExpense): Expense {
  return {
    id: e.id,
    categoryId: e.categoryId,
    particular: e.particular,
    amount: e.amount,
    expenseDate: utcToDateKey(e.expenseDate),
    description: e.description,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  q: z.string().trim().max(120).optional(),
  categoryIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : [])),
  from: z.string().optional().refine((v) => !v || isValidDateKey(v), "Invalid from date"),
  to: z.string().optional().refine((v) => !v || isValidDateKey(v), "Invalid to date"),
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
  sort: z.enum(["expenseDate", "amount", "particular", "category", "createdAt"]).default("expenseDate"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type ExpenseListQuery = z.input<typeof listQuerySchema>;

function whereFrom(q: z.output<typeof listQuerySchema>): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};
  // SQLite LIKE is already case-insensitive; Postgres needs mode: "insensitive".
  if (q.q) where.particular = IS_POSTGRES ? ({ contains: q.q, mode: "insensitive" } as Prisma.StringFilter) : { contains: q.q };
  if (q.categoryIds.length) where.categoryId = { in: q.categoryIds };
  if (q.from || q.to) {
    where.expenseDate = {
      ...(q.from ? { gte: dateKeyToUTC(q.from) } : {}),
      ...(q.to ? { lte: dateKeyToUTC(q.to) } : {}),
    };
  }
  if (q.min !== undefined || q.max !== undefined) {
    where.amount = {
      ...(q.min !== undefined ? { gte: q.min } : {}),
      ...(q.max !== undefined ? { lte: q.max } : {}),
    };
  }
  return where;
}

export async function listExpenses(params: Record<string, string | undefined>): Promise<Paginated<Expense>> {
  const q = listQuerySchema.parse(params);
  if (q.min !== undefined && q.max !== undefined && q.min > q.max) throw badRequest("Minimum amount is greater than maximum");
  const where = whereFrom(q);
  const orderBy: Prisma.ExpenseOrderByWithRelationInput[] =
    q.sort === "category"
      ? [{ category: { name: q.order } }, { expenseDate: "desc" }]
      : [{ [q.sort]: q.order }, { createdAt: "desc" }];
  const [total, agg] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / q.pageSize));
  const page = Math.min(q.page, pageCount);
  const rows = await prisma.expense.findMany({ where, orderBy, skip: (page - 1) * q.pageSize, take: q.pageSize });
  return {
    items: rows.map(serializeExpense),
    total,
    page,
    pageSize: q.pageSize,
    pageCount,
    sum: fromMinor(toMinor(agg._sum.amount ?? 0)),
  };
}

/** All matching rows (no pagination) for exports. */
export async function exportExpenses(params: Record<string, string | undefined>): Promise<Expense[]> {
  const q = listQuerySchema.parse({ ...params, page: 1, pageSize: 1 });
  const rows = await prisma.expense.findMany({
    where: whereFrom(q),
    orderBy: q.sort === "category" ? [{ category: { name: q.order } }] : [{ [q.sort]: q.order }],
  });
  return rows.map(serializeExpense);
}

/** Lean rows for analytics in a date range. */
export async function expensePoints(from?: string | null, to?: string | null): Promise<ExpensePoint[]> {
  if (from && !isValidDateKey(from)) throw badRequest("Invalid from date");
  if (to && !isValidDateKey(to)) throw badRequest("Invalid to date");
  const rows = await prisma.expense.findMany({
    where:
      from || to
        ? { expenseDate: { ...(from ? { gte: dateKeyToUTC(from) } : {}), ...(to ? { lte: dateKeyToUTC(to) } : {}) } }
        : undefined,
    select: { id: true, categoryId: true, particular: true, amount: true, expenseDate: true },
    orderBy: { expenseDate: "asc" },
  });
  return rows.map((r) => ({ ...r, expenseDate: utcToDateKey(r.expenseDate) }));
}

async function assertNormalCategories(ids: string[]) {
  const unique = [...new Set(ids)];
  const cats = await prisma.category.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, type: true } });
  if (cats.length !== unique.length) throw badRequest("The selected category does not exist.");
  const calc = cats.find((c) => c.type === "CALCULATED");
  if (calc) {
    throw badRequest(`"${calc.name}" is a calculated category. Its total comes from its formula, so expenses can't be added to it directly.`);
  }
}

export async function getExpense(id: string): Promise<Expense> {
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) throw notFound("Expense");
  return serializeExpense(e);
}

/** Accepts a single expense object or `{ expenses: [...] }` for quick multi-add. */
export async function createExpenses(body: unknown): Promise<Expense[]> {
  const list =
    body && typeof body === "object" && "expenses" in body
      ? expenseBatchSchema.parse(body).expenses
      : [expenseInputSchema.parse(body)];
  await assertNormalCategories(list.map((e) => e.categoryId));
  const created = await prisma.$transaction(
    list.map((e) =>
      prisma.expense.create({
        data: {
          categoryId: e.categoryId,
          particular: e.particular,
          amount: roundMoney(e.amount),
          expenseDate: dateKeyToUTC(e.expenseDate),
          description: e.description,
          notes: e.notes,
        },
      }),
    ),
  );
  return created.map(serializeExpense);
}

export async function updateExpense(id: string, body: unknown): Promise<Expense> {
  const data = expenseInputSchema.partial().parse(body);
  if (data.categoryId) await assertNormalCategories([data.categoryId]);
  const updated = await prisma.expense.update({
    where: { id },
    data: {
      categoryId: data.categoryId,
      particular: data.particular,
      amount: data.amount === undefined ? undefined : roundMoney(data.amount),
      expenseDate: data.expenseDate ? dateKeyToUTC(data.expenseDate) : undefined,
      description: data.description,
      notes: data.notes,
    },
  });
  return serializeExpense(updated);
}

export async function deleteExpenses(ids: string[]): Promise<number> {
  if (!ids.length) throw badRequest("No expenses selected");
  const res = await prisma.expense.deleteMany({ where: { id: { in: ids } } });
  return res.count;
}
