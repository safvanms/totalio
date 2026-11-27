import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { AppShell } from "@/components/layout/app-shell";
import { UserProvider } from "@/components/auth/user-context";

// Every page in this group needs a signed-in user; the check runs on the server.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <UserProvider user={user}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
