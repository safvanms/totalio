/** Excel + file I/O for Spendly data files (works in the browser and in Node for tests). */
import {
  CATEGORY_COLUMNS,
  EXPENSE_COLUMNS,
  SETTING_COLUMNS,
  backupToCsv,
  backupToRecords,
  importFromCsvText,
  importFromJson,
  recordsToBackup,
  splitTaggedRecords,
  tableToRecords,
  type Cell,
  type ImportResult,
} from "./data-file";
import type { Backup } from "./validation";

const HEADERS: Record<string, string> = {
  code: "Code",
  name: "Name",
  type: "Type",
  formula: "Formula",
  color: "Color",
  icon: "Icon",
  description: "Description",
  created_at: "Created At",
  id: "ID",
  date: "Date",
  category_code: "Category Code",
  category_name: "Category Name",
  particular: "Particular",
  amount: "Amount",
  notes: "Notes",
  key: "Key",
  value: "Value",
};

export async function backupToXlsx(b: Backup): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Spendly";
  const { categories, expenses, settings } = backupToRecords(b);
  const sheet = (name: string, cols: readonly string[], rows: Record<string, Cell>[], widths: Record<string, number> = {}) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: HEADERS[c] ?? c, key: c, width: widths[c] ?? Math.max(12, (HEADERS[c] ?? c).length + 4) }));
    rows.forEach((r) => ws.addRow(Object.fromEntries(cols.map((c) => [c, r[c] ?? ""]))));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    // Keep dates as text so Excel never reinterprets them.
    ["date", "created_at", "code", "category_code"].forEach((k) => {
      if (cols.includes(k)) ws.getColumn(k).numFmt = "@";
    });
    if (cols.includes("amount")) ws.getColumn("amount").numFmt = "0.00";
    return ws;
  };
  sheet("Expenses", EXPENSE_COLUMNS, expenses, { particular: 32, category_name: 22, description: 28, notes: 28, created_at: 26, id: 28 });
  sheet("Categories", CATEGORY_COLUMNS, categories, { name: 26, formula: 26, description: 32, created_at: 26, id: 28 });
  sheet("Settings", SETTING_COLUMNS, settings, { key: 16, value: 60 });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

function cellValue(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
  if (o.richText) return o.richText.map((t) => t.text).join("");
  if (o.result !== undefined) return cellValue(o.result);
  if (o.text !== undefined) return o.text;
  return String(v);
}

export async function importFromXlsx(data: ArrayBuffer, opts: { dateFormat?: string } = {}): Promise<ImportResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const table = (name: string): Cell[][] | null => {
    const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === name.toLowerCase());
    if (!ws) return null;
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = row.values as unknown[];
      rows.push(vals.slice(1).map(cellValue));
    });
    return rows;
  };
  const exp = table("Expenses");
  const cat = table("Categories");
  if (exp || cat) {
    return recordsToBackup(
      {
        expenses: exp ? tableToRecords(exp) : [],
        categories: cat ? tableToRecords(cat, ["name", "type"]) : [],
        settings: table("Settings") ? tableToRecords(table("Settings")!, ["key", "value"]) : [],
      },
      opts,
    );
  }
  // Any other workbook: use the first sheet as an expense list (or tagged table).
  const first = wb.worksheets[0];
  if (!first) throw new Error("The workbook is empty.");
  const records = tableToRecords(table(first.name) ?? []);
  if (!records.length) throw new Error("No data found. The sheet needs a header row with columns such as Particular and Amount.");
  return recordsToBackup(splitTaggedRecords(records), opts);
}

/* Browser helpers ---------------------------------------------------- */

export type DataFormat = "csv" | "xlsx" | "json";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadDataFile(format: DataFormat, b: Backup) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `spendly-data-${stamp}`;
  if (format === "json") return download(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }), `${name}.json`);
  if (format === "csv") return download(new Blob([backupToCsv(b)], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
  const buf = await backupToXlsx(b);
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
}

export const IMPORT_ACCEPT = ".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function readImportFile(file: File, opts: { dateFormat?: string } = {}): Promise<ImportResult> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (file.size > 50 * 1024 * 1024) throw new Error("The file is larger than 50 MB.");
  if (ext === "json") {
    try {
      return importFromJson(JSON.parse(await file.text()));
    } catch (e) {
      throw e instanceof SyntaxError ? new Error("The file is not valid JSON.") : e;
    }
  }
  if (ext === "csv" || ext === "txt") return importFromCsvText(await file.text(), opts);
  if (ext === "xlsx") return importFromXlsx(await file.arrayBuffer(), opts);
  if (ext === "pdf") throw new Error("PDF files are for reading and printing only and can't be imported. Use a CSV, Excel or JSON export.");
  if (ext === "xls") throw new Error("Old .xls files aren't supported. Re-save the file as .xlsx or .csv.");
  throw new Error("Unsupported file type. Choose a .csv, .xlsx or .json file.");
}
