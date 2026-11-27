/** Shapes returned by the /api/admin endpoints (dates are ISO strings). */

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  suspended: boolean;
  locked: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  activeSessions: number;
  categoryCount: number;
  expenseCount: number;
  totalSpent: number;
  currency: string;
  lastExpenseAt: string | null;
}

export interface AdminSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  /** Opened from /admin with "Open their account". */
  viaAdmin: boolean;
}

export interface AdminCategory {
  id: string;
  code: string;
  name: string;
  type: "NORMAL" | "CALCULATED";
  color: string;
  icon: string;
  expenseCount: number;
  total: number;
}

export interface AdminExpense {
  id: string;
  particular: string;
  amount: number;
  expenseDate: string;
  categoryName: string;
}

export interface AdminUserDetail extends AdminUserRow {
  updatedAt: string;
  failedLogins: number;
  lockedUntil: string | null;
  normalCategories: number;
  calculatedCategories: number;
  firstExpenseAt: string | null;
  spentThisMonth: number;
  dateFormat: string;
  sessions: AdminSession[];
  categories: AdminCategory[];
  recentExpenses: AdminExpense[];
}

export interface AdminTotals {
  users: number;
  suspended: number;
  locked: number;
  activeLast30: number;
  newLast30: number;
  expenses: number;
}

export type AdminFilter = "all" | "suspended" | "locked" | "active" | "inactive";
export type AdminSort = "newest" | "oldest" | "name" | "lastLogin" | "expenses";

export interface AdminUserList {
  totals: AdminTotals;
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}
