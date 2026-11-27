"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarRange,
  Calculator,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Layers,
  Receipt,
  Sheet,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { useDataAction } from "@/hooks/use-data";
import { useFormat } from "@/hooks/use-settings";
import { api, errorMessage } from "@/lib/api-client";
import { downloadDataFile, IMPORT_ACCEPT, readImportFile, type DataFormat } from "@/lib/data-file-io";
import { exportPDF, type ExportTable } from "@/lib/export";
import { formulaToString } from "@/lib/formula";
import type { FormulaToken } from "@/lib/formula/tokens";
import type { ImportResult } from "@/lib/data-file";
import { describeRange, formatDateKey } from "@/lib/dates";
import { cn, pluralize } from "@/lib/utils";
import type { Backup } from "@/lib/validation";

/* Export ---------------------------------------------------------------- */

function backupTables(b: Backup, dateFormat: string): ExportTable[] {
  const byId = new Map(b.categories.map((c) => [c.id, c]));
  return [
    {
      title: "Categories",
      columns: [
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        { key: "formula", header: "Formula" },
      ],
      rows: b.categories.map((c) => ({
        code: c.code,
        name: c.name,
        type: c.type === "CALCULATED" ? "Calculated" : "Normal",
        formula: c.formula ? formulaToString(c.formula as FormulaToken[], (id) => byId.get(id)?.code ?? "?") : "",
      })),
    },
    {
      title: "Expenses",
      columns: [
        { key: "date", header: "Date" },
        { key: "category", header: "Category" },
        { key: "particular", header: "Particular" },
        { key: "amount", header: "Amount", money: true },
      ],
      rows: b.expenses.map((e) => ({
        date: formatDateKey(e.expenseDate, dateFormat),
        category: byId.get(e.categoryId)?.name ?? "",
        particular: e.particular,
        amount: e.amount,
      })),
      footer: { date: "Total", amount: b.expenses.reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100 },
    },
  ];
}

/** Exports everything in a format that can be imported back exactly. */
export function DataExportMenu({ label = "Export data", variant = "outline", size = "sm" }: { label?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"] }) {
  const [busy, setBusy] = useState(false);
  const { money, dateFormat } = useFormat();

  const run = async (format: DataFormat | "pdf") => {
    setBusy(true);
    try {
      const backup = await api<Backup>("/api/backup");
      if (format === "pdf") {
        await exportPDF(backupTables(backup, dateFormat), `spendly-report-${new Date().toISOString().slice(0, 10)}`, (n) => money(n), "Spendly – all data");
      } else {
        await downloadDataFile(format, backup);
      }
      toast.success(`Exported ${pluralize(backup.categories.length, "category", "categories")} and ${pluralize(backup.expenses.length, "expense")}`);
    } catch (e) {
      toast.error(`Export failed: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} loading={busy}>
          {!busy && <Download />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Re-importable (everything)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run("csv")}>
          <FileText />
          <span className="flex flex-col">
            CSV (.csv)
            <span className="text-xs text-muted-foreground">Opens in Excel, Sheets, Numbers</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx")}>
          <FileSpreadsheet />
          <span className="flex flex-col">
            Excel (.xlsx)
            <span className="text-xs text-muted-foreground">Sheets for expenses, categories, settings</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("json")}>
          <FileJson />
          <span className="flex flex-col">
            JSON backup (.json)
            <span className="text-xs text-muted-foreground">Exact machine-readable copy</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>For reading & printing</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run("pdf")}>
          <Sheet /> PDF report (not importable)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Import ---------------------------------------------------------------- */

type Mode = "replace" | "merge";

export function ImportDataButton({ label = "Import data", variant = "outline", size = "sm" }: { label?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Upload /> {label}
      </Button>
      <ImportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { money, dateFormat } = useFormat();
  const action = useDataAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<Mode>("replace");

  const reset = () => {
    setFile(null);
    setResult(null);
    setReadError(null);
    setMode("replace");
  };

  const load = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setReadError(null);
    setReading(true);
    try {
      const r = await readImportFile(f, { dateFormat });
      setResult(r);
      setMode(r.kind === "expenses" ? "merge" : "replace");
    } catch (e) {
      setReadError(errorMessage(e));
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const confirm = async () => {
    if (!result) return;
    try {
      const r = await action.mutateAsync({ action: mode === "replace" ? "restore" : "merge", backup: result.backup });
      if (r.mode === "merge") {
        toast.success(
          `Imported ${pluralize(r.expenses ?? 0, "new expense")}` +
            (r.expensesSkipped ? `, skipped ${r.expensesSkipped} already present` : "") +
            (r.categoriesCreated ? `, added ${pluralize(r.categoriesCreated, "category", "categories")}` : ""),
        );
      } else {
        toast.success(`Restored ${pluralize(r.categories ?? 0, "category", "categories")} and ${pluralize(r.expenses ?? 0, "expense")}`);
      }
      onOpenChange(false);
      reset();
      router.push("/dashboard");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const s = result?.stats;
  const blocked = !result || result.errors.length > 0 || (result.stats.expenses === 0 && result.stats.categories === 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import data</DialogTitle>
          <DialogDescription>Restore a Spendly export (CSV, Excel or JSON), or add expenses from a spreadsheet. You&apos;ll see a preview before anything changes.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 pb-5">
          {!result && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                load(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                dragOver && "border-primary bg-primary/5",
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium">{reading ? `Reading ${file?.name}…` : "Drop a file here, or click to choose"}</span>
              <span className="text-xs text-muted-foreground">.csv · .xlsx · .json — up to 50 MB</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={(e) => load(e.target.files?.[0])} />

          {readError && (
            <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="font-medium text-destructive">Couldn&apos;t read {file?.name}</p>
                <p className="mt-0.5 text-muted-foreground">{readError}</p>
              </div>
            </div>
          )}

          {result && s && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                <p className="min-w-0 truncate text-sm font-medium" title={file?.name}>
                  {file?.name}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={result.kind === "full" ? "default" : "secondary"}>{result.kind === "full" ? "Spendly data file" : "Expense list"}</Badge>
                  <Button variant="ghost" size="xs" onClick={reset}>
                    Change file
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { icon: Layers, label: "Categories", value: s.categories.toLocaleString() },
                  { icon: Calculator, label: "Calculated", value: s.calculated.toLocaleString() },
                  { icon: Receipt, label: "Expenses", value: s.expenses.toLocaleString() },
                  { icon: Wallet, label: "Total amount", value: money(s.total) },
                  { icon: CalendarRange, label: "Date range", value: s.from ? describeRange({ from: s.from, to: s.to }, dateFormat) : "—", wide: true },
                ].map((x) => (
                  <div key={x.label} className={cn("min-w-0 rounded-xl border p-3", x.wide && "col-span-2 sm:col-span-2")}>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <x.icon className="h-3.5 w-3.5" /> {x.label}
                    </p>
                    <p className="tabular mt-1 truncate text-sm font-semibold" title={x.value}>
                      {x.value}
                    </p>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <XCircle className="h-4 w-4" /> Fix these problems in the file, then import again
                  </p>
                  <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-6 text-xs text-foreground/80">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
                  <ul className="space-y-1 text-xs text-foreground/80">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length === 0 && (
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Import mode">
                  {(
                    [
                      {
                        v: "replace" as const,
                        title: "Replace everything",
                        desc: "Restore exactly as exported. Your current categories and expenses are deleted first.",
                        disabled: result.kind !== "full",
                      },
                      {
                        v: "merge" as const,
                        title: "Merge with my data",
                        desc: "Keep current data, add what's new. Entries already present are skipped, so importing twice is safe.",
                        disabled: false,
                      },
                    ]
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      role="radio"
                      aria-checked={mode === o.v}
                      disabled={o.disabled}
                      onClick={() => setMode(o.v)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                        mode === o.v && "border-primary bg-primary/5 ring-1 ring-primary",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {mode === o.v ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <span className="h-4 w-4 rounded-full border" />}
                        {o.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{o.disabled ? "Only available for full Spendly data files." : o.desc}</span>
                    </button>
                  ))}
                </div>
              )}
              {mode === "replace" && result.errors.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Tip: export your current data first if you might want it back.{s.hasSettings ? " Currency, date format and dashboard preferences from the file will be applied." : ""}
                </p>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={mode === "replace" ? "destructive" : "default"} onClick={confirm} disabled={blocked} loading={action.isPending}>
            {mode === "replace" ? "Replace & restore" : "Merge into my data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
