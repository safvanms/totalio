"use client";

import { forwardRef } from "react";
import { AlertCircle, Calculator, HelpCircle } from "lucide-react";
import { getCategoryIcon } from "@/lib/constants";
import { OPERATOR_GLYPHS, type FormulaToken } from "@/lib/formula/tokens";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  token: FormulaToken;
  category?: Category;
  value?: number | null;
  formatValue: (n: number | null | undefined) => string;
  selected?: boolean;
  invalid?: boolean;
  dragging?: boolean;
  overlay?: boolean;
}

/** Visual representation of one formula token (category block, operator, paren or number). */
export const TokenChip = forwardRef<HTMLDivElement, ChipProps>(function TokenChip(
  { token, category, value, formatValue, selected, invalid, dragging, overlay, className, ...props },
  ref,
) {
  const ring = cn(
    selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
    invalid && "ring-2 ring-destructive ring-offset-2 ring-offset-card animate-pulse",
    dragging && "opacity-30",
    overlay && "shadow-2xl ring-2 ring-primary/60 rotate-[-2deg] cursor-grabbing",
  );

  if (token.kind === "category") {
    if (!category) {
      return (
        <div ref={ref} className={cn("flex h-12 items-center gap-2 rounded-xl border border-dashed border-destructive/60 bg-destructive/5 px-3 text-sm text-destructive", ring, className)} {...props}>
          <HelpCircle className="h-4 w-4" /> Missing category
        </div>
      );
    }
    const Icon = getCategoryIcon(category.icon);
    return (
      <div
        ref={ref}
        className={cn(
          "group relative flex h-12 min-w-0 max-w-full select-none items-center gap-2.5 rounded-xl border bg-card py-1.5 pl-1.5 pr-3 shadow-sm transition-shadow animate-pop-in hover:shadow-card-hover",
          ring,
          className,
        )}
        style={{ borderColor: `${category.color}55`, backgroundImage: `linear-gradient(135deg, ${category.color}14, transparent 70%)` }}
        {...props}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: category.color }}>
          <Icon className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[13px] font-semibold" title={category.name}>
              {category.name}
            </span>
            {category.type === "CALCULATED" && <Calculator className="h-3 w-3 shrink-0 text-primary" aria-label="calculated" />}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono">{category.code}</span>
            <span aria-hidden>·</span>
            {value === null ? (
              <span className="flex items-center gap-0.5 text-destructive">
                <AlertCircle className="h-3 w-3" /> error
              </span>
            ) : (
              <span className="tabular truncate font-medium text-foreground/80">{formatValue(value)}</span>
            )}
          </span>
        </span>
      </div>
    );
  }

  if (token.kind === "operator") {
    return (
      <div
        ref={ref}
        aria-label={`operator ${token.op}`}
        className={cn(
          "flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 text-lg font-semibold text-primary shadow-sm animate-pop-in",
          ring,
          className,
        )}
        {...props}
      >
        {OPERATOR_GLYPHS[token.op]}
      </div>
    );
  }

  if (token.kind === "lparen" || token.kind === "rparen") {
    return (
      <div
        ref={ref}
        aria-label={token.kind === "lparen" ? "open parenthesis" : "close parenthesis"}
        className={cn(
          "flex h-12 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-muted text-2xl font-light text-muted-foreground animate-pop-in",
          ring,
          className,
        )}
        {...props}
      >
        {token.kind === "lparen" ? "(" : ")"}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-10 min-w-10 max-w-[10rem] shrink-0 select-none items-center justify-center rounded-lg border border-dashed border-foreground/25 bg-muted/60 px-3 font-mono text-sm font-semibold animate-pop-in",
        ring,
        className,
      )}
      {...props}
    >
      <span className="truncate">{token.value}</span>
    </div>
  );
});
