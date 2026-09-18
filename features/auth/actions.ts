"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { loginWithPassword, completeLogin } from "@/lib/auth/login";
import { assertNotBlocked, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { destroySession } from "@/lib/auth/session";
import { formatZodError, AppError, toAppError, ValidationError } from "@/lib/errors";

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi").max(64),
  password: z.string().min(1, "Password wajib diisi").max(256),
});

export type LoginActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  mustChangePassword?: boolean;
};

export async function loginAction(_prev: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const headersStore = await headers();
  const ip =
    headersStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersStore.get("x-real-ip") ??
    headersStore.get("cf-connecting-ip") ??
    "0.0.0.0";
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      throw new ValidationError("Data tidak valid", formatZodError(parsed.error));
    }

    await assertNotBlocked(parsed.data.username, ip);

    const result = await loginWithPassword(parsed.data.username, parsed.data.password);
    await completeLogin(result);
    await recordLoginAttempt(parsed.data.username, ip, true);

    return { success: true, mustChangePassword: result.mustChangePassword };
  } catch (err) {
    const appErr = toAppError(err);
    if (appErr instanceof AppError && (appErr.code === "NOT_FOUND" || appErr.code === "VALIDATION_ERROR")) {
      await recordLoginAttempt(username, ip, false).catch(() => undefined);
    }
    if (appErr.code === "RATE_LIMITED") {
      return { error: "Terlalu banyak percobaan. Silakan coba lagi nanti." };
    }
    if (appErr.code === "VALIDATION_ERROR") {
      return { error: appErr.message, fieldErrors: (appErr.details as Record<string, string>) ?? {} };
    }
    if (appErr.code === "INTERNAL_ERROR") {
      return { error: "Terjadi kesalahan. Silakan coba lagi." };
    }
    return { error: appErr.message };
  }
}

export async function logoutAction(): Promise<{ success: boolean }> {
  try {
    await destroySession();
  } catch {
    // ignore
  }
  return { success: true };
}