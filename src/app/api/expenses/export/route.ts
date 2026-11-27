import { json, route } from "@/lib/server/http";
import { exportExpenses } from "@/lib/server/expenses";

export const dynamic = "force-dynamic";

/** Every row matching the current filters (no pagination), for exports. */
export const GET = route(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return json(await exportExpenses(params));
});
