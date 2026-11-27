import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  expired: "Your session ended. Please sign in again.",
  signedout: "You've been signed out.",
  deleted: "Your account and all of its data have been deleted.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <LoginForm notice={reason ? NOTICES[reason] ?? null : null} />;
}
