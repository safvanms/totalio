import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/server/admin-auth";
import { userBackup } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** The user's full data as a Totalio backup file (importable in Settings). */
export const GET = adminRoute<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { email, backup } = await userBackup((await params).id);
  const safe = email.replace(/[^a-z0-9._-]+/gi, "_");
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="totalio-${safe}-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
