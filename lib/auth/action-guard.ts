import { getSessionUser, requirePermissionOrThrow } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Resolves and authorizes the current user for a server action.
 * Throws UnauthorizedError/ForbiddenError when not permitted.
 */
export async function getActionUser(permission: string): Promise<SessionUser> {
  const user = await getSessionUser();
  await requirePermissionOrThrow(user, permission);
  return user;
}

export type ActionState = { success?: boolean; error?: string; data?: unknown };