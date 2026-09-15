import { and, count, eq, lt, gte } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { RateLimitedError } from "@/lib/errors";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PER_WINDOW = 10;

export async function isLoginBlocked(username: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byUser, byIp] = await Promise.all([
    db().select({ c: count() }).from(loginAttempts).where(and(eq(loginAttempts.username, username.toLowerCase()), eq(loginAttempts.successful, false), gte(loginAttempts.attemptedAt, since))),
    db().select({ c: count() }).from(loginAttempts).where(and(eq(loginAttempts.ipAddress, ip as never), eq(loginAttempts.successful, false), gte(loginAttempts.attemptedAt, since))),
  ]);
  const userFailures = byUser[0]?.c ?? 0;
  const ipFailures = byIp[0]?.c ?? 0;
  return userFailures >= MAX_FAILED_PER_WINDOW || ipFailures >= MAX_FAILED_PER_WINDOW;
}

export async function recordLoginAttempt(username: string, ip: string, successful: boolean): Promise<void> {
  await db().insert(loginAttempts).values({
    username: username.toLowerCase(),
    ipAddress: ip as never,
    successful,
  });
  if (successful) {
    const since = new Date(Date.now() - WINDOW_MS);
    await db().delete(loginAttempts).where(and(eq(loginAttempts.username, username.toLowerCase()), lt(loginAttempts.attemptedAt, since)));
  }
}

export async function assertNotBlocked(username: string, ip: string): Promise<void> {
  const blocked = await isLoginBlocked(username, ip);
  if (blocked) {
    throw new RateLimitedError();
  }
}