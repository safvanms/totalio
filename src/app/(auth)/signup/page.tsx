import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/auth-forms";
import { signupsAllowed } from "@/lib/server/accounts";
import { prisma } from "@/lib/server/db";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  // The very first account can always be created, even with sign-ups closed.
  const allowed = signupsAllowed() || (await prisma.user.count()) === 0;
  return <SignupForm allowed={allowed} />;
}
