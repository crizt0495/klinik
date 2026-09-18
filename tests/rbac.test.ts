import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";

let admin: SessionUser;
let doctor: SessionUser;
let pharmacist: SessionUser;
let cashier: SessionUser;
let receptionist: SessionUser;
let labUser: SessionUser;
let radUser: SessionUser;
let owner: SessionUser;

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  doctor = (await loginWithPassword("doctor", "Doctor@2026")).sessionUser;
  pharmacist = (await loginWithPassword("pharmacist", "Pharmacist@2026")).sessionUser;
  cashier = (await loginWithPassword("cashier", "Cashier@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  labUser = (await loginWithPassword("lab", "Lab@2026")).sessionUser;
  radUser = (await loginWithPassword("radiology", "Radiology@2026")).sessionUser;
  owner = (await loginWithPassword("owner", "Owner@2026")).sessionUser;
}, 120000);

describe("RBAC: permission per peran", () => {
  it("1. admin klinik memiliki akses billing & pengaturan", () => {
    expect(admin.permissions.has("billing.view")).toBe(true);
    expect(admin.permissions.has("settings.manage")).toBe(true);
    expect(admin.permissions.has("users.create")).toBe(true);
  });

  it("2. dokter dapat menulis rekam medis & resep, bukan farmasi", () => {
    expect(doctor.permissions.has("medical_records.create")).toBe(true);
    expect(doctor.permissions.has("prescriptions.create")).toBe(true);
    expect(doctor.permissions.has("pharmacy.view")).toBe(false);
  });

  it("3. apoteker dapat farmasi & dispensing, bukan billing", () => {
    expect(pharmacist.permissions.has("pharmacy.view")).toBe(true);
    expect(pharmacist.permissions.has("prescriptions.dispense")).toBe(true);
    expect(pharmacist.permissions.has("billing.view")).toBe(false);
  });

  it("4. kasir dapat billing & pembayaran, bukan inventori", () => {
    expect(cashier.permissions.has("billing.view")).toBe(true);
    expect(cashier.permissions.has("payments.create")).toBe(true);
    expect(cashier.permissions.has("inventory.view")).toBe(false);
  });

  it("5. resepsionis dapat pendaftaran & antrian, bukan rekam medis", () => {
    expect(receptionist.permissions.has("patients.create")).toBe(true);
    expect(receptionist.permissions.has("queue.create")).toBe(true);
    expect(receptionist.permissions.has("medical_records.create")).toBe(false);
  });

  it("6. petugas lab dapat laboratorium, bukan radiologi", () => {
    expect(labUser.permissions.has("laboratory.process")).toBe(true);
    expect(labUser.permissions.has("radiology.process")).toBe(false);
  });

  it("7. petugas radiologi dapat radiologi, bukan laboratorium", () => {
    expect(radUser.permissions.has("radiology.process")).toBe(true);
    expect(radUser.permissions.has("laboratory.process")).toBe(false);
  });

  it("8. pemilik klinik memiliki akses penuh", () => {
    expect(owner.permissions.has("users.view")).toBe(true);
    expect(owner.permissions.has("reports.export")).toBe(true);
    expect(owner.permissions.has("queue.complete")).toBe(true);
  });

  it("9. semua peran operasional dapat melihat pasien", () => {
    for (const u of [admin, doctor, pharmacist, cashier, receptionist, labUser, radUser]) {
      expect(u.permissions.has("patients.view")).toBe(true);
    }
  });

  it("10. sessionUser memuat kode peran yang benar", () => {
    expect(admin.roles).toContain("ADMIN_KLINIK");
    expect(doctor.roles).toContain("DOKTER");
    expect(cashier.roles).toContain("KASIR");
  });
});
