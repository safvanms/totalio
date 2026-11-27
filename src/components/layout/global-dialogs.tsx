"use client";

import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { QuickAddDialog } from "@/components/expenses/quick-add-dialog";
import { ExpenseDetailSheet } from "@/components/expenses/expense-detail-sheet";

export function GlobalDialogs() {
  return (
    <>
      <ExpenseFormDialog />
      <QuickAddDialog />
      <CategoryFormDialog />
      <ExpenseDetailSheet />
    </>
  );
}
