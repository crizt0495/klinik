import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, organizations, branches, userRoles, roles, rolePermissions, permissions, type User } from "@/db/schema";
import { UnauthorizedError } from "@/lib/errors";

export const SESSION_COOKIE = "klinik_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

export interface PermissionContext {
  permissions: Set<string>;
  roles: string[];
  isSuperAdmin: boolean;
}

export interface SessionUser {
  id: string;
  organizationId: string;
  branchId: string | null;
  username: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  organizationStatus: string;
  branchStatus: string | null;
  permissions: Set<string>;
  roles: string[];
  isSuperAdmin: boolean;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string, organizationId: string, branchId: string | null): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  await db().insert(sessions).values({
    userId,
    organizationId,
    branchId,
    tokenHash,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    userAgent: "",
  });
  return token;
}

export async function loadUserContext(user: User): Promise<SessionUser> {
  const org = await db().query.organizations.findFirst({ where: eq(organizations.id, user.organizationId) });
  if (!org) throw new UnauthorizedError("Organisasi tidak ditemukan");

  const branch = user.branchId ? await db().query.branches.findFirst({ where: eq(branches.id, user.branchId) }) : null;

  const userRoleRows = await db()
    .select({
      roleCode: roles.code,
      permissionCode: permissions.code,
      isSystem: roles.isSystem,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, user.id));

  const rolesSet = new Set<string>();
  const permissionsSet = new Set<string>();
  let isSuperAdmin = false;
  for (const row of userRoleRows) {
    if (!row.roleCode) continue;
    rolesSet.add(row.roleCode);
    if (row.roleCode === "SUPER_ADMIN") isSuperAdmin = true;
    if (row.permissionCode) permissionsSet.add(row.permissionCode);
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    branchId: user.branchId,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    organizationStatus: org.status,
    branchStatus: branch?.status ?? null,
    permissions: permissionsSet,
    roles: [...rolesSet],
    isSuperAdmin,
  };
}

export async function getSessionUserFromToken(token: string): Promise<SessionUser> {
  const tokenHash = hashToken(token);
  const row = await db()
    .select()
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1);

  if (row.length === 0) throw new UnauthorizedError("Sesi tidak ditemukan");

  const sessionRow = row[0].sessions;
  const user = row[0].users;

  if (new Date(sessionRow.expiresAt).getTime() < Date.now()) {
    await db().delete(sessions).where(eq(sessions.id, sessionRow.id));
    throw new UnauthorizedError("Sesi telah kedaluwarsa");
  }

  return loadUserContext(user);
}

export async function getCurrentSessionUser(): Promise<SessionUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) throw new UnauthorizedError("Tidak terautentikasi");
  return getSessionUserFromToken(token);
}

export async function refreshSessionExpiry(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db()
    .update(sessions)
    .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}

export async function destroySession(token?: string): Promise<void> {
  const cookieStore = await cookies();
  const raw = token ?? cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    await db().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(raw)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, userId));
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function can(ctx: SessionUser, permission: string): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.permissions.has(permission);
}

export function canAny(ctx: SessionUser, ...permissions: string[]): boolean {
  if (ctx.isSuperAdmin) return true;
  return permissions.some((p) => ctx.permissions.has(p));
}

export async function requirePermission(ctx: SessionUser, permission: string): Promise<void> {
  if (!can(ctx, permission)) {
    throw new UnauthorizedError(`Anda tidak memiliki izin untuk tindakan ini (${permission})`);
  }
}

export function requirePermissionSync(ctx: SessionUser, permission: string): void {
  if (!can(ctx, permission)) {
    throw new UnauthorizedError(`Anda tidak memiliki izin untuk tindakan ini (${permission})`);
  }
}

export function hasOrgAccess(ctx: SessionUser, organizationId: string): boolean {
  return ctx.organizationId === organizationId;
}

export function hasBranchAccess(ctx: SessionUser, organizationId: string, branchId?: string | null): boolean {
  if (ctx.organizationId !== organizationId) return false;
  if (!ctx.branchId || !branchId) return true;
  return ctx.branchId === branchId;
}

export function requireTenant(ctx: SessionUser, organizationId: string, branchId?: string | null): void {
  if (!hasOrgAccess(ctx, organizationId)) {
    throw new UnauthorizedError("Anda tidak memiliki akses ke data organisasi ini");
  }
  if (branchId && ctx.branchId && ctx.branchId !== branchId) {
    throw new UnauthorizedError("Anda tidak memiliki akses ke data cabang ini");
  }
}