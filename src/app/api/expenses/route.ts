import { z } from "zod";
import { json, readJson } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { createExpenses, deleteExpenses, listExpenses } from "@/lib/server/expenses";

export const dynamic = "force-dynamic";

export const GET = authedRoute(async (req, _ctx, user) => {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return json(await listExpenses(user.id, params));
});

export const POST = authedRoute(async (req, _ctx, user) => json(await createExpenses(user.id, await readJson(req)), { status: 201 }));

const bulkDelete = z.object({ ids: z.array(z.string().min(1)).min(1, "No expenses selected").max(5000) });

export const DELETE = authedRoute(async (req, _ctx, user) => {
  const { ids } = bulkDelete.parse(await readJson(req));
  return json({ deleted: await deleteExpenses(user.id, ids) });
});
