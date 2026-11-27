import { json, readJson, route } from "@/lib/server/http";
import { createCategory, listCategories } from "@/lib/server/categories";

export const dynamic = "force-dynamic";

export const GET = route(async () => json(await listCategories()));

export const POST = route(async (req) => json(await createCategory(await readJson(req)), { status: 201 }));
