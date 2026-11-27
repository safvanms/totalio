import { PrismaClient } from "@prisma/client";
import { loadSampleData } from "../src/lib/server/sample-data";

const db = new PrismaClient();

loadSampleData(db)
  .then((r) => console.log(`Seeded ${r.categories} categories and ${r.expenses} expenses.`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
