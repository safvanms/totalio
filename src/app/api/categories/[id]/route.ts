import { json, readJson } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { deleteCategory, getCategory, updateCategory } from "@/lib/server/categories";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = authedRoute<Ctx>(async (_req, { params }, user) => json(await getCategory(user.id, (await params).id)));

export const PATCH = authedRoute<Ctx>(async (req, { params }, user) =>
  json(await updateCategory(user.id, (await params).id, await readJson(req))),
);

export const DELETE = authedRoute<Ctx>(async (_req, { params }, user) => {
  await deleteCategory(user.id, (await params).id);
  return json({ ok: true });
});
