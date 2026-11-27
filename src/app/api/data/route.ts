import { json } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { expensePoints } from "@/lib/server/expenses";

export const dynamic = "force-dynamic";

/** Lean expense rows in [from, to] for client-side analytics. */
export const GET = authedRoute(async (req, _ctx, user) => {
  const sp = new URL(req.url).searchParams;
  return json(await expensePoints(user.id, sp.get("from"), sp.get("to")));
});
