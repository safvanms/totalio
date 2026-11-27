import { json, route } from "@/lib/server/http";
import { expensePoints } from "@/lib/server/expenses";

export const dynamic = "force-dynamic";

/** Lean expense rows in [from, to] for client-side analytics. */
export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  return json(await expensePoints(sp.get("from"), sp.get("to")));
});
