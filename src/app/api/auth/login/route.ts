import { json, readJson, route } from "@/lib/server/http";
import { login } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => json(await login(await readJson(req))));
