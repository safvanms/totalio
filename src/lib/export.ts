"use client";

/**
 * Client-side report export. A report is a list of tables; CSV joins them
 * with blank lines, Excel puts each table on its own sheet, PDF renders each
 * as an auto-paginated table. Heavy libraries are loaded on demand.
 */

export interface ExportColumn {
  key: string;
  header: string;
  /** numeric money column: right-aligned, 2-decimal number format */
  money?: boolean;
  /** numeric non-money column */
  numeric?: boolean;
}

export interface ExportTable {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number | null>[];
  /** optional totals row */
  footer?: Record<string, string | number | null>;
}

export type ExportFormat = "csv" | "xlsx" | "pdf";

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

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Neutralise spreadsheet formula injection, then quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function moneyNum(v: unknown): number | string {
  return typeof v === "number" ? Math.round(v * 100) / 100 : (v as string) ?? "";
}

export function toCSV(tables: ExportTable[]): string {
  const parts: string[] = [];
  for (const t of tables) {
    const lines: string[] = [];
    if (tables.length > 1 || t.subtitle) lines.push(csvCell(t.title));
    if (t.subtitle) lines.push(csvCell(t.subtitle));
    lines.push(t.columns.map((c) => csvCell(c.header)).join(","));
    for (const r of [...t.rows, ...(t.footer ? [t.footer] : [])]) {
      lines.push(t.columns.map((c) => csvCell(c.money ? (moneyNum(r[c.key]) as number) : r[c.key])).join(","));
    }
    parts.push(lines.join("\r\n"));
  }
  return parts.join("\r\n\r\n");
}

export function exportCSV(tables: ExportTable[], filename: string) {
  download(new Blob(["﻿" + toCSV(tables)], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export async function exportExcel(tables: ExportTable[], filename: string, currencySymbol = "") {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Spendly";
  wb.created = new Date();
  const used = new Set<string>();
  for (const t of tables) {
    let name = t.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
    let n = 2;
    while (used.has(name)) name = `${name.slice(0, 25)} ${n++}`;
    used.add(name);
    const ws = wb.addWorksheet(name);
    let rowIdx = 1;
    ws.getCell(rowIdx, 1).value = t.title;
    ws.getCell(rowIdx, 1).font = { bold: true, size: 14 };
    rowIdx++;
    if (t.subtitle) {
      ws.getCell(rowIdx, 1).value = t.subtitle;
      ws.getCell(rowIdx, 1).font = { color: { argb: "FF666666" } };
      rowIdx++;
    }
    rowIdx++;
    const header = ws.getRow(rowIdx);
    t.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.alignment = { horizontal: c.money || c.numeric ? "right" : "left" };
    });
    rowIdx++;
    const fmt = `"${currencySymbol}"#,##0.00`;
    const write = (r: Record<string, string | number | null>, bold = false) => {
      const row = ws.getRow(rowIdx++);
      t.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        const v = r[c.key];
        cell.value = v === null || v === undefined ? "" : v;
        if (c.money && typeof v === "number") cell.numFmt = fmt;
        if (bold) cell.font = { bold: true };
      });
    };
    t.rows.forEach((r) => write(r));
    if (t.footer) write(t.footer, true);
    t.columns.forEach((c, i) => {
      const len = Math.max(c.header.length, ...t.rows.slice(0, 500).map((r) => String(r[c.key] ?? "").length));
      ws.getColumn(i + 1).width = Math.min(Math.max(len + 4, c.money ? 14 : 10), 48);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
}

export async function exportPDF(tables: ExportTable[], filename: string, formatMoney: (n: number) => string, heading = "Spendly report") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: tables.some((t) => t.columns.length > 5) ? "landscape" : "portrait", unit: "pt" });
  const pageW = doc.internal.pageSize.getWidth();
  // Built-in PDF fonts can't render some currency glyphs (e.g. ₹); use the ISO-safe fallback.
  const safe = (s: string) => s.replace(/₹/g, "Rs.").replace(/[^\x00-\xFF]/g, "");

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(safe(heading), 40, 34);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - 40, 34, { align: "right" });
  doc.setTextColor(30, 30, 40);

  let y = 84;
  for (const t of tables) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 48;
    }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(safe(t.title), 40, y);
    doc.setFont("helvetica", "normal");
    if (t.subtitle) {
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 120);
      doc.text(safe(t.subtitle), 40, y + 14);
      doc.setTextColor(30, 30, 40);
    }
    const cell = (c: ExportColumn, v: string | number | null | undefined) =>
      v === null || v === undefined ? "" : c.money && typeof v === "number" ? safe(formatMoney(v)) : safe(String(v));
    autoTable(doc, {
      startY: y + (t.subtitle ? 22 : 10),
      head: [t.columns.map((c) => safe(c.header))],
      body: t.rows.map((r) => t.columns.map((c) => cell(c, r[c.key]))),
      foot: t.footer ? [t.columns.map((c) => cell(c, t.footer![c.key]))] : undefined,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      footStyles: { fillColor: [238, 240, 250], textColor: [20, 20, 30], fontStyle: "bold" },
      columnStyles: Object.fromEntries(t.columns.map((c, i) => [i, { halign: c.money || c.numeric ? "right" : "left" }])),
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 32;
  }
  doc.save(`${filename}.pdf`);
}

export async function runExport(
  format: ExportFormat,
  tables: ExportTable[],
  filename: string,
  opts: { formatMoney: (n: number) => string; currencySymbol: string; heading?: string },
) {
  if (format === "csv") return exportCSV(tables, filename);
  if (format === "xlsx") return exportExcel(tables, filename, opts.currencySymbol);
  return exportPDF(tables, filename, opts.formatMoney, opts.heading);
}

export function downloadJSON(data: unknown, filename: string) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}
