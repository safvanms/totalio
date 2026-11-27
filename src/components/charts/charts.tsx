"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Segmented } from "@/components/ui/select";
import { useFormat } from "@/hooks/use-settings";
import { autoInterval, calculatedHistory, effectiveBounds, type Interval, type SeriesPoint } from "@/lib/analytics";
import { daysInRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Category, DateRange, ExpensePoint } from "@/lib/types";
import {
  AXIS_LINE,
  AXIS_TICK,
  ChartBox,
  ChartEmpty,
  ChartTooltip,
  EMERALD,
  GRID_STROKE,
  LegendRow,
  OTHER_COLOR,
  PRIMARY,
  SURFACE,
  truncate,
} from "./chart-kit";

export interface CategorySlice {
  id: string;
  name: string;
  color: string;
  total: number;
}

const cursorFill = { fill: "hsl(var(--muted))", opacity: 0.6 };

/* Donut ---------------------------------------------------------------- */

/** Folds categories beyond `max` into a single "Other" slice. */
export function foldSlices(slices: CategorySlice[], max = 8): CategorySlice[] {
  const sorted = slices.filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1);
  return [...head, { id: "__other", name: `Other (${rest.length})`, color: OTHER_COLOR, total: rest.reduce((s, r) => s + r.total, 0) }];
}

export function CategoryDonut({ slices, total }: { slices: CategorySlice[]; total: number }) {
  const { money } = useFormat();
  const data = useMemo(() => foldSlices(slices), [slices]);
  if (!data.length) return <ChartEmpty />;
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative mx-auto h-[220px] w-full max-w-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={data.length > 1 ? 1 : 0}
              stroke={SURFACE}
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => money(v)} percentOf={total} hideLabel />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="tabular max-w-[60%] truncate text-lg font-semibold">{money(total, total >= 1e7)}</span>
        </div>
      </div>
      <ul className="min-w-0 space-y-1.5">
        {data.map((d) => (
          <li key={d.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate" title={d.name}>
              {d.name}
            </span>
            <span className="tabular shrink-0 text-xs text-muted-foreground">{total > 0 ? ((d.total / total) * 100).toFixed(1) : "0.0"}%</span>
            <span className="tabular w-[5.5rem] shrink-0 truncate text-right font-medium">{money(d.total, d.total >= 1e6)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Period bars (monthly / yearly) ------------------------------------- */

export function PeriodBarChart({ data, color = PRIMARY, name = "Expenses" }: { data: SeriesPoint[]; color?: string; name?: string }) {
  const { money } = useFormat();
  if (!data.length || data.every((d) => d.total === 0)) return <ChartEmpty />;
  return (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={12} interval="preserveStartEnd" />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => money(v, true)} />
          <Tooltip cursor={cursorFill} content={<ChartTooltip valueFormatter={(v) => money(v)} />} />
          <Bar dataKey="total" name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* Trend line --------------------------------------------------------- */

export function TrendLineChart({ data, color = PRIMARY }: { data: SeriesPoint[]; color?: string }) {
  const { money } = useFormat();
  if (!data.length || data.every((d) => d.total === 0)) return <ChartEmpty />;
  return (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={16} interval="preserveStartEnd" />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => money(v, true)} />
          <Tooltip
            cursor={{ stroke: "hsl(var(--chart-axis))", strokeDasharray: "3 3" }}
            content={<ChartTooltip valueFormatter={(v) => money(v)} />}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Spending"
            stroke={color}
            strokeWidth={2}
            dot={data.length <= 31 ? { r: 3, strokeWidth: 0, fill: color } : false}
            activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* Cumulative area ---------------------------------------------------- */

export function CumulativeAreaChart({
  data,
  dataKey = "cumulative",
  name = "Cumulative",
  color = EMERALD,
}: {
  data: SeriesPoint[];
  dataKey?: "cumulative" | "total";
  name?: string;
  color?: string;
}) {
  const { money } = useFormat();
  const gid = `area-${dataKey}`;
  if (!data.length || data.every((d) => d.total === 0)) return <ChartEmpty />;
  return (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={16} interval="preserveStartEnd" />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => money(v, true)} />
          <Tooltip
            cursor={{ stroke: "hsl(var(--chart-axis))", strokeDasharray: "3 3" }}
            content={<ChartTooltip valueFormatter={(v) => money(v)} />}
          />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${gid})`} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* Top categories (horizontal) ---------------------------------------- */

export function TopCategoriesChart({ slices, total, limit = 8 }: { slices: CategorySlice[]; total: number; limit?: number }) {
  const { money } = useFormat();
  const data = useMemo(
    () =>
      slices
        .filter((s) => s.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, limit),
    [slices, limit],
  );
  if (!data.length) return <ChartEmpty />;
  const height = Math.max(160, data.length * 36 + 24);
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => money(v, true)} minTickGap={16} />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
            width={96}
            tickFormatter={(v: string) => truncate(v, 13)}
          />
          <Tooltip cursor={cursorFill} content={<ChartTooltip valueFormatter={(v) => money(v)} percentOf={total} hideLabel />} />
          <Bar dataKey="total" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Compare (grouped bars, single axis) -------------------------------- */

export function CompareBarChart({
  rows,
  labelA,
  labelB,
}: {
  rows: { name: string; a: number; b: number }[];
  labelA: string;
  labelB: string;
}) {
  const { money } = useFormat();
  if (!rows.length || rows.every((r) => r.a === 0 && r.b === 0)) return <ChartEmpty message="No expenses in either period" />;
  return (
    <div className="space-y-3">
      <LegendRow
        items={[
          { label: labelA, color: PRIMARY },
          { label: labelB, color: EMERALD },
        ]}
      />
      <ChartBox className="h-[280px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="name"
              tick={AXIS_TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
              tickFormatter={(v: string) => truncate(v, 10)}
            />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => money(v, true)} />
            <Tooltip cursor={cursorFill} content={<ChartTooltip valueFormatter={(v) => money(v)} />} />
            <Bar dataKey="a" name={labelA} fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="b" name={labelB} fill={EMERALD} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBox>
    </div>
  );
}

/* Calculated category history ---------------------------------------- */

export function CalculatedHistoryChart({
  categories,
  category,
  points,
  range,
}: {
  categories: Category[];
  category: Category;
  points: ExpensePoint[];
  range: DateRange;
}) {
  const { money, weekStartsOn } = useFormat();
  const bounds = effectiveBounds(range, points);
  const auto: Interval = bounds ? autoInterval(daysInRange(bounds.from, bounds.to)) : "month";
  const [picked, setPicked] = useState<Interval | null>(null);
  const interval: Exclude<Interval, "year"> = ((picked ?? auto) === "year" ? "month" : picked ?? auto) as Exclude<Interval, "year">;
  const [mode, setMode] = useState<"period" | "cumulative">("period");

  const data = useMemo(
    () => calculatedHistory(categories, category.id, points, range, interval, weekStartsOn),
    [categories, category.id, points, range, interval, weekStartsOn],
  );
  const chartData = data.map((d) => ({ label: d.label, value: mode === "period" ? d.value : d.cumulative, error: d.error }));
  const errors = data.filter((d) => d.error && d.value === null).length;
  const hasData = chartData.some((d) => (d.value ?? 0) !== 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          ariaLabel="Value mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "period", label: "Per period" },
            { value: "cumulative", label: "Cumulative" },
          ]}
        />
        <Segmented
          ariaLabel="Interval"
          size="xs"
          value={interval}
          onChange={(v) => setPicked(v)}
          options={[
            { value: "day", label: "Daily" },
            { value: "week", label: "Weekly" },
            { value: "month", label: "Monthly" },
          ]}
        />
      </div>
      {!hasData ? (
        <ChartEmpty message="No values for this formula in the selected period" />
      ) : (
        <ChartBox>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={12} interval="preserveStartEnd" />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => money(v, true)} />
              <Tooltip
                cursor={cursorFill}
                content={
                  <ChartTooltip
                    valueFormatter={(v) => money(v)}
                    footer={(p) => {
                      const err = p[0]?.payload?.error as string | null | undefined;
                      return err ? <span className="text-destructive">{err}</span> : null;
                    }}
                  />
                }
              />
              <Bar dataKey="value" name={category.name} fill={category.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}
      {errors > 0 && (
        <p className={cn("text-xs text-muted-foreground")}>
          {errors} period{errors > 1 ? "s" : ""} could not be calculated (for example, division by zero) and {errors > 1 ? "are" : "is"} shown empty.
        </p>
      )}
    </div>
  );
}
