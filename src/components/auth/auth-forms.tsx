"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api-client";
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function PasswordInput({ id, invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} className="pr-11" aria-invalid={invalid} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

/** Full navigation (not router.push) so every cached query starts fresh for this account. */
const enterApp = () => window.location.assign("/dashboard");

export function LoginForm({ notice }: { notice?: string | null }) {
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const err = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api("/api/auth/login", { method: "POST", json: v });
      enterApp();
    } catch (e) {
      form.setError("root", { message: errorMessage(e) });
    }
  });
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Sign in to see your expenses.</p>
      {notice && (
        <p className="mt-5 flex gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" htmlFor="email" error={err.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus inputMode="email" aria-invalid={!!err.email} {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={err.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" invalid={!!err.password} {...form.register("password")} />
        </Field>
        <FormError message={err.root?.message} />
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Totalio?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function strength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!p) return { score: 0, label: "" };
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Za-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  const score = Math.min(3, s) as 0 | 1 | 2 | 3;
  return { score, label: ["Too short", "Okay", "Good", "Strong"][score] };
}

export function SignupForm({ allowed }: { allowed: boolean }) {
  const form = useForm<SignupInput>({ resolver: zodResolver(signupSchema), defaultValues: { name: "", email: "", password: "" } });
  const err = form.formState.errors;
  const pw = form.watch("password");
  const st = strength(pw);
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api("/api/auth/signup", { method: "POST", json: v });
      enterApp();
    } catch (e) {
      const msg = errorMessage(e);
      if (/email/i.test(msg)) form.setError("email", { message: msg });
      else form.setError("root", { message: msg });
    }
  });

  if (!allowed) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Sign-ups are closed</h1>
        <p className="mt-2 text-sm text-muted-foreground">This Totalio site isn&apos;t accepting new accounts right now.</p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Your expenses stay private to your account.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Name" htmlFor="name" error={err.name?.message}>
          <Input id="name" autoComplete="name" autoFocus maxLength={60} aria-invalid={!!err.name} {...form.register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={err.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!err.email} {...form.register("email")} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={err.password?.message}
          hint={!err.password ? "At least 8 characters, with a letter and a number." : undefined}
        >
          <PasswordInput id="password" autoComplete="new-password" invalid={!!err.password} {...form.register("password")} />
          {pw && (
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full bg-muted transition-colors",
                      st.score >= i && (st.score === 1 ? "bg-warning" : st.score === 2 ? "bg-primary" : "bg-success"),
                    )}
                  />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-muted-foreground">{st.label}</span>
            </div>
          )}
        </Field>
        <FormError message={err.root?.message} />
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
