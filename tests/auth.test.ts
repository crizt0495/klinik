import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { hashPassword, verifyPassword, isValidPasswordStrength } from "@/lib/auth/password";
import { loginWithPassword } from "@/lib/auth/login";
import { getSessionUserFromToken, can, canAny, requireTenant, revokeAllSessionsForUser } from "@/lib/auth/session";
import { assertNotBlocked, recordLoginAttempt, isLoginBlocked } from "@/lib/auth/rate-limit";
import { NotFoundError, RateLimitedError } from "@/lib/errors";

beforeAll(async () => {
  await initDb();
}, 120000);

describe("password hashing", () => {
  it("hashes and verifies with argon2id", async () => {
    const hash = await hashPassword("S3cret@Password");
    expect(hash).toContain("$argon2id$");
    expect(await verifyPassword(hash, "S3cret@Password")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("validates password strength", () => {
    expect(isValidPasswordStrength("12345678")).toBe(true);
    expect(isValidPasswordStrength("1234567")).toBe(false);
  });
});

describe("login flow", () => {
  it("logs in with valid credentials", async () => {
    const result = await loginWithPassword("admin", "Admin@2026");
    expect(result.token).toBeTruthy();
    expect(result.sessionUser.username).toBe("admin");
    expect(result.sessionUser.isSuperAdmin).toBe(false);
    expect(result.sessionUser.roles).toContain("ADMIN_KLINIK");
  });

  it("rejects wrong password", async () => {
    await expect(loginWithPassword("admin", "wrong-password")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects unknown username", async () => {
    await expect(loginWithPassword("nobody", "whatever123")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("loads the session user from a token", async () => {
    const result = await loginWithPassword("doctor", "Doctor@2026");
    const user = await getSessionUserFromToken(result.token);
    expect(user.id).toBe(result.sessionUser.id);
    expect(user.roles).toContain("DOKTER");
    expect(can(user, "medical_records.create")).toBe(true);
    expect(can(user, "settings.manage")).toBe(false);
    expect(canAny(user, "pharmacy.view", "patients.view")).toBe(true);
  });
});

describe("permission guards", () => {
  it("grants super admin everything", async () => {
    const result = await loginWithPassword("owner", "Owner@2026");
    const user = await getSessionUserFromToken(result.token);
    expect(user.isSuperAdmin).toBe(true);
    expect(can(user, "anything.at.all")).toBe(true);
  });

  it("enforces tenant access", async () => {
    const result = await loginWithPassword("admin", "Admin@2026");
    const user = await getSessionUserFromToken(result.token);
    expect(() => requireTenant(user, user.organizationId)).not.toThrow();
    expect(() => requireTenant(user, "some-other-org-id")).toThrow();
  });
});

describe("rate limiting", () => {
  it("blocks after too many failed attempts", async () => {
    const ip = "10.9.8.7";
    for (let i = 0; i < 10; i++) {
      await recordLoginAttempt("rateuser", ip, false);
    }
    expect(await isLoginBlocked("rateuser", ip)).toBe(true);
    await expect(assertNotBlocked("rateuser", ip)).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("does not block on a single failure", async () => {
    await recordLoginAttempt("freshuser", "10.1.1.1", false);
    expect(await isLoginBlocked("freshuser", "10.1.1.1")).toBe(false);
  });
});

describe("session lifecycle", () => {
  it("revokes all sessions for a user", async () => {
    const result = await loginWithPassword("manager", "Manager@2026");
    const user = await getSessionUserFromToken(result.token);
    expect(user.username).toBe("manager");
    await revokeAllSessionsForUser(user.id);
    await expect(getSessionUserFromToken(result.token)).rejects.toThrow();
  });
});