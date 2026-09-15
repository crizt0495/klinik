import { and, eq, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/services/audit";

export async function listUsers(user: SessionUser) {
  return db()
    .select({
      id: s.users.id, username: s.users.username, fullName: s.users.fullName, email: s.users.email, isActive: s.users.isActive, lastLoginAt: s.users.lastLoginAt, createdAt: s.users.createdAt,
      roles: sql<string>`string_agg(${s.roles.name}, ', ')`,
    })
    .from(s.users)
    .leftJoin(s.userRoles, eq(s.userRoles.userId, s.users.id))
    .leftJoin(s.roles, eq(s.roles.id, s.userRoles.roleId))
    .where(eq(s.users.organizationId, user.organizationId))
    .groupBy(s.users.id, s.users.username, s.users.fullName, s.users.email, s.users.isActive, s.users.lastLoginAt, s.users.createdAt)
    .orderBy(asc(s.users.username));
}

export async function createUser(user: SessionUser, data: { username: string; fullName: string; email?: string; password: string }) {
  const existing = await db().select().from(s.users).where(and(eq(s.users.username, data.username), eq(s.users.organizationId, user.organizationId))).limit(1);
  if (existing.length > 0) throw new ConflictError(`Username "${data.username}" sudah ada`);
  const passwordHash = await hashPassword(data.password);
  const [created] = await db().insert(s.users).values({
    organizationId: user.organizationId, branchId: user.branchId ?? "", username: data.username, fullName: data.fullName, email: data.email, passwordHash, isActive: true,
  }).returning({ id: s.users.id });
  await writeAuditLog({ user, action: "CREATE", entityType: "users", entityId: created.id, newData: { username: data.username, fullName: data.fullName } });
  return created;
}

export async function listRoles(user: SessionUser) {
  return db().select().from(s.roles).where(eq(s.roles.organizationId, user.organizationId)).orderBy(asc(s.roles.name));
}

export async function getRolePermissions(roleId: string) {
  return db().select({ permissionId: s.rolePermissions.permissionId }).from(s.rolePermissions).where(eq(s.rolePermissions.roleId, roleId));
}

export async function assignRolePermissions(user: SessionUser, roleId: string, permissionIds: string[]) {
  await db().delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, roleId));
  if (permissionIds.length > 0) {
    await db().insert(s.rolePermissions).values(permissionIds.map((pid) => ({ roleId, permissionId: pid })));
  }
  await writeAuditLog({ user, action: "UPDATE_PERMISSIONS", entityType: "roles", entityId: roleId, newData: { permissionCount: permissionIds.length } });
}

export async function assignUserRole(user: SessionUser, userId: string, roleIds: string[]) {
  await db().delete(s.userRoles).where(eq(s.userRoles.userId, userId));
  if (roleIds.length > 0) {
    await db().insert(s.userRoles).values(roleIds.map((rid) => ({ userId, roleId: rid })));
  }
  await writeAuditLog({ user, action: "UPDATE_ROLES", entityType: "users", entityId: userId, newData: { roleCount: roleIds.length } });
}