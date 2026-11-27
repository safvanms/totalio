import { prisma } from "./db";
import { dashboardPrefsSchema, settingsSchema } from "@/lib/validation";
import type { Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  currency: "INR",
  dateFormat: "dd MMM yyyy",
  dashboard: dashboardPrefsSchema.parse({}),
};

export async function getSettings(userId: string): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { userId } });
  if (!row) return DEFAULT_SETTINGS;
  let dashboard = DEFAULT_SETTINGS.dashboard;
  try {
    dashboard = dashboardPrefsSchema.parse(JSON.parse(row.dashboard));
  } catch {
    /* fall back to defaults */
  }
  return { currency: row.currency, dateFormat: row.dateFormat, dashboard };
}

export async function saveSettings(userId: string, input: unknown): Promise<Settings> {
  const s = settingsSchema.parse(input);
  const data = { currency: s.currency, dateFormat: s.dateFormat, dashboard: JSON.stringify(s.dashboard) };
  await prisma.setting.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return getSettings(userId);
}
