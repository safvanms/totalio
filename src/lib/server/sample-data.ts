/**
 * Deterministic sample dataset (used by `npm run db:seed` and the
 * "Load sample data" action in Settings). It is ordinary data written to
 * the database; every chart and statistic is still computed from it.
 */
import type { PrismaClient } from "@prisma/client";
import { addDays, subMonths } from "date-fns";
import { toDateKey, dateKeyToUTC } from "@/lib/dates";
import type { FormulaToken } from "@/lib/formula/tokens";
import { clearAll } from "./backup";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const NORMAL = [
  { code: "C1", name: "Train Tickets", icon: "train", color: "#257de0", description: "Intercity and local train travel" },
  { code: "C2", name: "Bus Tickets", icon: "bus", color: "#f47230", description: "City and long-distance buses" },
  { code: "C3", name: "Flight Tickets", icon: "plane", color: "#00b894", description: "Domestic and international flights" },
  { code: "C4", name: "Hotel Expenses", icon: "hotel", color: "#f2a600", description: "Stays, room service and tips" },
  { code: "C5", name: "Food Expenses", icon: "utensils", color: "#ee7fac", description: "Groceries, restaurants and snacks" },
  { code: "C6", name: "Shopping", icon: "shopping-bag", color: "#008a17", description: null },
  { code: "C7", name: "Utilities", icon: "zap", color: "#6a4ce2", description: "Electricity, water, internet" },
];

const PARTICULARS: Record<string, { items: string[]; min: number; max: number; perMonth: [number, number] }> = {
  C1: { items: ["Train ticket to Kochi", "Return ticket", "Express ticket", "Metro card recharge", "Sleeper class to Chennai"], min: 120, max: 900, perMonth: [2, 5] },
  C2: { items: ["City bus pass", "KSRTC to Trivandrum", "Airport shuttle", "Night bus to Bangalore"], min: 40, max: 1200, perMonth: [2, 6] },
  C3: { items: ["Flight to Delhi", "Flight to Mumbai", "Return flight", "Baggage fee"], min: 1500, max: 9500, perMonth: [0, 2] },
  C4: { items: ["Hotel stay - Mumbai", "Homestay - Munnar", "Room service", "Late checkout"], min: 900, max: 6500, perMonth: [0, 2] },
  C5: { items: ["Groceries", "Lunch with team", "Dinner out", "Coffee", "Snacks", "Weekend brunch"], min: 60, max: 2400, perMonth: [8, 16] },
  C6: { items: ["Clothes", "Headphones", "Books", "Home decor", "Gift for friend"], min: 300, max: 5000, perMonth: [1, 4] },
  C7: { items: ["Electricity bill", "Internet bill", "Water bill", "Mobile recharge"], min: 199, max: 3200, perMonth: [3, 4] },
};

export async function loadSampleData(db: PrismaClient, userId: string) {
  await clearAll(db, userId);
  const rand = rng(42);
  const ids: Record<string, string> = {};
  const created = new Date();
  for (const [i, c] of NORMAL.entries()) {
    const row = await db.category.create({
      data: { ...c, userId, type: "NORMAL", createdAt: subMonths(created, 15 - i * 0.1) },
    });
    ids[c.code] = row.id;
  }

  const t = (id: string): FormulaToken => ({ id: `s_${Math.round(rand() * 1e9)}`, kind: "category", categoryId: id });
  const plus = (): FormulaToken => ({ id: `s_${Math.round(rand() * 1e9)}`, kind: "operator", op: "+" });

  const tickets = [t(ids.C1), plus(), t(ids.C2), plus(), t(ids.C3)];
  const allTickets = await db.category.create({
    data: {
      userId,
      code: "C8",
      name: "All Tickets Expenses",
      icon: "ticket",
      color: "#ec4647",
      type: "CALCULATED",
      description: "Train + Bus + Flight tickets",
      formula: JSON.stringify(tickets),
    },
  });
  const travel = [t(allTickets.id), plus(), t(ids.C4)];
  const totalTravel = await db.category.create({
    data: {
      userId,
      code: "C9",
      name: "Total Travel Cost",
      icon: "globe",
      color: "#0e7490",
      type: "CALCULATED",
      description: "All tickets plus hotel stays (references another calculated category)",
      formula: JSON.stringify(travel),
    },
  });
  await db.categoryDependency.createMany({
    data: [
      { categoryId: allTickets.id, referencesId: ids.C1 },
      { categoryId: allTickets.id, referencesId: ids.C2 },
      { categoryId: allTickets.id, referencesId: ids.C3 },
      { categoryId: totalTravel.id, referencesId: allTickets.id },
      { categoryId: totalTravel.id, referencesId: ids.C4 },
    ],
  });

  // ~14 months of expenses ending today.
  const today = new Date();
  const start = subMonths(today, 13);
  start.setDate(1);
  const rows: { userId: string; categoryId: string; particular: string; amount: number; expenseDate: Date; description: string | null }[] = [];
  for (let m = 0; m < 14; m++) {
    const monthStart = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    for (const [code, spec] of Object.entries(PARTICULARS)) {
      const n = spec.perMonth[0] + Math.floor(rand() * (spec.perMonth[1] - spec.perMonth[0] + 1));
      for (let k = 0; k < n; k++) {
        const day = addDays(monthStart, Math.floor(rand() * daysInMonth));
        if (day > today) continue;
        const amount = Math.round((spec.min + rand() * (spec.max - spec.min)) / 10) * 10;
        rows.push({
          userId,
          categoryId: ids[code],
          particular: spec.items[Math.floor(rand() * spec.items.length)],
          amount,
          expenseDate: dateKeyToUTC(toDateKey(day)),
          description: null,
        });
      }
    }
  }
  // The exact example from the brief, in the current month.
  const d = toDateKey(today);
  rows.push(
    { userId, categoryId: ids.C1, particular: "Train ticket to Kochi", amount: 450, expenseDate: dateKeyToUTC(d), description: "Sample entry" },
    { userId, categoryId: ids.C1, particular: "Return ticket", amount: 450, expenseDate: dateKeyToUTC(d), description: "Sample entry" },
    { userId, categoryId: ids.C1, particular: "Express ticket", amount: 650, expenseDate: dateKeyToUTC(d), description: "Sample entry" },
  );
  await db.expense.createMany({ data: rows });
  return { categories: NORMAL.length + 2, expenses: rows.length };
}
