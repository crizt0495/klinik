import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { createQueueEntry, getQueue, listQueuesToday, updateQueueStatus, getQueueStatsToday, listPatientsForQueue, listDepartmentsForQueue } from "@/features/queue/service";
import { ConflictError, NotFoundError } from "@/lib/errors";

let admin: SessionUser;
let doctor: SessionUser;
let receptionist: SessionUser;
let departmentId: string;
let departmentCode: string;

async function newPatient(name: string) {
  return createPatient(receptionist, { fullName: name, gender: "MALE" });
}

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  doctor = (await loginWithPassword("doctor", "Doctor@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  const dept = (await db().select().from(s.departments).where(and(eq(s.departments.organizationId, admin.organizationId), eq(s.departments.code, "UMUM"))).limit(1))[0];
  departmentId = dept.id;
  departmentCode = dept.code;
}, 120000);

describe("modul antrian", () => {
  it("1. membuat entri antrian menghasilkan nomor & status WAITING", async () => {
    const p = await newPatient("Antrian Dasar");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    expect(q.status).toBe("WAITING");
    expect(q.priority).toBe("NORMAL");
    expect(q.queueCode).toMatch(new RegExp(`^${departmentCode}-\\d{3}$`));
    expect((await getQueue(admin, q.id)).id).toBe(q.id);
  });

  it("2. listQueuesToday memuat antrian hari ini", async () => {
    const p = await newPatient("Antrian Hari Ini");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    const list = await listQueuesToday(admin, departmentId);
    expect(list.some((row) => row.id === q.id)).toBe(true);
  });

  it("3. panggil antrian (WAITING -> CALLED) mengisi calledAt", async () => {
    const p = await newPatient("Antrian Panggil");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    const called = await updateQueueStatus(doctor, q.id, "CALLED");
    expect(called.status).toBe("CALLED");
    expect(called.calledAt).toBeTruthy();
  });

  it("4. layani antrian (CALLED -> SERVING) mengisi servedAt", async () => {
    const p = await newPatient("Antrian Layani");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    await updateQueueStatus(doctor, q.id, "CALLED");
    const serving = await updateQueueStatus(doctor, q.id, "SERVING");
    expect(serving.status).toBe("SERVING");
    expect(serving.servedAt).toBeTruthy();
  });

  it("5. selesaikan antrian (SERVING -> COMPLETED) mengisi completedAt", async () => {
    const p = await newPatient("Antrian Selesai");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    await updateQueueStatus(doctor, q.id, "CALLED");
    await updateQueueStatus(doctor, q.id, "SERVING");
    const done = await updateQueueStatus(doctor, q.id, "COMPLETED");
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBeTruthy();
  });

  it("6. lompat status (WAITING -> COMPLETED) ditolak", async () => {
    const p = await newPatient("Antrian Lompat");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    await expect(updateQueueStatus(doctor, q.id, "COMPLETED")).rejects.toBeInstanceOf(ConflictError);
  });

  it("7. antrian dapat dibatalkan dari WAITING", async () => {
    const p = await newPatient("Antrian Batal");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    const cancelled = await updateQueueStatus(doctor, q.id, "CANCELLED");
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("8. antrian dapat di-skip dari CALLED", async () => {
    const p = await newPatient("Antrian Skip");
    const q = await createQueueEntry(receptionist, p.id, departmentId);
    await updateQueueStatus(doctor, q.id, "CALLED");
    const skipped = await updateQueueStatus(doctor, q.id, "SKIPPED");
    expect(skipped.status).toBe("SKIPPED");
  });

  it("9. statistik antrian hari ini terkelompok per status", async () => {
    const p = await newPatient("Antrian Statistik");
    await createQueueEntry(receptionist, p.id, departmentId);
    const stats = await getQueueStatsToday(admin, departmentId);
    expect(stats.some((row) => row.status === "WAITING" && Number(row.c) >= 1)).toBe(true);
  });

  it("10. createQueueEntry dengan departemen tidak ada ditolak 404", async () => {
    const p = await newPatient("Antrian Dept Salah");
    await expect(createQueueEntry(receptionist, p.id, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("11. getQueue tidak ditemukan menolak 404", async () => {
    await expect(getQueue(admin, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("12. opsi antrian memuat pasien & departemen aktif", async () => {
    const patients = await listPatientsForQueue(receptionist);
    const depts = await listDepartmentsForQueue(receptionist);
    expect(patients.length).toBeGreaterThanOrEqual(1);
    expect(depts.some((d) => d.code === "UMUM")).toBe(true);
  });
});
