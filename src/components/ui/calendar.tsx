"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-1", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-3",
        month_caption: "flex h-9 items-center justify-center text-sm font-semibold",
        caption_label: "text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "h-9 w-9 sm:h-8 sm:w-8"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "h-9 w-9 sm:h-8 sm:w-8"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-10 text-center text-[11px] font-medium uppercase text-muted-foreground sm:w-9",
        week: "mt-1 flex w-full",
        day: "relative h-10 w-10 p-0 text-center text-sm sm:h-9 sm:w-9 [&:has([aria-selected].range_middle)]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg",
        day_button:
          "inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-normal transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9 aria-selected:opacity-100",
        range_start: "range_start rounded-l-lg bg-primary/10 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        range_end: "range_end rounded-r-lg bg-primary/10 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        range_middle: "range_middle bg-primary/10 [&>button]:rounded-none [&>button]:hover:bg-primary/20",
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        today: "[&>button]:font-semibold [&>button]:text-primary",
        outside: "opacity-40",
        disabled: "opacity-30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
