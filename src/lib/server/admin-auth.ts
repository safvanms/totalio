import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import { HttpError, route } from "./http";
import { cookieOptions, sha256 } from "./auth";
import { adminLoginSchema } from "@/lib/validation";

/**
 * The /admin area has its own sign-in, separate from user accounts. The
 * credentials come from ADMIN_USERNAME / ADMIN_PASSWORD (never the code, so
 * they don't end up in the repository). Without both, /admin is disabled.
 */
export const ADMIN_COOKIE = "totalio_admin";
const ADMIN_SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_USERNAME?.trim() && !!process.env.ADMIN_PASSWORD;
}

/** Constant-time string comparison (hashing first makes the lengths equal). */
function same(a: string, b: string) {
  return timingSafeEqual(Buffer.from(sha256(a), "hex"), Buffer.from(sha256(b), "hex"));
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64) || "local";
}

export async function adminLogin(input: unknown) {
  if (!adminConfigured()) throw new HttpError(503, "Admin access isn't set up on this server.");
  const { username, password } = adminLoginSchema.parse(input);
  const ip = await clientIp();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);

  const failures = await prisma.adminLoginFailure.count({ where: { ip, createdAt: { gte: since } } });
  if (failures >= MAX_FAILURES) {
    throw new HttpError(429, `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
  }

  // Evaluate both comparisons so timing doesn't reveal which one failed.
  const userOk = same(username.trim(), process.env.ADMIN_USERNAME!.trim());
  const passOk = same(password, process.env.ADMIN_PASSWORD!);
  if (!userOk || !passOk) {
    await prisma.adminLoginFailure.create({ data: { ip } });
    const left = MAX_FAILURES - failures - 1;
    throw new HttpError(
      401,
      left <= 0 ? `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` : "Incorrect username or password.",
    );
  }

  await prisma.adminLoginFailure.deleteMany({ where: { OR: [{ ip }, { createdAt: { lt: since } }] } });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_HOURS * 3_600_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await prisma.adminSession.create({ data: { tokenHash: sha256(token), expiresAt, userAgent: ua } });
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  (await cookies()).set(ADMIN_COOKIE, token, cookieOptions(expiresAt));
}

export async function adminLogout() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(ADMIN_COOKIE);
}

/** Whether this request carries a valid admin session. Cached per request. */
export const isAdminSignedIn = cache(async (): Promise<boolean> => {
  if (!adminConfigured()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 100) return false;
  const s = await prisma.adminSession.findUnique({ where: { tokenHash: sha256(token) }, select: { expiresAt: true } });
  return !!s && s.expiresAt.getTime() > Date.now();
});

export async function requireAdmin() {
  if (!(await isAdminSignedIn())) throw new HttpError(401, "Admin sign-in required.");
}

/** Route handler for /api/admin/*: requires an admin session. */
export function adminRoute<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return route<C>(async (req, ctx) => {
    await requireAdmin();
    return fn(req, ctx);
  });
}
