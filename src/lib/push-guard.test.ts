import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs build helper without type declarations
import { classifyPushOutput } from "../../scripts/push-guard.mjs";

// Verbatim from the failed Vercel build (accounts upgrade on Postgres).
const VERCEL_LOG = `
⚠️  There might be data loss when applying the changes:

  • A unique constraint covering the columns \`[userId,code]\` on the table \`Category\` will be added. If there are existing duplicate values, this will fail.

  • A unique constraint covering the columns \`[userId]\` on the table \`Setting\` will be added. If there are existing duplicate values, this will fail.


Error: Use the --accept-data-loss flag to ignore the data loss warnings like prisma db push --accept-data-loss
`;

describe("db push guard", () => {
  it("auto-accepts the accounts upgrade (only new unique constraints)", () => {
    const r = classifyPushOutput(VERCEL_LOG);
    expect(r.warnings).toHaveLength(2);
    expect(r.canAutoAccept).toBe(true);
  });

  it("refuses when a column would be dropped", () => {
    const log = `${VERCEL_LOG}\n  • You are about to drop the column \`notes\` on the \`Expense\` table, which still contains 381 non-null values.\n`;
    const r = classifyPushOutput(log);
    expect(r.canAutoAccept).toBe(false);
    expect(r.unsafe[0]).toMatch(/drop the column/);
  });

  it("refuses type changes and table drops", () => {
    for (const w of [
      "The `amount` column on the `Expense` table would be dropped and recreated. This will lead to data loss.",
      "You are about to drop the `Setting` table, which is not empty (1 rows).",
    ]) {
      expect(classifyPushOutput(`  • ${w}\nUse the --accept-data-loss flag`).canAutoAccept).toBe(false);
    }
  });

  it("refuses unrelated failures (e.g. connection errors)", () => {
    expect(classifyPushOutput("Error: P1001: Can't reach database server").canAutoAccept).toBe(false);
  });
});
