"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, LogOut, MonitorSmartphone, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PasswordInput } from "@/components/auth/auth-forms";
import { initials, useUser } from "@/components/auth/user-context";
import { signOut } from "@/components/layout/user-menu";
import { api, errorMessage } from "@/lib/api-client";
import { changePasswordSchema, nameSchema } from "@/lib/validation";

function Row({ icon: Icon, title, description, children }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ProfileForm() {
  const user = useUser();
  const router = useRouter();
  const form = useForm<{ name: string }>({ resolver: zodResolver(z.object({ name: nameSchema })), defaultValues: { name: user.name } });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api("/api/auth/account", { method: "PATCH", json: { action: "name", name: v.name } });
      toast.success("Name updated");
      form.reset(v);
      router.refresh();
    } catch (e) {
      form.setError("name", { message: errorMessage(e) });
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="acc-name" error={form.formState.errors.name?.message}>
        <Input id="acc-name" maxLength={60} autoComplete="name" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
      </Field>
      <Field label="Email" htmlFor="acc-email" hint="Used to sign in. It can't be changed.">
        <Input id="acc-email" value={user.email} readOnly disabled />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={!form.formState.isDirty} loading={form.formState.isSubmitting}>
          Save name
        </Button>
      </div>
    </form>
  );
}

const pwFormSchema = changePasswordSchema.extend({ confirm: z.string() }).refine((v) => v.newPassword === v.confirm, {
  path: ["confirm"],
  message: "Passwords don't match",
});
type PwForm = z.infer<typeof pwFormSchema>;

function PasswordForm() {
  const form = useForm<PwForm>({ resolver: zodResolver(pwFormSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const err = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api("/api/auth/account", { method: "PATCH", json: { action: "password", currentPassword: v.currentPassword, newPassword: v.newPassword } });
      toast.success("Password changed. Other devices have been signed out.");
      form.reset();
    } catch (e) {
      const msg = errorMessage(e);
      if (/current/i.test(msg)) form.setError("currentPassword", { message: msg });
      else form.setError("root", { message: msg });
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Current password" htmlFor="pw-current" error={err.currentPassword?.message} className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
        <PasswordInput id="pw-current" autoComplete="current-password" invalid={!!err.currentPassword} {...form.register("currentPassword")} />
      </Field>
      <Field label="New password" htmlFor="pw-new" error={err.newPassword?.message} hint={!err.newPassword ? "At least 8 characters, with a letter and a number." : undefined}>
        <PasswordInput id="pw-new" autoComplete="new-password" invalid={!!err.newPassword} {...form.register("newPassword")} />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm" error={err.confirm?.message}>
        <PasswordInput id="pw-confirm" autoComplete="new-password" invalid={!!err.confirm} {...form.register("confirm")} />
      </Field>
      {err.root && <p className="text-sm text-destructive sm:col-span-2">{err.root.message}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={form.formState.isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/account", { method: "DELETE", json: { password } });
      window.location.assign("/login?reason=deleted");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="outline" size="sm" className="hover:border-destructive/40 hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 /> Delete account
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setPassword("");
            setError(null);
          }
        }}
      >
        <DialogContent size="sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password) confirm();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Your account, categories, formulas, expenses and settings will be permanently deleted. This can&apos;t be undone. Export your data first if you want a copy.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="pb-5">
              <Field label="Enter your password to confirm" htmlFor="del-pw" error={error ?? undefined}>
                <PasswordInput id="del-pw" autoComplete="current-password" autoFocus value={password} invalid={!!error} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!password} loading={busy}>
                Delete permanently
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AccountSection() {
  const user = useUser();
  const [busy, setBusy] = useState<null | "others" | "me">(null);
  return (
    <Card id="account" className="scroll-mt-24 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
            {initials(user.name, user.email)}
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{user.name}</CardTitle>
            <CardDescription className="truncate">{user.email}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y">
        <Row icon={UserRound} title="Profile" description="How your name appears in Totalio.">
          <ProfileForm />
        </Row>
        <Row icon={KeyRound} title="Password" description="Changing it signs out your other devices.">
          <PasswordForm />
        </Row>
        <Row icon={MonitorSmartphone} title="Sessions" description="Signed in on a shared or lost device?">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={busy === "others"}
              onClick={async () => {
                setBusy("others");
                try {
                  await api("/api/auth/account", { method: "PATCH", json: { action: "signout-others" } });
                  toast.success("Signed out of all other devices");
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              <MonitorSmartphone /> Sign out other devices
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={busy === "me"}
              onClick={async () => {
                setBusy("me");
                await signOut().catch((e) => {
                  toast.error(errorMessage(e));
                  setBusy(null);
                });
              }}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        </Row>
        <Row icon={Trash2} title="Delete account" description="Permanently remove your account and all of its data.">
          <DeleteAccount />
        </Row>
      </CardContent>
    </Card>
  );
}
