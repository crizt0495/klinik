"use server";

import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError } from "@/lib/errors";
import { createUser, createRole, assignRolePermissions, assignUserRole } from "./service";
import { parseZod } from "@/lib/validation";
import { z } from "zod/v4";

const createUserSchema = z.object({ username: z.string().min(3).max(50), fullName: z.string().min(1), email: z.string().email().optional(), password: z.string().min(8) });
const createRoleSchema = z.object({ name: z.string().trim().min(1).max(128), description: z.string().trim().max(1000).optional() });

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("users.create");
    const input = parseZod(createUserSchema, Object.fromEntries(fd));
    await createUser(user, input);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function createRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("roles.manage");
    const input = parseZod(createRoleSchema, Object.fromEntries(fd));
    await createRole(user, input);
    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function assignRolePermissionsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("roles.manage");
    const roleId = String(fd.get("roleId"));
    const permissionIds = JSON.parse(String(fd.get("permissionIds") ?? "[]")) as string[];
    await assignRolePermissions(user, roleId, permissionIds);
    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function assignUserRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("users.update");
    const userId = String(fd.get("userId"));
    const roleIds = JSON.parse(String(fd.get("roleIds") ?? "[]")) as string[];
    await assignUserRole(user, userId, roleIds);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}