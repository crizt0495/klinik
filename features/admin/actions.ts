"use server";

import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError } from "@/lib/errors";
import { createUser, assignRolePermissions, assignUserRole } from "./service";
import { parseZod } from "@/lib/validation";
import { z } from "zod/v4";

const createUserSchema = z.object({ username: z.string().min(3).max(50), fullName: z.string().min(1), email: z.string().email().optional(), password: z.string().min(8) });

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("settings.manage");
    const input = parseZod(createUserSchema, Object.fromEntries(fd));
    await createUser(user, input);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function assignRolePermissionsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("settings.manage");
    const roleId = String(fd.get("roleId"));
    const permissionIds = JSON.parse(String(fd.get("permissionIds") ?? "[]")) as string[];
    await assignRolePermissions(user, roleId, permissionIds);
    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function assignUserRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("settings.manage");
    const userId = String(fd.get("userId"));
    const roleIds = JSON.parse(String(fd.get("roleIds") ?? "[]")) as string[];
    await assignUserRole(user, userId, roleIds);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}