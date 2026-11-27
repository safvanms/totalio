import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { conflict, HttpError, notFound } from "./http";
import { hashPassword } from "./password";
import { startSession } from "./auth";
import { purgeUser } from "./accounts";
import { createBackup } from "./backup";
import {
  adminDeleteUserSchema,
  adminListQuerySchema,
  adminSetPasswordSchema,
  adminUpdateUserSchema,
} from "@/lib/validation";
import { sumMoney } from "@/lib/money";
import { utcToDateKey } from "@/lib/dates";
import type { AdminCategory, AdminSession, AdminUserDetail, AdminUserList, AdminUserRow } from "@/lib/admin-types";

const DAY = 86_400_000;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Per-user aggregates, computed with a handful of grouped queries. */
async function aggregates(userIds?: string[]) {
  const whereUser = userIds ? { userId: { in: userIds } } : { userId: { not: null } };
  const now = new Date();
  const [expenses, categories, sessions, settings] = await Promise.all([
    prisma.expense.groupBy({ by: ["userId"], where: whereUser, _count: { _all: true }, _sum: { amount: true }, _max: { expenseDate: true } }),
    prisma.category.groupBy({ by: ["userId"], where: whereUser, _count: { _all: true } }),
    prisma.session.groupBy({
      by: ["userId"],
      where: { expiresAt: { gt: now }, viaAdmin: false, ...(userIds ? { userId: { in: userIds } } : {}) },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.setting.findMany({ where: whereUser, select: { userId: true, currency: true } }),
  ]);
  const index = <T extends { userId: string | null }>(rows: T[]) => new Map(rows.map((r) => [r.userId as string, r]));
  return { expenses: index(expenses), categories: index(categories), sessions: index(sessions), settings: index(settings) };
}

type UserBase = {
  id: string;
  email: string;
  name: string;
  suspended: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
};

function toRow(u: UserBase, agg: Awaited<ReturnType<typeof aggregates>>): AdminUserRow {
  const e = agg.expenses.get(u.id);
  const s = agg.sessions.get(u.id);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    suspended: u.suspended,
    locked: !!u.lockedUntil && u.lockedUntil.getTime() > Date.now(),
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: iso(u.lastLoginAt ?? s?._max.createdAt ?? null),
    activeSessions: s?._count._all ?? 0,
    categoryCount: agg.categories.get(u.id)?._count._all ?? 0,
    expenseCount: e?._count._all ?? 0,
    totalSpent: sumMoney([e?._sum.amount ?? 0]),
    currency: agg.settings.get(u.id)?.currency ?? "INR",
    lastExpenseAt: iso(e?._max.expenseDate ?? null),
  };
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  suspended: true,
  lockedUntil: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

/**
 * Users with usage stats, filtered, sorted and paginated. Filtering happens
 * in memory after one pass of grouped queries, which is fine for the user
 * counts a personal-finance site has (thousands, not millions).
 */
export async function listUsers(query: unknown): Promise<AdminUserList> {
  const { q, filter, sort, page, pageSize } = adminListQuerySchema.parse(query);
  const [users, agg] = await Promise.all([prisma.user.findMany({ select: USER_SELECT }), aggregates()]);
  const rows = users.map((u) => toRow(u, agg));

  const since30 = Date.now() - 30 * DAY;
  const active = (r: AdminUserRow) => !!r.lastLoginAt && Date.parse(r.lastLoginAt) >= since30;
  const totals = {
    users: rows.length,
    suspended: rows.filter((r) => r.suspended).length,
    locked: rows.filter((r) => r.locked).length,
    activeLast30: rows.filter(active).length,
    newLast30: rows.filter((r) => Date.parse(r.createdAt) >= since30).length,
    expenses: rows.reduce((n, r) => n + r.expenseCount, 0),
  };

  const needle = q.toLowerCase();
  let list = rows.filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.email.includes(needle));
  list = list.filter((r) => {
    switch (filter) {
      case "suspended":
        return r.suspended;
      case "locked":
        return r.locked;
      case "active":
        return active(r);
      case "inactive":
        return !active(r);
      default:
        return true;
    }
  });
  const time = (s: string | null) => (s ? Date.parse(s) : 0);
  list.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return time(a.createdAt) - time(b.createdAt);
      case "name":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "lastLogin":
        return time(b.lastLoginAt) - time(a.lastLoginAt);
      case "expenses":
        return b.expenseCount - a.expenseCount;
      default:
        return time(b.createdAt) - time(a.createdAt);
    }
  });

  const total = list.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, lastPage);
  return { totals, users: list.slice((p - 1) * pageSize, p * pageSize), total, page: p, pageSize };
}

export async function getUser(id: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...USER_SELECT, updatedAt: true, failedLogins: true },
  });
  if (!user) throw notFound("User");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [agg, categories, perCategory, first, month, setting, sessions, recent] = await Promise.all([
    aggregates([id]),
    prisma.category.findMany({
      where: { userId: id },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true, color: true, icon: true },
    }),
    prisma.expense.groupBy({ by: ["categoryId"], where: { userId: id }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.expense.findFirst({ where: { userId: id }, orderBy: { expenseDate: "asc" }, select: { expenseDate: true } }),
    prisma.expense.aggregate({ where: { userId: id, expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.setting.findUnique({ where: { userId: id }, select: { dateFormat: true } }),
    prisma.session.findMany({
      where: { userId: id, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, expiresAt: true, userAgent: true, viaAdmin: true },
    }),
    prisma.expense.findMany({
      where: { userId: id },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: { id: true, particular: true, amount: true, expenseDate: true, category: { select: { name: true } } },
    }),
  ]);
  const byCategory = new Map(perCategory.map((p) => [p.categoryId, p]));
  return {
    ...toRow(user, agg),
    updatedAt: user.updatedAt.toISOString(),
    failedLogins: user.failedLogins,
    lockedUntil: iso(user.lockedUntil),
    normalCategories: categories.filter((c) => c.type === "NORMAL").length,
    calculatedCategories: categories.filter((c) => c.type === "CALCULATED").length,
    firstExpenseAt: iso(first?.expenseDate),
    spentThisMonth: sumMoney([month._sum.amount ?? 0]),
    dateFormat: setting?.dateFormat ?? "dd MMM yyyy",
    sessions: sessions.map<AdminSession>((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      userAgent: s.userAgent,
      viaAdmin: s.viaAdmin,
    })),
    categories: categories.map<AdminCategory>((c) => ({
      ...c,
      type: c.type as AdminCategory["type"],
      expenseCount: byCategory.get(c.id)?._count._all ?? 0,
      total: sumMoney([byCategory.get(c.id)?._sum.amount ?? 0]),
    })),
    recentExpenses: recent.map((e) => ({
      id: e.id,
      particular: e.particular,
      amount: e.amount,
      expenseDate: utcToDateKey(e.expenseDate),
      categoryName: e.category.name,
    })),
  };
}

async function assertUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!u) throw notFound("User");
  return u;
}

/** Name and email. */
export async function updateUser(id: string, input: unknown) {
  const data = adminUpdateUserSchema.parse(input);
  const u = await assertUser(id);
  if (data.email && data.email !== u.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (taken) throw conflict("Another account already uses this email.");
  }
  await prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
    },
  });
  return getUser(id);
}

/** A random password that satisfies the password rules (no look-alike characters). */
export function generatePassword(length = 12): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Sets a new password (given, or generated when `generate` is true), clears
 * any lockout and signs the user out everywhere. The new password is
 * returned once so the admin can pass it on; only its hash is stored.
 */
export async function setPassword(id: string, input: { newPassword?: unknown; generate?: boolean }) {
  await assertUser(id);
  const newPassword = input.generate ? generatePassword() : adminSetPasswordSchema.parse(input).newPassword;
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null },
  });
  await prisma.session.deleteMany({ where: { userId: id } });
  return { user: await getUser(id), password: newPassword };
}

export async function unlockUser(id: string) {
  await assertUser(id);
  await prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
  return getUser(id);
}

export async function signOutUser(id: string) {
  await assertUser(id);
  await prisma.session.deleteMany({ where: { userId: id } });
  return getUser(id);
}

export async function endUserSession(id: string, sessionId: string) {
  await assertUser(id);
  const { count } = await prisma.session.deleteMany({ where: { id: sessionId, userId: id } });
  if (!count) throw notFound("Session");
  return getUser(id);
}

export async function setSuspended(id: string, suspended: boolean) {
  await assertUser(id);
  await prisma.user.update({ where: { id }, data: { suspended } });
  if (suspended) await prisma.session.deleteMany({ where: { userId: id } });
  return getUser(id);
}

/**
 * "Open their account": signs this browser in as the user (a short,
 * marked session), so the admin can see and change anything in the app.
 */
export async function impersonate(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { suspended: true } });
  if (!u) throw notFound("User");
  if (u.suspended) throw new HttpError(409, "Reactivate this account before opening it.");
  await startSession(id, { viaAdmin: true });
}

export async function userBackup(id: string) {
  const u = await assertUser(id);
  return { email: u.email, backup: await createBackup(prisma, id) };
}

/** Deletes the user and all their data. The caller must retype the email. */
export async function deleteUser(id: string, input: unknown) {
  const { confirmEmail } = adminDeleteUserSchema.parse(input);
  const u = await assertUser(id);
  if (confirmEmail !== u.email) throw new HttpError(400, "The email you typed doesn't match this account.");
  await purgeUser(id);
}
