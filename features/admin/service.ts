import { and, eq, sql, asc, ne, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
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

export async function listUserRoleMap(user: SessionUser): Promise<Record<string, string[]>> {
  const rows = await db()
    .select({ userId: s.userRoles.userId, roleId: s.userRoles.roleId })
    .from(s.userRoles)
    .innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId))
    .where(eq(s.roles.organizationId, user.organizationId));
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    (map[r.userId] ??= []).push(r.roleId);
  }
  return map;
}

async function getRoleInOrg(user: SessionUser, roleId: string) {
  const rows = await db().select().from(s.roles).where(and(eq(s.roles.id, roleId), eq(s.roles.organizationId, user.organizationId))).limit(1);
  return rows[0] ?? null;
}

async function getSuperAdminRoleId(user: SessionUser): Promise<string | null> {
  const rows = await db().select({ id: s.roles.id }).from(s.roles).where(and(eq(s.roles.organizationId, user.organizationId), eq(s.roles.code, "SUPER_ADMIN"))).limit(1);
  return rows[0]?.id ?? null;
}

export const PROTECTED_ROLE_CODES = new Set(["SUPER_ADMIN", "OWNER"]);

function isProtectedRole(role: { code: string; isSystem: boolean }): boolean {
  return role.isSystem && PROTECTED_ROLE_CODES.has(role.code);
}

export async function listStaff(user: SessionUser) {
  return db()
    .select({
      id: s.staff.id,
      employeeNumber: s.staff.employeeNumber,
      fullName: s.staff.fullName,
      phone: s.staff.phone,
      email: s.staff.email,
      staffType: s.staff.staffType,
      status: s.staff.status,
      username: s.users.username,
    })
    .from(s.staff)
    .leftJoin(s.users, eq(s.users.id, s.staff.userId))
    .where(eq(s.staff.organizationId, user.organizationId))
    .orderBy(asc(s.staff.fullName));
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

export async function listPermissions() {
  return db().select({ id: s.permissions.id, code: s.permissions.code, module: s.permissions.module }).from(s.permissions).orderBy(asc(s.permissions.code));
}

export async function createRole(user: SessionUser, data: { name: string; description?: string }) {
  const name = data.name.trim();
  if (!name) throw new ConflictError("Nama role tidak boleh kosong");
  const existing = await db().select({ id: s.roles.id }).from(s.roles).where(and(eq(s.roles.organizationId, user.organizationId), eq(s.roles.name, name))).limit(1);
  if (existing.length > 0) throw new ConflictError(`Role "${name}" sudah ada`);
  const existingCodes = await db().select({ code: s.roles.code }).from(s.roles).where(eq(s.roles.organizationId, user.organizationId));
  const usedCodes = new Set(existingCodes.map((r) => r.code));
  let code = name.toUpperCase().replace(/\s+/g, "_");
  if (usedCodes.has(code)) {
    let suffix = 2;
    while (usedCodes.has(`${code}_${suffix}`)) suffix++;
    code = `${code}_${suffix}`;
  }
  const [created] = await db().insert(s.roles).values({ organizationId: user.organizationId, code, name, description: data.description ?? null, isSystem: false }).returning();
  await writeAuditLog({ user, action: "CREATE", entityType: "roles", entityId: created.id, newData: { code, name, description: data.description ?? null } });
  return created;
}

export async function getRolePermissions(user: SessionUser, roleId: string) {
  const role = await getRoleInOrg(user, roleId);
  if (!role) throw new NotFoundError("Role tidak ditemukan");
  return db()
    .select({ permissionId: s.rolePermissions.permissionId })
    .from(s.rolePermissions)
    .innerJoin(s.permissions, eq(s.permissions.id, s.rolePermissions.permissionId))
    .where(eq(s.rolePermissions.roleId, roleId));
}

export async function assignRolePermissions(user: SessionUser, roleId: string, permissionIds: string[]) {
  const role = await getRoleInOrg(user, roleId);
  if (!role) throw new NotFoundError("Role tidak ditemukan");
  if (isProtectedRole(role)) throw new ForbiddenError("Hak akses role sistem utama (Super Admin / Owner) tidak dapat diubah");

  if (permissionIds.length > 0) {
    const valid = await db().select({ id: s.permissions.id }).from(s.permissions).where(inArray(s.permissions.id, permissionIds));
    if (valid.length !== permissionIds.length) throw new ValidationError("Terdapat izin yang tidak valid");
  }

  await db().delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, roleId));
  if (permissionIds.length > 0) {
    await db().insert(s.rolePermissions).values(permissionIds.map((pid) => ({ roleId, permissionId: pid })));
  }
  await writeAuditLog({ user, action: "UPDATE_PERMISSIONS", entityType: "roles", entityId: roleId, newData: { permissionCount: permissionIds.length } });
}

export async function updateRole(user: SessionUser, roleId: string, data: { name: string; description?: string }) {
  const role = await getRoleInOrg(user, roleId);
  if (!role) throw new NotFoundError("Role tidak ditemukan");
  if (role.isSystem) throw new ForbiddenError("Role sistem tidak dapat diubah");

  const name = data.name.trim();
  if (!name) throw new ValidationError("Nama role tidak boleh kosong");
  const dup = await db().select({ id: s.roles.id }).from(s.roles).where(and(eq(s.roles.organizationId, user.organizationId), eq(s.roles.name, name), ne(s.roles.id, roleId))).limit(1);
  if (dup.length > 0) throw new ConflictError(`Role "${name}" sudah ada`);

  await db().update(s.roles).set({ name, description: data.description?.trim() || null, updatedAt: new Date() }).where(eq(s.roles.id, roleId));
  await writeAuditLog({ user, action: "UPDATE", entityType: "roles", entityId: roleId, oldData: { name: role.name, description: role.description }, newData: { name, description: data.description?.trim() || null } });
}

export async function deleteRole(user: SessionUser, roleId: string) {
  const role = await getRoleInOrg(user, roleId);
  if (!role) throw new NotFoundError("Role tidak ditemukan");
  if (role.isSystem) throw new ForbiddenError("Role sistem tidak dapat dihapus");

  const assigned = await db().select({ userId: s.userRoles.userId }).from(s.userRoles).where(eq(s.userRoles.roleId, roleId)).limit(1);
  if (assigned.length > 0) throw new ConflictError("Role masih digunakan oleh pengguna dan tidak dapat dihapus");

  await db().delete(s.roles).where(eq(s.roles.id, roleId));
  await writeAuditLog({ user, action: "DELETE", entityType: "roles", entityId: roleId, oldData: { code: role.code, name: role.name } });
}

export async function assignUserRole(user: SessionUser, userId: string, roleIds: string[]) {
  const targetRows = await db().select().from(s.users).where(and(eq(s.users.id, userId), eq(s.users.organizationId, user.organizationId))).limit(1);
  if (targetRows.length === 0) throw new NotFoundError("Pengguna tidak ditemukan");

  if (roleIds.length > 0) {
    const valid = await db().select({ id: s.roles.id }).from(s.roles).where(and(inArray(s.roles.id, roleIds), eq(s.roles.organizationId, user.organizationId)));
    if (valid.length !== roleIds.length) throw new ValidationError("Terdapat role yang tidak valid");
  }

  const superAdminId = await getSuperAdminRoleId(user);

  // Cegah mencabut Super Admin dari diri sendiri (anti self-lockout).
  if (userId === user.id && superAdminId) {
    const currentRoles = await db().select({ roleId: s.userRoles.roleId }).from(s.userRoles).where(eq(s.userRoles.userId, userId));
    const hadSuper = currentRoles.some((r) => r.roleId === superAdminId);
    const willHaveSuper = roleIds.includes(superAdminId);
    if (hadSuper && !willHaveSuper) throw new ForbiddenError("Anda tidak dapat mencabut role Super Admin dari diri sendiri");
  }

  await db().delete(s.userRoles).where(eq(s.userRoles.userId, userId));
  if (roleIds.length > 0) {
    await db().insert(s.userRoles).values(roleIds.map((rid) => ({ userId, roleId: rid })));
  }
  await writeAuditLog({ user, action: "UPDATE_ROLES", entityType: "users", entityId: userId, newData: { roleCount: roleIds.length } });
}