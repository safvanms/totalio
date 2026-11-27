import { json, readJson, route } from "@/lib/server/http";
import { adminLogin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  await adminLogin(await readJson(req));
  return json({ ok: true });
});
