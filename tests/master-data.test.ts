import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { listDepartments, listRooms, listDoctors, listMedications, listPatientsOptions } from "@/features/appointments/service";
import { listDiagnoses, listProcedures } from "@/features/visits/service";
import { listServiceItems } from "@/features/billing/service";
import { listSuppliers } from "@/features/inventory/service";
import { listDepartmentsForQueue } from "@/features/queue/service";

let admin: SessionUser;

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
}, 120000);

describe("master data & integritas seed", () => {
  it("1. departemen seed tersedia (UMUM/GIGI/ANAK)", async () => {
    const depts = await listDepartments(admin);
    const codes = depts.map((d) => d.code);
    expect(codes).toContain("UMUM");
    expect(codes).toContain("GIGI");
    expect(codes).toContain("ANAK");
  });

  it("2. ruangan aktif terdaftar", async () => {
    const rooms = await listRooms(admin);
    expect(rooms.length).toBeGreaterThanOrEqual(1);
    expect(rooms.every((r) => r.status === "ACTIVE")).toBe(true);
  });

  it("3. dokter aktif dengan spesialisasi", async () => {
    const docs = await listDoctors(admin);
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs[0]).toHaveProperty("specialization");
  });

  it("4. jadwal praktik dokter seed (Senin-Jumat)", async () => {
    const doc = (await listDoctors(admin))[0];
    const schedules = await db().select().from(s.doctorSchedules).where(and(eq(s.doctorSchedules.organizationId, admin.organizationId), eq(s.doctorSchedules.doctorId, doc.id)));
    expect(schedules.length).toBeGreaterThanOrEqual(1);
    expect(schedules.every((sc) => sc.dayOfWeek >= 1 && sc.dayOfWeek <= 5)).toBe(true);
  });

  it("5. kategori obat seed tersedia", async () => {
    const cats = await db().select().from(s.medicationCategories).where(eq(s.medicationCategories.organizationId, admin.organizationId));
    expect(cats.length).toBeGreaterThanOrEqual(1);
  });

  it("6. daftar obat aktif (>=4)", async () => {
    const meds = await listMedications(admin);
    expect(meds.length).toBeGreaterThanOrEqual(4);
    expect(meds.every((m) => m.status === "ACTIVE")).toBe(true);
  });

  it("7. diagnosa dapat dicari berdasarkan kode", async () => {
    const all = await listDiagnoses(admin);
    expect(all.length).toBeGreaterThan(0);
    const search = await listDiagnoses(admin, all[0].code);
    expect(search.some((d) => d.id === all[0].id)).toBe(true);
  });

  it("8. prosedur/tindakan seed tersedia", async () => {
    const procs = await listProcedures(admin);
    expect(procs.length).toBeGreaterThanOrEqual(1);
  });

  it("9. layanan (services) dengan harga & kategori", async () => {
    const services = await listServiceItems(admin);
    expect(services.some((sv) => sv.code === "SVC-001")).toBe(true);
    const konsultasi = services.find((sv) => sv.code === "SVC-001");
    expect(Number(konsultasi?.price)).toBeGreaterThan(0);
  });

  it("10. supplier seed tersedia", async () => {
    const suppliers = await listSuppliers(admin);
    expect(suppliers.length).toBeGreaterThanOrEqual(1);
    expect(suppliers.every((sup) => sup.organizationId === admin.organizationId)).toBe(true);
  });

  it("11. provider asuransi seed tersedia", async () => {
    const providers = await db().select().from(s.insuranceProviders).where(eq(s.insuranceProviders.organizationId, admin.organizationId));
    expect(providers.length).toBeGreaterThanOrEqual(1);
  });

  it("12. opsi pasien aktif untuk dropdown appointment", async () => {
    const options = await listPatientsOptions(admin);
    expect(options.length).toBeGreaterThanOrEqual(4);
    expect(options.every((p) => p.medicalRecordNumber.startsWith("MR-"))).toBe(true);
  });

  it("13. daftar departemen antrian konsisten dengan departemen aktif", async () => {
    const depts = await listDepartments(admin);
    const queueDepts = await listDepartmentsForQueue(admin);
    expect(queueDepts.length).toBe(depts.length);
    expect(queueDepts.some((d) => d.code === "UMUM")).toBe(true);
  });
});
