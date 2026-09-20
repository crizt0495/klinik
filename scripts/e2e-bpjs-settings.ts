/**
 * End-to-end test for the (reworked) BPJS settings UX.
 *
 * Verifies that the three-mode selector (Demo / Produksi / Nonaktif), the
 * adaptive credential form, browser-side required validation and the
 * "Simpan & Uji" flow all behave as expected.
 *
 * Usage:
 *   npx tsx scripts/e2e-local.ts seed          # dev server MATI; print E2E_USERNAME/E2E_PASSWORD
 *   npx tsx scripts/e2e-bpjs-settings.ts       # dev server NYALA; memakai user hasil seed
 *   npx tsx scripts/e2e-local.ts cleanup       # hapus user uji
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const USERNAME = process.env.E2E_USERNAME ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

if (!USERNAME || !PASSWORD) {
  console.error("Set E2E_USERNAME & E2E_PASSWORD (hasil dari `npx tsx scripts/e2e-local.ts seed`).");
  process.exit(1);
}

const newPassword = `BpjsNew@${Math.random().toString(36).slice(2, 8)}2027`;

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

async function main() {
  const results: Check[] = [];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    const T = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const bodyText = () => page.locator("body").innerText();
    const toastCount = () => page.locator("[data-sonner-toast]").count();

    // 1. Login (toleransi: wajib ganti password atau langsung masuk)
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.fill("#username", USERNAME);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|profile/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    const hasForceForm = (await page.locator("#currentPassword").count()) > 0;
    if (hasForceForm) {
      // Simulasikan user hasil seed: ganti ke password sementara lalu lanjut.
      await page.fill("#currentPassword", PASSWORD);
      await page.fill("#newPassword", newPassword);
      await page.fill("#confirmPassword", newPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
    }
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    results.push({ name: "Login berhasil (dashboard)", ok: page.url().includes("dashboard"), detail: `force=${hasForceForm} url=${page.url()}` });

    // 2. Buka halaman pengaturan BPJS
    await page.goto(`${BASE}/bpjs/settings`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    const body = await bodyText();
    results.push({
      name: "Halaman Pengaturan BPJS render (Mode BPJS)",
      ok: page.url().includes("/bpjs/settings") && body.includes("Mode BPJS"),
      detail: page.url(),
    });

    // 3. Elemen UI baru hadir
    results.push({
      name: "UI baru: pilih mode + Simpan & Uji",
      ok: body.includes("Mode Demo / Simulasi") && body.includes("Mode Produksi (VClaim BPJS)") && body.includes("Simpan & Uji"),
    });

    // 4. Pilih Mode Produksi → card kredensial muncul
    await page.locator('label[for="bpjs-mode-production"]').click();
    await T(200);
    const prodBody = await bodyText();
    results.push({
      name: "Mode Produksi menampilkan form kredensial",
      ok: prodBody.includes("Kredensial VClaim") && prodBody.includes("Cons ID") && prodBody.includes("User Key"),
    });

    // 5. Submit dengan kredensial kosong → diblokir validasi browser (tanpa toast sukses)
    const toastsBefore = await toastCount();
    await page.getByRole("button", { name: /Simpan Pengaturan/ }).click();
    await T(600);
    const stillProd = (await bodyText()).includes("Kredensial VClaim");
    results.push({
      name: "Kredensial kosong diblokir (tak ada toast sukses)",
      ok: (await toastCount()) === toastsBefore && stillProd,
      detail: `toast ${toastsBefore} -> ${await toastCount()}`,
    });

    // 6. Isi preset URL + kredensial dummy → "Simpan & Uji"
    await page.getByRole("button", { name: /Development BPJS/ }).click();
    await T(150);
    await page.fill("#svc-consId", "12345678");
    await page.fill("#svc-secretKey", "secretKeyDummy");
    await page.fill("#svc-userKey", "userKeyDummy");
    await page.getByRole("button", { name: /Simpan & Uji/ }).click();
    await page.waitForSelector("[data-sonner-toast]", { timeout: 10000 }).catch(() => {});
    // Tunggu hasil uji koneksi (simpan cepat; test koneksi maks 15 dtk karena timeout fetch VClaim)
    await page
      .waitForFunction(() => document.body.innerText.includes("Hasil Tes Koneksi"), undefined, { timeout: 20000 })
      .catch(() => {});
    const resBody = await bodyText();
    const urlValue = await page.locator("#svc-serviceBaseUrl").inputValue().catch(() => "");
    results.push({
      name: "Simpan & Uji: URL tersimpan + hasil uji tampil",
      ok: resBody.includes("Hasil Tes Koneksi") && urlValue.includes("dvlp.bpjs-kesehatan.go.id"),
      detail: `url=${urlValue} | hasil=${resBody.includes("Hasil Tes Koneksi") ? "ada" : "tidak"}`,
    });

    // 7. Kembali ke Mode Demo → kredensial disembunyikan; simpan sukses; badge simulasi
    await page.locator('label[for="bpjs-mode-demo"]').click();
    await T(200);
    const demoBody = await bodyText();
    results.push({
      name: "Mode Demo menyembunyikan kredensial + info simulasi",
      ok: !demoBody.includes("Kredensial VClaim") && demoBody.includes("Mode simulasi aktif"),
    });
    await page.getByRole("button", { name: /Simpan Pengaturan/ }).click();
    await page.waitForSelector("[data-sonner-toast]", { timeout: 8000 }).catch(() => {});
    await T(600);
    const afterDemoSave = await bodyText();
    results.push({
      name: "Simpan di Mode Demo → status Mode Simulasi",
      ok: afterDemoSave.includes("Mode Simulasi"),
    });
  } finally {
    await browser.close();
  }

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nBPJS_SETTINGS_E2E: ${failed.length === 0 ? "PASS" : `FAIL (${failed.length}/${results.length})`}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("BPJS_SETTINGS_E2E_ERROR", e);
  process.exit(1);
});