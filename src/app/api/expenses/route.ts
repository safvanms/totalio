import { z } from "zod";
import { json, readJson, route } from "@/lib/server/http";
import { createExpenses, deleteExpenses, listExpenses } from "@/lib/server/expenses";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return json(await listExpenses(params));
});

export const POST = route(async (req) => json(await createExpenses(await readJson(req)), { status: 201 }));

const bulkDelete = z.object({ ids: z.array(z.string().min(1)).min(1, "No expenses selected").max(5000) });

export const DELETE = route(async (req) => {
  const { ids } = bulkDelete.parse(await readJson(req));
  return json({ deleted: await deleteExpenses(ids) });
});
