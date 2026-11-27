import { json, readJson, route } from "@/lib/server/http";
import { signup } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => json(await signup(await readJson(req)), { status: 201 }));
