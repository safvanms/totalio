import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Calculator,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  HeartPulse,
  Home,
  Hotel,
  Landmark,
  Layers,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sigma,
  Smartphone,
  Sparkles,
  Tag,
  Ticket,
  Train,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  train: Train,
  bus: Bus,
  plane: Plane,
  hotel: Hotel,
  utensils: Utensils,
  coffee: Coffee,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  car: Car,
  fuel: Fuel,
  bike: Bike,
  home: Home,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  "heart-pulse": HeartPulse,
  pill: Pill,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  film: Film,
  music: Music,
  gamepad: Gamepad2,
  gift: Gift,
  shirt: Shirt,
  dumbbell: Dumbbell,
  "paw-print": PawPrint,
  baby: Baby,
  briefcase: Briefcase,
  receipt: Receipt,
  "credit-card": CreditCard,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  landmark: Landmark,
  wrench: Wrench,
  ticket: Ticket,
  globe: Globe,
  tag: Tag,
  sparkles: Sparkles,
  calculator: Calculator,
  sigma: Sigma,
  layers: Layers,
};

export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Tag;
}

/**
 * Category colour presets. The first eight are a categorical palette whose
 * order was validated for colour-vision-deficiency separation between
 * adjacent hues; new categories take the next unused slot in this order so
 * charts stay distinguishable. Colour follows the category everywhere.
 */
export const CATEGORY_COLORS = [
  "#257de0", // blue
  "#f47230", // orange
  "#00b894", // aqua
  "#f2a600", // yellow
  "#ee7fac", // magenta
  "#008a17", // green
  "#6a4ce2", // violet
  "#ec4647", // red
  "#0e7490", // teal
  "#a16207", // amber-brown
  "#64748b", // slate
  "#be185d", // raspberry
];

export function nextCategoryColor(used: string[]): string {
  const set = new Set(used.map((c) => c.toLowerCase()));
  return CATEGORY_COLORS.find((c) => !set.has(c)) ?? CATEGORY_COLORS[used.length % CATEGORY_COLORS.length];
}

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/expenses", label: "Expenses", icon: "Receipt" },
  { href: "/categories", label: "Categories", icon: "Shapes" },
  { href: "/formula-builder", label: "Formula Builder", icon: "Sigma" },
  { href: "/reports", label: "Reports & Analytics", icon: "BarChart3" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
