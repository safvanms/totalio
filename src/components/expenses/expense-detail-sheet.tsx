"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { Separator, Skeleton } from "@/components/ui/primitives";
import { CategoryLabel } from "@/components/shared/common";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCategories, useDeleteExpenses, useExpense } from "@/hooks/use-data";
import { useFormat } from "@/hooks/use-settings";
import { useDialogs } from "@/stores/dialog-store";

export function ExpenseDetailSheet() {
  const { expenseDetail, showExpense, openExpense } = useDialogs();
  const { data: expense, isLoading, error } = useExpense(expenseDetail.id);
  const { data: categories = [] } = useCategories();
  const del = useDeleteExpenses();
  const { money, date } = useFormat();
  const [confirm, setConfirm] = useState(false);
  const category = categories.find((c) => c.id === expense?.categoryId);

  return (
    <Sheet open={!!expenseDetail.id} onOpenChange={(o) => !o && showExpense(null)}>
      <SheetContent className="p-0">
        <div className="border-b px-5 pb-4 pt-5">
          <SheetTitle>Expense details</SheetTitle>
          <SheetDescription>View, edit or delete this entry.</SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-24" />
            </div>
          ) : error || !expense ? (
            <p className="text-sm text-muted-foreground">This expense could not be found. It may have been deleted.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="break-words text-lg font-semibold">{expense.particular}</p>
                <p className="tabular mt-1 break-all text-3xl font-semibold tracking-tight">{money(expense.amount)}</p>
              </div>
              <dl className="grid gap-4 text-sm">
                <div className="grid gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</dt>
                  <dd>
                    {category ? (
                      <Link href={`/categories/${category.id}`} className="inline-flex max-w-full rounded-lg hover:underline" onClick={() => showExpense(null)}>
                        <CategoryLabel category={category} showCode />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="grid gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</dt>
                  <dd className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    {date(expense.expenseDate)}
                  </dd>
                </div>
                <div className="grid gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</dt>
                  <dd className="whitespace-pre-wrap break-words text-foreground/90">{expense.description || <span className="text-muted-foreground">None</span>}</dd>
                </div>
                <div className="grid gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-wrap break-words text-foreground/90">{expense.notes || <span className="text-muted-foreground">None</span>}</dd>
                </div>
              </dl>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Created {new Date(expense.createdAt).toLocaleString()}
                {expense.updatedAt !== expense.createdAt && <> · Updated {new Date(expense.updatedAt).toLocaleString()}</>}
              </p>
            </div>
          )}
        </div>
        {expense && (
          <div className="safe-bottom flex gap-2 border-t bg-muted/30 p-4">
            <Button variant="outline" className="flex-1" onClick={() => setConfirm(true)}>
              <Trash2 /> Delete
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                showExpense(null);
                openExpense({ expense });
              }}
            >
              <Pencil /> Edit
            </Button>
          </div>
        )}
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Delete this expense?"
          description={`"${expense?.particular}" will be removed and all totals and formulas will update.`}
          loading={del.isPending}
          onConfirm={async () => {
            if (!expense) return;
            await del.mutateAsync([expense.id]);
            setConfirm(false);
            showExpense(null);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
