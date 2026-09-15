import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, branches, organizations, type User } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, loadUserContext, setSessionCookie, type SessionUser } from "@/lib/auth/session";
import { AppError, InvalidStateError, NotFoundError } from "@/lib/errors";

export interface LoginResult {
  sessionUser: SessionUser;
  token: string;
  mustChangePassword: boolean;
}

export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  if (!username || !password) {
    throw new AppError("VALIDATION_ERROR", "Username atau password salah.", 400);
  }

  const usersFound = await db()
    .select()
    .from(users)
    .where(and(sql`lower(${users.username}) = lower(${username})`, isNull(users.deletedAt)))
    .limit(1);

  const user = usersFound[0] as User | undefined;
  if (!user) {
    throw new NotFoundError("Username atau password salah.");
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) {
    throw new NotFoundError("Username atau password salah.");
  }

  if (!user.isActive) {
    throw new InvalidStateError("Akun Anda tidak aktif. Hubungi administrator.");
  }

  const org = await db().query.organizations.findFirst({ where: eq(organizations.id, user.organizationId) });
  if (!org || org.status !== "ACTIVE") {
    throw new InvalidStateError("Organisasi tidak aktif. Hubungi administrator.");
  }

  if (user.branchId) {
    const branch = await db().query.branches.findFirst({ where: eq(branches.id, user.branchId) });
    if (!branch || branch.status !== "ACTIVE") {
      throw new InvalidStateError("Cabang tidak aktif. Hubungi administrator.");
    }
  }

  const sessionUser = await loadUserContext(user);
  const token = await createSession(user.id, user.organizationId, user.branchId);

  await db()
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { sessionUser, token, mustChangePassword: user.mustChangePassword ?? false };
}

export async function completeLogin(result: LoginResult): Promise<void> {
  await setSessionCookie(result.token);
}