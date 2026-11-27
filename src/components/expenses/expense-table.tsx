"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { CategoryIcon, CategoryLabel } from "@/components/shared/common";
import { useFormat } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";
import type { Category, Expense } from "@/lib/types";

export type SortKey = "expenseDate" | "amount" | "particular" | "category";
export interface SortState {
  sort: SortKey;
  order: "asc" | "desc";
}

function SortHeader({ label, k, state, onSort, className }: { label: string; k: SortKey; state?: SortState; onSort?: (k: SortKey) => void; className?: string }) {
  if (!onSort || !state) return <TableHead className={className}>{label}</TableHead>;
  const active = state.sort === k;
  const Icon = !active ? ArrowUpDown : state.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (state.order === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "-mx-1.5 inline-flex h-8 items-center gap-1 rounded-md px-1.5 uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
          className?.includes("text-right") && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

export function RowActions({ expense, onDelete }: { expense: Expense; onDelete: (e: Expense) => void }) {
  const { openExpense, showExpense } = useDialogs();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${expense.particular}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => showExpense(expense.id)}>
          <Eye /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExpense({ expense })}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={() => onDelete(expense)}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExpenseTable({
  items,
  categoriesById,
  sort,
  onSort,
  selected,
  onToggle,
  onToggleAll,
  onDelete,
  showCategory = true,
  footerTotal,
  footerLabel = "Total",
}: {
  items: Expense[];
  categoriesById: Map<string, Category>;
  sort?: SortState;
  onSort?: (k: SortKey) => void;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onDelete: (e: Expense) => void;
  showCategory?: boolean;
  footerTotal?: number;
  footerLabel?: string;
}) {
  const { money, date } = useFormat();
  const showExpense = useDialogs((s) => s.showExpense);
  const selectable = !!selected && !!onToggle;
  const allSelected = selectable && items.length > 0 && items.every((i) => selected!.has(i.id));
  const someSelected = selectable && items.some((i) => selected!.has(i.id));

  return (
    <>
      {/* md+: table */}
      <div className="hidden md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    aria-label="Select all on this page"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(c) => onToggleAll?.(c === true)}
                  />
                </TableHead>
              )}
              <SortHeader label="Particular" k="particular" state={sort} onSort={onSort} className={showCategory ? "w-[34%]" : "w-[46%]"} />
              {showCategory && <SortHeader label="Category" k="category" state={sort} onSort={onSort} className="w-[24%]" />}
              <SortHeader label="Date" k="expenseDate" state={sort} onSort={onSort} className="w-36" />
              <SortHeader label="Amount" k="amount" state={sort} onSort={onSort} className="w-40 text-right" />
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => {
              const c = categoriesById.get(e.categoryId);
              const isSel = selected?.has(e.id);
              return (
                <TableRow key={e.id} data-state={isSel ? "selected" : undefined} className="cursor-pointer" onClick={() => showExpense(e.id)}>
                  {selectable && (
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Checkbox aria-label={`Select ${e.particular}`} checked={!!isSel} onCheckedChange={() => onToggle!(e.id)} />
                    </TableCell>
                  )}
                  <TableCell>
                    <p className="truncate font-medium" title={e.particular}>
                      {e.particular}
                    </p>
                    {e.description && (
                      <p className="truncate text-xs text-muted-foreground" title={e.description}>
                        {e.description}
                      </p>
                    )}
                  </TableCell>
                  {showCategory && <TableCell>{c ? <CategoryLabel category={c} size="xs" /> : <span className="text-muted-foreground">—</span>}</TableCell>}
                  <TableCell className="whitespace-nowrap text-muted-foreground">{date(e.expenseDate)}</TableCell>
                  <TableCell className="tabular truncate text-right font-semibold" title={money(e.amount)}>
                    {money(e.amount)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                    <RowActions expense={e} onDelete={onDelete} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {footerTotal !== undefined && (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                {selectable && <TableCell />}
                <TableCell colSpan={showCategory ? 3 : 2} className="font-semibold">
                  {footerLabel}
                </TableCell>
                <TableCell className="tabular text-right text-base font-semibold">{money(footerTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* < md: cards */}
      <ul className="divide-y md:hidden">
        {items.map((e) => {
          const c = categoriesById.get(e.categoryId);
          const isSel = selected?.has(e.id);
          return (
            <li key={e.id} className={cn("flex items-center gap-3 px-4 py-3", isSel && "bg-primary/5")}>
              {selectable && <Checkbox aria-label={`Select ${e.particular}`} checked={!!isSel} onCheckedChange={() => onToggle!(e.id)} />}
              <button type="button" onClick={() => showExpense(e.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {c && <CategoryIcon icon={c.icon} color={c.color} size="sm" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.particular}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {showCategory && c ? `${c.name} · ` : ""}
                    {date(e.expenseDate)}
                  </span>
                </span>
                <span className="tabular max-w-[45%] shrink-0 truncate text-right text-sm font-semibold">{money(e.amount)}</span>
              </button>
              <RowActions expense={e} onDelete={onDelete} />
            </li>
          );
        })}
        {footerTotal !== undefined && (
          <li className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
            <span className="text-sm font-semibold">{footerLabel}</span>
            <span className="tabular truncate text-base font-semibold">{money(footerTotal)}</span>
          </li>
        )}
      </ul>
    </>
  );
}
