import { json, readJson, route } from "@/lib/server/http";
import { getSettings, saveSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export const GET = route(async () => json(await getSettings()));

export const PUT = route(async (req) => json(await saveSettings(await readJson(req))));
