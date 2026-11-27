import { json, readJson } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { getSettings, saveSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export const GET = authedRoute(async (_req, _ctx, user) => json(await getSettings(user.id)));

export const PUT = authedRoute(async (req, _ctx, user) => json(await saveSettings(user.id, await readJson(req))));
