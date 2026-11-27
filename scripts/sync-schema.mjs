/**
 * Generates prisma/schema.postgres.prisma (production) from prisma/schema.prisma
 * (local SQLite). Only the header and datasource block differ.
 * Usage: npm run schema:sync   (or: node scripts/sync-schema.mjs --check)
 */
import fs from "node:fs";

const src = fs.readFileSync("prisma/schema.prisma", "utf8");
const header = `// Totalio data model: PRODUCTION (PostgreSQL, used on Vercel).
// GENERATED from prisma/schema.prisma by \`npm run schema:sync\`. Do not edit by hand.
`;
const body = src
  .replace(/^(\/\/[^\n]*\n)+/, "")
  .replace(
    /datasource db \{[^}]*\}/,
    `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // pooled connection (serverless)
  directUrl = env("DIRECT_URL")   // direct connection (schema changes)
}`,
  );
const out = header + "\n" + body.replace(/^\n+/, "");
const target = "prisma/schema.postgres.prisma";

if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== out) {
    console.error("✖ prisma/schema.postgres.prisma is out of date. Run: npm run schema:sync");
    process.exit(1);
  }
  console.log("✔ Prisma schemas are in sync");
} else {
  fs.writeFileSync(target, out);
  console.log(`✔ Wrote ${target}`);
}
