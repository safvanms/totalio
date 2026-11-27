import { prisma } from "./db";
import { dashboardPrefsSchema, settingsSchema } from "@/lib/validation";
import type { Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  currency: "INR",
  dateFormat: "dd MMM yyyy",
  dashboard: dashboardPrefsSchema.parse({}),
};

export async function getSettings(): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { id: "singleton" } });
  if (!row) return DEFAULT_SETTINGS;
  let dashboard = DEFAULT_SETTINGS.dashboard;
  try {
    dashboard = dashboardPrefsSchema.parse(JSON.parse(row.dashboard));
  } catch {
    /* fall back to defaults */
  }
  return { currency: row.currency, dateFormat: row.dateFormat, dashboard };
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const s = settingsSchema.parse(input);
  await prisma.setting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", currency: s.currency, dateFormat: s.dateFormat, dashboard: JSON.stringify(s.dashboard) },
    update: { currency: s.currency, dateFormat: s.dateFormat, dashboard: JSON.stringify(s.dashboard) },
  });
  return getSettings();
}
