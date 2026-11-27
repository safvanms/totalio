import { describe, expect, it } from "vitest";
import { backupToCsv, importFromCsvText, importFromJson, parseCsv, parseDateCell, parseAmount } from "./data-file";
import { backupToXlsx, importFromXlsx } from "./data-file-io";
import type { Backup } from "./validation";

const backup: Backup = {
  app: "totalio",
  version: 1,
  exportedAt: "2026-11-27T10:00:00.000Z",
  settings: {
    currency: "USD",
    dateFormat: "dd/MM/yyyy",
    dashboard: {
      defaultRange: "year",
      weekStartsOn: 0,
      showCalculatedOnDashboard: false,
      visibleCharts: { donut: true, monthly: false, trend: true, top: true, cumulative: false },
    },
  },
  categories: [
    { id: "c1", code: "C1", name: "Train Tickets", description: "Trains, \"express\" & local", color: "#257de0", icon: "train", type: "NORMAL", formula: null, createdAt: "2025-01-01T00:00:00.000Z" },
    { id: "c2", code: "C2", name: "Bus, City", description: null, color: "#f47230", icon: "bus", type: "NORMAL", formula: null, createdAt: "2025-01-02T00:00:00.000Z" },
    {
      id: "c3",
      code: "C3",
      name: "Tickets x2",
      description: "Line one\nline two",
      color: "#ec4647",
      icon: "ticket",
      type: "CALCULATED",
      formula: [
        { id: "a", kind: "lparen" },
        { id: "b", kind: "category", categoryId: "c1" },
        { id: "c", kind: "operator", op: "+" },
        { id: "d", kind: "category", categoryId: "c2" },
        { id: "e", kind: "rparen" },
        { id: "f", kind: "operator", op: "*" },
        { id: "g", kind: "number", value: 2.5 },
      ],
      createdAt: "2025-01-03T00:00:00.000Z",
    },
  ],
  expenses: [
    { id: "e1", categoryId: "c1", particular: "Train ticket to Kochi", amount: 450, expenseDate: "2026-11-20", description: null, notes: null, createdAt: "2026-11-20T08:00:00.000Z" },
    { id: "e2", categoryId: "c1", particular: "=SUM(A1) tricky, \"quoted\"", amount: 0.1, expenseDate: "2026-02-28", description: "multi\nline", notes: "-note", createdAt: "2026-02-28T08:00:00.000Z" },
    { id: "e3", categoryId: "c2", particular: "Return", amount: 1234567.89, expenseDate: "2024-02-29", description: null, notes: null, createdAt: "2024-02-29T08:00:00.000Z" },
  ],
};

/** Normalise for comparison: formula token ids are regenerated on import. */
function shape(b: Backup) {
  return {
    settings: b.settings,
    categories: b.categories.map((c) => ({
      ...c,
      formula: c.formula?.map((t) => ({ ...t, id: "_" })) ?? null,
    })),
    expenses: b.expenses,
  };
}

describe("CSV round trip", () => {
  it("restores everything exactly", () => {
    const r = importFromCsvText(backupToCsv(backup));
    expect(r.errors).toEqual([]);
    expect(r.kind).toBe("full");
    expect(shape(r.backup)).toEqual(shape(backup));
    expect(r.stats.total).toBe(1235017.99); // 450 + 0.10 + 1,234,567.89, exact
  });
});

describe("Excel round trip", () => {
  it("restores everything exactly", async () => {
    const buf = await backupToXlsx(backup);
    const r = await importFromXlsx(buf);
    expect(r.errors).toEqual([]);
    expect(shape(r.backup)).toEqual(shape(backup));
  }, 20_000); // loads exceljs; can be slow on a busy machine
});

describe("JSON", () => {
  it("accepts a backup and rejects other JSON", () => {
    expect(importFromJson(JSON.parse(JSON.stringify(backup))).stats.expenses).toBe(3);
    expect(() => importFromJson({ foo: 1 })).toThrow(/not a Totalio backup/);
  });
});

describe("files exported before the rename (app = spendly)", () => {
  it("still import as full data files (JSON and CSV)", () => {
    const legacy = { ...backup, app: "spendly" as const };
    expect(importFromJson(JSON.parse(JSON.stringify(legacy))).kind).toBe("full");
    const csv = backupToCsv(backup).replace(",app,totalio", ",app,spendly");
    expect(csv).toContain("app,spendly");
    const r = importFromCsvText(csv);
    expect(r.errors).toEqual([]);
    expect(r.kind).toBe("full");
  });
});

describe("expense lists from other tools / report exports", () => {
  it("reads a report CSV with title rows, formatted dates and a totals row", () => {
    const csv = [
      "Expense history",
      "3 entries",
      "Date,Code,Category,Particular,Amount,Description,Notes",
      "27 Nov 2026,C1,Train Tickets,Express ticket,650,,",
      '27/11/2026,,Food,"Lunch, team","1,250.50",,',
      "2026-11-01,,Food,Coffee,₹80,,",
      "Total,,,,1980.5,,",
    ].join("\n");
    const r = importFromCsvText(csv);
    expect(r.errors).toEqual([]);
    expect(r.kind).toBe("expenses");
    expect(r.backup.expenses.map((e) => [e.expenseDate, e.amount])).toEqual([
      ["2026-11-27", 650],
      ["2026-11-27", 1250.5],
      ["2026-11-01", 80],
    ]);
    expect(r.backup.categories.map((c) => c.name).sort()).toEqual(["Food", "Train Tickets"]);
  });

  it("handles semicolon-delimited CSV (European Excel)", () => {
    const r = importFromCsvText("Date;Category;Particular;Amount\n2026-03-01;Food;Bread;2,50\n");
    expect(r.backup.expenses[0].amount).toBe(2.5);
  });

  it("reports row-level problems", () => {
    const r = importFromCsvText("Date,Category,Particular,Amount\nnot a date,Food,Bread,2\n2026-01-01,Food,Milk,-3\n2026-01-01,,Eggs,3\n");
    expect(r.errors).toHaveLength(3);
    expect(r.errors[0]).toMatch(/row 1.*date/);
    expect(r.errors[1]).toMatch(/row 2.*greater than 0/);
    expect(r.errors[2]).toMatch(/row 3.*category/);
  });

  it("reports invalid formulas in hand-edited files", () => {
    const csv = backupToCsv(backup).replace("(C1 + C2) * 2.5", "C1 + C9");
    const r = importFromCsvText(csv);
    expect(r.errors.join(" ")).toMatch(/Tickets x2.*C9/);
  });
});

describe("cell parsing", () => {
  it("parses CSV edge cases", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,"2\n3",4')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["1", "2\n3", "4"],
    ]);
  });
  it("parses dates in many shapes", () => {
    expect(parseDateCell("2026-11-27")).toBe("2026-11-27");
    expect(parseDateCell("27 Nov 2026")).toBe("2026-11-27");
    expect(parseDateCell("11/27/2026")).toBe("2026-11-27");
    expect(parseDateCell(46353)).toBe("2026-11-27"); // Excel serial
    expect(parseDateCell(new Date("2026-11-27T00:00:00Z"))).toBe("2026-11-27");
    expect(parseDateCell("2026-02-30")).toBeNull();
  });
  it("parses amounts with symbols and separators", () => {
    expect(parseAmount("₹1,23,456.70")).toBe(123456.7);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("abc")).toBeNull();
  });
});
