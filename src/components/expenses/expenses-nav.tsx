"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/expenses", label: "By category", icon: LayoutList },
  { href: "/expenses/history", label: "History", icon: History },
];

export function ExpensesNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Expense views" className="inline-flex h-10 max-w-full items-center gap-0.5 self-start rounded-lg bg-muted p-1 sm:h-9">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-card text-foreground shadow-sm",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
