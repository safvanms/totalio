import { json } from "@/lib/server/http";
import { adminRoute } from "@/lib/server/admin-auth";
import { listUsers } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (req) => json(await listUsers(Object.fromEntries(new URL(req.url).searchParams))));
