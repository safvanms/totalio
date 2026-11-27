"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronsLeft,
  LayoutDashboard,
  Menu,
  Plus,
  Receipt,
  Settings,
  Shapes,
  Sigma,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Hint, Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { ThemeToggle } from "./theme-toggle";
import { useUiStore } from "@/stores/ui-store";
import { useDialogs } from "@/stores/dialog-store";
import { GlobalDialogs } from "./global-dialogs";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/categories", label: "Categories", icon: Shapes },
  { href: "/formula-builder", label: "Formula Builder", icon: Sigma },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-violet-600 text-white shadow-glow">
        <Wallet className="h-[18px] w-[18px]" />
      </span>
      {!compact && (
        <span className="truncate text-[17px] font-semibold tracking-tight">
          Total<span className="text-primary">io</span>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        const link = (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10",
              compact && "justify-center px-0",
              active && "bg-sidebar-accent text-primary hover:text-primary",
            )}
          >
            {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden />}
            <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            {!compact && <span className="truncate">{label}</span>}
          </Link>
        );
        return compact ? (
          <Hint key={href} label={label} side="right">
            {link}
          </Hint>
        ) : (
          link
        );
      })}
    </nav>
  );
}

function SidebarFooterCard() {
  const openExpense = useDialogs((s) => s.openExpense);
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-violet-500/5 to-success/10 p-3.5">
      <p className="text-[13px] font-semibold">Track as you go</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Log expenses right away to keep your totals accurate.</p>
      <Button size="sm" className="mt-3 w-full" onClick={() => openExpense()}>
        <Plus /> Add expense
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const openExpense = useDialogs((s) => s.openExpense);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isCollapsed = mounted && collapsed;
  const current = NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

  return (
    <div className="flex min-h-dvh">
      {/* Tablet (md): compact icon rail. Desktop (lg+): full sidebar, collapsible. */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur transition-[width] duration-200 md:flex",
          "md:w-[72px]",
          isCollapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
      >
        <div className={cn("flex h-16 items-center px-4", isCollapsed ? "lg:justify-center lg:px-0" : "")}>
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <div className="hidden lg:block">
            <Brand compact={isCollapsed} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
          <div className="lg:hidden">
            <NavLinks compact />
          </div>
          <div className="hidden lg:block">
            <NavLinks compact={isCollapsed} />
          </div>
        </div>
        <div className="space-y-3 p-3">
          {!isCollapsed && (
            <div className="hidden lg:block">
              <SidebarFooterCard />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn("hidden w-full text-muted-foreground lg:flex", isCollapsed ? "justify-center px-0" : "justify-start")}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronsLeft className={cn("transition-transform", isCollapsed && "rotate-180")} />
            {!isCollapsed && "Collapse"}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(85vw,300px)] bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <div className="flex h-16 items-center px-4">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="safe-bottom p-3">
            <SidebarFooterCard />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" className="-ml-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="!size-5" />
            </Button>
            <div className="md:hidden">
              <Brand compact />
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm text-muted-foreground">
                Totalio <span className="mx-1.5 text-border">/</span>
                <span className="font-medium text-foreground">{current?.label ?? "Totalio"}</span>
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <Button onClick={() => openExpense()} className="h-10 px-3 sm:h-9 sm:px-4" aria-label="Add expense">
                <Plus />
                <span className="hidden xs:inline">Add expense</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-16 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">{children}</main>
      </div>
      <GlobalDialogs />
    </div>
  );
}
