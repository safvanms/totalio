/**
 * Loads the sample dataset into one account (creating it if needed).
 *
 *   npm run db:seed                       -> demo@totalio.local / demo12345 (local only)
 *   SEED_EMAIL=you@x.com SEED_PASSWORD=… npm run db:seed
 *
 * Existing data of that account is replaced. Other accounts are untouched.
 */
import { PrismaClient } from "@prisma/client";
import { loadSampleData } from "../src/lib/server/sample-data";
import { hashPassword } from "../src/lib/server/password";

const db = new PrismaClient();

async function main() {
  const isPostgres = /^postgres/.test(process.env.DATABASE_URL ?? "");
  const email = (process.env.SEED_EMAIL ?? "demo@totalio.local").trim().toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "demo12345";
  if (isPostgres && (!process.env.SEED_EMAIL || !process.env.SEED_PASSWORD)) {
    throw new Error("Refusing to create the default demo account in a production database. Set SEED_EMAIL and SEED_PASSWORD.");
  }
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { email, name: email.split("@")[0], passwordHash: await hashPassword(password) } });
    console.log(`Created account ${email} (password: ${process.env.SEED_PASSWORD ? "as provided" : password})`);
  }
  const r = await loadSampleData(db, user.id);
  console.log(`Seeded ${r.categories} categories and ${r.expenses} expenses into ${email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
