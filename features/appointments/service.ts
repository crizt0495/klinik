import { and, eq, lte, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { generateBusinessNumber, datePeriodMonth } from "@/lib/services/numbering";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";

export async function listDoctors(user: SessionUser) {
  return db()
    .select({ id: s.doctors.id, name: s.staff.fullName, specialization: s.doctors.specialization })
    .from(s.doctors)
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .where(and(eq(s.doctors.organizationId, user.organizationId), eq(s.doctors.status, "ACTIVE"), eq(s.staff.status, "ACTIVE")))
    .orderBy(s.staff.fullName);
}

export async function listDoctorSchedules(user: SessionUser) {
  return db()
    .select({
      id: s.doctorSchedules.id,
      doctorName: s.staff.fullName,
      specialization: s.doctors.specialization,
      departmentName: s.departments.name,
      dayOfWeek: s.doctorSchedules.dayOfWeek,
      startTime: s.doctorSchedules.startTime,
      endTime: s.doctorSchedules.endTime,
      slotDurationMinutes: s.doctorSchedules.slotDurationMinutes,
      maxPatients: s.doctorSchedules.maxPatients,
      effectiveFrom: s.doctorSchedules.effectiveFrom,
      effectiveUntil: s.doctorSchedules.effectiveUntil,
      status: s.doctorSchedules.status,
    })
    .from(s.doctorSchedules)
    .innerJoin(s.doctors, eq(s.doctors.id, s.doctorSchedules.doctorId))
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .innerJoin(s.departments, eq(s.departments.id, s.doctorSchedules.departmentId))
    .where(eq(s.doctorSchedules.organizationId, user.organizationId))
    .orderBy(s.doctorSchedules.dayOfWeek, s.doctorSchedules.startTime);
}

export async function listDepartments(user: SessionUser) {
  return db()
    .select()
    .from(s.departments)
    .where(and(eq(s.departments.organizationId, user.organizationId), eq(s.departments.status, "ACTIVE")))
    .orderBy(s.departments.name);
}

export async function listRooms(user: SessionUser) {
  return db()
    .select()
    .from(s.rooms)
    .where(and(eq(s.rooms.organizationId, user.organizationId), eq(s.rooms.status, "ACTIVE")))
    .orderBy(s.rooms.name);
}

export async function listPatientsOptions(user: SessionUser) {
  return db()
    .select({ id: s.patients.id, fullName: s.patients.fullName, medicalRecordNumber: s.patients.medicalRecordNumber })
    .from(s.patients)
    .where(and(eq(s.patients.organizationId, user.organizationId), sql`${s.patients.deletedAt} IS NULL`, eq(s.patients.status, "ACTIVE")))
    .orderBy(s.patients.fullName)
    .limit(200);
}

export async function listAppointments(user: SessionUser, date?: string, status?: string) {
  const conditions = [eq(s.appointments.organizationId, user.organizationId)];
  if (date) conditions.push(eq(s.appointments.appointmentDate, date));
  if (status) conditions.push(eq(s.appointments.status, status));
  return db()
    .select({
      id: s.appointments.id,
      appointmentNumber: s.appointments.appointmentNumber,
      appointmentDate: s.appointments.appointmentDate,
      startTime: s.appointments.startTime,
      endTime: s.appointments.endTime,
      status: s.appointments.status,
      appointmentType: s.appointments.appointmentType,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      patientId: s.patients.id,
      doctorName: s.staff.fullName,
      departmentName: s.departments.name,
      departmentId: s.departments.id,
      notes: s.appointments.notes,
    })
    .from(s.appointments)
    .innerJoin(s.patients, eq(s.patients.id, s.appointments.patientId))
    .innerJoin(s.doctors, eq(s.doctors.id, s.appointments.doctorId))
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .innerJoin(s.departments, eq(s.departments.id, s.appointments.departmentId))
    .where(and(...conditions))
    .orderBy(desc(s.appointments.appointmentDate), s.appointments.startTime);
}

export async function getAppointment(user: SessionUser, id: string) {
  const rows = await db()
    .select()
    .from(s.appointments)
    .where(and(eq(s.appointments.id, id), eq(s.appointments.organizationId, user.organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("Appointment tidak ditemukan");
  return row;
}

interface AppointmentInput {
  patientId: string;
  doctorId: string;
  departmentId: string;
  roomId?: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType?: string;
  notes?: string | null;
}

/** Times are stored as ISO "HH:MM:SS" so lexicographic comparison is valid. */
async function assertDoctorSchedule(user: SessionUser, doctorId: string, departmentId: string, appointmentDate: string, startTime: string, endTime: string) {
  const dayOfWeek = new Date(`${appointmentDate}T00:00:00`).getDay();
  const schedules = await db()
    .select()
    .from(s.doctorSchedules)
    .where(and(
      eq(s.doctorSchedules.organizationId, user.organizationId),
      eq(s.doctorSchedules.doctorId, doctorId),
      eq(s.doctorSchedules.departmentId, departmentId),
      eq(s.doctorSchedules.dayOfWeek, dayOfWeek),
      eq(s.doctorSchedules.status, "ACTIVE"),
      lte(s.doctorSchedules.effectiveFrom, appointmentDate),
    ));
  for (const sc of schedules) {
    if (sc.effectiveUntil && appointmentDate > sc.effectiveUntil) continue;
    if (startTime < sc.startTime || endTime > sc.endTime) {
      throw new ValidationError(`Waktu appointment harus dalam jam praktik dokter (${sc.startTime.slice(0, 5)}-${sc.endTime.slice(0, 5)})`);
    }
    return;
  }
  throw new ValidationError("Dokter tidak memiliki jadwal pada hari dan poli tersebut");
}

export async function createAppointment(user: SessionUser, input: AppointmentInput) {
  if (input.endTime <= input.startTime) throw new ValidationError("Waktu selesai harus setelah waktu mulai");
  await assertDoctorSchedule(user, input.doctorId, input.departmentId, input.appointmentDate, input.startTime, input.endTime);

  // Doctor double-booking check (overlapping active appointments)
  const doctorConflicts = await db()
    .select({ id: s.appointments.id, status: s.appointments.status })
    .from(s.appointments)
    .where(and(
      eq(s.appointments.organizationId, user.organizationId),
      eq(s.appointments.doctorId, input.doctorId),
      eq(s.appointments.appointmentDate, input.appointmentDate),
      sql`${s.appointments.startTime} < ${input.endTime} AND ${s.appointments.endTime} > ${input.startTime}`,
    ));
  for (const row of doctorConflicts) {
    if (!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(row.status)) {
      throw new ConflictError("Jadwal bentrok: dokter sudah memiliki appointment pada waktu tersebut");
    }
  }

  // Patient double-booking check
  const patientConflicts = await db()
    .select({ id: s.appointments.id, status: s.appointments.status })
    .from(s.appointments)
    .where(and(
      eq(s.appointments.organizationId, user.organizationId),
      eq(s.appointments.patientId, input.patientId),
      eq(s.appointments.appointmentDate, input.appointmentDate),
      sql`${s.appointments.startTime} < ${input.endTime} AND ${s.appointments.endTime} > ${input.startTime}`,
    ));
  for (const row of patientConflicts) {
    if (!["CANCELLED", "NO_SHOW"].includes(row.status)) {
      throw new ConflictError("Pasien sudah memiliki appointment pada waktu tersebut");
    }
  }

  const number = await generateBusinessNumber({ organizationId: user.organizationId, branchId: user.branchId, prefix: "APT", scope: "APT", period: datePeriodMonth() });
  const inserted = await db()
    .insert(s.appointments)
    .values({
      organizationId: user.organizationId,
      branchId: user.branchId ?? "",
      patientId: input.patientId,
      doctorId: input.doctorId,
      departmentId: input.departmentId,
      roomId: input.roomId || null,
      appointmentNumber: number,
      appointmentDate: input.appointmentDate,
      startTime: input.startTime,
      endTime: input.endTime,
      appointmentType: input.appointmentType ?? "REGULAR",
      status: "SCHEDULED",
      notes: input.notes || null,
    })
    .returning();
  const ap = inserted[0];
  await writeAuditLog({ user, action: "APPOINTMENT_CREATE", entityType: "appointments", entityId: ap.id, newData: { number, date: ap.appointmentDate, doctorId: ap.doctorId, patientId: ap.patientId, startTime: ap.startTime, endTime: ap.endTime } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "appointment_created", entityType: "appointments", entityId: ap.id });
  return ap;
}

// Medications master (for purchasing/inventory forms)
export async function listMedications(user: SessionUser) {
  return db().select().from(s.medications).where(and(eq(s.medications.organizationId, user.organizationId), eq(s.medications.status, "ACTIVE"))).orderBy(s.medications.name);
}

export async function updateAppointmentStatus(user: SessionUser, id: string, status: string, notes?: string | null) {
  const ap = await getAppointment(user, id);
  const allowedMap: Record<string, string[]> = {
    CONFIRMED: ["SCHEDULED"],
    CHECKED_IN: ["SCHEDULED", "CONFIRMED"],
    COMPLETED: ["CHECKED_IN", "CONFIRMED"],
    CANCELLED: ["SCHEDULED", "CONFIRMED"],
    NO_SHOW: ["SCHEDULED", "CONFIRMED"],
  };
  const allowed = allowedMap[status];
  if (!allowed || !allowed.includes(ap.status)) {
    throw new ConflictError(`Tidak dapat mengubah status dari ${ap.status} ke ${status}`);
  }
  const updated = await db().update(s.appointments).set({ status, notes: notes ?? ap.notes }).where(eq(s.appointments.id, id)).returning();
  await writeAuditLog({ user, action: `APPOINTMENT_${status}`, entityType: "appointments", entityId: id, oldData: { status: ap.status }, newData: { status } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: `appointment_${status.toLowerCase()}`, entityType: "appointments", entityId: id });
  return updated[0];
}