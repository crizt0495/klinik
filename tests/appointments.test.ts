import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { createAppointment, getAppointment, updateAppointmentStatus, listAppointments, listDoctors, listDepartments } from "@/features/appointments/service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

let admin: SessionUser;
let receptionist: SessionUser;
let doctorId: string;
let departmentId: string;

function nextMonday(): string {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function newPatient(name: string) {
  return createPatient(receptionist, { fullName: name, gender: "MALE" });
}

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  const doctors = await listDoctors(admin);
  doctorId = doctors[0].id;
  const depts = await listDepartments(admin);
  departmentId = depts.find((d) => d.code === "UMUM")!.id;
}, 120000);

describe("modul appointment", () => {
  it("1. membuat appointment dengan jadwal dokter (SCHEDULED)", async () => {
    const p = await newPatient("Appt Dasar");
    const appt = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "08:00:00", endTime: "08:15:00" });
    expect(appt.appointmentNumber).toMatch(/^APT-/);
    expect(appt.status).toBe("SCHEDULED");
    expect((await getAppointment(admin, appt.id)).id).toBe(appt.id);
  });

  it("2. waktu selesai <= mulai ditolak", async () => {
    const p = await newPatient("Appt Waktu Salah");
    await expect(
      createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "08:15:00", endTime: "08:15:00" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("3. appointment di luar jam praktik ditolak", async () => {
    const p = await newPatient("Appt Di Luar Jam");
    await expect(
      createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "15:00:00", endTime: "15:30:00" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("4. appointment pada hari tanpa jadwal dokter ditolak", async () => {
    const p = await newPatient("Appt Hari Libur");
    const sunday = addDays(nextMonday(), 6);
    await expect(
      createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: sunday, startTime: "08:00:00", endTime: "08:15:00" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("5. bentrok jadwal dokter ditolak", async () => {
    const p1 = await newPatient("Appt Bentrok Dokter A");
    const p2 = await newPatient("Appt Bentrok Dokter B");
    await createAppointment(receptionist, { patientId: p1.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "08:30:00", endTime: "09:00:00" });
    await expect(
      createAppointment(receptionist, { patientId: p2.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "08:45:00", endTime: "09:15:00" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("6. pasien yang sudah punya appointment pada waktu sama ditolak", async () => {
    const p = await newPatient("Appt Bentrok Pasien");
    await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "09:30:00", endTime: "10:00:00" });
    await expect(
      createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "09:45:00", endTime: "10:15:00" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("7. appointment yang dibatalkan membebaskan slot", async () => {
    const p = await newPatient("Appt Slot Bebas");
    const first = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "10:30:00", endTime: "10:45:00" });
    await updateAppointmentStatus(receptionist, first.id, "CANCELLED");
    expect((await getAppointment(admin, first.id)).status).toBe("CANCELLED");
    const second = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "10:30:00", endTime: "10:45:00" });
    expect(second.status).toBe("SCHEDULED");
  });

  it("8. konfirmasi appointment (SCHEDULED -> CONFIRMED)", async () => {
    const p = await newPatient("Appt Konfirmasi");
    const appt = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "11:00:00", endTime: "11:15:00" });
    await updateAppointmentStatus(receptionist, appt.id, "CONFIRMED");
    expect((await getAppointment(admin, appt.id)).status).toBe("CONFIRMED");
  });

  it("9. penandaan NO_SHOW dari CONFIRMED", async () => {
    const p = await newPatient("Appt No Show");
    const appt = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "11:15:00", endTime: "11:30:00" });
    await updateAppointmentStatus(receptionist, appt.id, "CONFIRMED");
    await updateAppointmentStatus(receptionist, appt.id, "NO_SHOW");
    expect((await getAppointment(admin, appt.id)).status).toBe("NO_SHOW");
  });

  it("10. check-in appointment (SCHEDULED -> CHECKED_IN)", async () => {
    const p = await newPatient("Appt Checkin");
    const appt = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "11:30:00", endTime: "11:45:00" });
    await updateAppointmentStatus(receptionist, appt.id, "CHECKED_IN");
    expect((await getAppointment(admin, appt.id)).status).toBe("CHECKED_IN");
  });

  it("11. penyelesaian appointment dari CHECKED_IN", async () => {
    const p = await newPatient("Appt Selesai");
    const appt = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "11:45:00", endTime: "12:00:00" });
    await updateAppointmentStatus(receptionist, appt.id, "CHECKED_IN");
    await updateAppointmentStatus(receptionist, appt.id, "COMPLETED");
    expect((await getAppointment(admin, appt.id)).status).toBe("COMPLETED");
  });

  it("12. transisi status tidak valid ditolak", async () => {
    const p = await newPatient("Appt Transisi Salah");
    const appt = await createAppointment(receptionist, { patientId: p.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "12:00:00", endTime: "12:15:00" });
    await expect(updateAppointmentStatus(receptionist, appt.id, "COMPLETED")).rejects.toBeInstanceOf(ConflictError);
  });

  it("13. listAppointments dapat difilter tanggal & status", async () => {
    const date = nextMonday();
    const scheduled = await listAppointments(admin, date, "SCHEDULED");
    expect(scheduled.every((a) => a.appointmentDate === date && a.status === "SCHEDULED")).toBe(true);
    const all = await listAppointments(admin, date);
    expect(all.length).toBeGreaterThanOrEqual(scheduled.length);
  });

  it("14. getAppointment tidak ditemukan menolak 404", async () => {
    await expect(getAppointment(admin, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("15. appointment aktif untuk data jadwal (query jadwal dokter)", async () => {
    const schedules = await db()
      .select()
      .from(s.doctorSchedules)
      .where(and(eq(s.doctorSchedules.organizationId, admin.organizationId), eq(s.doctorSchedules.doctorId, doctorId)));
    expect(schedules.length).toBeGreaterThanOrEqual(1);
  });
});
