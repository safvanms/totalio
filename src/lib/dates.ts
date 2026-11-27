/**
 * Calendar-date helpers. Expense dates are pure calendar days, handled as
 * "YYYY-MM-DD" strings everywhere in the app and stored in the DB at UTC
 * midnight. This keeps range filtering and bucketing timezone-proof.
 */
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import type { DateRange, RangePreset } from "@/lib/types";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local Date -> YYYY-MM-DD */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD -> local Date at midnight */
export function fromDateKey(key: string): Date {
  return parseISO(key);
}

/** YYYY-MM-DD -> Date at UTC midnight (DB representation) */
export function dateKeyToUTC(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** DB Date (UTC midnight) -> YYYY-MM-DD */
export function utcToDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function isValidDateKey(key: string): boolean {
  if (!DATE_RE.test(key)) return false;
  const d = parseISO(key);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === key;
}

export function rangeForPreset(preset: RangePreset, weekStartsOn: 0 | 1 = 1, now = new Date()): DateRange {
  switch (preset) {
    case "today":
      return { from: toDateKey(now), to: toDateKey(now) };
    case "week":
      return {
        from: toDateKey(startOfWeek(now, { weekStartsOn })),
        to: toDateKey(endOfWeek(now, { weekStartsOn })),
      };
    case "month":
      return { from: toDateKey(startOfMonth(now)), to: toDateKey(endOfMonth(now)) };
    case "year":
      return { from: toDateKey(startOfYear(now)), to: toDateKey(endOfYear(now)) };
    default:
      return { from: null, to: null };
  }
}

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  all: "All Time",
  custom: "Custom Range",
};

export function inRange(dateKey: string, range: DateRange): boolean {
  if (range.from && dateKey < range.from) return false;
  if (range.to && dateKey > range.to) return false;
  return true;
}

export function formatDateKey(key: string, pattern = "dd MMM yyyy"): string {
  try {
    return format(parseISO(key), pattern);
  } catch {
    return key;
  }
}

export function describeRange(range: DateRange, pattern = "dd MMM yyyy"): string {
  if (!range.from && !range.to) return "All time";
  if (range.from && range.to && range.from === range.to) return formatDateKey(range.from, pattern);
  const a = range.from ? formatDateKey(range.from, pattern) : "Beginning";
  const b = range.to ? formatDateKey(range.to, pattern) : "Today";
  return `${a} – ${b}`;
}

/** Number of calendar days in range (inclusive). */
export function daysInRange(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
}

/** Each day key from..to inclusive (capped for safety). */
export function eachDayKey(from: string, to: string): string[] {
  const out: string[] = [];
  let d = parseISO(from);
  const end = parseISO(to);
  let guard = 0;
  while (d <= end && guard < 20000) {
    out.push(toDateKey(d));
    d = addDays(d, 1);
    guard++;
  }
  return out;
}

export const DATE_FORMATS = [
  { value: "dd MMM yyyy", example: "27 Nov 2026" },
  { value: "dd/MM/yyyy", example: "27/11/2026" },
  { value: "MM/dd/yyyy", example: "11/27/2026" },
  { value: "yyyy-MM-dd", example: "2026-11-27" },
  { value: "MMM d, yyyy", example: "Nov 27, 2026" },
];
