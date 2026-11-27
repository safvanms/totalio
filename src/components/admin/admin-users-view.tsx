"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Ban,
  Eye,
  LogIn,
  LogOut,
  MoreHorizontal,
  Receipt,
  Search,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/primitives";
import { Segmented, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { EmptyState, ErrorState, PageHeader, StatCard } from "@/components/shared/common";
import { Pagination } from "@/components/shared/pagination";
import { LinkPendingOverlay } from "@/components/shared/link-pending";
import { errorMessage } from "@/lib/api-client";
import { cn, pluralize } from "@/lib/utils";
import type { AdminFilter, AdminSort, AdminUserRow } from "@/lib/admin-types";
import {
  Avatar,
  DeleteUserDialog,
  money,
  relativeTime,
  fullDate,
  SuspendDialog,
  useAdminAction,
  useAdminUsers,
  UserBadges,
  type AdminListQuery,
} from "./admin-shared";
import { openAccount } from "./open-account";

const FILTERS: { value: AdminFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "locked", label: "Locked" },
];

const SORTS: { value: AdminSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name" },
  { value: "lastLogin", label: "Last sign-in" },
  { value: "expenses", label: "Most expenses" },
];

export function AdminUsersView() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<AdminListQuery>({ q: "", filter: "all", sort: "newest", page: 1, pageSize: 20 });
  const { data, isLoading, isFetching, error, refetch } = useAdminUsers(query);

  // Debounce typing into the query.
  useEffect(() => {
    const t = setTimeout(() => setQuery((q) => (q.q === search.trim() ? q : { ...q, q: search.trim(), page: 1 })), 250);
    return () => clearTimeout(t);
  }, [search]);

  const set = (patch: Partial<AdminListQuery>) => setQuery((q) => ({ ...q, page: 1, ...patch }));
  const t = data?.totals;

  return (
    <>
      <PageHeader title="Users" description="Every account on this site. Open a user to see and change everything about it." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <StatCard label="Total users" value={t?.users.toLocaleString() ?? "—"} sub={t ? `+${t.newLast30} in the last 30 days` : undefined} icon={Users} loading={isLoading} />
        <StatCard label="Active (30 days)" value={t?.activeLast30.toLocaleString() ?? "—"} sub={t ? `${t.users ? Math.round((t.activeLast30 / t.users) * 100) : 0}% of users` : undefined} icon={UserCheck} tone="success" loading={isLoading} />
        <StatCard label="Expenses" value={t?.expenses.toLocaleString() ?? "—"} sub="Across all users" icon={Receipt} tone="violet" loading={isLoading} />
        <StatCard label="Suspended" value={t?.suspended.toLocaleString() ?? "—"} sub={t ? `${t.locked} locked right now` : undefined} icon={Ban} tone="rose" loading={isLoading} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="pl-9 pr-9" aria-label="Search users" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center">
            <Segmented ariaLabel="Filter users" value={query.filter} onChange={(v) => set({ filter: v })} options={FILTERS} className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto" />
            <Select value={query.sort} onValueChange={(v) => set({ sort: v as AdminSort })}>
              <SelectTrigger className="sm:w-44" aria-label="Sort users">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} className="m-4" />
        ) : !data || data.users.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={query.q || query.filter !== "all" ? "No users match" : "No users yet"}
            description={query.q || query.filter !== "all" ? "Try a different search or filter." : "Accounts appear here as people sign up."}
            compact
          />
        ) : (
          <div className={cn("transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
            {/* md+: table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[16rem]">User</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Categories</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u.id} className={cn(u.suspended && "opacity-70")}>
                      <TableCell>
                        <div className="relative flex min-w-0 items-center gap-3">
                          <Avatar name={u.name} email={u.email} />
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <Link href={`/admin/users/${u.id}`} className="truncate font-medium hover:underline" title={u.name}>
                                {u.name}
                                <LinkPendingOverlay label="Opening…" />
                              </Link>
                              <UserBadges user={u} />
                            </div>
                            <p className="truncate text-xs text-muted-foreground" title={u.email}>
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <div className="font-medium">{u.expenseCount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{money(u.totalSpent, u.currency)}</div>
                      </TableCell>
                      <TableCell className="text-right tabular">{u.categoryCount.toLocaleString()}</TableCell>
                      <TableCell>
                        <span title={fullDate(u.lastLoginAt, true)}>{relativeTime(u.lastLoginAt)}</span>
                        {u.activeSessions > 0 && <div className="text-xs text-muted-foreground">{pluralize(u.activeSessions, "device")} signed in</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{fullDate(u.createdAt)}</TableCell>
                      <TableCell>
                        <UserRowActions user={u} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phones: cards */}
            <ul className="divide-y md:hidden">
              {data.users.map((u) => (
                <li key={u.id} className={cn("relative p-4", u.suspended && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <Avatar name={u.name} email={u.email} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/users/${u.id}`} className="block truncate font-medium after:absolute after:inset-0" title={u.name}>
                        {u.name}
                        <LinkPendingOverlay label="Opening…" />
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      <UserBadges user={u} className="mt-1.5 flex flex-wrap items-center gap-1 empty:hidden" />
                    </div>
                    <div className="relative z-10 -mr-2 -mt-1">
                      <UserRowActions user={u} />
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Expenses</dt>
                      <dd className="truncate font-medium tabular">{u.expenseCount.toLocaleString()}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Total</dt>
                      <dd className="truncate font-medium tabular">{money(u.totalSpent, u.currency)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Last sign-in</dt>
                      <dd className="truncate font-medium">{relativeTime(u.lastLoginAt)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>

            <Pagination
              page={data.page}
              pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
              pageSize={data.pageSize}
              total={data.total}
              onPage={(page) => setQuery((q) => ({ ...q, page }))}
              onPageSize={(pageSize) => set({ pageSize })}
              sizes={[10, 20, 50, 100]}
            />
          </div>
        )}
      </Card>
    </>
  );
}

/** ⋯ menu on a user row. */
function UserRowActions({ user }: { user: AdminUserRow }) {
  const act = useAdminAction();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const run = async (body: Parameters<typeof act.mutateAsync>[0], done: string) => {
    try {
      await act.mutateAsync(body);
      toast.success(done);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${user.id}`}>
              <Eye /> View &amp; edit
            </Link>
          </DropdownMenuItem>
          {!user.suspended && (
            <DropdownMenuItem onSelect={() => openAccount(user.id)}>
              <LogIn /> Open their account
            </DropdownMenuItem>
          )}
          {user.locked && (
            <DropdownMenuItem onSelect={() => run({ id: user.id, action: "unlock" }, `${user.name} can sign in again`)}>
              <Unlock /> Unlock sign-in
            </DropdownMenuItem>
          )}
          {user.activeSessions > 0 && (
            <DropdownMenuItem onSelect={() => run({ id: user.id, action: "signout" }, `${user.name} was signed out everywhere`)}>
              <LogOut /> Sign out everywhere
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSuspendOpen(true)}>
            {user.suspended ? <UserCheck /> : <Ban />} {user.suspended ? "Reactivate" : "Suspend"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
            <Trash2 /> Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SuspendDialog user={user} open={suspendOpen} onOpenChange={setSuspendOpen} />
      <DeleteUserDialog user={user} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
