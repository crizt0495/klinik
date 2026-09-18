import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient, getPatient, getPatientDetail, listPatients, updatePatient, deletePatient, addPatientInsurance, getPatientTimeline, generateMRN } from "@/features/patients/service";
import { registerVisit } from "@/features/visits/service";
import { NotFoundError, DuplicateRecordError } from "@/lib/errors";

let admin: SessionUser;
let receptionist: SessionUser;
let seededDoctorId: string;
let seededDepartmentId: string;

let nikSeq = 0;
function uniqueNik() {
  nikSeq += 1;
  return `3273${String(Date.now()).slice(-8)}${String(nikSeq).padStart(4, "0")}`.slice(0, 16);
}

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  const doctorRow = await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1);
  seededDoctorId = doctorRow[0].id;
  const deptRow = await db().select({ id: s.departments.id }).from(s.departments).where(eq(s.departments.code, "UMUM")).limit(1);
  seededDepartmentId = deptRow[0].id;
}, 120000);

describe("modul pasien", () => {
  it("1. membuat pasien menghasilkan MRN otomatis", async () => {
    const p = await createPatient(receptionist, { fullName: "Pasien MRN Satu", gender: "MALE" });
    expect(p.medicalRecordNumber).toMatch(/^MR-\d{4}-\d{6}$/);
    expect(p.status).toBe("ACTIVE");
  });

  it("2. generateMRN menghasilkan nomor unik yang meningkat", async () => {
    const a = await generateMRN(admin);
    const b = await generateMRN(admin);
    expect(a).toMatch(/^MR-\d{4}-\d{6}$/);
    expect(a).not.toBe(b);
  });

  it("3. listPatients memuat pasien & dapat dicari berdasarkan nama", async () => {
    const p = await createPatient(receptionist, { fullName: "Budi Pencarian Unik", gender: "MALE" });
    const all = await listPatients(admin);
    expect(all.some((x) => x.id === p.id)).toBe(true);
    const found = await listPatients(admin, "Budi Pencarian");
    expect(found.some((x) => x.id === p.id)).toBe(true);
  });

  it("4. getPatientDetail mengembalikan pasien + daftar provider", async () => {
    const p = await createPatient(receptionist, { fullName: "Detail Pasien", gender: "FEMALE" });
    const detail = await getPatientDetail(admin, p.id);
    expect(detail.patient.id).toBe(p.id);
    expect(Array.isArray(detail.insurance)).toBe(true);
    expect(detail.providers.length).toBeGreaterThanOrEqual(1);
  });

  it("5. NIK duplikat ditolak", async () => {
    const nik = uniqueNik();
    await createPatient(receptionist, { fullName: "NIK Pertama", gender: "MALE", nik });
    await expect(createPatient(receptionist, { fullName: "NIK Kedua", gender: "FEMALE", nik })).rejects.toBeInstanceOf(DuplicateRecordError);
  });

  it("6. updatePatient mengubah nama & telepon", async () => {
    const p = await createPatient(receptionist, { fullName: "Nama Lama", gender: "MALE" });
    const updated = await updatePatient(receptionist, p.id, { fullName: "Nama Baru", gender: "MALE", phone: "081200011122" });
    expect(updated.fullName).toBe("Nama Baru");
    expect(updated.phone).toBe("081200011122");
  });

  it("7. updatePatient dengan NIK kosong menghapus NIK", async () => {
    const p = await createPatient(receptionist, { fullName: "Punya NIK", gender: "MALE", nik: uniqueNik() });
    const updated = await updatePatient(receptionist, p.id, { fullName: "Punya NIK", gender: "MALE", nik: "" });
    expect(updated.nik).toBeNull();
  });

  it("8. deletePatient melakukan soft delete dan menghilangkan dari daftar", async () => {
    const p = await createPatient(receptionist, { fullName: "Pasien Dihapus", gender: "MALE" });
    await deletePatient(receptionist, p.id);
    const all = await listPatients(admin);
    expect(all.some((x) => x.id === p.id)).toBe(false);
    await expect(getPatient(admin, p.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("9. filter status pasien ACTIVE", async () => {
    const p = await createPatient(receptionist, { fullName: "Pasien Aktif Filter", gender: "FEMALE" });
    const active = await listPatients(admin, undefined, "ACTIVE");
    expect(active.some((x) => x.id === p.id)).toBe(true);
    const inactive = await listPatients(admin, undefined, "INACTIVE");
    expect(inactive.some((x) => x.id === p.id)).toBe(false);
  });

  it("10. addPatientInsurance menambahkan asuransi pasien", async () => {
    const p = await createPatient(receptionist, { fullName: "Pasien Asuransi", gender: "MALE" });
    const provider = (await db().select().from(s.insuranceProviders).where(eq(s.insuranceProviders.organizationId, admin.organizationId)).limit(1))[0];
    await addPatientInsurance(receptionist, p.id, { insuranceProviderId: provider.id, memberNumber: "BPJS-123", coverageClass: "KELAS_1", isPrimary: true });
    const detail = await getPatientDetail(admin, p.id);
    expect(detail.insurance).toHaveLength(1);
    expect(detail.insurance[0].isPrimary).toBe(true);
    expect(detail.insurance[0].providerName).toBe(provider.name);
  });

  it("11. asuransi primary baru menurunkan primary lama", async () => {
    const p = await createPatient(receptionist, { fullName: "Pasien Dua Asuransi", gender: "FEMALE" });
    const providers = await db().select().from(s.insuranceProviders).where(eq(s.insuranceProviders.organizationId, admin.organizationId));
    await addPatientInsurance(receptionist, p.id, { insuranceProviderId: providers[0].id, memberNumber: "A-1", isPrimary: true });
    await addPatientInsurance(receptionist, p.id, { insuranceProviderId: providers[1].id, memberNumber: "B-1", isPrimary: true });
    const detail = await getPatientDetail(admin, p.id);
    const primaries = detail.insurance.filter((i) => i.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].providerId).toBe(providers[1].id);
  });

  it("12. timeline pasien memuat kunjungan setelah registrasi", async () => {
    const p = await createPatient(receptionist, { fullName: "Pasien Timeline", gender: "MALE" });
    await registerVisit(receptionist, { patientId: p.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    const timeline = await getPatientTimeline(admin, p.id);
    expect(timeline.some((e) => e.type === "Kunjungan")).toBe(true);
  });

  it("13. getPatient yang tidak ada menolak 404", async () => {
    await expect(getPatient(admin, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("14. listPatients menyertakan jumlah kunjungan", async () => {
    const p = await createPatient(receptionist, { fullName: "Pasien Hitung Kunjungan", gender: "FEMALE" });
    await registerVisit(receptionist, { patientId: p.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    const row = (await listPatients(admin)).find((x) => x.id === p.id);
    expect(row?.visitCount).toBeGreaterThanOrEqual(1);
  });
});
