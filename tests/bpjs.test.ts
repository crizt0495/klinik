import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { registerVisit } from "@/features/visits/service";
import { createBpjsProvider, loadBpjsConnection, providerFromConnection, saveBpjsSettings } from "@/lib/bpjs/client";
import type { BpjsConnection, BpjsProvider } from "@/lib/bpjs/types";
import {
  getBpjsOverview,
  checkEligibility,
  listEligibilityChecks,
  createSep,
  listSep,
  cancelSep,
  refreshReferrals,
  listReferrals,
  updateReferralPoli,
  createClaim,
  submitClaim,
  listClaims,
  getBpjsSettingsView,
  testBpjsConnection,
  listActiveInsuranceProviders,
} from "@/features/bpjs/service";

let admin: SessionUser;
let receptionist: SessionUser;
let doctorId: string;
let departmentId: string;
let bpjsProviderId: string;

const CARD = "0002000000000";

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;

  const d = await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1);
  doctorId = d[0].id;
  const dep = await db().select({ id: s.departments.id }).from(s.departments).where(eq(s.departments.code, "UMUM")).limit(1);
  departmentId = dep[0].id;

  const providers = await listActiveInsuranceProviders(admin);
  const bpjs = providers.find((p) => p.code.toLowerCase().includes("bpjs"));
  expect(bpjs).toBeDefined();
  bpjsProviderId = bpjs!.id;
}, 120000);

describe("lib/bpjs klien", () => {
  it("1. loadBpjsConnection kembali ke mock default saat kosong", async () => {
    const conn = await loadBpjsConnection(admin.organizationId);
    expect(typeof conn.mockMode).toBe("boolean");
  });

  it("2. createBpjsProvider return klien mock pada mode mock", async () => {
    const provider = await createBpjsProvider(admin.organizationId);
    expect(typeof provider.checkEligibility).toBe("function");
  });

  it("3. provider sebelumnya: norma card & nama dari data mock", async () => {
    const conn: BpjsConnection = await loadBpjsConnection(admin.organizationId);
    const provider: BpjsProvider = providerFromConnection(conn);
    const peserta = await provider.checkEligibility({ type: "nokartu", value: "0002000000000" });
    expect(peserta.noKartu).toMatch(/^0002\d{10}$/);
    expect(peserta.nama).toBeTruthy();
  });
});

describe("permissions & settings BPJS", () => {
  it("4. role RESEPSIONIS punya izin bpjs.manage_sep", () => {
    expect(receptionist.permissions.has("bpjs.view")).toBe(true);
    expect(receptionist.permissions.has("bpjs.manage_sep")).toBe(true);
    expect(receptionist.permissions.has("bpjs.cancel_sep")).toBe(true);
  });

  it("5. role ADMIN_KLINIK punya izin pengaturan BPJS", () => {
    expect(admin.permissions.has("bpjs.manage_settings")).toBe(true);
    expect(admin.permissions.has("bpjs.submit_claim")).toBe(true);
  });

  it("6. penyimpanan settings & test koneksi", async () => {
    await saveBpjsSettings(admin.organizationId, { enabled: true, mockMode: true, faskesCode: "000000000", faskesName: "KLINIK UJI" });
    const conn = await getBpjsSettingsView(admin);
    expect(conn.enabled).toBe(true);
    expect(conn.mockMode).toBe(true);
    const res = await testBpjsConnection(admin);
    expect(res.success).toBe(true);
  });
});

describe("modul eligibility BPJS", () => {
  it("7. pemeriksaan peserta berhasil & tercatat", async () => {
    const result = await checkEligibility(receptionist, { type: "nokartu", value: CARD });
    expect(result.status).toBe("SUCCESS");
    expect(result.noKartu).toMatch(/^0002/);
    expect(result.nama).toBeTruthy();
    const checks = await listEligibilityChecks(admin);
    expect(checks.some((c) => c.id === result.id)).toBe(true);
  });

  it("8. pemeriksaan peserta gagal dicatat sebagai FAILED", async () => {
    const result = await checkEligibility(receptionist, { type: "nokartu", value: "INVALID99999" });
    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toBeTruthy();
  });
});

describe("modul SEP BPJS", () => {
  it("9. overview mengembalikan statistik", async () => {
    const o = await getBpjsOverview(admin);
    expect(typeof o.sepCurrentMonth).toBe("number");
    expect(Array.isArray(o.recentSep)).toBe(true);
  });

  it("10. membuat SEP menghasilkan nomor SEP & status INSERTED", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien SEP Test", gender: "MALE" });
    const { visit } = await registerVisit(receptionist, { patientId: patient.id, doctorId, departmentId, chiefComplaint: "Demam" });
    const sep = await createSep(receptionist, {
      insuranceProviderId: bpjsProviderId,
      visitId: visit.id,
      patientId: patient.id,
      noKartu: CARD,
      tglSep: new Date().toISOString().slice(0, 10),
      jnsPelayanan: "2",
      asalRujukan: "6",
      poliTujuan: "12",
      diagnosa: "A09",
    });
    expect(sep.noSep).toBeTruthy();
    expect(sep.statusSubmit).toBe("INSERTED");
    expect(sep.status).toBe("ACTIVE");

    const list = await listSep(receptionist);
    expect(list.some((x) => x.id === sep.id)).toBe(true);
  });

  it("11. membatalkan SEP mengubah status menjadi INACTIVE", async () => {
    const sep = await createSep(receptionist, {
      insuranceProviderId: bpjsProviderId,
      noKartu: CARD,
      tglSep: new Date().toISOString().slice(0, 10),
      jnsPelayanan: "2",
      asalRujukan: "6",
      poliTujuan: "12",
    });
    await cancelSep(receptionist, sep.id);
    const list = await listSep(admin);
    const row = list.find((x) => x.id === sep.id);
    expect(row?.status).toBe("INACTIVE");
    expect(row?.statusSubmit).toBe("DELETED");
  });
});

describe("modul rujukan BPJS", () => {
  it("12. refresh rujukan menyalin rujukan dari mock ke lokal", async () => {
    const count = await refreshReferrals(receptionist, CARD);
    expect(count).toBeGreaterThanOrEqual(1);
    const refs = await listReferrals(admin, CARD);
    expect(refs.length).toBe(count);
    const first = refs.find((r) => r.status === "ACTIVE") ?? refs[0];
    expect(first).toBeDefined();
  });

  it("13. updateReferralPoli memperbarui poli tujuan", async () => {
    const refs = await listReferrals(admin, CARD);
    const target = refs[0];
    await updateReferralPoli(admin, target.id, "12");
    const updated = await listReferrals(admin, CARD);
    const row = updated.find((r) => r.id === target.id);
    expect(row?.poliRujukanKode).toBe("12");
  });
});

describe("modul klaim BPJS", () => {
  let claimId: string;

  it("14. membuat klaim dari kunjungan menghasilkan DRAFT", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien Klaim Test", gender: "FEMALE" });
    const { visit } = await registerVisit(receptionist, { patientId: patient.id, doctorId, departmentId, chiefComplaint: "Nyeri kepala" });
    const sep = await createSep(receptionist, {
      insuranceProviderId: bpjsProviderId,
      visitId: visit.id,
      patientId: patient.id,
      noKartu: CARD,
      tglSep: new Date().toISOString().slice(0, 10),
      jnsPelayanan: "2",
      asalRujukan: "6",
      poliTujuan: "12",
      diagnosa: "G43",
    });
    const claim = await createClaim(receptionist, { visitId: visit.id, noSep: sep.noSep!, diagnosa: "G43" });
    claimId = claim.id;
    expect(claim.status).toBe("DRAFT");
    expect(claim.claimNumber.startsWith("CLM")).toBe(true);

    const claims = await listClaims(receptionist);
    expect(claims.some((c) => c.id === claimId)).toBe(true);
  });

  it("15. submit klaim mengajukan trial claim & mengubah status", async () => {
    const res = await submitClaim(receptionist, claimId);
    expect(Number(res.totalBy40)).toBeGreaterThanOrEqual(0);
    const claims = await listClaims(admin, "SUBMITTED");
    const row = claims.find((c) => c.id === claimId);
    expect(row?.status).toBe("SUBMITTED");
    expect(row?.ttlByGroup).toBeDefined();
  });

  it("16. klaim keungan ganda ditolak", async () => {
    await expect(submitClaim(receptionist, claimId)).rejects.toThrow(/DRAFT|REJECTED/);
  });
});