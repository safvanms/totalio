import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import { HttpError, route } from "./http";

export const SESSION_COOKIE = "totalio_session";
const SESSION_DAYS = 30;
/** Sessions are extended when used and closer than this to expiry. */
const RENEW_WITHIN_DAYS = 15;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Creates a session row and sets the cookie. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await prisma.session.create({ data: { tokenHash: sha256(token), userId, expiresAt, userAgent: ua } });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Ends the current session (if any) and clears the cookie. */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/**
 * The signed-in user for this request, or null. Cached per request.
 * Expired sessions are removed; active ones are renewed (sliding expiry).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.expiresAt.getTime() - Date.now() < RENEW_WITHIN_DAYS * 86_400_000) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt } }).catch(() => {});
    try {
      jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
    } catch {
      /* cookies are read-only while rendering a page; the API will renew it */
    }
  }
  return session.user;
});

/** For API routes: the signed-in user, or a 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  return user;
}

/** Route handler that requires a signed-in user and receives it. */
export function authedRoute<C = unknown>(fn: (req: Request, ctx: C, user: SessionUser) => Promise<Response>) {
  return route<C>(async (req, ctx) => fn(req, ctx, await requireUser()));
}

/** Sign out everywhere except (optionally) the current session. */
export async function endOtherSessions(userId: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await prisma.session.deleteMany({
    where: { userId, ...(token ? { NOT: { tokenHash: sha256(token) } } : {}) },
  });
}

export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
