/**
 * Pure analytics over (categories, expenses). Everything shown in the
 * dashboard, reports and category pages is derived here from raw expense
 * rows; nothing is pre-aggregated or hardcoded. Calculated categories are
 * always evaluated from the period's own base totals, so a filtered
 * period never leaks all-time numbers.
 */
import { format, parseISO, startOfWeek } from "date-fns";
import { resolveAll, type CalcValue, type GraphNode } from "@/lib/formula";
import { referencedCategoryIds } from "@/lib/formula/tokens";
import { daysInRange, eachDayKey, inRange, toDateKey } from "@/lib/dates";
import { fromMinor, toMinor } from "@/lib/money";
import type { Category, DateRange, ExpensePoint } from "@/lib/types";

export type Interval = "day" | "week" | "month" | "year";

export function filterByRange<T extends { expenseDate: string }>(rows: T[], range: DateRange): T[] {
  if (!range.from && !range.to) return rows;
  return rows.filter((r) => inRange(r.expenseDate, range));
}

/** Sum of expense entries per category (minor-unit accurate). */
export function baseTotals(expenses: ExpensePoint[]): Map<string, number> {
  const minor = new Map<string, number>();
  for (const e of expenses) minor.set(e.categoryId, (minor.get(e.categoryId) ?? 0) + toMinor(e.amount));
  return new Map([...minor].map(([k, v]) => [k, fromMinor(v)]));
}

export function countByCategory(expenses: ExpensePoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + 1);
  return m;
}

export function toGraphNodes(categories: Pick<Category, "id" | "type" | "formula">[]): GraphNode[] {
  return categories.map((c) => ({ id: c.id, type: c.type, formula: c.formula }));
}

/** Values of every category (normal and calculated) for a set of expenses. */
export function categoryValues(categories: Category[], expenses: ExpensePoint[]): Map<string, CalcValue> {
  return resolveAll(toGraphNodes(categories), baseTotals(expenses));
}

export function totalOf(expenses: ExpensePoint[]): number {
  let m = 0;
  for (const e of expenses) m += toMinor(e.amount);
  return fromMinor(m);
}

export interface CategoryStat {
  category: Category;
  total: number;
  count: number;
  /** Share of total (normal) expenses in the period, 0-100 */
  share: number;
  error: string | null;
}

/** Per-category stats for a period. Calculated categories carry their formula value. */
export function categoryStats(categories: Category[], expensesInRange: ExpensePoint[]): CategoryStat[] {
  const values = categoryValues(categories, expensesInRange);
  const counts = countByCategory(expensesInRange);
  const grand = totalOf(expensesInRange);
  return categories.map((c) => {
    const v = values.get(c.id);
    const total = v?.value ?? 0;
    return {
      category: c,
      total,
      count: c.type === "NORMAL" ? counts.get(c.id) ?? 0 : 0,
      share: grand > 0 ? (total / grand) * 100 : 0,
      error: v?.error ?? null,
    };
  });
}

export interface Summary {
  totalExpenses: number;
  totalCategories: number;
  normalCategories: number;
  calculatedCategories: number;
  entryCount: number;
  averageExpense: number;
  highest: { category: Category; total: number } | null;
  lowest: { category: Category; total: number } | null;
  currentMonthTotal: number;
  averageDaily: number;
  days: number;
}

export function summarize(categories: Category[], expensesInRange: ExpensePoint[], range: DateRange): Summary {
  const normal = categories.filter((c) => c.type === "NORMAL");
  const totals = baseTotals(expensesInRange);
  const total = totalOf(expensesInRange);
  const ranked = normal
    .map((c) => ({ category: c, total: totals.get(c.id) ?? 0 }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const now = new Date();
  const monthPrefix = toDateKey(now).slice(0, 7);
  const currentMonthTotal = totalOf(expensesInRange.filter((e) => e.expenseDate.startsWith(monthPrefix)));

  const bounds = effectiveBounds(range, expensesInRange);
  const days = bounds ? daysInRange(bounds.from, bounds.to) : 0;

  return {
    totalExpenses: total,
    totalCategories: categories.length,
    normalCategories: normal.length,
    calculatedCategories: categories.length - normal.length,
    entryCount: expensesInRange.length,
    averageExpense: expensesInRange.length ? Math.round((total / expensesInRange.length) * 100) / 100 : 0,
    highest: ranked[0] ?? null,
    lowest: ranked.length ? ranked[ranked.length - 1] : null,
    currentMonthTotal,
    averageDaily: days ? Math.round((total / days) * 100) / 100 : 0,
    days,
  };
}

/**
 * Concrete [from, to] for a range. Unbounded ends fall back to the data's
 * own min/max date (and "to" never goes past today for open ranges).
 */
export function effectiveBounds(range: DateRange, expenses: ExpensePoint[]): { from: string; to: string } | null {
  let from = range.from;
  let to = range.to;
  if (!from || !to) {
    if (!expenses.length) {
      if (from && !to) to = toDateKey(new Date());
      if (!from || !to) return null;
    } else {
      let min = expenses[0].expenseDate;
      let max = min;
      for (const e of expenses) {
        if (e.expenseDate < min) min = e.expenseDate;
        if (e.expenseDate > max) max = e.expenseDate;
      }
      from = from ?? min;
      to = to ?? max;
    }
  }
  if (from > to) return null;
  return { from, to };
}

export function bucketKey(dateKey: string, interval: Interval, weekStartsOn: 0 | 1 = 1): string {
  switch (interval) {
    case "day":
      return dateKey;
    case "week":
      return toDateKey(startOfWeek(parseISO(dateKey), { weekStartsOn }));
    case "month":
      return dateKey.slice(0, 7);
    case "year":
      return dateKey.slice(0, 4);
  }
}

export function bucketLabel(key: string, interval: Interval): string {
  switch (interval) {
    case "day":
      return format(parseISO(key), "dd MMM");
    case "week":
      return `Wk ${format(parseISO(key), "dd MMM")}`;
    case "month":
      return format(parseISO(`${key}-01`), "MMM yy");
    case "year":
      return key;
  }
}

/** Ordered list of bucket keys covering [from, to] (gaps included, so charts show zero days). */
export function bucketKeys(from: string, to: string, interval: Interval, weekStartsOn: 0 | 1 = 1): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  if (interval === "day" || interval === "week") {
    for (const d of eachDayKey(from, to)) {
      const k = bucketKey(d, interval, weekStartsOn);
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
    return keys;
  }
  if (interval === "month") {
    let [y, m] = from.slice(0, 7).split("-").map(Number);
    const [ey, em] = to.slice(0, 7).split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      keys.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return keys;
  }
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) keys.push(String(y));
  return keys;
}

/** Choose a sensible default interval for a span of days. */
export function autoInterval(days: number): Interval {
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  if (days <= 365 * 3) return "month";
  return "year";
}

export interface SeriesPoint {
  key: string;
  label: string;
  total: number;
  /** running total up to and including this bucket */
  cumulative: number;
  count: number;
}

export function timeSeries(
  expensesInRange: ExpensePoint[],
  range: DateRange,
  interval: Interval,
  weekStartsOn: 0 | 1 = 1,
): SeriesPoint[] {
  const bounds = effectiveBounds(range, expensesInRange);
  if (!bounds) return [];
  const keys = bucketKeys(bounds.from, bounds.to, interval, weekStartsOn);
  const minor = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const e of expensesInRange) {
    const k = bucketKey(e.expenseDate, interval, weekStartsOn);
    minor.set(k, (minor.get(k) ?? 0) + toMinor(e.amount));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let run = 0;
  return keys.map((k) => {
    const m = minor.get(k) ?? 0;
    run += m;
    return {
      key: k,
      label: bucketLabel(k, interval),
      total: fromMinor(m),
      cumulative: fromMinor(run),
      count: counts.get(k) ?? 0,
    };
  });
}

/** Per-bucket totals for each category: rows of { key, label, [categoryId]: amount }. */
export function categorySeries(
  categories: Category[],
  expensesInRange: ExpensePoint[],
  range: DateRange,
  interval: Interval,
  weekStartsOn: 0 | 1 = 1,
): Array<Record<string, number | string>> {
  const bounds = effectiveBounds(range, expensesInRange);
  if (!bounds) return [];
  const keys = bucketKeys(bounds.from, bounds.to, interval, weekStartsOn);
  const grouped = new Map<string, ExpensePoint[]>(keys.map((k) => [k, []]));
  for (const e of expensesInRange) grouped.get(bucketKey(e.expenseDate, interval, weekStartsOn))?.push(e);
  return keys.map((k) => {
    const values = categoryValues(categories, grouped.get(k) ?? []);
    const row: Record<string, number | string> = { key: k, label: bucketLabel(k, interval) };
    for (const c of categories) row[c.id] = values.get(c.id)?.value ?? 0;
    return row;
  });
}

export interface CalculatedPoint {
  key: string;
  label: string;
  value: number | null;
  error: string | null;
  cumulative: number | null;
}

/**
 * Historical values of one calculated category: the formula is evaluated
 * separately on every bucket's own totals (and on running totals for the
 * cumulative line), never by scaling an all-time number.
 */
export function calculatedHistory(
  categories: Category[],
  categoryId: string,
  expensesInRange: ExpensePoint[],
  range: DateRange,
  interval: Interval,
  weekStartsOn: 0 | 1 = 1,
): CalculatedPoint[] {
  const bounds = effectiveBounds(range, expensesInRange);
  if (!bounds) return [];
  const keys = bucketKeys(bounds.from, bounds.to, interval, weekStartsOn);
  const grouped = new Map<string, ExpensePoint[]>(keys.map((k) => [k, []]));
  for (const e of expensesInRange) grouped.get(bucketKey(e.expenseDate, interval, weekStartsOn))?.push(e);
  const nodes = toGraphNodes(categories);
  const running: ExpensePoint[] = [];
  return keys.map((k) => {
    const bucket = grouped.get(k) ?? [];
    running.push(...bucket);
    const v = resolveAll(nodes, baseTotals(bucket)).get(categoryId);
    const cum = resolveAll(nodes, baseTotals(running)).get(categoryId);
    return {
      key: k,
      label: bucketLabel(k, interval),
      value: v?.value ?? null,
      error: v?.error ?? null,
      cumulative: cum?.value ?? null,
    };
  });
}

export interface BreakdownRow {
  category: Category;
  value: number | null;
  error: string | null;
  /** share of the sum of referenced values (absolute), 0-100 */
  share: number;
}

/** Referenced categories of a calculated category with their period values. */
export function formulaBreakdown(
  categories: Category[],
  target: Category,
  expensesInRange: ExpensePoint[],
): { rows: BreakdownRow[]; result: CalcValue | undefined } {
  const values = categoryValues(categories, expensesInRange);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const refs = referencedCategoryIds(target.formula)
    .map((id) => byId.get(id))
    .filter((c): c is Category => !!c);
  const absSum = refs.reduce((s, c) => s + Math.abs(values.get(c.id)?.value ?? 0), 0);
  return {
    rows: refs.map((c) => {
      const v = values.get(c.id);
      return {
        category: c,
        value: v?.value ?? null,
        error: v?.error ?? null,
        share: absSum > 0 ? (Math.abs(v?.value ?? 0) / absSum) * 100 : 0,
      };
    }),
    result: values.get(target.id),
  };
}
