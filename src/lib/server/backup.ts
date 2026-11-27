import type { Prisma, PrismaClient } from "@prisma/client";
import { buildGraph, findCycleFrom, parseFormula, parseStoredFormula, referencedCategoryIds } from "@/lib/formula";
import type { FormulaToken } from "@/lib/formula/tokens";
import { dateKeyToUTC, isValidDateKey, utcToDateKey } from "@/lib/dates";
import { MAX_AMOUNT, roundMoney } from "@/lib/money";
import { ICON_NAMES } from "@/lib/constants";
import { backupSchema, dashboardPrefsSchema, type Backup } from "@/lib/validation";
import { badRequest } from "./http";
import { getSettings, saveSettings } from "./settings";

export const BACKUP_VERSION = 1;

export async function createBackup(db: PrismaClient): Promise<Backup> {
  const [categories, expenses, settings] = await Promise.all([
    db.category.findMany({ orderBy: { createdAt: "asc" } }),
    db.expense.findMany({ orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }] }),
    getSettings(),
  ]);
  return {
    app: "spendly",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    categories: categories.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      color: c.color,
      icon: c.icon,
      type: c.type === "CALCULATED" ? "CALCULATED" : "NORMAL",
      formula: parseStoredFormula(c.formula),
      createdAt: c.createdAt.toISOString(),
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      categoryId: e.categoryId,
      particular: e.particular,
      amount: e.amount,
      expenseDate: utcToDateKey(e.expenseDate),
      description: e.description,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const fixColor = (c: string) => (HEX.test(c) ? c : "#64748b");
const fixIcon = (i: string, type: string) => (ICON_NAMES.includes(i) ? i : type === "CALCULATED" ? "calculator" : "tag");

function parseBackup(input: unknown): Backup {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw badRequest(
      `This file is not a valid Spendly data file${issue ? ` (${issue.path.join(".")}: ${issue.message})` : ""}.`,
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

function checkExpense(e: Backup["expenses"][number]) {
  if (!e.particular.trim() || e.particular.length > 120) throw badRequest(`Expense "${e.particular.slice(0, 30)}" has an invalid particular.`);
  if (!isValidDateKey(e.expenseDate)) throw badRequest(`Expense "${e.particular}" has an invalid date.`);
  if (!(e.amount > 0) || e.amount > MAX_AMOUNT) throw badRequest(`Expense "${e.particular}" has an invalid amount.`);
}

/** Structural validation shared by replace and merge: the file must be self-consistent. */
function validateSelfContained(b: Backup) {
  const ids = new Set(b.categories.map((c) => c.id));
  const codes = new Set(b.categories.map((c) => c.code.toUpperCase()));
  const names = new Set(b.categories.map((c) => c.name.trim().toLowerCase()));
  if (ids.size !== b.categories.length || codes.size !== b.categories.length || names.size !== b.categories.length) {
    throw badRequest("The file contains duplicate categories (same ID, code or name).");
  }
  for (const c of b.categories) {
    if (!c.name.trim() || c.name.length > 60) throw badRequest(`Category "${c.name.slice(0, 30)}" has an invalid name.`);
  }
  const calcIds = new Set(b.categories.filter((c) => c.type === "CALCULATED").map((c) => c.id));
  for (const c of b.categories) {
    if (c.type === "CALCULATED" && c.formula?.length) {
      const p = parseFormula(c.formula as FormulaToken[]);
      if (!p.ok) throw badRequest(`Formula of "${c.name}" is invalid: ${p.error.message}`);
      for (const r of referencedCategoryIds(c.formula as FormulaToken[])) {
        if (!ids.has(r)) throw badRequest(`Formula of "${c.name}" references a category that isn't in the file.`);
      }
    }
  }
  const graph = buildGraph(b.categories.map((c) => ({ id: c.id, type: c.type, formula: (c.formula as FormulaToken[] | null) ?? null })));
  for (const id of calcIds) if (findCycleFrom(graph, id)) throw badRequest("The file contains circular formulas.");
  const expenseIds = new Set<string>();
  for (const e of b.expenses) {
    if (!ids.has(e.categoryId) || calcIds.has(e.categoryId)) throw badRequest(`Expense "${e.particular}" has an invalid category.`);
    checkExpense(e);
    if (e.id) {
      if (expenseIds.has(e.id)) throw badRequest(`Expense ID ${e.id} appears more than once in the file.`);
      expenseIds.add(e.id);
    }
  }
}

async function applySettings(partial: Backup["settings"]) {
  if (!partial || (!partial.currency && !partial.dateFormat && !partial.dashboard)) return false;
  const current = await getSettings();
  const dash = dashboardPrefsSchema.safeParse(partial.dashboard ?? current.dashboard);
  await saveSettings({
    currency: partial.currency || current.currency,
    dateFormat: partial.dateFormat || current.dateFormat,
    dashboard: dash.success ? dash.data : current.dashboard,
  });
  return true;
}

async function insertExpenses(tx: Prisma.TransactionClient, rows: Backup["expenses"]) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await tx.expense.createMany({
      data: rows.slice(i, i + CHUNK).map((e) => ({
        id: e.id || undefined,
        categoryId: e.categoryId,
        particular: e.particular.trim(),
        amount: roundMoney(e.amount),
        expenseDate: dateKeyToUTC(e.expenseDate),
        description: e.description ?? null,
        notes: e.notes ?? null,
        createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
      })),
    });
  }
}

/** Replace mode: validates thoroughly, then replaces all data atomically (exact restore). */
export async function restoreBackup(db: PrismaClient, input: unknown) {
  const b = parseBackup(input);
  validateSelfContained(b);

  await db.$transaction(
    async (tx) => {
      await tx.categoryDependency.deleteMany();
      await tx.expense.deleteMany();
      await tx.category.deleteMany();
      for (const c of b.categories) {
        await tx.category.create({
          data: {
            id: c.id,
            code: c.code.toUpperCase(),
            name: c.name.trim(),
            description: c.description ?? null,
            color: fixColor(c.color),
            icon: fixIcon(c.icon, c.type),
            type: c.type,
            formula: c.type === "CALCULATED" && c.formula?.length ? JSON.stringify(c.formula) : null,
            createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
          },
        });
      }
      for (const c of b.categories) {
        const refs = c.type === "CALCULATED" ? referencedCategoryIds(c.formula as FormulaToken[]) : [];
        if (refs.length) await tx.categoryDependency.createMany({ data: refs.map((r) => ({ categoryId: c.id, referencesId: r })) });
      }
      await insertExpenses(tx, b.expenses);
    },
    { timeout: 120_000 },
  );
  const settings = await applySettings(b.settings);
  return { mode: "replace" as const, categories: b.categories.length, expenses: b.expenses.length, settings };
}

/**
 * Merge mode: keeps existing data. Categories are matched by ID, then by
 * name (case-insensitive); unmatched ones are created (with a new code if
 * the file's code is taken). Expenses already present are skipped: by ID,
 * or for rows without a known ID by (category, date, amount, particular),
 * counted as a multiset so genuinely repeated entries are preserved.
 * Importing the same file twice therefore changes nothing.
 */
export async function mergeBackup(db: PrismaClient, input: unknown) {
  const b = parseBackup(input);
  validateSelfContained(b);

  return db.$transaction(
    async (tx) => {
      const existing = await tx.category.findMany({ select: { id: true, name: true, code: true, type: true } });
      const byId = new Map(existing.map((c) => [c.id, c]));
      const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));
      const usedCodes = new Set(existing.map((c) => c.code.toUpperCase()));
      let maxCode = existing.reduce((m, c) => Math.max(m, Number(/^C(\d+)$/.exec(c.code)?.[1] ?? 0)), 0);

      const idMap = new Map<string, string>();
      let matched = 0;
      const toCreate: Backup["categories"] = [];
      for (const c of b.categories) {
        const hit = byId.get(c.id) ?? byName.get(c.name.trim().toLowerCase());
        if (hit) {
          idMap.set(c.id, hit.id);
          matched++;
        } else toCreate.push(c);
      }

      // Pre-assign ids so formulas can reference categories created in the same merge.
      for (const c of toCreate) {
        const keepId = !c.id.startsWith("imp_") && !byId.has(c.id);
        idMap.set(c.id, keepId ? c.id : `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
      }
      const remap = (tokens: FormulaToken[]) =>
        tokens.map((t) => (t.kind === "category" ? { ...t, categoryId: idMap.get(t.categoryId) ?? t.categoryId } : t));

      for (const c of toCreate) {
        let code = c.code.toUpperCase();
        if (usedCodes.has(code)) code = `C${++maxCode}`;
        else maxCode = Math.max(maxCode, Number(/^C(\d+)$/.exec(code)?.[1] ?? 0));
        usedCodes.add(code);
        const formula = c.type === "CALCULATED" && c.formula?.length ? remap(c.formula as FormulaToken[]) : null;
        await tx.category.create({
          data: {
            id: idMap.get(c.id)!,
            code,
            name: c.name.trim(),
            description: c.description ?? null,
            color: fixColor(c.color),
            icon: fixIcon(c.icon, c.type),
            type: c.type,
            formula: formula ? JSON.stringify(formula) : null,
            createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
          },
        });
      }
      for (const c of toCreate) {
        if (c.type !== "CALCULATED" || !c.formula?.length) continue;
        const refs = referencedCategoryIds(remap(c.formula as FormulaToken[]));
        await tx.categoryDependency.createMany({ data: refs.map((r) => ({ categoryId: idMap.get(c.id)!, referencesId: r })) });
      }

      // Whole-graph checks after merging.
      const all = await tx.category.findMany({ select: { id: true, type: true, formula: true } });
      const graph = buildGraph(all.map((c) => ({ id: c.id, type: c.type === "CALCULATED" ? "CALCULATED" : "NORMAL", formula: parseStoredFormula(c.formula) })));
      for (const c of toCreate) if (findCycleFrom(graph, idMap.get(c.id)!)) throw badRequest("Merging would create circular formulas.");
      const calcIds = new Set(all.filter((c) => c.type === "CALCULATED").map((c) => c.id));

      // Expenses: skip what's already stored.
      const sig = (catId: string, date: string, amount: number, particular: string) =>
        `${catId}|${date}|${Math.round(amount * 100)}|${particular.trim().toLowerCase()}`;
      const stored = await tx.expense.findMany({ select: { id: true, categoryId: true, expenseDate: true, amount: true, particular: true } });
      const storedIds = new Set(stored.map((e) => e.id));
      const counts = new Map<string, number>();
      for (const e of stored) {
        const k = sig(e.categoryId, utcToDateKey(e.expenseDate), e.amount, e.particular);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const toInsert: Backup["expenses"] = [];
      let skipped = 0;
      for (const e of b.expenses) {
        const catId = idMap.get(e.categoryId)!;
        if (calcIds.has(catId)) {
          throw badRequest(`Expense "${e.particular}" belongs to a category that is calculated in your current data, so it can't hold expenses.`);
        }
        if (e.id && storedIds.has(e.id)) {
          skipped++;
          continue;
        }
        const k = sig(catId, e.expenseDate, e.amount, e.particular);
        const n = counts.get(k) ?? 0;
        if (n > 0) {
          counts.set(k, n - 1);
          skipped++;
          continue;
        }
        toInsert.push({ ...e, categoryId: catId });
      }
      await insertExpenses(tx, toInsert);
      return {
        mode: "merge" as const,
        categoriesCreated: toCreate.length,
        categoriesMatched: matched,
        expenses: toInsert.length,
        expensesSkipped: skipped,
      };
    },
    { timeout: 120_000 },
  );
}

export async function clearAll(db: PrismaClient) {
  await db.$transaction([db.categoryDependency.deleteMany(), db.expense.deleteMany(), db.category.deleteMany()]);
}
