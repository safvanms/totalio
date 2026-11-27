"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Calculator, Plus, Search, Shapes, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Skeleton } from "@/components/ui/primitives";
import { Segmented, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon, EmptyState, ErrorState, PageHeader } from "@/components/shared/common";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { LinkPendingOverlay } from "@/components/shared/link-pending";
import { CategoryActions } from "@/components/categories/category-actions";
import { useCategories, useExpensePoints } from "@/hooks/use-data";
import { useDateRange } from "@/hooks/use-date-range";
import { useFormat } from "@/hooks/use-settings";
import { categoryStats } from "@/lib/analytics";
import { describeRange } from "@/lib/dates";
import { formulaToString } from "@/lib/formula";
import { cn, formatPercent, pluralize } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";

type SortKey = "code" | "name" | "total" | "count" | "createdAt";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "code", label: "Code" },
  { value: "name", label: "Name" },
  { value: "total", label: "Total amount" },
  { value: "count", label: "Entries" },
  { value: "createdAt", label: "Date created" },
];

export default function CategoriesPage() {
  const { data: categories, isLoading, error, refetch } = useCategories();
  const { state: rangeState, range, setState: setRange } = useDateRange("categories");
  const { data: points = [], isFetching } = useExpensePoints(range);
  const { money, date, dateFormat } = useFormat();
  const openCategory = useDialogs((s) => s.openCategory);

  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "NORMAL" | "CALCULATED">("all");
  const [sort, setSort] = useState<SortKey>("code");
  const [asc, setAsc] = useState(true);

  const all = useMemo(() => categories ?? [], [categories]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const stats = useMemo(() => categoryStats(all, points), [all, points]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = stats.filter(
      (r) =>
        (type === "all" || r.category.type === type) &&
        (!s || r.category.name.toLowerCase().includes(s) || r.category.code.toLowerCase().includes(s) || (r.category.description ?? "").toLowerCase().includes(s)),
    );
    const num = (code: string) => Number(code.replace(/\D/g, "")) || 0;
    const cmp = (a: (typeof stats)[number], b: (typeof stats)[number]) => {
      switch (sort) {
        case "code":
          return num(a.category.code) - num(b.category.code);
        case "name":
          return a.category.name.localeCompare(b.category.name);
        case "total":
          return a.total - b.total;
        case "count":
          return a.count - b.count;
        case "createdAt":
          return a.category.createdAt.localeCompare(b.category.createdAt);
      }
    };
    return filtered.sort((a, b) => (asc ? cmp(a, b) : -cmp(a, b)));
  }, [stats, q, type, sort, asc]);

  const normalCount = all.filter((c) => c.type === "NORMAL").length;

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise expenses into categories, and combine them into calculated categories with formulas."
        actionsClassName="grid grid-cols-2 sm:flex"
        actions={
          <>
            <Button variant="outline" onClick={() => openCategory({ type: "CALCULATED" })} disabled={!normalCount}>
              <Calculator /> New calculated
            </Button>
            <Button onClick={() => openCategory({ type: "NORMAL" })}>
              <Plus /> New category
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5 sm:gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <div className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories" className="pl-9 pr-9" aria-label="Search categories" />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Segmented
              ariaLabel="Category type"
              value={type}
              onChange={setType}
              className="grid w-full grid-cols-3 sm:order-last sm:inline-flex sm:w-auto"
              options={[
                { value: "all", label: "All" },
                { value: "NORMAL", label: "Normal" },
                { value: "CALCULATED", label: "Calculated" },
              ]}
            />
            {/* Phones: sort + direction, then the date range (same row from 425px). */}
            <div className="flex min-w-0 flex-wrap items-center gap-2 xs:flex-nowrap">
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="min-w-0 flex-1 sm:w-44 sm:flex-none" aria-label="Sort by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      Sort: {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => setAsc((a) => !a)} aria-label={asc ? "Ascending" : "Descending"}>
                {asc ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
              </Button>
              <DateRangeFilter state={rangeState} range={range} onChange={setRange} className="w-full min-w-0 xs:w-auto xs:flex-1 sm:hidden" />
            </div>
          </div>
          <DateRangeFilter state={rangeState} range={range} onChange={setRange} className="hidden sm:flex" />
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={Shapes}
            title="No categories yet"
            description="Start with categories like Train Tickets, Bus Tickets or Food Expenses."
            action={
              <Button onClick={() => openCategory({ type: "NORMAL" })}>
                <Plus /> Create your first category
              </Button>
            }
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState compact icon={Search} title="No categories match" description="Try a different search or type filter." />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {pluralize(rows.length, "category", "categories")} · totals for {describeRange(range, dateFormat).toLowerCase() === "all time" ? "all time" : describeRange(range, dateFormat)}
          </p>
          <ul className={cn("grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4", isFetching && "opacity-70")}>
            {rows.map(({ category: c, total, count, share, error: calcError }) => (
              <li key={c.id} className="min-w-0">
                <Card className="group relative flex h-full flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5">
                  <div className="flex items-start gap-3">
                    <CategoryIcon icon={c.icon} color={c.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/categories/${c.id}`} className="block truncate font-semibold after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none" title={c.name}>
                        {c.name}
                        <LinkPendingOverlay />
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span>
                        {c.type === "CALCULATED" ? (
                          <Badge>
                            <Calculator /> Calculated
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Normal</Badge>
                        )}
                      </div>
                    </div>
                    <div className="relative z-10">
                      <CategoryActions category={c} />
                    </div>
                  </div>

                  {c.type === "CALCULATED" ? (
                    <p className="mt-3 truncate rounded-lg bg-muted/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground" title={formulaToString(c.formula, (id) => byId.get(id)?.name ?? "?", { pretty: true })}>
                      = {formulaToString(c.formula, (id) => byId.get(id)?.code ?? "?", { pretty: true }) || "no formula yet"}
                    </p>
                  ) : (
                    c.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  )}

                  <div className="mt-auto pt-4">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{c.type === "CALCULATED" ? "Calculated total" : "Total spent"}</p>
                        <p className={cn("tabular truncate text-xl font-semibold", calcError && "text-sm font-medium text-destructive")} title={calcError ?? money(total)}>
                          {calcError ? calcError : money(total)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                        {c.type === "NORMAL" ? pluralize(count, "entry", "entries") : `${c.formula ? new Set(c.formula.filter((t) => t.kind === "category").map((t) => (t as { categoryId: string }).categoryId)).size : 0} refs`}
                        <p className="tabular font-medium text-foreground">{formatPercent(share)}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${formatPercent(share)} of total expenses`}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, share))}%`, backgroundColor: c.color }} />
                    </div>
                    <p className="mt-2.5 text-[11px] text-muted-foreground">Created {date(c.createdAt.slice(0, 10))}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
