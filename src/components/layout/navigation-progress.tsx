"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Thin bar at the top of the window during in-app navigation. It starts on
 * any same-origin link click (capture phase, so menus that stop propagation
 * still count) and finishes when the URL changes. Short navigations that
 * finish within 120ms never show it.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const pending = useRef(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // The URL changed: navigation finished.
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    clear();
    setPhase((p) => (p === "loading" ? "done" : "idle"));
    timers.current.push(window.setTimeout(() => setPhase("idle"), 350));
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      clear();
      pending.current = true;
      timers.current.push(window.setTimeout(() => pending.current && setPhase("loading"), 120));
      // Safety net (e.g. navigation cancelled): never spin forever.
      timers.current.push(
        window.setTimeout(() => {
          pending.current = false;
          setPhase("idle");
        }, 15000),
      );
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);

  if (phase === "idle") return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] pt-[env(safe-area-inset-top,0px)]"
      role="progressbar"
      aria-label="Loading page"
      aria-busy={phase === "loading"}
    >
      <div
        className={cn(
          "h-full origin-left animate-nav-progress rounded-r-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.7)] transition-opacity duration-300",
          phase === "done" && "opacity-0",
        )}
      />
    </div>
  );
}
