import { z } from "zod";
import { json, readJson } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { changePassword, deleteAccount, signOutEverywhereElse, updateName } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("name"), name: z.unknown() }),
  z.object({ action: z.literal("password"), currentPassword: z.unknown(), newPassword: z.unknown() }),
  z.object({ action: z.literal("signout-others") }),
]);

export const PATCH = authedRoute(async (req, _ctx, user) => {
  const body = action.parse(await readJson(req));
  switch (body.action) {
    case "name":
      return json(await updateName(user, body));
    case "password":
      await changePassword(user, body);
      return json({ ok: true });
    case "signout-others":
      await signOutEverywhereElse(user);
      return json({ ok: true });
  }
});

export const DELETE = authedRoute(async (req, _ctx, user) => {
  await deleteAccount(user, await readJson(req));
  return json({ ok: true });
});
