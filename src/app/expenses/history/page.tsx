"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Plus, Receipt, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Skeleton } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { CategoryIcon, EmptyState, ErrorState, PageHeader } from "@/components/shared/common";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportMenu } from "@/components/shared/export-menu";
import { ImportDataButton } from "@/components/data/data-transfer";
import { Pagination } from "@/components/shared/pagination";
import { ExpensesNav } from "@/components/expenses/expenses-nav";
import { ExpenseTable, type SortKey, type SortState } from "@/components/expenses/expense-table";
import { expenseQueryString, useCategories, useDeleteExpenses, useExpenses, type ExpenseQuery } from "@/hooks/use-data";
import { useFormat } from "@/hooks/use-settings";
import { api } from "@/lib/api-client";
import { cn, pluralize } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";
import type { ExportTable } from "@/lib/export";
import type { Expense } from "@/lib/types";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ExpenseHistoryPage() {
  const { data: categories = [] } = useCategories();
  const normal = useMemo(() => categories.filter((c) => c.type === "NORMAL"), [categories]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const { money, date } = useFormat();
  const openExpense = useDialogs((s) => s.openExpense);
  const del = useDeleteExpenses();

  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minS, setMin] = useState("");
  const [maxS, setMax] = useState("");
  const min = useDebounced(minS);
  const max = useDebounced(maxS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortState>({ sort: "expenseDate", order: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; label: string } | null>(null);

  const rangeError = from && to && from > to ? "Start date is after end date" : null;
  const amountError = min && max && Number(min) > Number(max) ? "Min is greater than max" : null;

  const query: ExpenseQuery = {
    q: q || undefined,
    categoryIds,
    from: rangeError ? undefined : from || undefined,
    to: rangeError ? undefined : to || undefined,
    min: amountError || min === "" ? null : Number(min),
    max: amountError || max === "" ? null : Number(max),
    sort: sort.sort,
    order: sort.order,
    page,
    pageSize,
  };
  const { data, isLoading, error, refetch, isFetching } = useExpenses(query);

  // Reset to page 1 and clear selection whenever filters change.
  const filterKey = JSON.stringify([q, categoryIds, from, to, min, max, sort, pageSize]);
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [filterKey]);

  const activeFilters = (categoryIds.length ? 1 : 0) + (from || to ? 1 : 0) + (min || max ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setCategoryIds([]);
    setFrom("");
    setTo("");
    setMin("");
    setMax("");
  };

  const onSort = (k: SortKey) => setSort((s) => ({ sort: k, order: s.sort === k && s.order === "desc" ? "asc" : "desc" }));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = (checked: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      for (const e of data?.items ?? []) {
        if (checked) n.add(e.id);
        else n.delete(e.id);
      }
      return n;
    });

  const exportTables = async (): Promise<ExportTable[]> => {
    const { page: _p, pageSize: _s, ...rest } = query;
    const rows = await api<Expense[]>(`/api/expenses/export${expenseQueryString(rest)}`);
    return [
      {
        title: "Expense history",
        subtitle: `${pluralize(rows.length, "entry", "entries")}${activeFilters || q ? " (filtered)" : ""}`,
        columns: [
          { key: "date", header: "Date" },
          { key: "code", header: "Code" },
          { key: "category", header: "Category" },
          { key: "particular", header: "Particular" },
          { key: "amount", header: "Amount", money: true },
          { key: "description", header: "Description" },
          { key: "notes", header: "Notes" },
        ],
        rows: rows.map((e) => ({
          date: date(e.expenseDate),
          code: byId.get(e.categoryId)?.code ?? "",
          category: byId.get(e.categoryId)?.name ?? "",
          particular: e.particular,
          amount: e.amount,
          description: e.description,
          notes: e.notes,
        })),
        footer: { date: "Total", amount: rows.reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100 },
      },
    ];
  };

  return (
    <>
      <PageHeader
        title="Expense history"
        description="Every expense record. Search, filter, sort, select and export."
        actions={
          <>
            <ImportDataButton label="Import" />
            <ExportMenu getTables={exportTables} filename="spendly-expenses" heading="Expense history" disabled={!data?.total} />
            <Button onClick={() => openExpense()}>
              <Plus /> Add expense
            </Button>
          </>
        }
      >
        <ExpensesNav />
      </PageHeader>

      <Card className="min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by particular…" className="pl-9 pr-9" aria-label="Search expenses" />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    <Filter /> Categories
                    {categoryIds.length > 0 && <Badge className="ml-0.5 px-1.5">{categoryIds.length}</Badge>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
                  <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
                  {normal.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={categoryIds.includes(c.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(v) => setCategoryIds((ids) => (v ? [...ids, c.id] : ids.filter((i) => i !== c.id)))}
                    >
                      <CategoryIcon icon={c.icon} color={c.color} size="xs" />
                      <span className="truncate">{c.name}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                  {categoryIds.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem checked={false} onCheckedChange={() => setCategoryIds([])}>
                        Clear selection
                      </DropdownMenuCheckboxItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="flex-1 sm:flex-none">
                <SlidersHorizontal /> More filters
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid gap-3 rounded-xl border bg-muted/30 p-3 animate-fade-in xs:grid-cols-2 lg:grid-cols-4">
              <Field label="From date" htmlFor="f-from" error={rangeError ?? undefined}>
                <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To date" htmlFor="f-to">
                <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Field label="Min amount" htmlFor="f-min" error={amountError ?? undefined}>
                <Input id="f-min" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={minS} onChange={(e) => setMin(e.target.value)} />
              </Field>
              <Field label="Max amount" htmlFor="f-max">
                <Input id="f-max" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Any" value={maxS} onChange={(e) => setMax(e.target.value)} />
              </Field>
            </div>
          )}

          {(activeFilters > 0 || q) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {data ? (
                  <>
                    {pluralize(data.total, "result")} · <span className="tabular font-semibold text-foreground">{money(data.sum)}</span>
                  </>
                ) : (
                  "Filtering…"
                )}
              </span>
              <Button variant="ghost" size="xs" onClick={clearFilters}>
                <X /> Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary/5 px-4 py-2.5 animate-fade-in">
            <p className="text-sm font-medium">{pluralize(selected.size, "expense")} selected</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirm({ ids: [...selected], label: pluralize(selected.size, "expense") })}>
                <Trash2 /> Delete selected
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            icon={Receipt}
            title={activeFilters || q ? "No expenses match these filters" : "No expenses yet"}
            description={activeFilters || q ? "Try widening the date range or clearing filters." : "Add your first expense to get started."}
            action={
              activeFilters || q ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => openExpense()}>
                  <Plus /> Add expense
                </Button>
              )
            }
          />
        ) : (
          <div className={cn("transition-opacity", isFetching && "opacity-70")}>
            <ExpenseTable
              items={data.items}
              categoriesById={byId}
              sort={sort}
              onSort={onSort}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onDelete={(e) => setConfirm({ ids: [e.id], label: `"${e.particular}"` })}
              footerTotal={data.sum}
              footerLabel={`Total of ${pluralize(data.total, "filtered entry", "filtered entries")}`}
            />
            <Pagination page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} total={data.total} onPage={setPage} onPageSize={setPageSize} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm && confirm.ids.length > 1 ? `Delete ${confirm.ids.length} expenses?` : "Delete expense?"}
        description={`${confirm?.label} will be permanently removed. This can't be undone.`}
        loading={del.isPending}
        onConfirm={async () => {
          if (!confirm) return;
          await del.mutateAsync(confirm.ids);
          setSelected((s) => {
            const n = new Set(s);
            confirm.ids.forEach((id) => n.delete(id));
            return n;
          });
          setConfirm(null);
        }}
      />
    </>
  );
}
