import { json } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { exportExpenses } from "@/lib/server/expenses";

export const dynamic = "force-dynamic";

/** Every row matching the current filters (no pagination), for exports. */
export const GET = authedRoute(async (req, _ctx, user) => {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return json(await exportExpenses(user.id, params));
});
