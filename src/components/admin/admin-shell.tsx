"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { PasswordInput } from "@/components/auth/auth-forms";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { api, errorMessage } from "@/lib/api-client";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/validation";

function Brand() {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-violet-600 text-white shadow-glow">
        <Wallet className="h-[18px] w-[18px]" />
      </span>
      <span className="truncate text-[17px] font-semibold tracking-tight">
        Total<span className="text-primary">io</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
        <ShieldCheck className="h-3.5 w-3.5" /> Admin
      </span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true);
    try {
      await api("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.assign("/admin");
    }
  };
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Brand />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut} loading={leaving} aria-label="Sign out of admin">
              {!leaving && <LogOut />} <span className="hidden xs:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-[1400px] px-4 pb-16 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}

export function AdminLogin() {
  const form = useForm<AdminLoginInput>({ resolver: zodResolver(adminLoginSchema), defaultValues: { username: "", password: "" } });
  const err = form.formState.errors;
  const [entering, setEntering] = useState(false);
  const busy = form.formState.isSubmitting || entering;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api("/api/admin/login", { method: "POST", json: v });
      setEntering(true);
      // Reload so the server renders the admin area for this session.
      window.location.reload();
    } catch (e) {
      form.setError("root", { message: errorMessage(e) });
      form.resetField("password");
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <Card className="p-5 sm:p-6">
          <h1 className="text-xl font-semibold tracking-tight">Admin sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Restricted area. Sign in with the admin credentials.</p>
          <form onSubmit={onSubmit} noValidate className="mt-5" aria-busy={busy}>
            <fieldset disabled={busy} className="space-y-4">
              <Field label="Username" htmlFor="admin-username" error={err.username?.message}>
                <Input id="admin-username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus aria-invalid={!!err.username} {...form.register("username")} />
              </Field>
              <Field label="Password" htmlFor="admin-password" error={err.password?.message}>
                <PasswordInput id="admin-password" autoComplete="current-password" invalid={!!err.password} {...form.register("password")} />
              </Field>
              {err.root?.message && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {err.root.message}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                {entering ? "Opening admin…" : busy ? "Checking…" : "Sign in"}
              </Button>
            </fieldset>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function AdminNotConfigured() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Admin isn&apos;t set up</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Set the <code className="font-mono text-foreground">ADMIN_USERNAME</code> and <code className="font-mono text-foreground">ADMIN_PASSWORD</code> environment variables on the server, then redeploy.
        </p>
      </Card>
    </div>
  );
}
