import { json, route } from "@/lib/server/http";
import { adminLogout } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  await adminLogout();
  return json({ ok: true });
});
