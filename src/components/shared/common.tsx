"use client";

import * as React from "react";
import { AlertTriangle, Calculator, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import type { Category } from "@/lib/types";

/* Category icon tile -------------------------------------------------- */

export function CategoryIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = getCategoryIcon(icon);
  const dims = { xs: "h-6 w-6 rounded-md", sm: "h-8 w-8 rounded-lg", md: "h-10 w-10 rounded-xl", lg: "h-12 w-12 rounded-xl" }[size];
  const iconDims = { xs: "h-3.5 w-3.5", sm: "h-4 w-4", md: "h-[18px] w-[18px]", lg: "h-5 w-5" }[size];
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", dims, className)}
      style={{ backgroundColor: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}2e` }}
      aria-hidden
    >
      <Icon className={iconDims} strokeWidth={2.2} />
    </span>
  );
}

/** Icon + name (+ code) with truncation for long names. */
export function CategoryLabel({
  category,
  size = "sm",
  showCode,
  className,
}: {
  category: Pick<Category, "icon" | "color" | "name" | "code" | "type">;
  size?: "xs" | "sm" | "md";
  showCode?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <CategoryIcon icon={category.icon} color={category.color} size={size} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium" title={category.name}>
            {category.name}
          </span>
          {category.type === "CALCULATED" && (
            <Calculator className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Calculated category" />
          )}
        </span>
        {showCode && <span className="block font-mono text-[11px] text-muted-foreground">{category.code}</span>}
      </span>
    </span>
  );
}

/** Small colour dot used in legends and tables (identity, never alone: always next to a name). */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} aria-hidden />;
}

/* Page header --------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  actionsClassName,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** e.g. "hidden sm:flex" when the actions are shown elsewhere on phones */
  actionsClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:mb-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className={cn("flex flex-wrap items-center gap-2", actionsClassName)}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/* Empty / error / loading -------------------------------------------- */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center animate-fade-in", compact ? "py-8" : "py-14", className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" aria-hidden />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border bg-card text-primary shadow-card">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <Card className={cn("border-destructive/30", className)}>
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load this data"
        description={error instanceof Error ? error.message : "An unexpected error occurred."}
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          )
        }
      />
    </Card>
  );
}

export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <Card className={cn("p-5", className)}>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: `${90 - i * 15}%` }} />
        ))}
      </div>
    </Card>
  );
}

/* Stat card ----------------------------------------------------------- */

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "violet" | "amber" | "sky" | "rose";
  loading?: boolean;
  className?: string;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  return (
    // Compact below `sm` so two cards fit side by side even on 320px phones.
    <Card className={cn("group relative min-w-0 overflow-hidden p-3 transition-shadow hover:shadow-card-hover xs:p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="min-w-0 text-xs font-medium leading-snug text-muted-foreground sm:text-[13px]">{label}</p>
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg xs:h-8 xs:w-8 sm:h-9 sm:w-9 sm:rounded-xl", tones[tone])}>
          <Icon className="h-3.5 w-3.5 xs:h-4 xs:w-4 sm:h-[18px] sm:w-[18px]" />
        </span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-6 w-2/3 sm:h-7" />
          <Skeleton className="mt-2.5 h-3 w-1/2" />
        </>
      ) : (
        <>
          <div
            className="mt-1 truncate text-lg font-semibold tracking-tight xs:text-xl sm:-mt-1 sm:text-2xl"
            title={typeof value === "string" ? value : undefined}
          >
            {value}
          </div>
          {sub && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground sm:mt-1 sm:text-xs" title={typeof sub === "string" ? sub : undefined}>
              {sub}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
