"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiStore, type RangeState } from "@/stores/ui-store";
import { useSettings } from "./use-settings";
import { rangeForPreset } from "@/lib/dates";
import type { DateRange } from "@/lib/types";

/**
 * Date range state for a page scope. Defaults to the user's dashboard
 * preference; persisted per scope. Preset ranges are recomputed on every
 * render so "This Month" stays correct across midnight / month boundaries.
 */
export function useDateRange(scope: string) {
  const settings = useSettings();
  const stored = useUiStore((s) => s.ranges[scope]);
  const setRange = useUiStore((s) => s.setRange);
  // Avoid hydration mismatch: persisted state is only read after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state: RangeState = (mounted && stored) || { preset: settings.dashboard.defaultRange, from: null, to: null };
  const range: DateRange = useMemo(
    () =>
      state.preset === "custom"
        ? { from: state.from, to: state.to }
        : rangeForPreset(state.preset, settings.dashboard.weekStartsOn),
    [state.preset, state.from, state.to, settings.dashboard.weekStartsOn],
  );
  return { state, range, setState: (r: RangeState) => setRange(scope, r) };
}
