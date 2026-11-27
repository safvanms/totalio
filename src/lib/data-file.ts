/**
 * Totalio data files: a portable, re-importable representation of all data.
 *
 *  - CSV  : one table, every row tagged with `record_type`
 *           (META / SETTING / CATEGORY / EXPENSE). Opens fine in Excel.
 *  - XLSX : sheets "Categories", "Expenses", "Settings" with the same columns.
 *  - JSON : the backup object as-is.
 *
 * Importing also accepts "report" exports (e.g. Expense history CSV/Excel):
 * any table with Particular + Amount columns is read as expenses only.
 *
 * Formulas are written as readable code text ("(C1 + C2) * 2") and parsed
 * back with the safe tokenizer, so a file can even be edited by hand.
 */
import { isValid, parse as parseDate } from "date-fns";
import { DATE_FORMATS, isValidDateKey, toDateKey } from "@/lib/dates";
import { formulaToString, parseFormula, tokenizeText } from "@/lib/formula";
import type { FormulaToken } from "@/lib/formula/tokens";
import { CATEGORY_COLORS, ICON_NAMES } from "@/lib/constants";
import { MAX_AMOUNT } from "@/lib/money";
import type { Backup } from "@/lib/validation";

export const DATA_FILE_VERSION = 1;

/** Files exported before the rename to Totalio say "spendly"; both are accepted. */
export const isAppMarker = (v: unknown) => v === "totalio" || v === "spendly";

export type Cell = string | number | boolean | Date | null | undefined;
export type RecordRow = Record<string, Cell>;

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

export const CATEGORY_COLUMNS = ["code", "name", "type", "formula", "color", "icon", "description", "created_at", "id"] as const;
export const EXPENSE_COLUMNS = ["date", "category_code", "category_name", "particular", "amount", "description", "notes", "created_at", "id"] as const;
export const SETTING_COLUMNS = ["key", "value"] as const;
export const CSV_COLUMNS = [
  "record_type",
  ...new Set<string>([...CATEGORY_COLUMNS, ...EXPENSE_COLUMNS, ...SETTING_COLUMNS]),
] as string[];

/* ------------------------------------------------------------------ */
/* Backup -> rows                                                      */
/* ------------------------------------------------------------------ */

export function backupToRecords(b: Backup) {
  const byId = new Map(b.categories.map((c) => [c.id, c]));
  const categories: RecordRow[] = b.categories.map((c) => ({
    code: c.code,
    name: c.name,
    type: c.type,
    formula: c.type === "CALCULATED" && c.formula ? formulaToString(c.formula as FormulaToken[], (id) => byId.get(id)?.code ?? "?") : "",
    color: c.color,
    icon: c.icon,
    description: c.description ?? "",
    created_at: c.createdAt ?? "",
    id: c.id,
  }));
  const expenses: RecordRow[] = b.expenses.map((e) => ({
    date: e.expenseDate,
    category_code: byId.get(e.categoryId)?.code ?? "",
    category_name: byId.get(e.categoryId)?.name ?? "",
    particular: e.particular,
    amount: e.amount,
    description: e.description ?? "",
    notes: e.notes ?? "",
    created_at: e.createdAt ?? "",
    id: e.id ?? "",
  }));
  const settings: RecordRow[] = [
    { key: "app", value: "totalio" },
    { key: "version", value: String(DATA_FILE_VERSION) },
    { key: "exported_at", value: b.exportedAt },
  ];
  if (b.settings) {
    if (b.settings.currency) settings.push({ key: "currency", value: b.settings.currency });
    if (b.settings.dateFormat) settings.push({ key: "date_format", value: b.settings.dateFormat });
    if (b.settings.dashboard) settings.push({ key: "dashboard", value: JSON.stringify(b.settings.dashboard) });
  }
  return { categories, expenses, settings };
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Guard against spreadsheet formula injection; the importer strips this prefix again.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function backupToCsv(b: Backup): string {
  const { categories, expenses, settings } = backupToRecords(b);
  const lines = [CSV_COLUMNS.join(",")];
  const push = (type: string, r: RecordRow) => lines.push(CSV_COLUMNS.map((c) => (c === "record_type" ? type : csvCell(r[c]))).join(","));
  settings.forEach((r) => push(r.key === "app" || r.key === "version" || r.key === "exported_at" ? "META" : "SETTING", r));
  categories.forEach((r) => push("CATEGORY", r));
  expenses.forEach((r) => push("EXPENSE", r));
  return "﻿" + lines.join("\r\n");
}

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF/LF, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  // Detect delimiter from the first line (Excel in some locales saves with ';').
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ------------------------------------------------------------------ */
/* Rows -> Backup                                                      */
/* ------------------------------------------------------------------ */

const normKey = (h: string) =>
  h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** Turn a 2-D table into keyed records, finding the header row automatically. */
export function tableToRecords(table: Cell[][], mustHave: string[] = ["particular", "amount"]): RecordRow[] {
  const isHeader = (r: Cell[]) => {
    const keys = r.map((c) => normKey(String(c ?? "")));
    return keys.includes("record_type") || mustHave.every((k) => keys.includes(k)) || (keys.includes("key") && keys.includes("value"));
  };
  const hi = table.findIndex(isHeader);
  if (hi < 0) return [];
  const header = table[hi].map((c) => normKey(String(c ?? "")));
  return table.slice(hi + 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

export function cleanText(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

export function parseAmount(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = cleanText(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  // "1.234,56" (EU) vs "1,234.56"
  const normalized = /,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function parseDateCell(v: Cell, preferredFormat?: string): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(EXCEL_EPOCH + v * 86400000).toISOString().slice(0, 10);
  const s = cleanText(v);
  if (!s) return null;
  if (isValidDateKey(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return isValidDateKey(s.slice(0, 10)) ? s.slice(0, 10) : null;
  const formats = [preferredFormat, ...DATE_FORMATS.map((f) => f.value), "d MMM yyyy", "d/M/yyyy", "M/d/yyyy", "dd-MM-yyyy", "d MMMM yyyy", "MMMM d, yyyy"].filter(
    (f): f is string => !!f,
  );
  for (const f of formats) {
    const d = parseDate(s, f, new Date(2000, 0, 1));
    if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2200) return toDateKey(d);
  }
  return null;
}

export interface ImportResult {
  /** "full": complete Totalio data file. "expenses": a report/expense list (merge only). */
  kind: "full" | "expenses";
  backup: Backup;
  errors: string[];
  warnings: string[];
  stats: {
    categories: number;
    calculated: number;
    expenses: number;
    total: number;
    from: string | null;
    to: string | null;
    hasSettings: boolean;
  };
}

const MAX_ERRORS = 25;

function statsOf(b: Backup): ImportResult["stats"] {
  let minor = 0;
  let from: string | null = null;
  let to: string | null = null;
  for (const e of b.expenses) {
    minor += Math.round(e.amount * 100);
    if (!from || e.expenseDate < from) from = e.expenseDate;
    if (!to || e.expenseDate > to) to = e.expenseDate;
  }
  return {
    categories: b.categories.length,
    calculated: b.categories.filter((c) => c.type === "CALCULATED").length,
    expenses: b.expenses.length,
    total: minor / 100,
    from,
    to,
    hasSettings: !!b.settings?.currency,
  };
}

/**
 * Build a Backup from tagged records. Records carry `record_type`
 * (CSV) or are passed per sheet (XLSX).
 */
export function recordsToBackup(
  input: { categories: RecordRow[]; expenses: RecordRow[]; settings: RecordRow[] },
  opts: { dateFormat?: string } = {},
): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.length < MAX_ERRORS && errors.push(m);

  // Settings / meta
  const kv = new Map(input.settings.map((r) => [cleanText(r.key).toLowerCase(), cleanText(r.value)]));
  let settings: Backup["settings"];
  if (kv.get("currency") || kv.get("date_format") || kv.get("dashboard")) {
    let dashboard: unknown;
    try {
      dashboard = kv.get("dashboard") ? JSON.parse(kv.get("dashboard")!) : undefined;
    } catch {
      warnings.push("Dashboard preferences in the file are unreadable and were skipped.");
    }
    settings = {
      currency: kv.get("currency") || undefined,
      dateFormat: kv.get("date_format") || undefined,
      dashboard: dashboard as never,
    };
  }

  // Categories
  const categories: Backup["categories"] = [];
  const codeToId = new Map<string, string>();
  const nameToId = new Map<string, string>();
  const pendingFormulas: { idx: number; text: string; name: string; row: number }[] = [];
  const usedColors: string[] = [];
  input.categories.forEach((r, i) => {
    const row = i + 1;
    const name = cleanText(r.name);
    if (!name) return err(`Categories row ${row}: name is missing.`);
    if (name.length > 60) return err(`Categories row ${row}: "${name.slice(0, 20)}…" is longer than 60 characters.`);
    const code = (cleanText(r.code) || `C${categories.length + 1}`).toUpperCase();
    if (codeToId.has(code)) return err(`Categories row ${row}: code ${code} is used more than once.`);
    if (nameToId.has(name.toLowerCase())) return err(`Categories row ${row}: the name "${name}" is used more than once.`);
    const id = cleanText(r.id) || `imp_${code.toLowerCase()}_${i}`;
    const typeRaw = cleanText(r.type).toUpperCase();
    const type = typeRaw.startsWith("CALC") ? "CALCULATED" : "NORMAL";
    let color = cleanText(r.color);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      color = CATEGORY_COLORS.find((c) => !usedColors.includes(c)) ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length];
      if (cleanText(r.color)) warnings.push(`Category "${name}": colour "${cleanText(r.color)}" is not valid; a default colour was used.`);
    }
    usedColors.push(color);
    let icon = cleanText(r.icon);
    if (!ICON_NAMES.includes(icon)) icon = type === "CALCULATED" ? "calculator" : "tag";
    const created = cleanText(r.created_at);
    codeToId.set(code, id);
    nameToId.set(name.toLowerCase(), id);
    categories.push({
      id,
      code,
      name,
      description: cleanText(r.description) || null,
      color,
      icon,
      type,
      formula: null,
      createdAt: created && !isNaN(Date.parse(created)) ? new Date(created).toISOString() : undefined,
    });
    if (type === "CALCULATED") {
      const text = cleanText(r.formula);
      if (text) pendingFormulas.push({ idx: categories.length - 1, text, name, row });
      else warnings.push(`Calculated category "${name}" has no formula; you can build one after importing.`);
    }
  });

  for (const f of pendingFormulas) {
    try {
      const tokens = tokenizeText(f.text, (code) => codeToId.get(code));
      const p = parseFormula(tokens);
      if (!p.ok) err(`Category "${f.name}": formula "${f.text}" is invalid. ${p.error.message}`);
      else categories[f.idx].formula = tokens;
    } catch (e) {
      err(`Category "${f.name}": formula "${f.text}" could not be read. ${(e as Error).message}`);
    }
  }

  // Expenses
  const expenses: Backup["expenses"] = [];
  const calcIds = new Set(categories.filter((c) => c.type === "CALCULATED").map((c) => c.id));
  input.expenses.forEach((r, i) => {
    const row = i + 1;
    const particular = cleanText(r.particular);
    const amountCell = r.amount;
    // Skip totals/blank rows coming from report exports.
    if (!particular && (amountCell === "" || amountCell === null || amountCell === undefined || /total/i.test(cleanText(r.date)))) return;
    if (!particular) return err(`Expenses row ${row}: particular is missing.`);
    const amount = parseAmount(amountCell);
    if (amount === null) return err(`Expenses row ${row} ("${particular}"): amount "${cleanText(amountCell)}" is not a number.`);
    if (amount <= 0 || amount > MAX_AMOUNT) return err(`Expenses row ${row} ("${particular}"): amount must be greater than 0.`);
    const date = parseDateCell(r.date ?? r.expense_date, opts.dateFormat);
    if (!date) return err(`Expenses row ${row} ("${particular}"): date "${cleanText(r.date ?? r.expense_date)}" is not a valid date.`);
    const code = cleanText(r.category_code ?? r.code).toUpperCase();
    const cname = cleanText(r.category_name ?? r.category);
    let categoryId = (code && codeToId.get(code)) || (cname && nameToId.get(cname.toLowerCase())) || "";
    if (!categoryId) {
      if (!cname && !code) return err(`Expenses row ${row} ("${particular}"): category is missing.`);
      // Category not described in the file: create a normal one for it.
      const newCode = code && !codeToId.has(code) ? code : `C${categories.length + 1}`;
      const name = cname || code;
      categoryId = `imp_new_${categories.length}`;
      const color = CATEGORY_COLORS.find((c) => !usedColors.includes(c)) ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
      usedColors.push(color);
      categories.push({ id: categoryId, code: newCode, name, description: null, color, icon: "tag", type: "NORMAL", formula: null });
      codeToId.set(newCode, categoryId);
      nameToId.set(name.toLowerCase(), categoryId);
    }
    if (calcIds.has(categoryId)) return err(`Expenses row ${row} ("${particular}"): it belongs to a calculated category, which can't hold expenses.`);
    const created = cleanText(r.created_at);
    expenses.push({
      id: cleanText(r.id) || undefined,
      categoryId,
      particular: particular.slice(0, 120),
      amount: Math.round(amount * 100) / 100,
      expenseDate: date,
      description: cleanText(r.description) || null,
      notes: cleanText(r.notes) || null,
      createdAt: created && !isNaN(Date.parse(created)) ? new Date(created).toISOString() : undefined,
    });
  });
  if (errors.length === MAX_ERRORS) errors.push("…more problems not shown.");

  const backup: Backup = {
    app: "totalio",
    version: DATA_FILE_VERSION,
    exportedAt: kv.get("exported_at") || new Date().toISOString(),
    settings: settings as Backup["settings"],
    categories,
    expenses,
  };
  const kind = input.categories.length || isAppMarker(kv.get("app")) ? "full" : "expenses";
  if (kind === "expenses") {
    warnings.unshift("This file only lists expenses. They can be merged into your data; categories are matched by name and created if missing.");
  }
  return { kind, backup, errors, warnings, stats: statsOf(backup) };
}

/** Records from a single CSV/sheet: either a tagged Totalio table or a plain expense list. */
export function splitTaggedRecords(records: RecordRow[]) {
  const tagged = records.length > 0 && "record_type" in records[0];
  if (!tagged) return { categories: [], expenses: records, settings: [] };
  const by = (t: string) => records.filter((r) => cleanText(r.record_type).toUpperCase() === t);
  return { categories: by("CATEGORY"), expenses: by("EXPENSE"), settings: [...by("META"), ...by("SETTING")] };
}

export function importFromCsvText(text: string, opts: { dateFormat?: string } = {}): ImportResult {
  const records = tableToRecords(parseCsv(text));
  if (!records.length) throw new Error("No data found. The file needs a header row with columns such as Particular and Amount.");
  return recordsToBackup(splitTaggedRecords(records), opts);
}

export function importFromJson(data: unknown): ImportResult {
  const b = data as Backup;
  if (!b || !isAppMarker(b.app) || !Array.isArray(b.categories) || !Array.isArray(b.expenses)) {
    throw new Error("This JSON file is not a Totalio backup.");
  }
  return { kind: "full", backup: b, errors: [], warnings: [], stats: statsOf(b) };
}
