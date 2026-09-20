import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError, InvalidStateError } from "@/lib/errors";
import { todayISO } from "@/lib/utils";
import { generateBusinessNumber, datePeriodMonth } from "@/lib/services/numbering";
import { createQueueEntry } from "@/features/queue/service";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";

interface RegisterVisitInput {
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentId?: string | null;
  chiefComplaint?: string | null;
  priority?: string;
}

export async function registerVisit(user: SessionUser, input: RegisterVisitInput) {
  const visitNumber = await generateBusinessNumber({ organizationId: user.organizationId, branchId: user.branchId, prefix: "VST", scope: "VISIT", period: datePeriodMonth() });
  const today = todayISO();
  const queueEntry = await createQueueEntry(user, input.patientId, input.departmentId, input.priority ?? "NORMAL");
  const inserted = await db()
    .insert(s.visits)
    .values({
      organizationId: user.organizationId,
      branchId: user.branchId ?? "",
      patientId: input.patientId,
      appointmentId: input.appointmentId || null,
      doctorId: input.doctorId,
      departmentId: input.departmentId,
      visitNumber,
      visitDate: today,
      visitType: "REGISTRATION",
      status: "CHECKED_IN",
      chiefComplaint: input.chiefComplaint || null,
    })
    .returning();
  const visit = inserted[0];
  if (input.appointmentId) {
    await db().update(s.appointments).set({ status: "CHECKED_IN" }).where(eq(s.appointments.id, input.appointmentId));
  }
  await writeAuditLog({ user, action: "VISIT_CREATE", entityType: "visits", entityId: visit.id, newData: { visitNumber, patientId: input.patientId, doctorId: input.doctorId } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "visit_created", entityType: "visits", entityId: visit.id, meta: { queueId: queueEntry.id } });
  return { visit, queue: queueEntry };
}

export async function listVisits(user: SessionUser, date?: string, status?: string) {
  const conditions = [eq(s.visits.organizationId, user.organizationId), eq(s.visits.branchId, user.branchId ?? "")];
  if (date) conditions.push(eq(s.visits.visitDate, date));
  if (status) conditions.push(eq(s.visits.status, status));
  return db()
    .select({
      id: s.visits.id,
      visitNumber: s.visits.visitNumber,
      visitDate: s.visits.visitDate,
      visitType: s.visits.visitType,
      status: s.visits.status,
      chiefComplaint: s.visits.chiefComplaint,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      patientId: s.patients.id,
      doctorName: s.staff.fullName,
      departmentName: s.departments.name,
    })
    .from(s.visits)
    .innerJoin(s.patients, eq(s.patients.id, s.visits.patientId))
    .innerJoin(s.doctors, eq(s.doctors.id, s.visits.doctorId))
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .innerJoin(s.departments, eq(s.departments.id, s.visits.departmentId))
    .where(and(...conditions))
    .orderBy(desc(s.visits.createdAt));
}

export async function getVisit(user: SessionUser, id: string) {
  const rows = await db()
    .select({
      id: s.visits.id,
      visitNumber: s.visits.visitNumber,
      visitDate: s.visits.visitDate,
      visitType: s.visits.visitType,
      status: s.visits.status,
      chiefComplaint: s.visits.chiefComplaint,
      patientId: s.visits.patientId,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      patientBirthDate: s.patients.birthDate,
      patientGender: s.patients.gender,
      doctorId: s.visits.doctorId,
      doctorName: s.staff.fullName,
      departmentId: s.visits.departmentId,
      departmentName: s.departments.name,
      appointmentId: s.visits.appointmentId,
      createdAt: s.visits.createdAt,
    })
    .from(s.visits)
    .innerJoin(s.patients, eq(s.patients.id, s.visits.patientId))
    .innerJoin(s.doctors, eq(s.doctors.id, s.visits.doctorId))
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .innerJoin(s.departments, eq(s.departments.id, s.visits.departmentId))
    .where(and(eq(s.visits.id, id), eq(s.visits.organizationId, user.organizationId)))
    .limit(1);
  const v = rows[0];
  if (!v) throw new NotFoundError("Kunjungan tidak ditemukan");

  const mr = await db().select().from(s.medicalRecords).where(eq(s.medicalRecords.visitId, id)).limit(1);
  const diagnoses = mr.length > 0
    ? db()
        .select({ id: s.medicalRecordDiagnoses.id, diagnosisId: s.medicalRecordDiagnoses.diagnosisId, code: s.diagnoses.code, name: s.diagnoses.name, diagnosisType: s.medicalRecordDiagnoses.diagnosisType, notes: s.medicalRecordDiagnoses.notes })
        .from(s.medicalRecordDiagnoses)
        .innerJoin(s.diagnoses, eq(s.diagnoses.id, s.medicalRecordDiagnoses.diagnosisId))
        .where(eq(s.medicalRecordDiagnoses.medicalRecordId, mr[0].id))
        .then((r) => r) : Promise.resolve([]);
  const procResult = mr.length > 0
    ? db()
        .select({ id: s.medicalRecordProcedures.id, procedureId: s.medicalRecordProcedures.procedureId, procedureName: s.procedures.name, quantity: s.medicalRecordProcedures.quantity, price: s.medicalRecordProcedures.price, notes: s.medicalRecordProcedures.notes })
        .from(s.medicalRecordProcedures)
        .innerJoin(s.procedures, eq(s.procedures.id, s.medicalRecordProcedures.procedureId))
        .where(eq(s.medicalRecordProcedures.medicalRecordId, mr[0].id))
        .then((r) => r) : Promise.resolve([]);

  const prescriptions = await db()
    .select({ id: s.prescriptions.id, number: s.prescriptions.prescriptionNumber, status: s.prescriptions.status, notes: s.prescriptions.notes, issuedAt: s.prescriptions.issuedAt })
    .from(s.prescriptions)
    .where(eq(s.prescriptions.visitId, id));
  const prescriptionItems: Array<{ prescriptionId: string; medicationId: string; name: string; quantity: number; dosage: string | null; frequency: string | null; route: string; duration: string | null; instructions: string | null; dispensedQuantity: number; status: string }> = [];
  for (const rx of prescriptions) {
    const items = await db()
      .select({ id: s.prescriptionItems.id, medicationId: s.prescriptionItems.medicationId, name: s.medications.name, quantity: s.prescriptionItems.quantity, dosage: s.prescriptionItems.dosage, frequency: s.prescriptionItems.frequency, route: s.prescriptionItems.route, duration: s.prescriptionItems.duration, instructions: s.prescriptionItems.instructions, dispensedQuantity: s.prescriptionItems.dispensedQuantity, status: s.prescriptionItems.status })
      .from(s.prescriptionItems)
      .innerJoin(s.medications, eq(s.medications.id, s.prescriptionItems.medicationId))
      .where(eq(s.prescriptionItems.prescriptionId, rx.id));
    prescriptionItems.push(...items.map((i) => ({ ...i, prescriptionId: rx.id })));
  }

  const vital = await db().select().from(s.vitalSigns).where(eq(s.vitalSigns.visitId, id)).orderBy(desc(s.vitalSigns.recordedAt)).limit(1);
  const labs = await db().select().from(s.laboratoryOrders).where(eq(s.laboratoryOrders.visitId, id));
  const rads = await db().select().from(s.radiologyOrders).where(eq(s.radiologyOrders.visitId, id));
  const invoices = await db().select({ id: s.invoices.id, number: s.invoices.invoiceNumber, total: s.invoices.total, status: s.invoices.status }).from(s.invoices).where(eq(s.invoices.visitId, id));

  return {
    ...v,
    medicalRecord: mr[0] ?? null,
    diagnoses: await diagnoses,
    procedures: await procResult,
    prescriptions,
    prescriptionItems,
    vitalSigns: vital[0] ?? null,
    labOrders: labs,
    radiologyOrders: rads,
    invoices,
  };
}

export async function startVisit(user: SessionUser, id: string) {
  const visit = await db().select().from(s.visits).where(and(eq(s.visits.id, id), eq(s.visits.organizationId, user.organizationId))).limit(1);
  const row = visit[0];
  if (!row) throw new NotFoundError("Kunjungan tidak ditemukan");
  if (row.status !== "CHECKED_IN") throw new InvalidStateError(`Kunjungan dengan status ${row.status} tidak dapat dimulai`);
  await db().update(s.visits).set({ status: "IN_PROGRESS", startedAt: new Date() }).where(eq(s.visits.id, id));
  await writeAuditLog({ user, action: "VISIT_START", entityType: "visits", entityId: id, oldData: { status: "CHECKED_IN" }, newData: { status: "IN_PROGRESS" } });
}

export async function completeVisit(user: SessionUser, id: string) {
  const visit = await db().select().from(s.visits).where(and(eq(s.visits.id, id), eq(s.visits.organizationId, user.organizationId))).limit(1);
  const row = visit[0];
  if (!row) throw new NotFoundError("Kunjungan tidak ditemukan");
  if (row.status !== "IN_PROGRESS") throw new InvalidStateError("Kunjungan harus dalam status Berlangsung");
  await db().update(s.visits).set({ status: "COMPLETED", completedAt: new Date() }).where(eq(s.visits.id, id));
  await writeAuditLog({ user, action: "VISIT_COMPLETE", entityType: "visits", entityId: id });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "visit_completed", entityType: "visits", entityId: id });
}

export async function cancelVisit(user: SessionUser, id: string) {
  const visit = await db().select().from(s.visits).where(and(eq(s.visits.id, id), eq(s.visits.organizationId, user.organizationId))).limit(1);
  const row = visit[0];
  if (!row) throw new NotFoundError("Kunjungan tidak ditemukan");
  if (["COMPLETED", "CANCELLED"].includes(row.status)) throw new InvalidStateError("Kunjungan tidak dapat dibatalkan");
  await db().update(s.visits).set({ status: "CANCELLED" }).where(eq(s.visits.id, id));
  await writeAuditLog({ user, action: "VISIT_CANCEL", entityType: "visits", entityId: id, oldData: { status: row.status }, newData: { status: "CANCELLED" } });
}

// Medical Records
export async function listMedicalRecords(user: SessionUser) {
  return db()
    .select({
      id: s.medicalRecords.id,
      visitId: s.medicalRecords.visitId,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      doctorName: s.staff.fullName,
      status: s.medicalRecords.status,
      finalizedAt: s.medicalRecords.finalizedAt,
      updatedAt: s.medicalRecords.updatedAt,
      createdAt: s.medicalRecords.createdAt,
    })
    .from(s.medicalRecords)
    .innerJoin(s.patients, eq(s.patients.id, s.medicalRecords.patientId))
    .leftJoin(s.doctors, eq(s.doctors.id, s.medicalRecords.doctorId))
    .leftJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .where(eq(s.medicalRecords.organizationId, user.organizationId))
    .orderBy(desc(s.medicalRecords.updatedAt));
}

export async function getMedicalRecord(user: SessionUser, visitId: string) {
  const rows = await db().select().from(s.medicalRecords).where(eq(s.medicalRecords.visitId, visitId)).limit(1);
  return rows[0] ?? null;
}

export async function createOrUpdateSoap(user: SessionUser, visitId: string, input: { subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null }) {
  const existing = await getMedicalRecord(user, visitId);
  if (existing && existing.status === "FINALIZED") {
    throw new InvalidStateError("Rekam medis sudah difinalisasi. Gunakan amend untuk mengubah.");
  }
  if (existing) {
    const updated = await db().update(s.medicalRecords).set({ subjective: input.subjective ?? existing.subjective, objective: input.objective ?? existing.objective, assessment: input.assessment ?? existing.assessment, plan: input.plan ?? existing.plan, updatedAt: new Date() }).where(eq(s.medicalRecords.id, existing.id)).returning();
    return updated[0];
  }
  const visit = await db().select().from(s.visits).where(eq(s.visits.id, visitId)).limit(1);
  if (visit.length === 0) throw new NotFoundError("Kunjungan tidak ditemukan");
  const inserted = await db().insert(s.medicalRecords).values({ organizationId: user.organizationId, branchId: user.branchId ?? "", visitId, patientId: visit[0].patientId, doctorId: visit[0].doctorId, subjective: input.subjective ?? null, objective: input.objective ?? null, assessment: input.assessment ?? null, plan: input.plan ?? null, status: "DRAFT" }).returning();
  return inserted[0];
}

export async function addDiagnoses(user: SessionUser, medicalRecordId: string, diagnoses: Array<{ diagnosisId: string; diagnosisType?: string; notes?: string | null }>) {
  for (const diag of diagnoses) {
    await db().insert(s.medicalRecordDiagnoses).values({ medicalRecordId, diagnosisId: diag.diagnosisId, diagnosisType: diag.diagnosisType ?? "PRIMARY", notes: diag.notes || null });
  }
  await writeAuditLog({ user, action: "MR_ADD_DIAGNOSES", entityType: "medical_records", entityId: medicalRecordId, newData: { count: diagnoses.length } });
}

export async function addProcedures(user: SessionUser, medicalRecordId: string, procedures: Array<{ procedureId: string; quantity?: number; price: string; notes?: string | null }>) {
  for (const proc of procedures) {
    await db().insert(s.medicalRecordProcedures).values({ medicalRecordId, procedureId: proc.procedureId, quantity: proc.quantity ?? 1, price: proc.price, notes: proc.notes || null, performedBy: user.id });
  }
  await writeAuditLog({ user, action: "MR_ADD_PROCEDURES", entityType: "medical_records", entityId: medicalRecordId, newData: { count: procedures.length } });
}

export async function addVitalSigns(user: SessionUser, visitId: string, input: Record<string, string | number | null | undefined>) {
  const inserted = await db().insert(s.vitalSigns).values({
    visitId,
    temperature: input.temperature != null ? String(input.temperature) : null,
    systolic: input.systolic != null ? Number(input.systolic) : null,
    diastolic: input.diastolic != null ? Number(input.diastolic) : null,
    heartRate: input.heartRate != null ? Number(input.heartRate) : null,
    respiratoryRate: input.respiratoryRate != null ? Number(input.respiratoryRate) : null,
    oxygenSaturation: input.oxygenSaturation != null ? String(input.oxygenSaturation) : null,
    weight: input.weight != null ? String(input.weight) : null,
    height: input.height != null ? String(input.height) : null,
    bmi: input.bmi != null ? String(input.bmi) : null,
    painScale: input.painScale != null ? Number(input.painScale) : null,
    notes: input.notes != null ? String(input.notes) : null,
    recordedBy: user.id,
  }).returning();
  return inserted[0];
}

export async function finalizeMedicalRecord(user: SessionUser, visitId: string) {
  const mr = await getMedicalRecord(user, visitId);
  if (!mr) throw new NotFoundError("Rekam medis tidak ditemukan");
  if (mr.status === "FINALIZED") throw new InvalidStateError("Sudah difinalisasi");
  await db().update(s.medicalRecords).set({ status: "FINALIZED", finalizedAt: new Date(), finalizedBy: user.id }).where(eq(s.medicalRecords.id, mr.id));
  // Create version 1
  await db().insert(s.medicalRecordVersions).values({ medicalRecordId: mr.id, versionNumber: 1, subjective: mr.subjective, objective: mr.objective, assessment: mr.assessment, plan: mr.plan, changedBy: user.id, changeReason: "Finalisasi awal" });
  await writeAuditLog({ user, action: "MR_FINALIZE", entityType: "medical_records", entityId: mr.id });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "medical_record_finalized", entityType: "medical_records", entityId: mr.id });
}

export async function amendMedicalRecord(user: SessionUser, visitId: string, reason: string, input: { subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null }) {
  const mr = await getMedicalRecord(user, visitId);
  if (!mr) throw new NotFoundError("Rekam medis tidak ditemukan");
  if (mr.status !== "FINALIZED") throw new InvalidStateError("Hanya rekam medis yang sudah finalisasi yang dapat diubah");
  // Snapshot current to version N
  const latestVersion = await db().select({ v: sql<number>`COALESCE(MAX(${s.medicalRecordVersions.versionNumber}),0)` }).from(s.medicalRecordVersions).where(eq(s.medicalRecordVersions.medicalRecordId, mr.id));
  const currentVersion = latestVersion[0]?.v ?? 0;
  if (currentVersion > 0) {
    await db().insert(s.medicalRecordVersions).values({ medicalRecordId: mr.id, versionNumber: currentVersion + 1, subjective: mr.subjective, objective: mr.objective, assessment: mr.assessment, plan: mr.plan, changedBy: user.id, changeReason: reason });
  }
  const updated = await db().update(s.medicalRecords).set({ ...input, status: "DRAFT", updatedAt: new Date() }).where(eq(s.medicalRecords.id, mr.id)).returning();
  await writeAuditLog({ user, action: "MR_AMEND", entityType: "medical_records", entityId: mr.id, oldData: { status: "FINALIZED" }, newData: { status: "DRAFT", reason } });
  return updated[0];
}

export async function getMedicalRecordVersions(user: SessionUser, medicalRecordId: string) {
  return db().select().from(s.medicalRecordVersions).where(eq(s.medicalRecordVersions.medicalRecordId, medicalRecordId)).orderBy(desc(s.medicalRecordVersions.versionNumber));
}

// Diagnoses master
export async function listDiagnoses(user: SessionUser, search?: string) {
  const conditions = [eq(s.diagnoses.organizationId, user.organizationId), eq(s.diagnoses.status, "ACTIVE")];
  if (search && search.trim()) {
    const p = `%${search.trim()}%`;
    conditions.push(sql`(${s.diagnoses.code} ILIKE ${p} OR ${s.diagnoses.name} ILIKE ${p})`);
  }
  return db().select().from(s.diagnoses).where(and(...conditions)).orderBy(s.diagnoses.code);
}

// Procedures master
export async function listProcedures(user: SessionUser) {
  return db().select().from(s.procedures).where(and(eq(s.procedures.organizationId, user.organizationId), eq(s.procedures.status, "ACTIVE"))).orderBy(s.procedures.code);
}

// Medications master for prescriptions
export async function listMedications(user: SessionUser) {
  return db().select().from(s.medications).where(and(eq(s.medications.organizationId, user.organizationId), eq(s.medications.status, "ACTIVE"))).orderBy(s.medications.name);
}

// Prescriptions
export async function createPrescription(user: SessionUser, visitId: string, patientId: string, doctorId: string, items: Array<{ medicationId: string; quantity: number; dosage?: string | null; frequency?: string | null; route?: string | null; duration?: string | null; instructions?: string | null }>, notes?: string | null) {
  const number = await generateBusinessNumber({ organizationId: user.organizationId, branchId: user.branchId, prefix: "RX", scope: "PRESCRIPTION", period: datePeriodMonth() });
  const rx = await db().insert(s.prescriptions).values({ organizationId: user.organizationId, branchId: user.branchId ?? "", visitId, patientId, doctorId, prescriptionNumber: number, status: "ISSUED", notes: notes || null, issuedAt: new Date() }).returning();
  for (const item of items) {
    await db().insert(s.prescriptionItems).values({ prescriptionId: rx[0].id, medicationId: item.medicationId, quantity: item.quantity, dosage: item.dosage || null, frequency: item.frequency || null, route: item.route ?? "ORAL", duration: item.duration || null, instructions: item.instructions || null });
  }
  await writeAuditLog({ user, action: "PRESCRIPTION_CREATE", entityType: "prescriptions", entityId: rx[0].id, newData: { number, items: items.length } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "prescription_created", entityType: "prescriptions", entityId: rx[0].id });
  return rx[0];
}