import { getCurrentSessionUser, type SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";

/**
 * Returns the authenticated session user after validating:
 * 1. authenticated
 * 2. user active
 * 3. organization active
 * 4. branch active (if bound)
 */
export async function getSessionUser(): Promise<SessionUser> {
  const user = await getCurrentSessionUser();
  await assertSessionUsable(user);
  return user;
}

export async function assertSessionUsable(user: SessionUser): Promise<void> {
  if (!user.isActive) {
    throw new ForbiddenError("Akun Anda tidak aktif.");
  }
  if (user.organizationStatus !== "ACTIVE") {
    throw new ForbiddenError("Organisasi tidak aktif.");
  }
  if (user.branchStatus && user.branchStatus !== "ACTIVE") {
    throw new ForbiddenError("Cabang tidak aktif.");
  }
}

export async function requirePermissionOrThrow(user: SessionUser, permission: string): Promise<void> {
  assertSessionUsable(user);
  if (user.isSuperAdmin) return;
  if (!user.permissions.has(permission)) {
    throw new ForbiddenError(`Anda tidak memiliki izin: ${permission}`);
  }
}

export function assertCan(user: SessionUser, permission: string): void {
  if (!user.isSuperAdmin && !user.permissions.has(permission)) {
    throw new ForbiddenError(`Anda tidak memiliki izin: ${permission}`);
  }
}

export function assertOrgAccess(user: SessionUser, organizationId: string): void {
  if (user.organizationId !== organizationId) {
    throw new ForbiddenError("Anda tidak memiliki akses ke data organisasi ini.");
  }
}

export function assertBranchAccess(user: SessionUser, organizationId: string, branchId?: string | null): void {
  assertOrgAccess(user, organizationId);
  if (branchId && user.branchId && user.branchId !== branchId) {
    throw new ForbiddenError("Anda tidak memiliki akses ke data cabang ini.");
  }
}