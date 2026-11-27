"use client";

import { useCallback, useMemo } from "react";
import { useSettingsQuery } from "./use-data";
import { formatMoney, getCurrency } from "@/lib/money";
import { formatDateKey } from "@/lib/dates";
import { dashboardPrefsSchema } from "@/lib/validation";
import type { Settings } from "@/lib/types";

export const FALLBACK_SETTINGS: Settings = {
  currency: "INR",
  dateFormat: "dd MMM yyyy",
  dashboard: dashboardPrefsSchema.parse({}),
};

export function useSettings(): Settings {
  const { data } = useSettingsQuery();
  return data ?? FALLBACK_SETTINGS;
}

/** Formatting helpers bound to the user's currency and date format. */
export function useFormat() {
  const s = useSettings();
  const money = useCallback((n: number | null | undefined, compact = false) => formatMoney(n, s.currency, { compact }), [s.currency]);
  const date = useCallback((key: string) => formatDateKey(key, s.dateFormat), [s.dateFormat]);
  return useMemo(
    () => ({ money, date, currency: getCurrency(s.currency), dateFormat: s.dateFormat, weekStartsOn: s.dashboard.weekStartsOn }),
    [money, date, s.currency, s.dateFormat, s.dashboard.weekStartsOn],
  );
}
