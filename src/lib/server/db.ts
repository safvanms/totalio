import { PrismaClient } from "@prisma/client";

// Accept the connection-string names that hosting integrations create
// (same fallbacks as scripts/vercel-build.mjs).
const env = process.env;
env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || "";
env.DIRECT_URL ||= env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
