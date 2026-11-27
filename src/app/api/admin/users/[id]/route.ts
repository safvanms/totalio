import { z } from "zod";
import { json, readJson } from "@/lib/server/http";
import { adminRoute } from "@/lib/server/admin-auth";
import {
  deleteUser,
  endUserSession,
  getUser,
  impersonate,
  setPassword,
  setSuspended,
  signOutUser,
  unlockUser,
  updateUser,
} from "@/lib/server/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = adminRoute<Ctx>(async (_req, { params }) => json(await getUser((await params).id)));

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), name: z.unknown().optional(), email: z.unknown().optional() }),
  z.object({ action: z.literal("password"), newPassword: z.unknown().optional(), generate: z.boolean().optional() }),
  z.object({ action: z.literal("unlock") }),
  z.object({ action: z.literal("signout") }),
  z.object({ action: z.literal("end-session"), sessionId: z.string().min(1).max(64) }),
  z.object({ action: z.literal("suspend"), suspended: z.boolean() }),
  z.object({ action: z.literal("impersonate") }),
]);

export const PATCH = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = action.parse(await readJson(req));
  switch (body.action) {
    case "update":
      return json(await updateUser(id, { name: body.name, email: body.email }));
    case "password":
      return json(await setPassword(id, body));
    case "unlock":
      return json(await unlockUser(id));
    case "signout":
      return json(await signOutUser(id));
    case "end-session":
      return json(await endUserSession(id, body.sessionId));
    case "suspend":
      return json(await setSuspended(id, body.suspended));
    case "impersonate":
      await impersonate(id);
      return json({ ok: true });
  }
});

export const DELETE = adminRoute<Ctx>(async (req, { params }) => {
  await deleteUser((await params).id, await readJson(req));
  return json({ ok: true });
});
