"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Input } from "@/components/ui/primitives";
import { CategorySelect } from "@/components/shared/pickers";
import { useCategories, useCreateExpenses } from "@/hooks/use-data";
import { useFormat } from "@/hooks/use-settings";
import { errorMessage } from "@/lib/api-client";
import { todayKey } from "@/lib/dates";
import { sumMoney } from "@/lib/money";
import { cn, uid } from "@/lib/utils";
import { expenseInputSchema } from "@/lib/validation";
import { useDialogs } from "@/stores/dialog-store";

interface Row {
  key: string;
  particular: string;
  amount: string;
  expenseDate: string;
}
type RowErrors = Partial<Record<"particular" | "amount" | "expenseDate", string>>;

const blank = (date = todayKey()): Row => ({ key: uid("r"), particular: "", amount: "", expenseDate: date });

/**
 * Spreadsheet-like multi-row entry: type a particular, Tab to amount, Enter
 * adds the next row. All rows are validated and saved in one transaction.
 */
export function QuickAddDialog() {
  const { quickAdd, closeQuickAdd } = useDialogs();
  const { data: categories = [] } = useCategories();
  const normal = useMemo(() => categories.filter((c) => c.type === "NORMAL"), [categories]);
  const create = useCreateExpenses();
  const { currency, money } = useFormat();

  const [categoryId, setCategoryId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!quickAdd.open) return;
    setCategoryId(quickAdd.categoryId ?? normal[0]?.id ?? "");
    setRows([blank(), blank(), blank()]);
    setErrors({});
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAdd.open]);

  const filled = rows.filter((r) => r.particular.trim() || r.amount.trim());
  const total = sumMoney(filled.map((r) => Number(r.amount) || 0));

  const update = (key: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: {} }));
  };

  const addRow = (focus = true) => {
    const last = rows[rows.length - 1];
    const r = blank(last?.expenseDate);
    setRows((rs) => [...rs, r]);
    if (focus) setTimeout(() => document.getElementById(`qa-${r.key}-particular`)?.focus(), 0);
  };

  const removeRow = (key: string) => setRows((rs) => (rs.length === 1 ? [blank()] : rs.filter((r) => r.key !== key)));

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx === rows.length - 1) addRow();
      else document.getElementById(`qa-${rows[idx + 1].key}-particular`)?.focus();
    }
  };

  const save = async () => {
    setFormError(null);
    if (!categoryId) return setFormError("Choose a category for these expenses.");
    if (!filled.length) return setFormError("Fill in at least one row.");
    const nextErrors: Record<string, RowErrors> = {};
    const payload = [];
    for (const r of filled) {
      const parsed = expenseInputSchema.safeParse({ categoryId, particular: r.particular, amount: r.amount, expenseDate: r.expenseDate });
      if (!parsed.success) {
        const fe = parsed.error.flatten().fieldErrors;
        nextErrors[r.key] = { particular: fe.particular?.[0], amount: fe.amount?.[0], expenseDate: fe.expenseDate?.[0] };
      } else payload.push(parsed.data);
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return setFormError("Fix the highlighted rows.");
    try {
      await create.mutateAsync(payload);
      closeQuickAdd();
    } catch (e) {
      setFormError(errorMessage(e));
    }
  };

  return (
    <Dialog open={quickAdd.open} onOpenChange={(o) => !o && closeQuickAdd()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Quick add expenses
          </DialogTitle>
          <DialogDescription>Enter several expenses at once. Press Enter to jump to a new row.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 pb-4">
          <Field label="Category" required className="max-w-sm">
            <CategorySelect categories={normal} value={categoryId || null} onChange={setCategoryId} invalid={!categoryId && !!formError} />
          </Field>

          <div className="rounded-xl border">
            <div className="hidden grid-cols-[minmax(0,1fr)_9rem_10rem_2.5rem] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
              <span>Particular</span>
              <span>Amount</span>
              <span>Date</span>
              <span className="sr-only">Remove</span>
            </div>
            <ul className="divide-y">
              {rows.map((r, idx) => {
                const e = errors[r.key] ?? {};
                return (
                  <li key={r.key} className="grid grid-cols-2 gap-2 p-3 md:grid-cols-[minmax(0,1fr)_9rem_10rem_2.5rem] md:items-start md:py-2">
                    <div className="col-span-2 md:col-span-1">
                      <label className="sr-only" htmlFor={`qa-${r.key}-particular`}>
                        Particular
                      </label>
                      <Input
                        id={`qa-${r.key}-particular`}
                        placeholder={`Particular ${idx + 1}`}
                        value={r.particular}
                        maxLength={120}
                        aria-invalid={!!e.particular}
                        onChange={(ev) => update(r.key, { particular: ev.target.value })}
                        onKeyDown={(ev) => onKeyDown(ev, idx)}
                      />
                      {e.particular && <p className="mt-1 text-xs text-destructive">{e.particular}</p>}
                    </div>
                    <div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency.symbol}</span>
                        <Input
                          aria-label="Amount"
                          inputMode="decimal"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          className="tabular pl-9"
                          value={r.amount}
                          aria-invalid={!!e.amount}
                          onChange={(ev) => update(r.key, { amount: ev.target.value })}
                          onKeyDown={(ev) => onKeyDown(ev, idx)}
                        />
                      </div>
                      {e.amount && <p className="mt-1 text-xs text-destructive">{e.amount}</p>}
                    </div>
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <Input
                          aria-label="Date"
                          type="date"
                          value={r.expenseDate}
                          aria-invalid={!!e.expenseDate}
                          onChange={(ev) => update(r.key, { expenseDate: ev.target.value })}
                        />
                        {e.expenseDate && <p className="mt-1 text-xs text-destructive">{e.expenseDate}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive md:hidden" onClick={() => removeRow(r.key)} aria-label="Remove row">
                        <Trash2 />
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="hidden text-muted-foreground hover:text-destructive md:inline-flex" onClick={() => removeRow(r.key)} aria-label="Remove row">
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => addRow()}>
                <Plus /> Add row
              </Button>
              <p className="text-sm text-muted-foreground">
                {filled.length} {filled.length === 1 ? "entry" : "entries"} ·{" "}
                <span className="tabular font-semibold text-foreground">{money(total)}</span>
              </p>
            </div>
          </div>
          {formError && (
            <p role="alert" className={cn("rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive")}>
              {formError}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeQuickAdd}>
            Cancel
          </Button>
          <Button type="button" onClick={save} loading={create.isPending}>
            Save {filled.length > 0 ? filled.length : ""} {filled.length === 1 ? "expense" : "expenses"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
