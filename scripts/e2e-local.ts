/**
 * End-to-end local smoke test (Playwright + Google Chrome).
 *
 * Usage:
 *   tsx scripts/e2e-local.ts seed        # buat user uji (wajib ganti password)
 *   tsx scripts/e2e-local.ts run         # jalankan alur browser E2E
 *   tsx scripts/e2e-local.ts cleanup     # hapus user uji + sesi
 *
 * Jalankan dengan dev server MATI saat `seed`/`cleanup` (hindari konflik file
 * PGlite), dan dengan dev server NYALA saat `run`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { chromium, type Page } from "playwright";
import { db } from "../db";
import * as s from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth/password";
import { ensureLocalSchema } from "../db";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const MODE = process.argv[2] ?? "run";

const USERNAME = process.env.E2E_USERNAME ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

// ── DB helpers (mode seed / cleanup) ───────────────────────────────────────
async function dbSeed() {
  await ensureLocalSchema();
  const username = USERNAME || `e2e_${Math.random().toString(36).slice(2, 8)}`;
  const password = PASSWORD || "E2ePass@2026";
  const [org] = await db().select({ id: s.organizations.id }).from(s.organizations).limit(1);
  const [branch] = await db().select({ id: s.branches.id }).from(s.branches).limit(1);
  const [role] = await db().select({ id: s.roles.id }).from(s.roles).where(eq(s.roles.code, "ADMIN_KLINIK")).limit(1);
  if (!org || !branch || !role) throw new Error("Data seed belum ada — jalankan `npm run db:seed` dulu.");
  const [user] = await db()
    .insert(s.users)
    .values({
      organizationId: org.id,
      branchId: branch.id,
      username,
      passwordHash: await hashPassword(password),
      fullName: "E2E Test User",
      isActive: true,
      mustChangePassword: true,
    })
    .returning();
  await db().insert(s.userRoles).values({ userId: user.id, roleId: role.id, branchId: branch.id }).onConflictDoNothing();
  console.log(`E2E_USERNAME=${username}`);
  console.log(`E2E_PASSWORD=${password}`);
}

async function dbCleanup() {
  await ensureLocalSchema();
  const rows = await db().select({ id: s.users.id }).from(s.users).where(eq(s.users.username, USERNAME));
  for (const row of rows) {
    await db().delete(s.sessions).where(eq(s.sessions.userId, row.id));
    await db().delete(s.userRoles).where(eq(s.userRoles.userId, row.id));
    await db().delete(s.users).where(eq(s.users.id, row.id));
  }
  console.log(`Cleanup selesai (${rows.length} user dihapus).`);
}

// ── Browser E2E (mode run) ─────────────────────────────────────────────────
interface Check { name: string; ok: boolean; detail?: string }

async function runE2E() {
  if (!USERNAME || !PASSWORD) throw new Error("Set E2E_USERNAME & E2E_PASSWORD (hasil dari mode `seed`).");
  const results: Check[] = [];
  const newPassword = "E2eNew@2027";
  const badResponses: Array<{ status: number; url: string }> = [];

  async function trackBadResponses(page: Page) {
    page.on("response", (r) => {
      if (r.status() >= 400 && ["document", "fetch", "xhr"].includes(r.request().resourceType())) {
        badResponses.push({ status: r.status(), url: r.url() });
      }
    });
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await trackBadResponses(page);
    const T = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // 1. Halaman login
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    const loginTitle = await page.title();
    results.push({ name: "Login page renders", ok: loginTitle.toLowerCase().includes("masuk"), detail: loginTitle });

    // 2. Login → wajib ganti password
    await page.fill("#username", USERNAME);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/profile/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    results.push({ name: "Force-change redirect", ok: page.url().includes("/profile"), detail: page.url() });

    // 3. Ganti password → dashboard
    const formVisible = (await page.locator("#currentPassword").count()) > 0;
    results.push({ name: "Password form visible", ok: formVisible });
    if (formVisible) {
      await page.fill("#currentPassword", PASSWORD);
      await page.fill("#newPassword", newPassword);
      await page.fill("#confirmPassword", newPassword);
      await page.click('button[type="submit"]');
    }
    await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    results.push({ name: "Redirect to dashboard after change", ok: page.url().includes("dashboard"), detail: page.url() });

    // 4. Sapuan halaman modul
    const pagesToCheck = [
      "/dashboard", "/queue", "/appointments", "/visits", "/medical-records",
      "/prescriptions", "/pharmacy", "/inventory", "/inventory/batches",
      "/inventory/stock-opname", "/purchasing", "/billing", "/payments", "/refunds",
      "/lab", "/radiology", "/bpjs", "/bpjs/claims", "/bpjs/participants",
      "/bpjs/referrals", "/bpjs/sep", "/bpjs/settings", "/patients", "/reports",
      "/settings", "/rooms", "/schedules", "/departments", "/doctors", "/staff",
      "/insurance", "/notifications", "/profile", "/audit-logs", "/admin/users",
      "/admin/roles",
    ];
    for (const path of pagesToCheck) {
      const before = badResponses.length;
      const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => null);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      const newBad = badResponses.slice(before);
      const status = resp?.status() ?? 0;
      const landed = page.url().includes(path);
      results.push({
        name: `Page ${path}`,
        ok: status < 400 && landed && newBad.length === 0,
        detail: `http=${status} url=${page.url()}${newBad.length ? ` bad=${newBad.map((b) => `${b.status} ${b.url}`).join("|")}` : ""}`,
      });
    }

    // 5. Relogin dengan password baru (konteks baru → sesi baru)
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await trackBadResponses(page2);
    await page2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page2.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page2.fill("#username", USERNAME);
    await page2.fill("#password", newPassword);
    await page2.click('button[type="submit"]');
    await page2.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
    await page2.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    results.push({ name: "Relogin with new password", ok: page2.url().includes("dashboard"), detail: page2.url() });
    await ctx2.close();

    await T(300);
    await context.close();
  } finally {
    await browser.close();
  }

  results.push({
    name: "No 4xx/5xx during session",
    ok: badResponses.length === 0,
    detail: badResponses.length ? badResponses.map((b) => `${b.status} ${b.url}`).join(" | ") : undefined,
  });

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nE2E_RESULT: ${failed.length === 0 ? "PASS" : `FAIL (${failed.length}/${results.length})`}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

(async () => {
  try {
    if (MODE === "seed") {
      await dbSeed();
      process.exit(0);
    } else if (MODE === "cleanup") {
      await dbCleanup();
      process.exit(0);
    } else {
      await runE2E(); // runE2E memanggil process.exit sendiri
    }
  } catch (err) {
    console.error("E2E_ERROR", err);
    process.exit(1);
  }
})();