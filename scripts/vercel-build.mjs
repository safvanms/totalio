/**
 * Production build for Vercel (PostgreSQL).
 *
 * Resolves the database connection strings from whatever names the hosting
 * integration created, so the only thing you must provide is a database:
 *   DATABASE_URL : pooled connection   (fallbacks: POSTGRES_PRISMA_URL, POSTGRES_URL)
 *   DIRECT_URL   : direct connection   (fallbacks: DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DATABASE_URL)
 *
 * Then: prisma generate -> prisma db push (create/update tables) -> next build.
 * `node scripts/vercel-build.mjs --check` only validates the setup.
 */
import { execSync } from "node:child_process";

const SCHEMA = "prisma/schema.postgres.prisma";
const env = { ...process.env };

function pick(target, candidates) {
  if (env[target]) return target;
  const found = candidates.find((n) => env[n]);
  if (found) env[target] = env[found];
  return found ?? null;
}

const dbFrom = pick("DATABASE_URL", ["POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
const directFrom = pick("DIRECT_URL", ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"]);

if (!dbFrom) {
  console.error(
    "\n✖ No database connection string found.\n" +
      "  Add a Postgres database to this Vercel project (Storage → Create Database → Neon)\n" +
      "  or set DATABASE_URL in Settings → Environment Variables, then redeploy.\n",
  );
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
  console.error(`\n✖ ${dbFrom} is not a PostgreSQL connection string (it must start with postgres:// or postgresql://).\n`);
  process.exit(1);
}

console.log(`• Database (pooled) : ${dbFrom}`);
console.log(`• Database (direct) : ${directFrom}${directFrom === "DATABASE_URL" ? "  (no separate direct URL found; using the pooled one)" : ""}`);

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env });
};

run("node scripts/sync-schema.mjs --check");

if (process.argv.includes("--check")) {
  run(`npx prisma validate --schema ${SCHEMA}`);
  process.exit(0);
}

run(`npx prisma generate --schema ${SCHEMA}`);
run(`npx prisma db push --schema ${SCHEMA} --skip-generate`);
run("npx next build");
