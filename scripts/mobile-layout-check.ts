import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const USERNAME = process.env.E2E_USERNAME ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const NEW_PASS = process.env.NEW_PASS ?? "MobileShot@2027";

interface Check { name: string; ok: boolean; detail?: string }

async function main() {
  const results: Check[] = [];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  async function login(ctx: import("playwright").BrowserContext) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.fill("#username", USERNAME);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|profile/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    if ((await page.locator("#currentPassword").count()) > 0) {
      await page.fill("#currentPassword", PASSWORD);
      await page.fill("#newPassword", NEW_PASS);
      await page.fill("#confirmPassword", NEW_PASS);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
    }
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    return page;
  }

  try {
    // ── MOBILE (390x844) ────────────────────────────────────────────────
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await login(mobile);

    const nav = page.locator('nav[aria-label="Navigasi utama"]');
    const navBox = await nav.boundingBox();
    const navVisible = navBox !== null && navBox.y > 700 && Math.abs(navBox.x) < 1 && Math.abs(navBox.width - 390) < 2 && navBox.y + navBox.height <= 845;
    results.push({ name: "Bottom nav menempel di bawah (lebar penuh)", ok: Boolean(navVisible), detail: JSON.stringify(navBox) });

    const navItems = await nav.locator("a, button").count();
    results.push({ name: `Bottom nav berisi tab (${navItems})`, ok: navItems >= 2, detail: `tab=${navItems}` });

    // Sidebar desktop harus tersembunyi di mobile
    const sideBar = page.locator("div.bg-sidebar.hidden");
    const sideBarBox = await sideBar.boundingBox();
    results.push({ name: "Sidebar tersembunyi di mobile", ok: sideBarBox === null, detail: JSON.stringify(sideBarBox) });

    // Padding bawah konten ≥ 96px agar tidak tertutup bottom nav
    const mainPad = await page.evaluate(() => {
      const el = document.querySelector("main > div");
      return el ? getComputedStyle(el).paddingBottom : null;
    });
    results.push({ name: "Konten punya ruang untuk bottom nav", ok: mainPad !== null && parseFloat(mainPad) >= 96, detail: `paddingBottom=${mainPad}` });

    // Aktif: Dashboard saat di /dashboard
    const dashActive = await page.locator('nav[aria-label="Navigasi utama"] a[href="/dashboard"]').getAttribute("class");
    results.push({ name: "Tab Dashboard aktif di /dashboard", ok: dashActive?.includes("text-primary") ?? false, detail: dashActive?.slice(0, 120) });

    // Tab aktif bergeser saat di /visits
    await page.goto(`${BASE}/visits`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const visitsActive = await page.locator('nav[aria-label="Navigasi utama"] a[href="/visits"]').getAttribute("class");
    const dashNow = await page.locator('nav[aria-label="Navigasi utama"] a[href="/dashboard"]').getAttribute("class");
    results.push({
      name: "Tab berubah mengikuti halaman (/visits)",
      ok: (visitsActive?.includes("text-primary") ?? false) && !(dashNow?.includes("text-primary") ?? false),
      detail: `visits=${visitsActive?.slice(0, 90)} dash=${dashNow?.slice(0, 90)}`,
    });

    // Menu sheet terbuka dari bawah (full width, menempel bawah)
    await page.locator('nav[aria-label="Navigasi utama"] button', { hasText: "Menu" }).click();
    await page.waitForTimeout(700);
    const sheetBox = await page.locator('[role="dialog"]').boundingBox();
    results.push({
      name: "Menu sheet membuka dari bawah (penuh selebar layar)",
      ok: sheetBox !== null && Math.abs(sheetBox.x) < 1 && Math.abs(sheetBox.width - 390) < 2 && sheetBox.y + sheetBox.height >= 843,
      detail: JSON.stringify(sheetBox),
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // Header: hamburger menu masih ada di mobile
    const burger = await page.locator('header button[aria-label="Buka menu"]').count();
    results.push({ name: "Header hamburger ada di mobile", ok: burger === 1 });
    await mobile.close();

    // ── DESKTOP (1280x800) ──────────────────────────────────────────────
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await login(desktop);
    const navD = await page2.locator('nav[aria-label="Navigasi utama"]').boundingBox();
    results.push({ name: "Bottom nav disembunyikan di desktop", ok: navD === null, detail: JSON.stringify(navD) });
    const sideBarD = await page2.locator("div.bg-sidebar.hidden").boundingBox();
    results.push({ name: "Sidebar tampil di desktop (lebar 256px)", ok: sideBarD !== null && sideBarD.width > 200, detail: JSON.stringify(sideBarD) });
    await desktop.close();
  } finally {
    await browser.close();
  }

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nMOBILE_LAYOUT: ${failed.length === 0 ? "PASS" : `FAIL (${failed.length}/${results.length})`}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("LAYOUT_ERROR", e);
  process.exit(1);
});