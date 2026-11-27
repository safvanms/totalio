"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { CategorySelect } from "@/components/shared/pickers";
import { EmptyState } from "@/components/shared/common";
import { useCategories, useCreateExpenses, useUpdateExpense } from "@/hooks/use-data";
import { useFormat } from "@/hooks/use-settings";
import { errorMessage } from "@/lib/api-client";
import { todayKey } from "@/lib/dates";
import { expenseInputSchema, type ExpenseInput, type ExpenseValues } from "@/lib/validation";
import { useDialogs } from "@/stores/dialog-store";
import { Shapes } from "lucide-react";

export function MoneyInput({ currencySymbol, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { currencySymbol: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
      <Input inputMode="decimal" type="number" step="0.01" min="0" className="tabular pl-9" {...props} />
    </div>
  );
}

export function ExpenseFormDialog() {
  const { expense: state, closeExpense, openCategory } = useDialogs();
  const editing = state.expense ?? null;
  const { data: categories = [] } = useCategories();
  const normal = useMemo(() => categories.filter((c) => c.type === "NORMAL"), [categories]);
  const create = useCreateExpenses();
  const update = useUpdateExpense();
  const { currency } = useFormat();

  const form = useForm<ExpenseInput, unknown, ExpenseValues>({
    resolver: zodResolver(expenseInputSchema),
    defaultValues: { categoryId: "", particular: "", amount: "" as unknown as number, expenseDate: todayKey(), description: "", notes: "" },
  });

  useEffect(() => {
    if (!state.open) return;
    form.reset(
      editing
        ? {
            categoryId: editing.categoryId,
            particular: editing.particular,
            amount: editing.amount,
            expenseDate: editing.expenseDate,
            description: editing.description ?? "",
            notes: editing.notes ?? "",
          }
        : {
            categoryId: state.categoryId ?? (normal.length === 1 ? normal[0].id : ""),
            particular: "",
            amount: "" as unknown as number,
            expenseDate: todayKey(),
            description: "",
            notes: "",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, editing?.id]);

  const submit = (another: boolean) =>
    form.handleSubmit(async (v) => {
      try {
        if (editing) {
          await update.mutateAsync({ id: editing.id, input: v });
          closeExpense();
        } else {
          await create.mutateAsync([v]);
          if (another) {
            form.reset({ ...v, particular: "", amount: "" as unknown as number, description: "", notes: "" });
            setTimeout(() => form.setFocus("particular"), 0);
          } else closeExpense();
        }
      } catch (e) {
        form.setError("root", { message: errorMessage(e) });
      }
    });

  const err = form.formState.errors;

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && closeExpense()}>
      <DialogContent size="md">
        {normal.length === 0 && !editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Add expense</DialogTitle>
              <DialogDescription className="sr-only">No categories</DialogDescription>
            </DialogHeader>
            <EmptyState
              icon={Shapes}
              title="Create a category first"
              description="Expenses live inside normal categories such as Train Tickets or Food."
              action={
                <Button
                  onClick={() => {
                    closeExpense();
                    openCategory({ type: "NORMAL" });
                  }}
                >
                  Create category
                </Button>
              }
            />
          </>
        ) : (
          <form onSubmit={submit(false)} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
              <DialogDescription>{editing ? "Changes update every total, chart and formula instantly." : "Record a single expense entry."}</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-4 pb-5 sm:grid-cols-2 [&>*]:min-w-0">
              <Field label="Category" error={err.categoryId?.message} required className="sm:col-span-2">
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <CategorySelect categories={normal} value={field.value || null} onChange={field.onChange} invalid={!!err.categoryId} />
                  )}
                />
              </Field>
              <Field label="Particular" htmlFor="exp-particular" error={err.particular?.message} required className="sm:col-span-2">
                <Input
                  id="exp-particular"
                  placeholder="e.g. Train ticket to Kochi"
                  maxLength={120}
                  autoFocus={!editing}
                  aria-invalid={!!err.particular}
                  {...form.register("particular")}
                />
              </Field>
              <Field label="Amount" htmlFor="exp-amount" error={err.amount?.message} required>
                <MoneyInput id="exp-amount" currencySymbol={currency.symbol} placeholder="0.00" aria-invalid={!!err.amount} {...form.register("amount")} />
              </Field>
              <Field label="Date" htmlFor="exp-date" error={err.expenseDate?.message} required>
                <Input id="exp-date" type="date" aria-invalid={!!err.expenseDate} {...form.register("expenseDate")} />
              </Field>
              <Field label="Description" htmlFor="exp-desc" error={err.description?.message} className="sm:col-span-2">
                <Input id="exp-desc" placeholder="Optional" maxLength={500} {...form.register("description")} />
              </Field>
              <Field label="Notes" htmlFor="exp-notes" error={err.notes?.message} className="sm:col-span-2">
                <Textarea id="exp-notes" rows={2} placeholder="Optional" maxLength={1000} {...form.register("notes")} />
              </Field>
              {err.root && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:col-span-2">
                  {err.root.message}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeExpense}>
                Cancel
              </Button>
              {!editing && (
                <Button type="button" variant="secondary" onClick={submit(true)} disabled={form.formState.isSubmitting}>
                  Save & add another
                </Button>
              )}
              <Button type="submit" loading={form.formState.isSubmitting}>
                {editing ? "Save changes" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
