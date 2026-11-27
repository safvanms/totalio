"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Ban, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminFilter, AdminSort, AdminUserDetail, AdminUserList, AdminUserRow } from "@/lib/admin-types";

/* Data ---------------------------------------------------------------- */

export interface AdminListQuery {
  q: string;
  filter: AdminFilter;
  sort: AdminSort;
  page: number;
  pageSize: number;
}

const adminKeys = {
  all: ["admin"] as const,
  list: (q: AdminListQuery) => ["admin", "users", q] as const,
  user: (id: string) => ["admin", "user", id] as const,
};

export function useAdminUsers(q: AdminListQuery) {
  const params = new URLSearchParams({ q: q.q, filter: q.filter, sort: q.sort, page: String(q.page), pageSize: String(q.pageSize) });
  return useQuery({
    queryKey: adminKeys.list(q),
    queryFn: () => api<AdminUserList>(`/api/admin/users?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string) {
  return useQuery({ queryKey: adminKeys.user(id), queryFn: () => api<AdminUserDetail>(`/api/admin/users/${id}`) });
}

export type AdminAction =
  | { action: "update"; name?: string; email?: string }
  | { action: "password"; newPassword: string }
  | { action: "password"; generate: true }
  | { action: "unlock" }
  | { action: "signout" }
  | { action: "end-session"; sessionId: string }
  | { action: "suspend"; suspended: boolean }
  | { action: "impersonate" };

/** What PATCH returns: the updated user, or (password) the user plus the new password. */
export type AdminActionResult = AdminUserDetail | { user: AdminUserDetail; password: string } | { ok: true };

/** PATCH an action on a user; refreshes the list and the user's detail. */
export function useAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: AdminAction & { id: string }) =>
      api<AdminActionResult>(`/api/admin/users/${id}`, { method: "PATCH", json: body }),
    onSuccess: (result) => {
      const user = "sessions" in result ? result : "user" in result ? result.user : null;
      if (user) qc.setQueryData(adminKeys.user(user.id), user);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmEmail }: { id: string; confirmEmail: string }) =>
      api(`/api/admin/users/${id}`, { method: "DELETE", json: { confirmEmail } }),
    onSuccess: (_r, { id }) => {
      qc.removeQueries({ queryKey: adminKeys.user(id) });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

/* Formatting ---------------------------------------------------------- */

export function relativeTime(isoDate: string | null, never = "Never"): string {
  if (!isoDate) return never;
  const diff = Date.now() - Date.parse(isoDate);
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const fmt = (n: number, unit: string) => (diff >= 0 ? `${n} ${unit}${n === 1 ? "" : "s"} ago` : `in ${n} ${unit}${n === 1 ? "" : "s"}`);
  if (mins < 1) return "Just now";
  if (mins < 60) return fmt(mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return fmt(hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return fmt(days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return fmt(months, "month");
  return fmt(Math.round(months / 12), "year");
}

export function fullDate(isoDate: string | null, withTime = false): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** "Chrome on Windows" from a user-agent string. */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|undici|Playwright|Headless/i.test(ua)
              ? "Script / API client"
              : "Browser";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return os ? `${browser} on ${os}` : browser;
}

export const money = (n: number, currency: string) => formatMoney(n, currency);

/* Badges -------------------------------------------------------------- */

export function UserBadges({ user, className }: { user: Pick<AdminUserRow, "suspended" | "locked">; className?: string }) {
  return (
    <span className={className ?? "flex flex-wrap items-center gap-1"}>
      {user.suspended && (
        <Badge variant="destructive">
          <Ban /> Suspended
        </Badge>
      )}
      {user.locked && (
        <Badge variant="warning">
          <Lock /> Locked
        </Badge>
      )}
    </span>
  );
}

export function Avatar({ name, email, size = "md" }: { name: string; email: string; size?: "sm" | "md" | "lg" }) {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  const dims = { sm: "h-9 w-9 text-xs", md: "h-10 w-10 text-[13px]", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white ${dims}`} aria-hidden>
      {text}
    </span>
  );
}

/* Dialogs ------------------------------------------------------------- */

/** Delete needs the email retyped: it removes the account and all its data. */
export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
}: {
  user: Pick<AdminUserRow, "id" | "email" | "name" | "expenseCount" | "categoryCount">;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted?: () => void;
}) {
  const del = useDeleteUser();
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === user.email;
  const close = (o: boolean) => {
    if (!o) setTyped("");
    onOpenChange(o);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    try {
      await del.mutateAsync({ id: user.id, confirmEmail: typed });
      toast.success(`Deleted ${user.name}'s account`);
      close(false);
      onDeleted?.();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 pb-5">
            <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p>
                <span className="font-medium">{user.name}</span> will be signed out and permanently lose their account,{" "}
                {user.expenseCount.toLocaleString()} expense{user.expenseCount === 1 ? "" : "s"} and {user.categoryCount.toLocaleString()} categor
                {user.categoryCount === 1 ? "y" : "ies"}.
              </p>
            </div>
            <Field label={<>Type <span className="font-mono">{user.email}</span> to confirm</>} htmlFor="confirm-email">
              <Input id="confirm-email" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches} loading={del.isPending}>
              Delete account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Suspend / reactivate confirmation. */
export function SuspendDialog({
  user,
  open,
  onOpenChange,
}: {
  user: Pick<AdminUserRow, "id" | "name" | "suspended">;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const act = useAdminAction();
  const suspend = !user.suspended;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive={suspend}
      title={suspend ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`}
      description={
        suspend
          ? "They'll be signed out on every device and won't be able to sign in until you reactivate the account. Their data is kept."
          : "They'll be able to sign in again with their current password."
      }
      confirmLabel={suspend ? "Suspend" : "Reactivate"}
      loading={act.isPending}
      onConfirm={async () => {
        try {
          await act.mutateAsync({ id: user.id, action: "suspend", suspended: suspend });
          toast.success(suspend ? `${user.name} is suspended` : `${user.name} can sign in again`);
          onOpenChange(false);
        } catch (err) {
          toast.error(errorMessage(err));
        }
      }}
    />
  );
}
