import type { Category as DbCategory, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { badRequest, conflict, notFound } from "./http";
import {
  detectCycle,
  evaluateFormula,
  parseFormula,
  parseStoredFormula,
  referencedCategoryIds,
  resolveAll,
  type FormulaToken,
  type GraphNode,
} from "@/lib/formula";
import { fromMinor, toMinor } from "@/lib/money";
import { categoryInputSchema, categoryUpdateSchema } from "@/lib/validation";
import type { Category } from "@/lib/types";

/*
 * Every function takes the owner's userId and only ever reads or writes that
 * user's rows. A category id belonging to someone else behaves exactly like
 * an id that doesn't exist (404), so ids can't be probed.
 */

type DbCategoryWithDeps = DbCategory & { dependents: { categoryId: string }[] };

export function serializeCategory(c: DbCategoryWithDeps, total = 0, count = 0): Category {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    color: c.color,
    icon: c.icon,
    type: c.type === "CALCULATED" ? "CALCULATED" : "NORMAL",
    formula: c.type === "CALCULATED" ? parseStoredFormula(c.formula) : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    total,
    expenseCount: count,
    dependentIds: c.dependents.map((d) => d.categoryId),
  };
}

export async function listCategories(userId: string): Promise<Category[]> {
  const [rows, sums] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      include: { dependents: { select: { categoryId: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.groupBy({ by: ["categoryId"], where: { userId }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const byCat = new Map(sums.map((s) => [s.categoryId, s]));
  return rows.map((c) => {
    const s = byCat.get(c.id);
    return serializeCategory(c, fromMinor(toMinor(s?._sum.amount ?? 0)), s?._count._all ?? 0);
  });
}

export async function getCategory(userId: string, id: string): Promise<Category> {
  const c = await prisma.category.findFirst({ where: { id, userId }, include: { dependents: { select: { categoryId: true } } } });
  if (!c) throw notFound("Category");
  const agg = await prisma.expense.aggregate({ where: { categoryId: id, userId }, _sum: { amount: true }, _count: { _all: true } });
  return serializeCategory(c, fromMinor(toMinor(agg._sum.amount ?? 0)), agg._count._all);
}

async function nextCode(tx: Prisma.TransactionClient, userId: string): Promise<string> {
  const codes = await tx.category.findMany({ where: { userId }, select: { code: true } });
  const max = codes.reduce((m, { code }) => {
    const n = /^C(\d+)$/.exec(code);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `C${max + 1}`;
}

/**
 * Validates a formula for `targetId` against the user's own category graph:
 * structure, existing references (another user's category counts as missing),
 * no self/circular references, and no division by zero with current data.
 */
async function validateFormula(tx: Prisma.TransactionClient, userId: string, targetId: string, tokens: FormulaToken[]) {
  const all = await tx.category.findMany({ where: { userId }, select: { id: true, name: true, type: true, formula: true } });
  const names = new Map(all.map((c) => [c.id, c.name]));
  const parsed = parseFormula(tokens, (id) => names.get(id) ?? "Unknown category");
  if (!parsed.ok) throw badRequest(parsed.error.message, { tokenIndex: parsed.error.tokenIndex });

  const refs = referencedCategoryIds(tokens);
  if (refs.some((id) => !names.has(id))) throw badRequest("The formula references a category that no longer exists.");
  if (refs.includes(targetId)) throw badRequest("A calculated category can't reference itself.");

  const nodes: GraphNode[] = all
    .filter((c) => c.id !== targetId)
    .map((c) => ({ id: c.id, type: c.type === "CALCULATED" ? "CALCULATED" : "NORMAL", formula: parseStoredFormula(c.formula) }));
  nodes.push({ id: targetId, type: "CALCULATED", formula: tokens });
  const cycle = detectCycle(nodes, targetId, tokens);
  if (cycle) {
    const path = cycle.map((id) => names.get(id) ?? "This category").join(" → ");
    throw badRequest(`Circular dependency: ${path}. A category can't depend on itself, directly or indirectly.`);
  }

  const sums = await tx.expense.groupBy({ by: ["categoryId"], where: { userId }, _sum: { amount: true } });
  const base = new Map(sums.map((s) => [s.categoryId, fromMinor(toMinor(s._sum.amount ?? 0))]));
  const values = resolveAll(nodes, base);
  const res = evaluateFormula(tokens, (id) => values.get(id)?.value ?? null);
  if (!res.ok && res.reason === "division-by-zero") {
    throw badRequest("Division by zero: the divisor currently totals 0. Add expenses to it or change the formula.", {
      tokenIndex: res.tokenIndex,
    });
  }
  return refs;
}

async function syncDependencies(tx: Prisma.TransactionClient, id: string, refs: string[]) {
  await tx.categoryDependency.deleteMany({ where: { categoryId: id } });
  if (refs.length) {
    await tx.categoryDependency.createMany({ data: refs.map((referencesId) => ({ categoryId: id, referencesId })) });
  }
}

async function assertUniqueName(tx: Prisma.TransactionClient, userId: string, name: string, exceptId?: string) {
  const all = await tx.category.findMany({ where: { userId }, select: { id: true, name: true } });
  const clash = all.find((c) => c.id !== exceptId && c.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (clash) throw conflict(`A category named "${clash.name}" already exists.`);
}

export async function createCategory(userId: string, input: unknown): Promise<Category> {
  const data = categoryInputSchema.parse(input);
  const id = await prisma.$transaction(async (tx) => {
    await assertUniqueName(tx, userId, data.name);
    const code = await nextCode(tx, userId);
    const created = await tx.category.create({
      data: {
        userId,
        code,
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        type: data.type,
        formula: null,
      },
    });
    if (data.type === "CALCULATED" && data.formula?.length) {
      const refs = await validateFormula(tx, userId, created.id, data.formula as FormulaToken[]);
      await tx.category.update({ where: { id: created.id }, data: { formula: JSON.stringify(data.formula) } });
      await syncDependencies(tx, created.id, refs);
    }
    return created.id;
  });
  return getCategory(userId, id);
}

export async function updateCategory(userId: string, id: string, input: unknown): Promise<Category> {
  const data = categoryUpdateSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.category.findFirst({ where: { id, userId }, include: { _count: { select: { expenses: true } } } });
    if (!existing) throw notFound("Category");
    if (data.name !== undefined) await assertUniqueName(tx, userId, data.name, id);

    const nextType = data.type ?? existing.type;
    if (existing.type === "NORMAL" && nextType === "CALCULATED" && existing._count.expenses > 0) {
      throw conflict(
        `"${existing.name}" has ${existing._count.expenses} expense entr${existing._count.expenses === 1 ? "y" : "ies"}. Delete or move them before converting it to a calculated category.`,
      );
    }

    let formula: string | null | undefined = undefined;
    if (nextType === "NORMAL") {
      formula = null;
      await syncDependencies(tx, id, []);
    } else if (data.formula !== undefined) {
      if (data.formula && data.formula.length) {
        const refs = await validateFormula(tx, userId, id, data.formula as FormulaToken[]);
        formula = JSON.stringify(data.formula);
        await syncDependencies(tx, id, refs);
      } else {
        formula = null;
        await syncDependencies(tx, id, []);
      }
    }

    await tx.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description === undefined ? undefined : data.description,
        color: data.color,
        icon: data.icon,
        type: nextType,
        formula,
      },
    });
  });
  return getCategory(userId, id);
}

export async function deleteCategory(userId: string, id: string) {
  const c = await prisma.category.findFirst({
    where: { id, userId },
    include: { dependents: { include: { category: { select: { name: true } } } } },
  });
  if (!c) throw notFound("Category");
  if (c.dependents.length) {
    const names = c.dependents.map((d) => `"${d.category.name}"`).join(", ");
    throw conflict(`"${c.name}" is used in the formula of ${names}. Remove it from those formulas first.`, {
      dependents: c.dependents.map((d) => d.categoryId),
    });
  }
  await prisma.category.delete({ where: { id } });
}
