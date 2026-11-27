"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, Hash, Layers, Loader2, Pencil, Plus, Receipt, Sigma, Trash2, TrendingUp, Wallet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/primitives";
import { CategoryIcon, CategoryLabel, EmptyState, ErrorState, StatCard } from "@/components/shared/common";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { Pagination } from "@/components/shared/pagination";
import { DeleteCategoryDialog } from "@/components/categories/category-actions";
import { CategoryDetailSkeleton, CategoryStatsSkeleton } from "@/components/categories/category-detail-skeleton";
import { ExpenseTable, type SortKey, type SortState } from "@/components/expenses/expense-table";
import { InlineAddRow } from "@/components/expenses/inline-add-row";
import { TokenChip } from "@/components/formula/token-chip";
import { CalculatedHistoryChart } from "@/components/charts";
import { useCategories, useDeleteExpenses, useExpensePoints, useExpenses } from "@/hooks/use-data";
import { useDateRange } from "@/hooks/use-date-range";
import { useFormat } from "@/hooks/use-settings";
import { categoryValues, formulaBreakdown, totalOf } from "@/lib/analytics";
import { describeRange } from "@/lib/dates";
import { formulaToString } from "@/lib/formula";
import { cn, formatPercent, pluralize } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";
import type { Category, DateRange, Expense, ExpensePoint } from "@/lib/types";

export default function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: categories, isLoading, error, refetch } = useCategories();
  const { state: rangeState, range, setState: setRange } = useDateRange("category");
  const { data: points = [], isLoading: pointsLoading, isFetching: pointsFetching } = useExpensePoints(range);
  const { openCategory, openExpense, openQuickAdd } = useDialogs();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const all = useMemo(() => categories ?? [], [categories]);
  const category = all.find((c) => c.id === id);

  if (isLoading) return <CategoryDetailSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!category) {
    return (
      <Card>
        <EmptyState
          title="Category not found"
          description="It may have been deleted."
          action={
            <Button asChild variant="outline">
              <Link href="/categories">
                <ArrowLeft /> Back to categories
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const dependents = all.filter((c) => category.dependentIds.includes(c.id));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
        <Link href="/categories">
          <ArrowLeft /> Categories
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <CategoryIcon icon={category.icon} color={category.color} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-[28px]">{category.name}</h1>
              {category.type === "CALCULATED" ? (
                <Badge>
                  <Calculator /> Calculated
                </Badge>
              ) : (
                <Badge variant="secondary">Normal</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{category.code}</span>
              {category.description && <> · {category.description}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="hover:border-destructive/40 hover:text-destructive">
            <Trash2 /> Delete
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCategory({ category })}>
            <Pencil /> Edit
          </Button>
          {category.type === "NORMAL" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => openQuickAdd(category.id)}>
                <Zap /> Quick add
              </Button>
              <Button size="sm" onClick={() => openExpense({ categoryId: category.id })}>
                <Plus /> Add expense
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => router.push(`/formula-builder?id=${category.id}`)}>
              <Sigma /> Edit formula
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          Period
          {pointsFetching && !pointsLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs font-normal" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
            </span>
          )}
        </p>
        <DateRangeFilter state={rangeState} range={range} onChange={setRange} />
      </div>

      {pointsLoading ? (
        <CategoryStatsSkeleton />
      ) : (
        <div className={cn("transition-opacity duration-200", pointsFetching && "opacity-60")} aria-busy={pointsFetching}>
          {category.type === "NORMAL" ? (
            <NormalDetail category={category} all={all} points={points} range={range} />
          ) : (
            <CalculatedDetail category={category} all={all} points={points} range={range} />
          )}
        </div>
      )}

      {dependents.length > 0 && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Used in formulas</CardTitle>
            <CardDescription>These calculated categories recalculate automatically when this category changes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dependents.map((d) => (
              <Link key={d.id} href={`/categories/${d.id}`} className="inline-flex max-w-full items-center rounded-xl border px-3 py-2 transition-colors hover:bg-accent">
                <CategoryLabel category={d} size="xs" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <DeleteCategoryDialog category={category} open={confirmDelete} onOpenChange={setConfirmDelete} onDeleted={() => router.push("/categories")} />
    </>
  );
}

function NormalDetail({ category, all, points, range }: { category: Category; all: Category[]; points: ExpensePoint[]; range: DateRange }) {
  const { money, dateFormat } = useFormat();
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const mine = useMemo(() => points.filter((p) => p.categoryId === category.id), [points, category.id]);
  const total = totalOf(mine);
  const grand = totalOf(points);
  const largest = mine.reduce<ExpensePoint | null>((m, p) => (!m || p.amount > m.amount ? p : m), null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ sort: "expenseDate", order: "desc" });
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const del = useDeleteExpenses();
  const list = useExpenses({ categoryIds: [category.id], from: range.from, to: range.to, page, pageSize: 20, sort: sort.sort, order: sort.order });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total in period" value={money(total)} sub={describeRange(range, dateFormat)} icon={Wallet} />
        <StatCard label="Entries" value={mine.length.toLocaleString()} sub={`${category.expenseCount.toLocaleString()} all time`} icon={Hash} tone="violet" />
        <StatCard label="Average entry" value={money(mine.length ? total / mine.length : 0)} sub={largest ? `Largest: ${money(largest.amount)}` : "No entries"} icon={TrendingUp} tone="sky" />
        <StatCard label="Share of spending" value={formatPercent(grand ? (total / grand) * 100 : 0)} sub={`of ${money(grand)} total`} icon={Layers} tone="success" />
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Expense entries</p>
            <p className="text-xs text-muted-foreground">Click a row for details</p>
          </div>
        </div>
        {list.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : list.error ? (
          <div className="p-4">
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          </div>
        ) : !list.data?.items.length ? (
          <EmptyState compact icon={Receipt} title="No entries in this period" description="Add one below. Totals and formulas update immediately." />
        ) : (
          <>
            <ExpenseTable
              items={list.data.items}
              categoriesById={byId}
              sort={sort}
              onSort={(k: SortKey) => setSort((s) => ({ sort: k, order: s.sort === k && s.order === "desc" ? "asc" : "desc" }))}
              onDelete={setToDelete}
              showCategory={false}
              footerTotal={list.data.sum}
            />
            {list.data.pageCount > 1 && <Pagination page={list.data.page} pageCount={list.data.pageCount} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
          </>
        )}
        <InlineAddRow categoryId={category.id} />
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete expense?"
        description={`"${toDelete?.particular}" will be permanently removed.`}
        loading={del.isPending}
        onConfirm={async () => {
          if (toDelete) await del.mutateAsync([toDelete.id]);
          setToDelete(null);
        }}
      />
    </>
  );
}

function CalculatedDetail({ category, all, points, range }: { category: Category; all: Category[]; points: ExpensePoint[]; range: DateRange }) {
  const { money, dateFormat } = useFormat();
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const { rows, result } = useMemo(() => formulaBreakdown(all, category, points), [all, category, points]);
  const values = useMemo(() => categoryValues(all, points), [all, points]);
  const rowsSum = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const isPureSum = (category.formula ?? []).every((t) => t.kind === "category" || (t.kind === "operator" && t.op === "+"));

  if (!category.formula?.length) {
    return (
      <Card>
        <EmptyState
          icon={Sigma}
          title="No formula yet"
          description="Build a formula to combine other categories into this one."
          action={
            <Button asChild>
              <Link href={`/formula-builder?id=${category.id}`}>
                <Sigma /> Open formula builder
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <Card className="overflow-hidden">
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-violet-700 p-5 text-white sm:p-6">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">Calculated total · {describeRange(range, dateFormat)}</p>
            <p className="tabular mt-1 break-all text-3xl font-semibold tracking-tight sm:text-4xl">{result?.value === null || result === undefined ? "—" : money(result.value)}</p>
            {result?.error && <p className="mt-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm">{result.error}</p>}
            <p className="mt-3 break-words font-mono text-sm text-white/85">
              {category.name} = {formulaToString(category.formula, (id) => byId.get(id)?.code ?? "?", { pretty: true })}
            </p>
          </div>
          <CardContent className="pt-4 sm:pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Formula</p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {category.formula.map((t) => (
                <TokenChip
                  key={t.id}
                  token={t}
                  category={t.kind === "category" ? byId.get(t.categoryId) : undefined}
                  value={t.kind === "category" ? values.get(t.categoryId)?.value ?? null : undefined}
                  formatValue={(n) => money(n)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>The formula is evaluated separately for each period using only that period&apos;s expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <CalculatedHistoryChart categories={all} category={category} points={points} range={range} />
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 self-start overflow-hidden">
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
          <CardDescription>Referenced categories in this period</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-16 text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.category.id}>
                <TableCell className="max-w-0">
                  <Link href={`/categories/${r.category.id}`} className="block min-w-0 hover:underline">
                    <CategoryLabel category={r.category} size="xs" />
                  </Link>
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-right font-medium">{r.value === null ? <span className="text-destructive">error</span> : money(r.value)}</TableCell>
                <TableCell className="tabular text-right text-muted-foreground">{formatPercent(r.share, 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-semibold">{isPureSum ? "Total" : "Result"}</TableCell>
              <TableCell className="tabular whitespace-nowrap text-right font-semibold">{result?.value === null || !result ? "—" : money(result.value)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
        {!isPureSum && (
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            The formula uses operators other than addition, so the result ({result?.value === null || !result ? "—" : money(result.value)}) differs from the simple sum of
            referenced totals ({money(rowsSum)}).
          </p>
        )}
      </Card>
    </div>
  );
}
