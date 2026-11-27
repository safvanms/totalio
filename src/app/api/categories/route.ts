import { json, readJson } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { createCategory, listCategories } from "@/lib/server/categories";

export const dynamic = "force-dynamic";

export const GET = authedRoute(async (_req, _ctx, user) => json(await listCategories(user.id)));

export const POST = authedRoute(async (req, _ctx, user) => json(await createCategory(user.id, await readJson(req)), { status: 201 }));
