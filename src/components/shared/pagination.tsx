"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [10, 20, 50, 100],
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (s: number) => void;
  sizes?: number[];
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        <span className="tabular font-medium text-foreground">
          {start.toLocaleString()}–{end.toLocaleString()}
        </span>{" "}
        of <span className="tabular font-medium text-foreground">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center justify-center gap-2">
        {onPageSize && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger className="h-10 w-[7.5rem] sm:h-9" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => onPage(1)} disabled={page <= 1} aria-label="First page" className="hidden xs:inline-flex">
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="tabular min-w-[4.5rem] text-center text-sm">
            {page} / {pageCount}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page">
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPage(pageCount)} disabled={page >= pageCount} aria-label="Last page" className="hidden xs:inline-flex">
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
