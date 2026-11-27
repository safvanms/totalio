import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { json, readJson, route } from "@/lib/server/http";
import { clearAll, createBackup, mergeBackup, restoreBackup } from "@/lib/server/backup";
import { loadSampleData } from "@/lib/server/sample-data";

export const dynamic = "force-dynamic";
// Large restores/merges can take a while on serverless hosts.
export const maxDuration = 60;

export const GET = route(async () => {
  const backup = await createBackup(prisma);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="spendly-backup-${backup.exportedAt.slice(0, 10)}.json"`,
    },
  });
});

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restore"), backup: z.unknown() }),
  z.object({ action: z.literal("merge"), backup: z.unknown() }),
  z.object({ action: z.literal("sample") }),
  z.object({ action: z.literal("clear") }),
]);

export const POST = route(async (req) => {
  const body = action.parse(await readJson(req));
  switch (body.action) {
    case "restore":
      return json(await restoreBackup(prisma, body.backup));
    case "merge":
      return json(await mergeBackup(prisma, body.backup));
    case "sample":
      return json(await loadSampleData(prisma));
    case "clear":
      await clearAll(prisma);
      return json({ ok: true });
  }
});
