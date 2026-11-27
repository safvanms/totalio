import type { Metadata } from "next";
import { adminConfigured, isAdminSignedIn } from "@/lib/server/admin-auth";
import { AdminLogin, AdminNotConfigured, AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * /admin is not linked anywhere in the app. Every admin page shows the admin
 * sign-in until ADMIN_USERNAME / ADMIN_PASSWORD have been verified (server-side).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!adminConfigured()) return <AdminNotConfigured />;
  if (!(await isAdminSignedIn())) return <AdminLogin />;
  return <AdminShell>{children}</AdminShell>;
}
