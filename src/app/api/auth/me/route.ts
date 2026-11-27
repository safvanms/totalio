import { json } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = authedRoute(async (_req, _ctx, user) => json(user));
