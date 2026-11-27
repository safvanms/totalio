"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Calculator,
  Crown,
  Hash,
  Layers,
  Plus,
  Receipt,
  Shapes,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/select";
import { CardSkeleton, CategoryIcon, EmptyState, ErrorState, PageHeader, StatCard } from "@/components/shared/common";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import {
  CategoryDonut,
  CumulativeAreaChart,
  PeriodBarChart,
  TopCategoriesChart,
  TrendLineChart,
  type CategorySlice,
} from "@/components/charts";
import { useCategories, useExpensePoints } from "@/hooks/use-data";
import { useDateRange } from "@/hooks/use-date-range";
import { useFormat, useSettings } from "@/hooks/use-settings";
import { autoInterval, categoryStats, effectiveBounds, summarize, timeSeries, type Interval } from "@/lib/analytics";
import { daysInRange, describeRange } from "@/lib/dates";
import { formulaToString } from "@/lib/formula";
import { cn, pluralize } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";

function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col animate-fade-in", className)}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="min-w-0 flex-1">{children}</CardContent>
    </Card>
  );
}

export function DashboardView() {
  const settings = useSettings();
  const { money, date, dateFormat, weekStartsOn } = useFormat();
  const { state, range, setState } = useDateRange("dashboard");
  const cats = useCategories();
  const pts = useExpensePoints(range);
  const { openExpense, openQuickAdd, openCategory, showExpense } = useDialogs();

  const [barInterval, setBarInterval] = useState<"month" | "year">("month");
  const [trendInterval, setTrendInterval] = useState<"day" | "week" | "month" | null>(null);

  const categories = useMemo(() => cats.data ?? [], [cats.data]);
  const points = useMemo(() => pts.data ?? [], [pts.data]);

  const summary = useMemo(() => summarize(categories, points, range), [categories, points, range]);
  const stats = useMemo(() => categoryStats(categories, points), [categories, points]);
  const slices: CategorySlice[] = useMemo(
    () =>
      stats
        .filter((s) => s.category.type === "NORMAL")
        .map((s) => ({ id: s.category.id, name: s.category.name, color: s.category.color, total: s.total })),
    [stats],
  );
  const bounds = effectiveBounds(range, points);
  const spanDays = bounds ? daysInRange(bounds.from, bounds.to) : 0;
  const autoTrend = autoInterval(spanDays);
  const trendIv: Interval = trendInterval ?? (autoTrend === "year" ? "month" : autoTrend);

  const barSeries = useMemo(() => timeSeries(points, range, barInterval, weekStartsOn), [points, range, barInterval, weekStartsOn]);
  const trendSeries = useMemo(() => timeSeries(points, range, trendIv, weekStartsOn), [points, range, trendIv, weekStartsOn]);
  const cumulative = useMemo(() => timeSeries(points, range, autoTrend, weekStartsOn), [points, range, autoTrend, weekStartsOn]);

  const codeOf = useMemo(() => new Map(categories.map((c) => [c.id, c.code])), [categories]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const calculated = stats.filter((s) => s.category.type === "CALCULATED");
  const recent = useMemo(() => [...points].sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1)).slice(0, 6), [points]);
  const vis = settings.dashboard.visibleCharts;
  const rangeLabel = describeRange(range, dateFormat);

  const header = (
    <PageHeader
      title="Dashboard"
      description={`Your spending at a glance · ${rangeLabel}`}
      // Phones: "Add expense" is already in the top bar, and Quick add sits next to the date filter.
      actionsClassName="hidden sm:flex"
      actions={
        <>
          <Button variant="outline" onClick={() => openQuickAdd()}>
            <Zap /> Quick add
          </Button>
          <Button onClick={() => openExpense()}>
            <Plus /> Add expense
          </Button>
        </>
      }
    >
      <DateRangeFilter
        state={state}
        range={range}
        onChange={setState}
        phoneLeading={
          <Button variant="outline" onClick={() => openQuickAdd()}>
            <Zap /> Quick add
          </Button>
        }
      />
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

  const loading = cats.isLoading || pts.isLoading;

  if (!loading && categories.length === 0) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Shapes}
            title="Welcome to Totalio"
            description="Start by creating categories like Train Tickets or Food, then add your expenses. Charts and insights appear automatically."
            action={
              <>
                <Button onClick={() => openCategory({ type: "NORMAL" })}>
                  <Plus /> Create category
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/settings">Load sample data</Link>
                </Button>
              </>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total Expenses"
          icon={Wallet}
          tone="primary"
          loading={loading}
          value={money(summary.totalExpenses)}
          sub={rangeLabel}
        />
        <StatCard
          label="Total Categories"
          icon={Layers}
          tone="violet"
          loading={loading}
          value={summary.totalCategories.toLocaleString()}
          sub={`${summary.normalCategories} normal · ${summary.calculatedCategories} calculated`}
        />
        <StatCard
          label="Expense Entries"
          icon={Hash}
          tone="sky"
          loading={loading}
          value={summary.entryCount.toLocaleString()}
          sub={summary.days ? `over ${pluralize(summary.days, "day")}` : "No entries in range"}
        />
        <StatCard
          label="Highest Spending"
          icon={Crown}
          tone="amber"
          loading={loading}
          value={summary.highest ? summary.highest.category.name : "—"}
          sub={summary.highest ? money(summary.highest.total) : "No spending yet"}
        />
        <StatCard
          label="Average Expense"
          icon={TrendingUp}
          tone="success"
          loading={loading}
          value={money(summary.averageExpense)}
          sub="per entry"
        />
        <StatCard
          label="Current Month"
          icon={CalendarClock}
          tone="rose"
          loading={loading}
          value={money(summary.currentMonthTotal)}
          sub="this month, within the selected range"
        />
      </section>

      {!loading && points.length === 0 && (
        <Card className="mt-4 sm:mt-5 lg:mt-6">
          <EmptyState
            compact
            icon={Receipt}
            title="No expenses in this period"
            description="Try a wider date range, or add an expense to see your charts come alive."
            action={
              <>
                <Button onClick={() => openExpense()}>
                  <Plus /> Add expense
                </Button>
                <Button variant="outline" onClick={() => setState({ preset: "all", from: null, to: null })}>
                  Show all time
                </Button>
              </>
            }
          />
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:mt-6 lg:grid-cols-2 lg:gap-6 xl:grid-cols-3">
        {loading ? (
          <>
            <CardSkeleton className="h-[340px]" />
            <CardSkeleton className="h-[340px] xl:col-span-2" />
            <CardSkeleton className="h-[340px] lg:col-span-2 xl:col-span-3" />
          </>
        ) : (
          <>
            {vis.donut && (
              <ChartCard title="Expenses by Category" description="Share of spending per category">
                <CategoryDonut slices={slices} total={summary.totalExpenses} />
              </ChartCard>
            )}
            {vis.monthly && (
              <ChartCard
                title={barInterval === "month" ? "Monthly Expenses" : "Yearly Expenses"}
                description={barInterval === "month" ? "Total spent each month" : "Total spent each year"}
                className="xl:col-span-2"
                action={
                  <Segmented
                    ariaLabel="Bar interval"
                    size="xs"
                    value={barInterval}
                    onChange={setBarInterval}
                    options={[
                      { value: "month", label: "Monthly" },
                      { value: "year", label: "Yearly" },
                    ]}
                  />
                }
              >
                <PeriodBarChart data={barSeries} />
              </ChartCard>
            )}
            {vis.trend && (
              <ChartCard
                title="Spending Trend"
                description="How your spending moves over time"
                className="lg:col-span-2"
                action={
                  <Segmented
                    ariaLabel="Trend interval"
                    size="xs"
                    value={trendIv as "day" | "week" | "month"}
                    onChange={setTrendInterval}
                    options={[
                      { value: "day", label: "Daily" },
                      { value: "week", label: "Weekly" },
                      { value: "month", label: "Monthly" },
                    ]}
                  />
                }
              >
                <TrendLineChart data={trendSeries} />
              </ChartCard>
            )}
            {vis.top && (
              <ChartCard title="Top Spending Categories" description="Ranked by amount spent">
                <TopCategoriesChart slices={slices} total={summary.totalExpenses} />
              </ChartCard>
            )}
            {vis.cumulative && (
              <ChartCard
                title="Cumulative Expenses"
                description="Running total across the selected period"
                className="xl:col-span-2"
              >
                <CumulativeAreaChart data={cumulative} />
              </ChartCard>
            )}

            {settings.dashboard.showCalculatedOnDashboard && calculated.length > 0 && (
              <ChartCard title="Calculated Categories" description="Formula totals for this period">
                <ul className="-mx-1 divide-y">
                  {calculated.map((s) => (
                    <li key={s.category.id}>
                      <Link
                        href={`/categories/${s.category.id}`}
                        className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <CategoryIcon icon={s.category.icon} color={s.category.color} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.category.name}</span>
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {s.category.formula?.length
                              ? formulaToString(s.category.formula, (id) => codeOf.get(id) ?? "?", { pretty: true })
                              : "No formula yet"}
                          </span>
                        </span>
                        {s.error ? (
                          <span className="max-w-[45%] truncate text-right text-xs text-destructive" title={s.error}>
                            {s.error}
                          </span>
                        ) : (
                          <span className="tabular shrink-0 text-sm font-semibold">{money(s.total)}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="mt-2 w-full" asChild>
                  <Link href="/formula-builder">
                    <Calculator /> Open formula builder
                  </Link>
                </Button>
              </ChartCard>
            )}

            <ChartCard
              title="Recent Expenses"
              description="Latest entries in this period"
              className={cn(settings.dashboard.showCalculatedOnDashboard && calculated.length > 0 ? "xl:col-span-3" : "lg:col-span-2 xl:col-span-1")}
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/expenses/history">
                    View all <ArrowRight />
                  </Link>
                </Button>
              }
            >
              {recent.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No expenses in this period.</p>
              ) : (
                <ul className="-mx-1 divide-y">
                  {recent.map((e) => {
                    const c = byId.get(e.categoryId);
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => showExpense(e.id)}
                          className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {c ? <CategoryIcon icon={c.icon} color={c.color} size="sm" /> : <Skeleton className="h-8 w-8" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.particular}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {c?.name ?? "Unknown"} · {date(e.expenseDate)}
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-sm font-semibold">{money(e.amount)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ChartCard>
          </>
        )}
      </div>
    </>
  );
}
