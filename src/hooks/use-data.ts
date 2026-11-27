"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, qs } from "@/lib/api-client";
import type { CategoryInput, ExpenseInput } from "@/lib/validation";
import type { Category, DateRange, Expense, ExpensePoint, Paginated, Settings } from "@/lib/types";

export const keys = {
  categories: ["categories"] as const,
  category: (id: string) => ["categories", id] as const,
  points: (range: DateRange) => ["points", range.from, range.to] as const,
  expenses: (params: object) => ["expenses", params] as const,
  expense: (id: string) => ["expense", id] as const,
  settings: ["settings"] as const,
};

/* Queries ------------------------------------------------------------- */

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api<Category[]>("/api/categories") });
}

export function useExpensePoints(range: DateRange) {
  return useQuery({
    queryKey: keys.points(range),
    queryFn: () => api<ExpensePoint[]>(`/api/data${qs({ from: range.from, to: range.to })}`),
    placeholderData: keepPreviousData,
  });
}

export interface ExpenseQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  categoryIds?: string[];
  from?: string | null;
  to?: string | null;
  min?: number | null;
  max?: number | null;
  sort?: "expenseDate" | "amount" | "particular" | "category" | "createdAt";
  order?: "asc" | "desc";
}

export function expenseQueryString(q: ExpenseQuery) {
  return qs({
    page: q.page,
    pageSize: q.pageSize,
    q: q.q,
    categoryIds: q.categoryIds,
    from: q.from,
    to: q.to,
    min: q.min ?? undefined,
    max: q.max ?? undefined,
    sort: q.sort,
    order: q.order,
  });
}

export function useExpenses(q: ExpenseQuery) {
  return useQuery({
    queryKey: keys.expenses(q),
    queryFn: () => api<Paginated<Expense>>(`/api/expenses${expenseQueryString(q)}`),
    placeholderData: keepPreviousData,
  });
}

export function useExpense(id: string | null) {
  return useQuery({
    queryKey: keys.expense(id ?? ""),
    queryFn: () => api<Expense>(`/api/expenses/${id}`),
    enabled: !!id,
  });
}

export function useSettingsQuery() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api<Settings>("/api/settings"), staleTime: 5 * 60_000 });
}

/* Mutations ----------------------------------------------------------- */

/** Anything that changes expenses or categories invalidates every derived view. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["categories"] }),
      qc.invalidateQueries({ queryKey: ["points"] }),
      qc.invalidateQueries({ queryKey: ["expenses"] }),
      qc.invalidateQueries({ queryKey: ["expense"] }),
    ]);
}

export function useCreateCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CategoryInput) => api<Category>("/api/categories", { method: "POST", json: input }),
    onSuccess: (c) => {
      toast.success(`Category "${c.name}" created`);
      return invalidate();
    },
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) =>
      api<Category>(`/api/categories/${id}`, { method: "PATCH", json: input }),
    onSuccess: (c) => {
      toast.success(`Category "${c.name}" saved`);
      return invalidate();
    },
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (c: Pick<Category, "id" | "name">) => api(`/api/categories/${c.id}`, { method: "DELETE" }).then(() => c),
    onSuccess: (c) => {
      toast.success(`Category "${c.name}" deleted`);
      return invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useCreateExpenses() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (rows: ExpenseInput[]) =>
      api<Expense[]>("/api/expenses", { method: "POST", json: rows.length === 1 ? rows[0] : { expenses: rows } }),
    onSuccess: (rows) => {
      toast.success(rows.length === 1 ? `Added "${rows[0].particular}"` : `Added ${rows.length} expenses`);
      return invalidate();
    },
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ExpenseInput> }) =>
      api<Expense>(`/api/expenses/${id}`, { method: "PATCH", json: input }),
    onSuccess: () => {
      toast.success("Expense updated");
      return invalidate();
    },
  });
}

export function useDeleteExpenses() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (ids: string[]) => api<{ deleted: number }>("/api/expenses", { method: "DELETE", json: { ids } }),
    onSuccess: ({ deleted }) => {
      toast.success(deleted === 1 ? "Expense deleted" : `${deleted} expenses deleted`);
      return invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api<Settings>("/api/settings", { method: "PUT", json: s }),
    onSuccess: (s) => {
      qc.setQueryData(keys.settings, s);
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useDataAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: "restore" | "merge"; backup: unknown } | { action: "sample" } | { action: "clear" }) =>
      api<{
        mode?: "replace" | "merge";
        categories?: number;
        expenses?: number;
        settings?: boolean;
        categoriesCreated?: number;
        categoriesMatched?: number;
        expensesSkipped?: number;
      }>("/api/backup", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
