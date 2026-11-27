import { json, readJson } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { deleteExpenses, getExpense, updateExpense } from "@/lib/server/expenses";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = authedRoute<Ctx>(async (_req, { params }, user) => json(await getExpense(user.id, (await params).id)));

export const PATCH = authedRoute<Ctx>(async (req, { params }, user) =>
  json(await updateExpense(user.id, (await params).id, await readJson(req))),
);

export const DELETE = authedRoute<Ctx>(async (_req, { params }, user) => {
  const id = (await params).id;
  await getExpense(user.id, id);
  await deleteExpenses(user.id, [id]);
  return json({ ok: true });
});
