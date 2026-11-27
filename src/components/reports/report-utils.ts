import { addDays, parseISO } from "date-fns";
import { daysInRange, toDateKey } from "@/lib/dates";
import type { DateRange } from "@/lib/types";

/** The period of equal length immediately before `range`; null for open-ended ranges. */
export function previousPeriod(range: DateRange): { from: string; to: string } | null {
  if (!range.from || !range.to) return null;
  const len = daysInRange(range.from, range.to);
  const to = addDays(parseISO(range.from), -1);
  const from = addDays(to, -(len - 1));
  return { from: toDateKey(from), to: toDateKey(to) };
}

/** Percentage change from `prev` to `cur`; null when undefined (prev = 0). */
export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function fmtPct(p: number | null, digits = 1): string {
  if (p === null) return "New";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(digits)}%`;
}
