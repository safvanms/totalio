"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * Place inside a <Link> whose card is `relative`: covers the card with an
 * "Opening…" state while that link's page is loading.
 */
export function LinkPendingOverlay({ label = "Opening…" }: { label?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-card/70 backdrop-blur-[1px] animate-fade-in" role="status">
      <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        {label}
      </span>
    </span>
  );
}
