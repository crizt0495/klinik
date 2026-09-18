import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
process.env.DB_DRIVER = "";
process.env.NODE_ENV = process.env.NODE_ENV ?? "development";

import { chromium } from "playwright";
import { db } from "../db";
import * as s from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth/password";

const BASE = process.env.SMOKE_BASE ?? "https://klinik-rho.vercel.app";
const PREFIX = "smoketest";

async function seedUser(username: string, password: string, mustChangePassword: boolean) {
  const [org] = await db().select({ id: s.organizations.id }).from(s.organizations).limit(1);
  const [branch] = await db().select({ id: s.branches.id }).from(s.branches).limit(1);
  const [role] = await db().select({ id: s.roles.id }).from(s.roles).where(eq(s.roles.code, "ADMIN_KLINIK")).limit(1);
  const [user] = await db()
    .insert(s.users)
    .values({
      organizationId: org.id,
      branchId: branch.id,
      username,
      passwordHash: await hashPassword(password),
      fullName: "Smoke Test User",
      isActive: true,
      mustChangePassword,
    })
    .returning();
  await db().insert(s.userRoles).values({ userId: user.id, roleId: role.id });
  return user;
}

async function cleanup(username: string) {
  const rows = await db().select({ id: s.users.id }).from(s.users).where(eq(s.users.username, username));
  for (const row of rows) {
    await db().delete(s.sessions).where(eq(s.sessions.userId, row.id));
    await db().delete(s.userRoles).where(eq(s.userRoles.userId, row.id));
    await db().delete(s.users).where(eq(s.users.id, row.id));
  }
}

const T = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rnd = Math.random().toString(36).slice(2, 8);
  const normalUser = `${PREFIX}_normal_${rnd}`;
  const forcedUser = `${PREFIX}_forced_${rnd}`;
  await seedUser(normalUser, "Smoke@2026pass", false);
  const forced = await seedUser(forcedUser, "Smoke@2026pass", true);

  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const results: string[] = [];
  try {
    // --- Test 1: login normal -> dashboard
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.getByLabel(/username|nama pengguna/i).first().fill(normalUser).catch(async () => {
      await page.getByPlaceholder(/username/i).first().fill(normalUser);
    });
    await page.locator('input[type="password"]').first().fill("Smoke@2026pass");
    await page.getByRole("button", { name: /masuk|login|sign in/i }).first().click();
    await page.waitForTimeout(3500);
    const urlAfterLogin = page.url();
    const dashboard = urlAfterLogin.includes("dashboard") || urlAfterLogin === new URL("/", BASE).href;
    results.push(`LOGIN_NORMAL url=${urlAfterLogin} dashboard=${dashboard}`);
    if (!dashboard) {
      const body = await page.textContent("body");
      results.push(`LOGIN_NORMAL body=${body?.slice(0, 200)}`);
    }
    await ctx.close();

    // --- Test 2: akun wajib ganti password -> /profile?force=1
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page2.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page2.getByLabel(/username|nama pengguna/i).first().fill(forcedUser).catch(async () => {
      await page2.getByPlaceholder(/username/i).first().fill(forcedUser);
    });
    await page2.locator('input[type="password"]').first().fill("Smoke@2026pass");
    await page2.getByRole("button", { name: /masuk|login|sign in/i }).first().click();
    await page2.waitForTimeout(4000);
    const forcedUrl = page2.url();
    const gotForce = forcedUrl.includes("force=1");
    results.push(`FORCE_REDIRECT url=${forcedUrl} gotForce=${gotForce}`);
    if (!gotForce) {
      const body = await page2.textContent("body");
      results.push(`FORCE_REDIRECT body=${body?.slice(0, 200)}`);
    }
    // --- Test 2b: ganti password di halaman profil
    await page2.locator('input[type="password"]').first().fill("Smoke@2026pass");
    const pwInputs = page2.locator('input[type="password"]');
    await pwInputs.nth(1).fill("NewPass@2026");
    await pwInputs.nth(2).fill("NewPass@2026");
    await page2.getByRole("button", { name: /simpan perubahan|ubah password|ganti password/i }).first().click();
    await page2.waitForTimeout(4000);
    const afterChange = page2.url();
    results.push(`AFTER_CHANGE_PW url=${afterChange} dashboard=${afterChange.includes("dashboard")}`);
    if (!afterChange.includes("dashboard")) {
      const body = await page2.textContent("body");
      results.push(`AFTER_CHANGE_PW body=${body?.slice(0, 200)}`);
    }
    await ctx2.close();

    // --- Test 3: login ulang dengan password baru yang sudah diubah
    await page2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }).catch(() => {});
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    await page3.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page3.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page3.getByLabel(/username|nama pengguna/i).first().fill(forcedUser).catch(async () => {
      await page3.getByPlaceholder(/username/i).first().fill(forcedUser);
    });
    await page3.locator('input[type="password"]').first().fill("NewPass@2026");
    await page3.getByRole("button", { name: /masuk|login|sign in/i }).first().click();
    await page3.waitForTimeout(4000);
    const reUrl = page3.url();
    results.push(`RELOGIN_NEWPW url=${reUrl} dashboard=${reUrl.includes("dashboard")}`);
    if (!reUrl.includes("dashboard")) {
      const body = await page3.textContent("body");
      results.push(`RELOGIN_NEWPW body=${body?.slice(0, 200)}`);
    }
    await ctx3.close();
  } finally {
    await browser.close();
    await cleanup(normalUser);
    await cleanup(forcedUser);
  }
  for (const line of results) console.log("SMOKE:", line);
  const fail = results.filter((r) => r.includes("=false") || r.includes("FAIL"));
  if (fail.length) {
    console.log("SMOKE_RESULT: FAIL");
    process.exit(1);
  }
  console.log("SMOKE_RESULT: PASS");
}

main().catch((e) => {
  console.error("SMOKE_ERROR", e);
  process.exit(1);
});