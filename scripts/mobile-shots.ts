import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { chromium, type Page } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const OUT = "/tmp/opencode/mobile";
const USERNAME = process.env.E2E_USERNAME ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const NEW_PASS = process.env.NEW_PASS ?? "MobileShot@2027";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("shot:", name);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    // Viewport iPhone-ish
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.fill("#username", USERNAME);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|profile/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    // wajib ganti password (user hasil seed)
    if ((await page.locator("#currentPassword").count()) > 0) {
      await page.fill("#currentPassword", PASSWORD);
      await page.fill("#newPassword", NEW_PASS);
      await page.fill("#confirmPassword", NEW_PASS);
      await page.click('button[type="submit"]');
    }
    await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    console.log("logged as admin | url:", page.url());

    const hasBottomNav = (await page.locator('nav[aria-label="Navigasi utama"]').count()) > 0;
    console.log("bottom nav ada:", hasBottomNav);

    // Dashboard
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await shot(page, "01-dashboard");

    // Buka sheet Menu dari tab Menu
    const menuBtn = page.locator('nav[aria-label="Navigasi utama"] button', { hasText: "Menu" });
    if ((await menuBtn.count()) > 0) {
      await menuBtn.click();
      await page.waitForTimeout(600);
      const sheetVisible = (await page.locator('[role="dialog"]').count()) > 0;
      console.log("sheet menu terbuka:", sheetVisible);
      await shot(page, "02-menu-sheet");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // Halaman lain: pasien
    await page.goto(`${BASE}/patients`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await shot(page, "03-patients");

    // Pengaturan BPJS (periksa tetap bersih)
    await page.goto(`${BASE}/bpjs/settings`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await shot(page, "04-bpjs-settings");

    // Halaman detail kunjungan aktif bottom nav "Kunjungan"
    await page.goto(`${BASE}/visits`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await shot(page, "05-visits");
    await ctx.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("SHOT_ERROR", e);
  process.exit(1);
});