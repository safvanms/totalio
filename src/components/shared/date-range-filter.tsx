"use client";

import { useState } from "react";
import type { DateRange as DayRange } from "react-day-picker";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { describeRange, fromDateKey, PRESET_LABELS, toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-settings";
import type { RangeState } from "@/stores/ui-store";
import type { DateRange, RangePreset } from "@/lib/types";

const PRESETS: RangePreset[] = ["today", "week", "month", "year", "all"];

/**
 * Date-range control: preset chips on wide screens, a select on phones,
 * and a calendar popover for a custom range.
 */
export function DateRangeFilter({
  state,
  range,
  onChange,
  className,
  phoneLeading,
}: {
  state: RangeState;
  range: DateRange;
  onChange: (s: RangeState) => void;
  className?: string;
  /** Phones only: content placed at the start of the row, with the select pushed to the end. */
  phoneLeading?: React.ReactNode;
}) {
  const { dateFormat } = useFormat();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | undefined>();

  const openCustom = (o: boolean) => {
    setOpen(o);
    if (o) {
      setDraft({
        from: range.from ? fromDateKey(range.from) : undefined,
        to: range.to ? fromDateKey(range.to) : undefined,
      });
    }
  };

  const apply = () => {
    if (!draft?.from) return;
    onChange({ preset: "custom", from: toDateKey(draft.from), to: toDateKey(draft.to ?? draft.from) });
    setOpen(false);
  };

  const customLabel = state.preset === "custom" ? describeRange(range, dateFormat) : "Custom";

  return (
    <Popover open={open} onOpenChange={openCustom}>
      <PopoverAnchor asChild>
      <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {/* Phones: compact select */}
      <div className={cn("flex w-full items-center gap-2 sm:hidden", phoneLeading && "justify-between")}>
        {phoneLeading && <div className="shrink-0">{phoneLeading}</div>}
        <div className={cn("flex min-w-0 items-center gap-2", phoneLeading ? "justify-end" : "flex-1")}>
        <Select
          value={state.preset}
          onValueChange={(v) => (v === "custom" ? openCustom(true) : onChange({ preset: v as RangePreset, from: null, to: null }))}
        >
          <SelectTrigger aria-label="Date range" className={cn(phoneLeading && "w-[10.5rem] xs:w-44")}>
            <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue>{state.preset === "custom" ? customLabel : PRESET_LABELS[state.preset]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[...PRESETS, "custom" as const].map((p) => (
              <SelectItem key={p} value={p}>
                {PRESET_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.preset === "custom" && (
          <Button variant="outline" size="icon" onClick={() => openCustom(true)} aria-label="Edit custom range">
            <CalendarRange />
          </Button>
        )}
        </div>
      </div>

      {/* sm+: segmented presets */}
      <div role="radiogroup" aria-label="Date range" className="hidden max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border bg-card p-0.5 shadow-sm scrollbar-thin sm:inline-flex">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={state.preset === p}
            onClick={() => onChange({ preset: p, from: null, to: null })}
            className={cn(
              "h-8 whitespace-nowrap rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              state.preset === p && "bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground",
            )}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

        <PopoverTrigger asChild>
          <Button
            variant={state.preset === "custom" ? "default" : "outline"}
            size="sm"
            className={cn("hidden max-w-full sm:inline-flex", open && "ring-2 ring-ring/30")}
          >
            <CalendarRange />
            <span className="truncate">{customLabel}</span>
            <ChevronDown className="opacity-60" />
          </Button>
        </PopoverTrigger>
      </div>
      </PopoverAnchor>
        <PopoverContent align="end" className="w-auto p-3">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1}
            defaultMonth={draft?.from}
            weekStartsOn={1}
          />
          <div className="mt-3 flex flex-col gap-2 border-t pt-3 xs:flex-row xs:items-center xs:justify-between">
            <p className="text-xs text-muted-foreground">
              {draft?.from
                ? describeRange({ from: toDateKey(draft.from), to: toDateKey(draft.to ?? draft.from) }, dateFormat)
                : "Pick a start and end date"}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={apply} disabled={!draft?.from}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
    </Popover>
  );
}
