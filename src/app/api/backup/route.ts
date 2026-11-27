import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { json, readJson } from "@/lib/server/http";
import { authedRoute } from "@/lib/server/auth";
import { clearAll, createBackup, mergeBackup, restoreBackup } from "@/lib/server/backup";
import { loadSampleData } from "@/lib/server/sample-data";

export const dynamic = "force-dynamic";
// Large restores/merges can take a while on serverless hosts.
export const maxDuration = 60;

export const GET = authedRoute(async (_req, _ctx, user) => {
  const backup = await createBackup(prisma, user.id);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="totalio-backup-${backup.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restore"), backup: z.unknown() }),
  z.object({ action: z.literal("merge"), backup: z.unknown() }),
  z.object({ action: z.literal("sample") }),
  z.object({ action: z.literal("clear") }),
]);

export const POST = authedRoute(async (req, _ctx, user) => {
  const body = action.parse(await readJson(req));
  switch (body.action) {
    case "restore":
      return json(await restoreBackup(prisma, user.id, body.backup));
    case "merge":
      return json(await mergeBackup(prisma, user.id, body.backup));
    case "sample":
      return json(await loadSampleData(prisma, user.id));
    case "clear":
      await clearAll(prisma, user.id);
      return json({ ok: true });
  }
});
