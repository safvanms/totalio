import { json, route } from "@/lib/server/http";
import { endSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  await endSession();
  return json({ ok: true });
});
