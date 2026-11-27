"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RangePreset } from "@/lib/types";

export interface RangeState {
  preset: RangePreset;
  /** only used when preset === "custom" */
  from: string | null;
  to: string | null;
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  /** Range per page scope ("dashboard", "reports", "category") — persisted across reloads */
  ranges: Record<string, RangeState>;
  setRange: (scope: string, r: RangeState) => void;
}

// Carry over saved UI preferences from before the rename.
if (typeof window !== "undefined") {
  try {
    const legacy = localStorage.getItem("spendly-ui");
    if (legacy && !localStorage.getItem("totalio-ui")) localStorage.setItem("totalio-ui", legacy);
    if (legacy) localStorage.removeItem("spendly-ui");
  } catch {
    /* storage unavailable */
  }
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      ranges: {},
      setRange: (scope, r) => set((s) => ({ ranges: { ...s.ranges, [scope]: r } })),
    }),
    {
      name: "totalio-ui",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, ranges: s.ranges }),
    },
  ),
);
