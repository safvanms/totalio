"use client";

import { Check } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS, ICON_NAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { CategoryIcon } from "./common";
import type { Category } from "@/lib/types";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colour">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-8 sm:w-8",
            value.toLowerCase() === c && "ring-2 ring-offset-2 ring-offset-background",
          )}
          style={{ backgroundColor: c, ["--tw-ring-color" as string]: c }}
        >
          {value.toLowerCase() === c && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
        </button>
      ))}
      <label
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-input text-[10px] font-medium text-muted-foreground hover:border-primary sm:h-8 sm:w-8"
        title="Custom colour"
      >
        {!CATEGORY_COLORS.includes(value.toLowerCase()) ? (
          <span className="absolute inset-0.5 rounded-full" style={{ backgroundColor: value }} />
        ) : (
          "+"
        )}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom colour" />
      </label>
    </div>
  );
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5" role="radiogroup" aria-label="Icon">
      {ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICONS[name];
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            title={name}
            onClick={() => onChange(name)}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10",
              active && "border-current",
            )}
            style={active ? { color, backgroundColor: `${color}1a` } : undefined}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}
    </div>
  );
}

/** Category select with icons; optionally restricted to normal categories. */
export function CategorySelect({
  categories,
  value,
  onChange,
  placeholder = "Select category",
  allowAll,
  invalid,
  id,
  className,
}: {
  categories: Category[];
  value: string | null | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
  allowAll?: string;
  invalid?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={invalid} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && (
          <>
            <SelectItem value="all">{allowAll}</SelectItem>
            <SelectSeparator />
          </>
        )}
        {categories.length === 0 && <div className="px-3 py-4 text-center text-sm text-muted-foreground">No categories yet</div>}
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <CategoryIcon icon={c.icon} color={c.color} size="xs" />
            <span className="truncate">{c.name}</span>
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">{c.code}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
