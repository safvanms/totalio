import { json, readJson, route } from "@/lib/server/http";
import { deleteCategory, getCategory, updateCategory } from "@/lib/server/categories";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = route<Ctx>(async (_req, { params }) => json(await getCategory((await params).id)));

export const PATCH = route<Ctx>(async (req, { params }) =>
  json(await updateCategory((await params).id, await readJson(req))),
);

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await deleteCategory((await params).id);
  return json({ ok: true });
});
