import type { FormulaToken } from "@/lib/formula/tokens";

export type CategoryType = "NORMAL" | "CALCULATED";

/** Category as returned by the API (dates serialised to ISO strings). */
export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  type: CategoryType;
  formula: FormulaToken[] | null;
  createdAt: string;
  updatedAt: string;
  /** All-time entry count (normal categories only) */
  expenseCount: number;
  /** All-time total of own expense entries (normal categories only) */
  total: number;
  /** IDs of calculated categories that reference this one */
  dependentIds: string[];
}

export interface Expense {
  id: string;
  categoryId: string;
  particular: string;
  amount: number;
  /** Calendar date, YYYY-MM-DD */
  expenseDate: string;
  description: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lean expense row used for analytics. */
export interface ExpensePoint {
  id: string;
  categoryId: string;
  particular: string;
  amount: number;
  expenseDate: string;
}

export interface DateRange {
  /** inclusive YYYY-MM-DD, or null for unbounded */
  from: string | null;
  to: string | null;
}

export type RangePreset = "today" | "week" | "month" | "year" | "all" | "custom";

export interface DashboardPreferences {
  defaultRange: RangePreset;
  weekStartsOn: 0 | 1;
  showCalculatedOnDashboard: boolean;
  visibleCharts: {
    donut: boolean;
    monthly: boolean;
    trend: boolean;
    top: boolean;
    cumulative: boolean;
  };
}

export interface Settings {
  currency: string;
  dateFormat: string;
  dashboard: DashboardPreferences;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Sum of amounts across all filtered rows (not just this page) */
  sum: number;
}
