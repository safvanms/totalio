"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared chart styling tokens (theme-aware through CSS variables). */
export const AXIS_TICK = { fill: "hsl(var(--chart-axis))", fontSize: 11 } as const;
export const GRID_STROKE = "hsl(var(--chart-grid))";
export const AXIS_LINE = { stroke: "hsl(var(--chart-grid))" } as const;
export const SURFACE = "hsl(var(--chart-surface))";
export const PRIMARY = "hsl(var(--primary))";
export const EMERALD = "hsl(var(--success))";
export const OTHER_COLOR = "#94a3b8";

export function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

interface TooltipItem {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: Record<string, unknown>;
}

/**
 * Card-styled HTML tooltip for every Recharts chart. Recharts clones this
 * element and injects `active`, `payload` and `label`.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
  labelFormatter,
  percentOf,
  hideLabel,
  footer,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  valueFormatter?: (v: number) => string;
  labelFormatter?: (label: string | number | undefined, payload: TooltipItem[]) => React.ReactNode;
  /** when set, each row also shows its share of this total */
  percentOf?: number;
  hideLabel?: boolean;
  footer?: (payload: TooltipItem[]) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const heading = labelFormatter ? labelFormatter(label, payload) : label;
  return (
    <div className="min-w-[10rem] max-w-[16rem] rounded-xl border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-xl">
      {!hideLabel && heading !== undefined && heading !== "" && <p className="mb-1.5 font-medium text-muted-foreground">{heading}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          const raw = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value;
          const v = typeof raw === "number" ? raw : Number(raw ?? 0);
          const color = p.color ?? (p.payload?.color as string | undefined) ?? (p.payload?.fill as string | undefined);
          return (
            <li key={`${p.name}-${i}`} className="flex items-center gap-2">
              {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
              <span className="min-w-0 flex-1 truncate text-foreground/80">{p.name}</span>
              <span className="tabular font-semibold text-foreground">{valueFormatter(v)}</span>
              {percentOf !== undefined && percentOf > 0 && (
                <span className="tabular w-11 text-right text-muted-foreground">{((v / percentOf) * 100).toFixed(1)}%</span>
              )}
            </li>
          );
        })}
      </ul>
      {footer && <div className="mt-1.5 border-t pt-1.5">{footer(payload)}</div>}
    </div>
  );
}

/** Fixed-height, overflow-safe container for a chart. */
export function ChartBox({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("h-[240px] w-full min-w-0 sm:h-[280px]", className)}>{children}</div>;
}

export function ChartEmpty({ message = "No expenses in this period", className }: { message?: string; className?: string }) {
  return (
    <div className={cn("flex h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center sm:h-[280px]", className)}>
      <BarChart3 className="h-6 w-6 text-muted-foreground/60" />
      <p className="px-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Simple legend row (identity never by colour alone: always next to a name). */
export function LegendRow({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
