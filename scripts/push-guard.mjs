/**
 * Decides whether a failed `prisma db push` may be retried with
 * --accept-data-loss. Only "a unique constraint will be added" warnings are
 * considered safe: adding a constraint never deletes rows (it either applies,
 * or fails if duplicates exist). Anything else — dropping a column or table,
 * changing a type, etc. — is not safe.
 */
const SAFE = /^A unique constraint covering the columns `\[[^\]]+\]` on the table `[^`]+` will be added\./;

export function classifyPushOutput(output) {
  const asksForFlag = /--accept-data-loss/.test(output);
  const warnings = [...output.matchAll(/^\s*•\s+(.+)$/gm)].map((m) => m[1].trim());
  const unsafe = warnings.filter((w) => !SAFE.test(w));
  return {
    warnings,
    unsafe,
    canAutoAccept: asksForFlag && warnings.length > 0 && unsafe.length === 0,
  };
}
