import "server-only";
import { prisma } from "./db";
import { conflict, HttpError } from "./http";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import { endOtherSessions, endSession, startSession, type SessionUser } from "./auth";
import { changePasswordSchema, deleteAccountSchema, loginSchema, nameSchema, signupSchema } from "@/lib/validation";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export function signupsAllowed() {
  return (process.env.ALLOW_SIGNUPS ?? "true").toLowerCase() !== "false";
}

/**
 * Creates an account and signs it in. The very first account also takes
 * ownership of data that existed before accounts were introduced.
 */
export async function signup(input: unknown): Promise<SessionUser & { claimed: number }> {
  const data = signupSchema.parse(input);
  const passwordHash = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const userCount = await tx.user.count();
    if (userCount > 0 && !signupsAllowed()) throw new HttpError(403, "New sign-ups are closed on this site.");
    if (await tx.user.findUnique({ where: { email: data.email } })) {
      throw conflict("An account with this email already exists. Try signing in instead.");
    }
    const user = await tx.user.create({ data: { email: data.email, name: data.name, passwordHash } });
    let claimed = 0;
    if (userCount === 0) {
      const c = await tx.category.updateMany({ where: { userId: null }, data: { userId: user.id } });
      const e = await tx.expense.updateMany({ where: { userId: null }, data: { userId: user.id } });
      await tx.setting.updateMany({ where: { userId: null }, data: { userId: user.id } });
      claimed = c.count + e.count;
    }
    return { user, claimed };
  });

  await startSession(result.user.id);
  const u = result.user;
  return { id: u.id, email: u.email, name: u.name, viaAdmin: false, claimed: result.claimed };
}

const INVALID = "Incorrect email or password.";

export async function login(input: unknown): Promise<SessionUser> {
  const { email, password } = loginSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await verifyPassword(password, await dummyHash()); // same timing as a real check
    throw new HttpError(401, INVALID);
  }
  if (user.suspended) {
    // Only revealed after the password is verified, so it can't be used to probe emails.
    if (await verifyPassword(password, user.passwordHash)) {
      throw new HttpError(403, "This account has been suspended. Contact the site administrator.");
    }
    throw new HttpError(401, INVALID);
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new HttpError(429, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data:
        failed >= MAX_FAILED
          ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLogins: failed },
    });
    throw new HttpError(
      401,
      failed >= MAX_FAILED ? `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` : INVALID,
    );
  }
  if (user.failedLogins || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  await startSession(user.id);
  return { id: user.id, email: user.email, name: user.name, viaAdmin: false };
}

export async function updateName(user: SessionUser, input: unknown): Promise<SessionUser> {
  const name = nameSchema.parse((input as { name?: unknown })?.name);
  const u = await prisma.user.update({ where: { id: user.id }, data: { name } });
  return { id: u.id, email: u.email, name: u.name, viaAdmin: user.viaAdmin };
}

/** Changes the password and signs out every other device. */
export async function changePassword(user: SessionUser, input: unknown) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    throw new HttpError(400, "Your current password is incorrect.");
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await endOtherSessions(user.id);
}

export async function signOutEverywhereElse(user: SessionUser) {
  await endOtherSessions(user.id);
}

/** Permanently deletes the account and all of its data. */
export async function deleteAccount(user: SessionUser, input: unknown) {
  const { password } = deleteAccountSchema.parse(input);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(password, row.passwordHash))) throw new HttpError(400, "Your password is incorrect.");
  await purgeUser(user.id);
  await endSession();
}

/** Deletes a user and everything they own, in one transaction. */
export async function purgeUser(userId: string) {
  await prisma.$transaction([
    prisma.categoryDependency.deleteMany({ where: { category: { userId } } }),
    prisma.expense.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId } }),
    prisma.setting.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
