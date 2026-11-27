import { json, readJson, route } from "@/lib/server/http";
import { deleteExpenses, getExpense, updateExpense } from "@/lib/server/expenses";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = route<Ctx>(async (_req, { params }) => json(await getExpense((await params).id)));

export const PATCH = route<Ctx>(async (req, { params }) =>
  json(await updateExpense((await params).id, await readJson(req))),
);

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const id = (await params).id;
  await getExpense(id);
  await deleteExpenses([id]);
  return json({ ok: true });
});
