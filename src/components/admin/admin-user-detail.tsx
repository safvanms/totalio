"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  Copy,
  Download,
  KeyRound,
  Layers,
  Lock,
  LogIn,
  LogOut,
  MonitorSmartphone,
  Receipt,
  Shapes,
  Sparkles,
  Trash2,
  Unlock,
  UserCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/primitives";
import { CategoryIcon, EmptyState, ErrorState, StatCard } from "@/components/shared/common";
import { PasswordInput } from "@/components/auth/auth-forms";
import { CategoryStatsSkeleton } from "@/components/categories/category-detail-skeleton";
import { errorMessage } from "@/lib/api-client";
import { formatDateKey } from "@/lib/dates";
import { emailSchema, nameSchema, newPasswordSchema } from "@/lib/validation";
import { cn, pluralize } from "@/lib/utils";
import type { AdminUserDetail } from "@/lib/admin-types";
import {
  Avatar,
  DeleteUserDialog,
  describeDevice,
  fullDate,
  money,
  relativeTime,
  SuspendDialog,
  useAdminAction,
  useAdminUser,
  UserBadges,
} from "./admin-shared";
import { openAccount } from "./open-account";

export function AdminUserDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: user, isLoading, error, refetch } = useAdminUser(id);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [opening, setOpening] = useState(false);

  if (isLoading) return <AdminUserDetailSkeleton />;
  if (error || !user) {
    const missing = error && /not found/i.test(errorMessage(error));
    return missing ? (
      <Card>
        <EmptyState
          title="User not found"
          description="This account may have been deleted."
          action={
            <Button asChild variant="outline">
              <Link href="/admin">
                <ArrowLeft /> All users
              </Link>
            </Button>
          }
        />
      </Card>
    ) : (
      <ErrorState error={error} onRetry={() => refetch()} />
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft /> All users
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={user.name} email={user.email} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-[28px]">{user.name}</h1>
              <UserBadges user={user} />
            </div>
            <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Joined {fullDate(user.createdAt)} · last sign-in {relativeTime(user.lastLoginAt).toLowerCase()}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <Button
            size="sm"
            className="col-span-2 sm:col-auto"
            disabled={user.suspended}
            title={user.suspended ? "Reactivate the account to open it" : undefined}
            loading={opening}
            onClick={async () => {
              setOpening(true);
              await openAccount(user.id);
              setOpening(false);
            }}
          >
            {!opening && <LogIn />} Open their account
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/users/${user.id}/backup`} download>
              <Download /> Download data
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSuspendOpen(true)} className={cn(!user.suspended && "hover:border-destructive/40 hover:text-destructive")}>
            {user.suspended ? <UserCheck /> : <Ban />} {user.suspended ? "Reactivate" : "Suspend"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="col-span-2 hover:border-destructive/40 hover:text-destructive sm:col-auto">
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      {user.suspended && (
        <div className="mb-5 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm" role="status">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>This account is suspended. {user.name} can&apos;t sign in until you reactivate it. Their data is kept.</p>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard label="Expenses" value={user.expenseCount.toLocaleString()} sub={user.lastExpenseAt ? `Latest ${fullDate(user.lastExpenseAt)}` : "None yet"} icon={Receipt} />
        <StatCard label="Total spent" value={money(user.totalSpent, user.currency)} sub={`All time · ${user.currency}`} icon={Wallet} tone="violet" />
        <StatCard label="This month" value={money(user.spentThisMonth, user.currency)} sub={new Date().toLocaleString("en-GB", { month: "long", year: "numeric" })} icon={CalendarClock} tone="sky" />
        <StatCard label="Categories" value={user.categoryCount.toLocaleString()} sub={`${user.normalCategories} normal · ${user.calculatedCategories} calculated`} icon={Layers} tone="success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-5">
          <ProfileCard user={user} />
          <PasswordCard user={user} />
          <SessionsCard user={user} />
          <CategoriesCard user={user} />
          <RecentExpensesCard user={user} />
        </div>
        <div className="min-w-0 space-y-5">
          <DetailsCard user={user} />
        </div>
      </div>

      <SuspendDialog user={user} open={suspendOpen} onOpenChange={setSuspendOpen} />
      <DeleteUserDialog user={user} open={deleteOpen} onOpenChange={setDeleteOpen} onDeleted={() => router.replace("/admin")} />
    </>
  );
}

function CardIconTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2">
      <Icon className="h-[18px] w-[18px] text-primary" /> {children}
    </CardTitle>
  );
}

/* Profile: name, email ----------------------------------------------------- */

const profileSchema = z.object({ name: nameSchema, email: emailSchema });

function ProfileCard({ user }: { user: AdminUserDetail }) {
  const act = useAdminAction();
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), values: { name: user.name, email: user.email } });
  const err = form.formState.errors;

  const save = form.handleSubmit(async (v) => {
    try {
      await act.mutateAsync({ id: user.id, action: "update", name: v.name, email: v.email });
      toast.success("Profile saved");
    } catch (e) {
      const msg = errorMessage(e);
      if (/email/i.test(msg)) form.setError("email", { message: msg });
      else toast.error(msg);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardIconTitle icon={UserRound}>Profile</CardIconTitle>
        <CardDescription>Changing the email changes what they sign in with.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="adm-name" error={err.name?.message}>
              <Input id="adm-name" maxLength={60} aria-invalid={!!err.name} {...form.register("name")} />
            </Field>
            <Field label="Email" htmlFor="adm-email" error={err.email?.message}>
              <Input id="adm-email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} aria-invalid={!!err.email} {...form.register("email")} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            {form.formState.isDirty && (
              <Button type="button" variant="ghost" onClick={() => form.reset()}>
                Discard
              </Button>
            )}
            <Button type="submit" disabled={!form.formState.isDirty} loading={form.formState.isSubmitting}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* Password + lock ------------------------------------------------------------ */

function PasswordCard({ user }: { user: AdminUserDetail }) {
  const act = useAdminAction();
  const form = useForm<{ newPassword: string }>({ resolver: zodResolver(z.object({ newPassword: newPasswordSchema })), defaultValues: { newPassword: "" } });
  const err = form.formState.errors;
  const [unlocking, setUnlocking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Forget the shown password when switching users.
  useEffect(() => setIssued(null), [user.id]);

  const apply = async (body: { newPassword: string } | { generate: true }) => {
    const r = await act.mutateAsync({ id: user.id, action: "password", ...body } as Parameters<typeof act.mutateAsync>[0]);
    const password = "password" in r ? r.password : null;
    setIssued(password);
    setCopied(false);
    toast.success(`New password set. ${user.name} was signed out everywhere.`);
  };

  const submit = form.handleSubmit(async (v) => {
    try {
      await apply({ newPassword: v.newPassword });
      form.reset();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardIconTitle icon={KeyRound}>Password &amp; sign-in</CardIconTitle>
        <CardDescription>
          Passwords are stored one-way encrypted, so the current password can&apos;t be shown to anyone. Set a new one here and pass it to the user privately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user.locked && (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex gap-2 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              Locked after too many wrong passwords, until {fullDate(user.lockedUntil, true)}.
            </p>
            <Button
              size="sm"
              variant="outline"
              loading={unlocking}
              onClick={async () => {
                setUnlocking(true);
                try {
                  await act.mutateAsync({ id: user.id, action: "unlock" });
                  toast.success(`${user.name} can sign in again`);
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setUnlocking(false);
                }
              }}
            >
              <Unlock /> Unlock now
            </Button>
          </div>
        )}

        {issued && (
          <div className="rounded-xl border border-success/40 bg-success/10 p-3" role="status">
            <p className="text-sm font-medium">New password for {user.name}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-lg border bg-card px-3 py-2 font-mono text-[15px] tracking-wide">{issued}</code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy password"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issued);
                    setCopied(true);
                  } catch {
                    toast.error("Couldn't copy. Select the text instead.");
                  }
                }}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Hide password" onClick={() => setIssued(null)}>
                <X />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Shown only now. It isn&apos;t stored anywhere readable, so copy it before leaving this page.</p>
          </div>
        )}

        <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field
            label="New password"
            htmlFor="adm-pw"
            error={err.newPassword?.message}
            hint={!err.newPassword ? "At least 8 characters, with a letter and a number." : undefined}
            className="min-w-0 flex-1"
          >
            <PasswordInput id="adm-pw" autoComplete="new-password" invalid={!!err.newPassword} {...form.register("newPassword")} />
          </Field>
          <div className="grid grid-cols-2 gap-2 sm:mt-[1.6rem] sm:flex">
            <Button type="submit" loading={form.formState.isSubmitting}>
              Set password
            </Button>
            <Button
              type="button"
              variant="outline"
              loading={generating}
              onClick={async () => {
                setGenerating(true);
                try {
                  await apply({ generate: true });
                  form.reset();
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setGenerating(false);
                }
              }}
            >
              {!generating && <Sparkles />} Generate
            </Button>
          </div>
        </form>
        {user.failedLogins > 0 && !user.locked && (
          <p className="text-xs text-muted-foreground">{pluralize(user.failedLogins, "failed attempt")} since the last successful sign-in.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* Sessions ------------------------------------------------------------------- */

function SessionsCard({ user }: { user: AdminUserDetail }) {
  const act = useAdminAction();
  const [ending, setEnding] = useState<string | null>(null);

  const end = async (sessionId: string | "all") => {
    setEnding(sessionId);
    try {
      await act.mutateAsync(sessionId === "all" ? { id: user.id, action: "signout" } : { id: user.id, action: "end-session", sessionId });
      toast.success(sessionId === "all" ? "Signed out everywhere" : "Device signed out");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setEnding(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardIconTitle icon={MonitorSmartphone}>Signed-in devices</CardIconTitle>
          <CardDescription>{user.sessions.length ? pluralize(user.sessions.length, "active session") : "Not signed in anywhere."}</CardDescription>
        </div>
        {user.sessions.length > 0 && (
          <Button variant="outline" size="sm" loading={ending === "all"} onClick={() => end("all")} className="shrink-0">
            {ending !== "all" && <LogOut />} Sign out everywhere
          </Button>
        )}
      </CardHeader>
      {user.sessions.length > 0 && (
        <CardContent className="pt-0">
          <ul className="divide-y rounded-xl border">
            {user.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <MonitorSmartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{describeDevice(s.userAgent)}</span>
                    {s.viaAdmin && <Badge variant="warning">Admin view</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={s.userAgent ?? undefined}>
                    {s.viaAdmin ? "Opened" : "Signed in"} {relativeTime(s.createdAt).toLowerCase()} · expires {fullDate(s.expiresAt, s.viaAdmin)}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Sign out this device" loading={ending === s.id} onClick={() => end(s.id)} className="text-muted-foreground hover:text-destructive">
                  {ending !== s.id && <X />}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

/* Their data ----------------------------------------------------------------- */

function CategoriesCard({ user }: { user: AdminUserDetail }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardIconTitle icon={Shapes}>Categories</CardIconTitle>
        <CardDescription>All time totals. Use &ldquo;Open their account&rdquo; to change anything here.</CardDescription>
      </CardHeader>
      {user.categories.length === 0 ? (
        <CardContent className="pt-0 text-sm text-muted-foreground">No categories yet.</CardContent>
      ) : (
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {c.code} · {c.type === "CALCULATED" ? "Calculated" : "Normal"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular">{c.type === "CALCULATED" ? "—" : c.expenseCount.toLocaleString()}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular">{c.type === "CALCULATED" ? "Formula" : money(c.total, user.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function RecentExpensesCard({ user }: { user: AdminUserDetail }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardIconTitle icon={Receipt}>Latest expenses</CardIconTitle>
        <CardDescription>
          The 10 most recent of {user.expenseCount.toLocaleString()}. &ldquo;Download data&rdquo; exports all of them.
        </CardDescription>
      </CardHeader>
      {user.recentExpenses.length === 0 ? (
        <CardContent className="pt-0 text-sm text-muted-foreground">No expenses yet.</CardContent>
      ) : (
        <ul className="divide-y border-t">
          {user.recentExpenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={e.particular}>
                  {e.particular}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {e.categoryName} · {formatDateKey(e.expenseDate, user.dateFormat)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular">{money(e.amount, user.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* Read-only details ------------------------------------------------------------ */

function DetailsCard({ user }: { user: AdminUserDetail }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const rows: [string, React.ReactNode][] = [
    ["Status", user.suspended ? "Suspended" : user.locked ? "Locked (temporary)" : "Active"],
    ["Password", "Set (one-way encrypted)"],
    ["Joined", fullDate(user.createdAt, true)],
    ["Last sign-in", user.lastLoginAt ? `${fullDate(user.lastLoginAt, true)} (${relativeTime(user.lastLoginAt).toLowerCase()})` : "Never"],
    ["Profile updated", fullDate(user.updatedAt, true)],
    ["First expense", fullDate(user.firstExpenseAt)],
    ["Latest expense", fullDate(user.lastExpenseAt)],
    ["Currency", user.currency],
    ["Date format", user.dateFormat],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account details</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <dl className="divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-muted-foreground">{k}</dt>
              <dd className="min-w-0 text-right font-medium">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-muted-foreground">User ID</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono text-xs">{user.id}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy user ID"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(user.id);
                    setCopied(true);
                  } catch {
                    toast.error("Couldn't copy");
                  }
                }}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function AdminUserDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading user">
      <Skeleton className="mb-4 h-8 w-28" />
      <div className="mb-8 flex items-start gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 max-w-[60vw]" />
          <Skeleton className="h-4 w-64 max-w-[60vw]" />
          <Skeleton className="h-3 w-56 max-w-[60vw]" />
        </div>
      </div>
      <CategoryStatsSkeleton />
      <span className="sr-only">Loading user…</span>
    </div>
  );
}
