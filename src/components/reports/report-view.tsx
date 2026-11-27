"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Calculator,
  Crown,
  FileBarChart,
  Hash,
  Minus,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/primitives";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/select";
import { CardSkeleton, CategoryLabel, EmptyState, ErrorState, PageHeader, StatCard } from "@/components/shared/common";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ExportMenu } from "@/components/shared/export-menu";
import { CompareBarChart, CumulativeAreaChart, PeriodBarChart, TrendLineChart } from "@/components/charts";
import { useCategories, useExpensePoints } from "@/hooks/use-data";
import { useDateRange } from "@/hooks/use-date-range";
import { useFormat } from "@/hooks/use-settings";
import {
  autoInterval,
  categoryStats,
  effectiveBounds,
  formulaBreakdown,
  summarize,
  timeSeries,
  type CategoryStat,
  type Interval,
} from "@/lib/analytics";
import { daysInRange, describeRange, rangeForPreset } from "@/lib/dates";
import { formulaToString } from "@/lib/formula";
import type { ExportTable } from "@/lib/export";
import { cn } from "@/lib/utils";
import type { Category, DateRange, ExpensePoint } from "@/lib/types";
import type { RangeState } from "@/stores/ui-store";
import { fmtPct, pctChange, previousPeriod } from "./report-utils";

type Tab = "overview" | "categories" | "monthly" | "yearly" | "calculated" | "compare";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "categories", label: "Categories" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "calculated", label: "Calculated" },
  { value: "compare", label: "Compare" },
];

/** Change indicator. For spending, an increase is flagged (icon + sign + colour), never colour alone. */
function Delta({ value, className }: { value: number | null; className?: string }) {
  const Icon = value === null || value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium",
        value === null || value > 0 ? "text-destructive" : value < 0 ? "text-success" : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {fmtPct(value)}
    </span>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 animate-fade-in", className)}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

interface PeriodRow {
  key: string;
  label: string;
  count: number;
  total: number;
  change: number | null;
  first: boolean;
}

function periodRows(points: ExpensePoint[], range: DateRange, interval: "month" | "year", weekStartsOn: 0 | 1): PeriodRow[] {
  return timeSeries(points, range, interval, weekStartsOn).map((p, i, arr) => ({
    key: p.key,
    label: interval === "year" ? p.key : p.label,
    count: p.count,
    total: p.total,
    change: i === 0 ? null : pctChange(p.total, arr[i - 1].total),
    first: i === 0,
  }));
}

export function ReportView() {
  const { money, dateFormat, weekStartsOn } = useFormat();
  const { state, range, setState } = useDateRange("reports");
  const [tab, setTab] = useState<Tab>("overview");
  const [overInterval, setOverInterval] = useState<Interval | null>(null);
  const [bOverride, setBOverride] = useState<RangeState | null>(null);

  const cats = useCategories();
  const pts = useExpensePoints(range);
  const categories = useMemo(() => cats.data ?? [], [cats.data]);
  const points = useMemo(() => pts.data ?? [], [pts.data]);

  // Compare: Range B defaults to the previous period of equal length.
  const prev = previousPeriod(range);
  const stateB: RangeState = bOverride ?? (prev ? { preset: "custom", ...prev } : { preset: "year", from: null, to: null });
  const rangeB: DateRange = stateB.preset === "custom" ? { from: stateB.from, to: stateB.to } : rangeForPreset(stateB.preset, weekStartsOn);
  const ptsB = useExpensePoints(rangeB);
  const pointsB = useMemo(() => ptsB.data ?? [], [ptsB.data]);

  const labelA = describeRange(range, dateFormat);
  const labelB = describeRange(rangeB, dateFormat);

  const summary = useMemo(() => summarize(categories, points, range), [categories, points, range]);
  const stats = useMemo(() => categoryStats(categories, points), [categories, points]);
  const normalStats = useMemo(() => stats.filter((s) => s.category.type === "NORMAL").sort((a, b) => b.total - a.total), [stats]);
  const calculated = useMemo(() => categories.filter((c) => c.type === "CALCULATED"), [categories]);
  const codeOf = useMemo(() => new Map(categories.map((c) => [c.id, c.code])), [categories]);
  const nameOf = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const bounds = effectiveBounds(range, points);
  const autoIv = autoInterval(bounds ? daysInRange(bounds.from, bounds.to) : 0);
  const iv = overInterval ?? autoIv;
  const overTime = useMemo(() => timeSeries(points, range, iv, weekStartsOn), [points, range, iv, weekStartsOn]);
  const monthly = useMemo(() => periodRows(points, range, "month", weekStartsOn), [points, range, weekStartsOn]);
  const yearly = useMemo(() => periodRows(points, range, "year", weekStartsOn), [points, range, weekStartsOn]);
  const monthlySeries = useMemo(() => timeSeries(points, range, "month", weekStartsOn), [points, range, weekStartsOn]);
  const yearlySeries = useMemo(() => timeSeries(points, range, "year", weekStartsOn), [points, range, weekStartsOn]);

  const calcReports = useMemo(
    () => calculated.map((c) => ({ category: c, ...formulaBreakdown(categories, c, points) })),
    [calculated, categories, points],
  );

  const statsB = useMemo(() => categoryStats(categories, pointsB), [categories, pointsB]);
  const totalB = useMemo(() => summarize(categories, pointsB, rangeB).totalExpenses, [categories, pointsB, rangeB]);
  const compareRows = useMemo(() => {
    const bMap = new Map<string, CategoryStat>(statsB.map((s) => [s.category.id, s]));
    return stats
      .map((s) => {
        const b = bMap.get(s.category.id);
        const a = s.error ? 0 : s.total;
        const bv = b && !b.error ? b.total : 0;
        return { category: s.category, a, b: bv, diff: a - bv, pct: pctChange(a, bv) };
      })
      .filter((r) => r.a !== 0 || r.b !== 0)
      .sort((x, y) => Number(x.category.type === "CALCULATED") - Number(y.category.type === "CALCULATED") || y.a + y.b - (x.a + x.b));
  }, [stats, statsB]);

  /* Export tables -------------------------------------------------- */

  const fmtFormula = (c: Category) => (c.formula?.length ? formulaToString(c.formula, (id) => codeOf.get(id) ?? "?") : "");

  const tablesFor = (t: Tab): ExportTable[] => {
    const sub = `Period: ${labelA}`;
    switch (t) {
      case "overview":
        return [
          {
            title: "Summary",
            subtitle: sub,
            columns: [
              { key: "metric", header: "Metric" },
              { key: "value", header: "Value" },
            ],
            rows: [
              { metric: "Total expenses", value: money(summary.totalExpenses) },
              { metric: "Expense entries", value: summary.entryCount },
              { metric: "Average expense", value: money(summary.averageExpense) },
              { metric: "Average daily expense", value: money(summary.averageDaily) },
              { metric: "Days in period", value: summary.days },
              { metric: "Highest spending category", value: summary.highest ? `${summary.highest.category.name} (${money(summary.highest.total)})` : "-" },
              { metric: "Lowest spending category", value: summary.lowest ? `${summary.lowest.category.name} (${money(summary.lowest.total)})` : "-" },
            ],
          },
          {
            title: "Expenses over time",
            subtitle: sub,
            columns: [
              { key: "period", header: "Period" },
              { key: "count", header: "Entries", numeric: true },
              { key: "total", header: "Total", money: true },
              { key: "cumulative", header: "Cumulative", money: true },
            ],
            rows: overTime.map((p) => ({ period: p.label, count: p.count, total: p.total, cumulative: p.cumulative })),
          },
        ];
      case "categories":
        return [
          {
            title: "Category-wise expenses",
            subtitle: sub,
            columns: [
              { key: "code", header: "Code" },
              { key: "name", header: "Category" },
              { key: "count", header: "Entries", numeric: true },
              { key: "total", header: "Total", money: true },
              { key: "share", header: "Share %", numeric: true },
              { key: "avg", header: "Avg / entry", money: true },
            ],
            rows: normalStats.map((s) => ({
              code: s.category.code,
              name: s.category.name,
              count: s.count,
              total: s.total,
              share: Number(s.share.toFixed(2)),
              avg: s.count ? Math.round((s.total / s.count) * 100) / 100 : 0,
            })),
            footer: { code: "", name: "Total", count: summary.entryCount, total: summary.totalExpenses, share: summary.totalExpenses > 0 ? 100 : 0, avg: summary.averageExpense },
          },
        ];
      case "monthly":
      case "yearly": {
        const rows = t === "monthly" ? monthly : yearly;
        return [
          {
            title: t === "monthly" ? "Monthly expenses" : "Yearly expenses",
            subtitle: sub,
            columns: [
              { key: "period", header: t === "monthly" ? "Month" : "Year" },
              { key: "count", header: "Entries", numeric: true },
              { key: "total", header: "Total", money: true },
              { key: "change", header: "Change vs previous" },
            ],
            rows: rows.map((r) => ({ period: r.label, count: r.count, total: r.total, change: r.first ? "-" : fmtPct(r.change) })),
            footer: { period: "Total", count: summary.entryCount, total: summary.totalExpenses, change: "" },
          },
        ];
      }
      case "calculated":
        return calcReports.map((r) => ({
          title: `${r.category.code} ${r.category.name}`,
          subtitle: `Formula: ${fmtFormula(r.category) || "none"} · ${sub}`,
          columns: [
            { key: "code", header: "Code" },
            { key: "name", header: "Referenced category" },
            { key: "amount", header: "Amount", money: true },
            { key: "share", header: "Contribution %", numeric: true },
          ],
          rows: r.rows.map((b) => ({
            code: b.category.code,
            name: b.category.name,
            amount: b.value ?? (b.error ? `Error: ${b.error}` : 0),
            share: Number(b.share.toFixed(2)),
          })),
          footer: { code: "", name: "Result", amount: r.result?.value ?? (r.result?.error ? `Error: ${r.result.error}` : 0), share: "" },
        }));
      case "compare":
        return [
          {
            title: "Period comparison",
            subtitle: `A: ${labelA} · B: ${labelB}`,
            columns: [
              { key: "code", header: "Code" },
              { key: "name", header: "Category" },
              { key: "a", header: "Range A", money: true },
              { key: "b", header: "Range B", money: true },
              { key: "diff", header: "Difference", money: true },
              { key: "pct", header: "Change" },
            ],
            rows: compareRows.map((r) => ({
              code: r.category.code,
              name: r.category.type === "CALCULATED" ? `${r.category.name} (calculated)` : r.category.name,
              a: r.a,
              b: r.b,
              diff: Math.round(r.diff * 100) / 100,
              pct: fmtPct(r.pct),
            })),
            footer: {
              code: "",
              name: "Total expenses",
              a: summary.totalExpenses,
              b: totalB,
              diff: Math.round((summary.totalExpenses - totalB) * 100) / 100,
              pct: fmtPct(pctChange(summary.totalExpenses, totalB)),
            },
          },
        ];
    }
  };

  const allTables = () => TABS.flatMap((t) => tablesFor(t.value));

  /* Render --------------------------------------------------------- */

  const header = (
    <PageHeader
      title="Reports & Analytics"
      description={`Detailed breakdowns and comparisons · ${labelA}`}
      actions={
        <>
          <ExportMenu getTables={() => tablesFor(tab)} filename={`spendly-${tab}-report`} heading={`Spendly – ${TABS.find((t) => t.value === tab)?.label} report`} label="Export tab" disabled={!points.length && tab !== "compare"} />
          <ExportMenu getTables={allTables} filename="spendly-full-report" heading="Spendly – Full report" label="Full report" variant="default" disabled={!categories.length} />
        </>
      }
    >
      <DateRangeFilter state={state} range={range} onChange={setState} />
    </PageHeader>
  );

  if (cats.error || pts.error) {
    return (
      <>
        {header}
        <ErrorState
          error={cats.error ?? pts.error}
          onRetry={() => {
            cats.refetch();
            pts.refetch();
          }}
        />
      </>
    );
  }

  if (cats.isLoading || pts.isLoading) {
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton className="sm:col-span-2 lg:col-span-1" />
          <CardSkeleton className="h-[320px] sm:col-span-2 lg:col-span-3" lines={6} />
        </div>
      </>
    );
  }

  if (!categories.length) {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon={FileBarChart} title="No data to report yet" description="Create categories and add expenses to unlock reports." action={<Button asChild><Link href="/categories">Go to categories</Link></Button>} />
        </Card>
      </>
    );
  }

  const noData = points.length === 0;
  const noDataCard = (
    <Card>
      <EmptyState compact icon={BarChart3} title="No expenses in this period" description="Choose a different date range to see this report." />
    </Card>
  );

  return (
    <>
      {header}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-thin sm:mx-0 sm:px-0">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview -------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-4 sm:space-y-5 lg:space-y-6">
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Total Expenses" icon={Wallet} value={money(summary.totalExpenses)} sub={`${summary.entryCount.toLocaleString()} entries`} />
            <StatCard label="Average Daily" icon={CalendarDays} tone="sky" value={money(summary.averageDaily)} sub={`over ${summary.days} day${summary.days === 1 ? "" : "s"}`} />
            <StatCard label="Expense Entries" icon={Hash} tone="violet" value={summary.entryCount.toLocaleString()} sub={`avg ${money(summary.averageExpense)} each`} />
            <StatCard label="Highest Category" icon={Crown} tone="amber" value={summary.highest?.category.name ?? "—"} sub={summary.highest ? money(summary.highest.total) : "No spending"} />
            <StatCard label="Lowest Category" icon={TrendingDown} tone="success" value={summary.lowest?.category.name ?? "—"} sub={summary.lowest ? money(summary.lowest.total) : "No spending"} />
            <StatCard label="Days in Period" icon={CalendarDays} tone="rose" value={summary.days.toLocaleString()} sub={labelA} />
          </div>
          {noData ? (
            noDataCard
          ) : (
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
              <SectionCard
                title="Total expenses over time"
                description="Spending per period"
                action={
                  <Segmented
                    size="xs"
                    ariaLabel="Interval"
                    value={iv}
                    onChange={setOverInterval}
                    options={[
                      { value: "day", label: "Daily" },
                      { value: "week", label: "Weekly" },
                      { value: "month", label: "Monthly" },
                      { value: "year", label: "Yearly" },
                    ]}
                  />
                }
              >
                <TrendLineChart data={overTime} />
              </SectionCard>
              <SectionCard title="Cumulative total" description="Running total across the period">
                <CumulativeAreaChart data={overTime} />
              </SectionCard>
            </div>
          )}
        </TabsContent>

        {/* Categories ------------------------------------------------ */}
        <TabsContent value="categories">
          {noData && !normalStats.some((s) => s.total) ? (
            noDataCard
          ) : (
            <SectionCard title="Category-wise expense report" description={`${normalStats.length} categories · ${labelA}`}>
              {/* Phones: cards */}
              <ul className="divide-y md:hidden">
                {normalStats.map((s) => (
                  <li key={s.category.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CategoryLabel category={s.category} showCode />
                      <span className="tabular shrink-0 font-semibold">{money(s.total)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.share)}%`, backgroundColor: s.category.color }} />
                      </div>
                      <span className="tabular w-12 text-right text-xs text-muted-foreground">{s.share.toFixed(1)}%</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.count} entr{s.count === 1 ? "y" : "ies"} · avg {money(s.count ? s.total / s.count : 0)}
                    </p>
                  </li>
                ))}
                <li className="flex justify-between py-3 font-semibold">
                  <span>Total</span>
                  <span className="tabular">{money(summary.totalExpenses)}</span>
                </li>
              </ul>
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-48">Share</TableHead>
                      <TableHead className="text-right">Avg / entry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {normalStats.map((s) => (
                      <TableRow key={s.category.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{s.category.code}</TableCell>
                        <TableCell className="max-w-[260px]">
                          <Link href={`/categories/${s.category.id}`} className="block min-w-0 hover:underline">
                            <CategoryLabel category={s.category} size="xs" />
                          </Link>
                        </TableCell>
                        <TableCell className="tabular text-right">{s.count}</TableCell>
                        <TableCell className="tabular text-right font-medium">{money(s.total)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.share)}%`, backgroundColor: s.category.color }} />
                            </div>
                            <span className="tabular w-12 text-right text-xs text-muted-foreground">{s.share.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="tabular text-right text-muted-foreground">{money(s.count ? s.total / s.count : 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell />
                      <TableCell>Total</TableCell>
                      <TableCell className="tabular text-right">{summary.entryCount}</TableCell>
                      <TableCell className="tabular text-right">{money(summary.totalExpenses)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{summary.totalExpenses > 0 ? "100%" : "0%"}</TableCell>
                      <TableCell className="tabular text-right">{money(summary.averageExpense)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </SectionCard>
          )}
        </TabsContent>

        {/* Monthly / Yearly ----------------------------------------- */}
        {(["monthly", "yearly"] as const).map((t) => {
          const rows = t === "monthly" ? monthly : yearly;
          const series = t === "monthly" ? monthlySeries : yearlySeries;
          return (
            <TabsContent key={t} value={t}>
              {noData ? (
                noDataCard
              ) : (
                <div className="grid gap-4 sm:gap-5 lg:grid-cols-5 lg:gap-6">
                  <SectionCard title={t === "monthly" ? "Monthly expenses" : "Yearly expenses"} description={labelA} className="lg:col-span-3">
                    <PeriodBarChart data={series} />
                  </SectionCard>
                  <SectionCard title={t === "monthly" ? "By month" : "By year"} description="Change compares with the previous period" className="lg:col-span-2">
                    <div className="max-h-[420px] overflow-auto rounded-lg border scrollbar-thin">
                      <Table>
                        <TableHeader className="sticky top-0 z-[1] bg-muted">
                          <TableRow>
                            <TableHead>{t === "monthly" ? "Month" : "Year"}</TableHead>
                            <TableHead className="text-right">Entries</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...rows].reverse().map((r) => (
                            <TableRow key={r.key}>
                              <TableCell className="whitespace-nowrap font-medium">{r.label}</TableCell>
                              <TableCell className="tabular text-right">{r.count}</TableCell>
                              <TableCell className="tabular whitespace-nowrap text-right">{money(r.total)}</TableCell>
                              <TableCell className="text-right">{r.first ? <span className="text-xs text-muted-foreground">—</span> : <Delta value={r.change} />}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell>Total</TableCell>
                            <TableCell className="tabular text-right">{summary.entryCount}</TableCell>
                            <TableCell className="tabular whitespace-nowrap text-right">{money(summary.totalExpenses)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </SectionCard>
                </div>
              )}
            </TabsContent>
          );
        })}

        {/* Calculated ------------------------------------------------ */}
        <TabsContent value="calculated">
          {calcReports.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon={Calculator}
                title="No calculated categories"
                description="Combine categories with a formula, e.g. Train + Bus + Flight tickets."
                action={
                  <Button asChild>
                    <Link href="/formula-builder">Open formula builder</Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
              {calcReports.map((r) => (
                <SectionCard
                  key={r.category.id}
                  title={r.category.name}
                  description={labelA}
                  action={
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/categories/${r.category.id}`}>Details</Link>
                    </Button>
                  }
                >
                  <div className="mb-4 rounded-lg border bg-muted/40 px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Formula</p>
                    <p className="mt-0.5 break-words font-mono text-sm">{fmtFormula(r.category) ? formulaToString(r.category.formula, (id) => codeOf.get(id) ?? "?", { pretty: true }) : "No formula yet"}</p>
                    {r.category.formula?.length ? (
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">{formulaToString(r.category.formula, (id) => nameOf.get(id) ?? "?", { pretty: true })}</p>
                    ) : null}
                  </div>
                  <ul className="divide-y">
                    {r.rows.map((b) => (
                      <li key={b.category.id} className="flex items-center gap-3 py-2.5">
                        <CategoryLabel category={b.category} size="xs" className="flex-1" />
                        <span className="tabular w-12 shrink-0 text-right text-xs text-muted-foreground">{b.share.toFixed(1)}%</span>
                        {b.error ? (
                          <span className="max-w-[40%] truncate text-xs text-destructive" title={b.error}>
                            {b.error}
                          </span>
                        ) : (
                          <span className="tabular w-28 shrink-0 truncate text-right text-sm font-medium">{money(b.value)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between gap-3 border-t pt-3">
                    <span className="text-sm font-semibold">{r.category.name}</span>
                    {r.result?.error ? (
                      <Badge variant="destructive" className="max-w-[60%] truncate" title={r.result.error}>
                        {r.result.error}
                      </Badge>
                    ) : (
                      <span className="tabular text-lg font-semibold text-primary">{money(r.result?.value ?? 0)}</span>
                    )}
                  </div>
                </SectionCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Compare --------------------------------------------------- */}
        <TabsContent value="compare" className="space-y-4 sm:space-y-5 lg:space-y-6">
          <Card className="p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <p className="text-[13px] font-medium">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-primary align-middle" />
                  Range A <span className="font-normal text-muted-foreground">(page filter)</span>
                </p>
                <DateRangeFilter state={state} range={range} onChange={setState} />
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-success align-middle" />
                    Range B
                  </p>
                  {bOverride && prev && (
                    <Button variant="link" size="xs" className="h-auto px-0" onClick={() => setBOverride(null)}>
                      Reset to previous period
                    </Button>
                  )}
                </div>
                <DateRangeFilter state={stateB} range={rangeB} onChange={setBOverride} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            <StatCard label="Range A total" icon={Wallet} value={money(summary.totalExpenses)} sub={labelA} />
            <StatCard label="Range B total" icon={Wallet} tone="success" value={ptsB.isLoading ? "…" : money(totalB)} sub={labelB} />
            <StatCard label="Difference" icon={BarChart3} tone="violet" value={money(summary.totalExpenses - totalB)} sub="A minus B" />
            <StatCard
              label="Change"
              icon={summary.totalExpenses >= totalB ? ArrowUpRight : ArrowDownRight}
              tone={summary.totalExpenses > totalB ? "rose" : "success"}
              value={fmtPct(pctChange(summary.totalExpenses, totalB))}
              sub={summary.totalExpenses > totalB ? "More spent in A" : summary.totalExpenses < totalB ? "Less spent in A" : "No change"}
            />
          </div>

          {ptsB.error ? (
            <ErrorState error={ptsB.error} onRetry={() => ptsB.refetch()} />
          ) : (
            <div className="grid gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-5">
              <SectionCard title="By category" description="Normal categories, A vs B" className="xl:col-span-2">
                <CompareBarChart
                  labelA="Range A"
                  labelB="Range B"
                  rows={compareRows.filter((r) => r.category.type === "NORMAL").map((r) => ({ name: r.category.name, a: r.a, b: r.b }))}
                />
              </SectionCard>
              <SectionCard title="Comparison table" description="Positive change means more was spent in Range A" className="xl:col-span-3">
                {compareRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No expenses in either period.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Range A</TableHead>
                          <TableHead className="text-right">Range B</TableHead>
                          <TableHead className="text-right">Δ</TableHead>
                          <TableHead className="text-right">Δ %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareRows.map((r) => (
                          <TableRow key={r.category.id}>
                            <TableCell className="min-w-[160px] max-w-[240px]">
                              <CategoryLabel category={r.category} size="xs" />
                            </TableCell>
                            <TableCell className="tabular whitespace-nowrap text-right">{money(r.a)}</TableCell>
                            <TableCell className="tabular whitespace-nowrap text-right">{money(r.b)}</TableCell>
                            <TableCell className="tabular whitespace-nowrap text-right">{money(r.diff)}</TableCell>
                            <TableCell className="text-right">
                              <Delta value={r.pct} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell>Total expenses</TableCell>
                          <TableCell className="tabular whitespace-nowrap text-right">{money(summary.totalExpenses)}</TableCell>
                          <TableCell className="tabular whitespace-nowrap text-right">{money(totalB)}</TableCell>
                          <TableCell className="tabular whitespace-nowrap text-right">{money(summary.totalExpenses - totalB)}</TableCell>
                          <TableCell className="text-right">
                            <Delta value={pctChange(summary.totalExpenses, totalB)} />
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
