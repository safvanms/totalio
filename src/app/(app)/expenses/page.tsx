"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, Receipt, Shapes, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { CategoryIcon, EmptyState, ErrorState, PageHeader } from "@/components/shared/common";
import { CategorySelect } from "@/components/shared/pickers";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { Pagination } from "@/components/shared/pagination";
import { ExpensesNav } from "@/components/expenses/expenses-nav";
import { ExpenseTable, type SortKey, type SortState } from "@/components/expenses/expense-table";
import { InlineAddRow } from "@/components/expenses/inline-add-row";
import { useCategories, useDeleteExpenses, useExpensePoints, useExpenses } from "@/hooks/use-data";
import { useDateRange } from "@/hooks/use-date-range";
import { useFormat } from "@/hooks/use-settings";
import { baseTotals, countByCategory, totalOf } from "@/lib/analytics";
import { describeRange } from "@/lib/dates";
import { cn, formatPercent, pluralize } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";
import type { Expense } from "@/lib/types";

export default function ExpensesByCategoryPage() {
  const { data: categories, isLoading, error, refetch } = useCategories();
  const { state: rangeState, range, setState: setRange } = useDateRange("expenses");
  const { data: points = [] } = useExpensePoints(range);
  const { money, dateFormat } = useFormat();
  const { openExpense, openQuickAdd, openCategory } = useDialogs();
  const del = useDeleteExpenses();

  const normal = useMemo(() => (categories ?? []).filter((c) => c.type === "NORMAL"), [categories]);
  const byId = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const totals = useMemo(() => baseTotals(points), [points]);
  const counts = useMemo(() => countByCategory(points), [points]);
  const grand = totalOf(points);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ sort: "expenseDate", order: "desc" });
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  useEffect(() => {
    if (normal.length && (!selectedId || !normal.some((c) => c.id === selectedId))) setSelectedId(normal[0].id);
  }, [normal, selectedId]);
  useEffect(() => setPage(1), [selectedId, range.from, range.to]);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const list = useExpenses({
    categoryIds: selectedId ? [selectedId] : [],
    from: range.from,
    to: range.to,
    page,
    pageSize: 25,
    sort: sort.sort,
    order: sort.order,
  });

  const onSort = (k: SortKey) => setSort((s) => ({ sort: k, order: s.sort === k && s.order === "desc" ? "asc" : "desc" }));

  const header = (
    <PageHeader
      title="Expenses"
      description="Record expenses under each category and see category-wise totals."
      actions={
        <>
          <Button variant="outline" onClick={() => openQuickAdd(selectedId)} disabled={!normal.length}>
            <Zap /> Quick add
          </Button>
          <Button onClick={() => openExpense({ categoryId: selectedId })}>
            <Plus /> Add expense
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ExpensesNav />
        <DateRangeFilter state={rangeState} range={range} onChange={setRange} />
      </div>
    </PageHeader>
  );

  if (isLoading) {
    return (
      <>
        {header}
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  if (!normal.length) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Shapes}
            title="No expense categories yet"
            description="Create a category such as Train Tickets, then start adding expenses to it."
            action={<Button onClick={() => openCategory({ type: "NORMAL" })}>Create category</Button>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Category totals */}
        <Card className="min-w-0 self-start overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Category totals</p>
              <p className="truncate text-xs text-muted-foreground">{describeRange(range, dateFormat)}</p>
            </div>
            <p className="tabular shrink-0 text-sm font-semibold">{money(grand)}</p>
          </div>
          {/* phones/tablets: select */}
          <div className="p-3 lg:hidden">
            <CategorySelect categories={normal} value={selectedId} onChange={setSelectedId} />
          </div>
          <ul className="hidden max-h-[calc(100dvh-18rem)] overflow-y-auto p-2 scrollbar-thin lg:block" role="listbox" aria-label="Categories">
            {normal.map((c) => {
              const t = totals.get(c.id) ?? 0;
              const share = grand ? (t / grand) * 100 : 0;
              const active = c.id === selectedId;
              return (
                <li key={c.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active && "bg-accent",
                    )}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium" title={c.name}>
                          {c.name}
                        </span>
                        <span className="tabular shrink-0 text-sm font-semibold">{money(t, true)}</span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: c.color }} />
                        </span>
                        <span className="tabular w-16 text-right text-[11px] text-muted-foreground">{pluralize(counts.get(c.id) ?? 0, "entry", "entries")}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Selected category entries */}
        {selected && (
          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <CategoryIcon icon={selected.icon} color={selected.color} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-semibold" title={selected.name}>
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">{selected.code}</span>
                    {selected.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pluralize(counts.get(selected.id) ?? 0, "entry", "entries")} · {formatPercent(grand ? ((totals.get(selected.id) ?? 0) / grand) * 100 : 0)} of spending
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="tabular text-xl font-semibold">{money(totals.get(selected.id) ?? 0)}</p>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/categories/${selected.id}`}>
                    Details <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </div>

            {list.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : list.error ? (
              <div className="p-4">
                <ErrorState error={list.error} onRetry={() => list.refetch()} />
              </div>
            ) : !list.data?.items.length ? (
              <EmptyState compact icon={Receipt} title="No expenses in this period" description="Add the first one below, or change the date range." />
            ) : (
              <div className={cn("transition-opacity", list.isFetching && "opacity-70")}>
                <ExpenseTable
                  items={list.data.items}
                  categoriesById={byId}
                  sort={sort}
                  onSort={onSort}
                  onDelete={setToDelete}
                  showCategory={false}
                  footerTotal={list.data.sum}
                  footerLabel={list.data.pageCount > 1 ? `Total (${list.data.total} entries)` : "Total"}
                />
                {list.data.pageCount > 1 && (
                  <Pagination page={list.data.page} pageCount={list.data.pageCount} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
                )}
              </div>
            )}
            <InlineAddRow categoryId={selected.id} />
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete expense?"
        description={`"${toDelete?.particular}" will be permanently removed. Totals and formulas update immediately.`}
        loading={del.isPending}
        onConfirm={async () => {
          if (toDelete) await del.mutateAsync([toDelete.id]);
          setToDelete(null);
        }}
      />
    </>
  );
}
