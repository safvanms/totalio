"use client";

import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Calculator, ChevronDown, GripVertical, Lock, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/primitives";
import { Hint } from "@/components/ui/overlays";
import { CategoryIcon } from "@/components/shared/common";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

function LibraryItem({
  category,
  value,
  formatValue,
  blocked,
  onAdd,
}: {
  category: Category;
  value: number | null | undefined;
  formatValue: (n: number | null | undefined) => string;
  blocked: boolean;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${category.id}`,
    data: { source: "library", categoryId: category.id },
    disabled: blocked,
  });

  const body = (
    <li
      ref={setNodeRef}
      className={cn(
        "group flex min-w-0 items-center gap-2 rounded-xl border bg-card p-1.5 pr-1 transition-all",
        blocked ? "cursor-not-allowed opacity-50" : "hover:border-primary/40 hover:shadow-card-hover",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        disabled={blocked}
        aria-label={`Drag ${category.name} into the formula`}
        className={cn(
          "flex h-11 min-w-0 flex-1 touch-none items-center gap-2.5 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10",
          !blocked && "cursor-grab active:cursor-grabbing",
        )}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
        <CategoryIcon icon={category.icon} color={category.color} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[13px] font-medium" title={category.name}>
              {category.name}
            </span>
            {category.type === "CALCULATED" && <Calculator className="h-3 w-3 shrink-0 text-primary" />}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono">{category.code}</span>
            <span aria-hidden>·</span>
            <span className="tabular truncate">{value === null ? "error" : formatValue(value)}</span>
          </span>
        </span>
      </button>
      {blocked ? (
        <Hint label="Adding this would create a circular dependency">
          <span className="flex h-10 w-10 items-center justify-center text-muted-foreground">
            <Lock className="h-4 w-4" />
          </span>
        </Hint>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add ${category.name} to the formula`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </li>
  );
  return body;
}

export function CategoryLibrary({
  categories,
  values,
  formatValue,
  blockedIds,
  onAdd,
}: {
  categories: Category[];
  values: Map<string, number | null>;
  formatValue: (n: number | null | undefined) => string;
  blockedIds: Set<string>;
  onAdd: (categoryId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(true);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? categories.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s)) : categories;
  }, [categories, q]);
  const normal = filtered.filter((c) => c.type === "NORMAL");
  const calc = filtered.filter((c) => c.type === "CALCULATED");

  return (
    <section aria-label="Category library" className="flex min-h-0 flex-col rounded-2xl border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 px-4 pb-2 pt-4 text-left lg:pointer-events-none"
        aria-expanded={open}
      >
        <span>
          <span className="block text-[15px] font-semibold">Categories</span>
          <span className="block text-xs text-muted-foreground">
            <span className="hidden md:inline">Drag into the workspace</span>
            <span className="md:hidden">Tap + to add</span>, or use the + button
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform lg:hidden", open && "rotate-180")} />
      </button>
      <div className={cn("flex min-h-0 flex-1 flex-col", !open && "hidden lg:flex")}>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories" className="pl-9" aria-label="Search categories" />
          </div>
        </div>
        <div className="max-h-[22rem] min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4 scrollbar-thin lg:max-h-[calc(100dvh-16rem)]">
          {filtered.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No categories match &ldquo;{q}&rdquo;.</p>}
          {normal.length > 0 && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Expense categories</p>
              <ul className="space-y-1.5">
                {normal.map((c) => (
                  <LibraryItem key={c.id} category={c} value={values.get(c.id)} formatValue={formatValue} blocked={blockedIds.has(c.id)} onAdd={() => onAdd(c.id)} />
                ))}
              </ul>
            </div>
          )}
          {calc.length > 0 && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Calculated categories</p>
              <ul className="space-y-1.5">
                {calc.map((c) => (
                  <LibraryItem key={c.id} category={c} value={values.get(c.id)} formatValue={formatValue} blocked={blockedIds.has(c.id)} onAdd={() => onAdd(c.id)} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
