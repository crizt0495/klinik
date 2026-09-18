"use server";

import { cookies } from "next/headers";
import { z } from "zod/v4";
import { getSessionUser } from "@/lib/auth/guard";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken, SESSION_COOKIE } from "@/lib/auth/session";
import { toAppError, AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseZod } from "@/lib/validation";
import { writeAuditLog } from "@/lib/services/audit";

type ChangePasswordState = { success?: boolean; error?: string };

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi").max(256),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter").max(256),
  confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
});

export async function changePasswordAction(_prev: ChangePasswordState, fd: FormData): Promise<ChangePasswordState> {
  try {
    const user = await getSessionUser();
    const input = parseZod(changePasswordSchema, Object.fromEntries(fd));
    if (input.newPassword !== input.confirmPassword) {
      throw new ValidationError("Konfirmasi password tidak cocok");
    }

    const rows = await db().select().from(users).where(eq(users.id, user.id)).limit(1);
    const u = rows[0];
    if (!u) throw new NotFoundError("Pengguna tidak ditemukan");

    const currentValid = await verifyPassword(u.passwordHash, input.currentPassword);
    if (!currentValid) {
      throw new AppError("VALIDATION_ERROR", "Password saat ini salah", 400);
    }
    if (input.currentPassword === input.newPassword) {
      throw new AppError("VALIDATION_ERROR", "Password baru tidak boleh sama dengan password lama", 400);
    }

    const passwordHash = await hashPassword(input.newPassword);
    await db().update(users).set({ passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));

    // Cabut sesi lain, sesi saat ini tetap aktif.
    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
    if (currentToken) {
      await db().update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, hashToken(currentToken))));
    }

    await writeAuditLog({ user, action: "CHANGE_PASSWORD", entityType: "users", entityId: user.id });
    return { success: true };
  } catch (err) {
    return { error: toAppError(err).message };
  }
}