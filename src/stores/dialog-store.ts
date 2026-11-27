"use client";

import { create } from "zustand";
import type { Category, Expense } from "@/lib/types";

/** Global dialogs that can be opened from anywhere (top bar, tables, cards). */
interface DialogState {
  expense: { open: boolean; expense?: Expense | null; categoryId?: string | null };
  quickAdd: { open: boolean; categoryId?: string | null };
  category: { open: boolean; category?: Category | null; type?: "NORMAL" | "CALCULATED" };
  expenseDetail: { id: string | null };
  openExpense: (opts?: { expense?: Expense | null; categoryId?: string | null }) => void;
  closeExpense: () => void;
  openQuickAdd: (categoryId?: string | null) => void;
  closeQuickAdd: () => void;
  openCategory: (opts?: { category?: Category | null; type?: "NORMAL" | "CALCULATED" }) => void;
  closeCategory: () => void;
  showExpense: (id: string | null) => void;
}

export const useDialogs = create<DialogState>()((set) => ({
  expense: { open: false },
  quickAdd: { open: false },
  category: { open: false },
  expenseDetail: { id: null },
  openExpense: (opts) => set({ expense: { open: true, ...opts } }),
  closeExpense: () => set((s) => ({ expense: { ...s.expense, open: false } })),
  openQuickAdd: (categoryId) => set({ quickAdd: { open: true, categoryId } }),
  closeQuickAdd: () => set((s) => ({ quickAdd: { ...s.quickAdd, open: false } })),
  openCategory: (opts) => set({ category: { open: true, ...opts } }),
  closeCategory: () => set((s) => ({ category: { ...s.category, open: false } })),
  showExpense: (id) => set({ expenseDetail: { id } }),
}));
