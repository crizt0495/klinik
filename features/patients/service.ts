import { and, eq, isNull, or, ilike, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError, DuplicateRecordError } from "@/lib/errors";
import { requireTenant } from "@/lib/auth/session";
import { nextSequence, datePeriodYear } from "@/lib/services/numbering";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";

export interface PatientInput {
  fullName: string;
  nik?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  gender: string;
  bloodType?: string | null;
  maritalStatus?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  occupation?: string | null;
}

export async function generateMRN(user: SessionUser): Promise<string> {
  const seq = await nextSequence(user.organizationId, user.branchId, "MRN", datePeriodYear());
  return `MR-${datePeriodYear()}-${String(seq).padStart(6, "0")}`;
}

export async function listPatients(user: SessionUser, search?: string, status?: string) {
  const conditions = [
    eq(s.patients.organizationId, user.organizationId),
    isNull(s.patients.deletedAt),
  ];
  if (status) conditions.push(eq(s.patients.status, status));
  if (search && search.trim()) {
    const p = `%${search.trim()}%`;
    const searchCondition = or(ilike(s.patients.fullName, p), ilike(s.patients.medicalRecordNumber, p), ilike(s.patients.nik, p));
    if (searchCondition) conditions.push(searchCondition);
  }
  const rows = await db()
    .select({
      id: s.patients.id,
      medicalRecordNumber: s.patients.medicalRecordNumber,
      fullName: s.patients.fullName,
      nik: s.patients.nik,
      gender: s.patients.gender,
      birthDate: s.patients.birthDate,
      phone: s.patients.phone,
      address: s.patients.address,
      status: s.patients.status,
      createdAt: s.patients.createdAt,
      visitCount: sql<number>`(select count(*) from visits where visits.patient_id = patients.id)`,
    })
    .from(s.patients)
    .where(and(...conditions))
    .orderBy(desc(s.patients.createdAt));
  return rows;
}

export async function getPatient(user: SessionUser, id: string) {
  const rows = await db()
    .select()
    .from(s.patients)
    .where(and(eq(s.patients.id, id), eq(s.patients.organizationId, user.organizationId), isNull(s.patients.deletedAt)))
    .limit(1);
  const patient = rows[0];
  if (!patient) throw new NotFoundError("Pasien tidak ditemukan");
  return patient;
}

export async function getPatientDetail(user: SessionUser, id: string) {
  const patient = await getPatient(user, id);
  const insurance = await db()
    .select({
      id: s.patientInsurances.id,
      providerId: s.patientInsurances.insuranceProviderId,
      providerName: s.insuranceProviders.name,
      memberNumber: s.patientInsurances.memberNumber,
      coverageClass: s.patientInsurances.coverageClass,
      isPrimary: s.patientInsurances.isPrimary,
      status: s.patientInsurances.status,
    })
    .from(s.patientInsurances)
    .innerJoin(s.insuranceProviders, eq(s.insuranceProviders.id, s.patientInsurances.insuranceProviderId))
    .where(and(eq(s.patientInsurances.patientId, id), eq(s.patientInsurances.organizationId, user.organizationId)));
  const contacts = await db().select().from(s.patientContacts).where(eq(s.patientContacts.patientId, id));
  const providers = await db()
    .select()
    .from(s.insuranceProviders)
    .where(and(eq(s.insuranceProviders.organizationId, user.organizationId), eq(s.insuranceProviders.status, "ACTIVE")));
  return { patient, insurance, contacts, providers };
}

export async function listInsuranceProviders(user: SessionUser) {
  return db()
    .select()
    .from(s.insuranceProviders)
    .where(eq(s.insuranceProviders.organizationId, user.organizationId))
    .orderBy(s.insuranceProviders.name);
}

export async function createPatient(user: SessionUser, input: PatientInput) {
  const nik = input.nik?.trim() || null;
  if (nik) {
    const dup = await db()
      .select({ id: s.patients.id })
      .from(s.patients)
      .where(and(eq(s.patients.organizationId, user.organizationId), eq(s.patients.nik, nik), isNull(s.patients.deletedAt)))
      .limit(1);
    if (dup.length > 0) throw new DuplicateRecordError("NIK sudah terdaftar untuk pasien lain");
  }
  const mrn = await generateMRN(user);
  const inserted = await db()
    .insert(s.patients)
    .values({
      organizationId: user.organizationId,
      branchId: user.branchId ?? "",
      medicalRecordNumber: mrn,
      nik,
      fullName: input.fullName.trim(),
      birthPlace: input.birthPlace?.trim() || null,
      birthDate: input.birthDate || null,
      gender: input.gender,
      bloodType: input.bloodType || null,
      maritalStatus: input.maritalStatus || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
      occupation: input.occupation?.trim() || null,
      status: "ACTIVE",
    })
    .returning();
  const patient = inserted[0];
  await writeAuditLog({ user, action: "PATIENT_CREATE", entityType: "patients", entityId: patient.id, newData: { medicalRecordNumber: mrn, fullName: patient.fullName } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "patient_created", entityType: "patients", entityId: patient.id, meta: { mrn } });
  return patient;
}

export async function updatePatient(user: SessionUser, id: string, input: PatientInput) {
  const patient = await getPatient(user, id);
  const updated = await db().update(s.patients).set({ ...input, nik: input.nik?.trim() || null }).where(eq(s.patients.id, id)).returning();
  const row = updated[0];
  await writeAuditLog({ user, action: "PATIENT_UPDATE", entityType: "patients", entityId: id, oldData: { fullName: patient.fullName }, newData: { fullName: row.fullName } });
  return row;
}

export async function deletePatient(user: SessionUser, id: string) {
  await getPatient(user, id);
  await db().update(s.patients).set({ deletedAt: new Date(), status: "INACTIVE" }).where(eq(s.patients.id, id));
  await writeAuditLog({ user, action: "PATIENT_DELETE", entityType: "patients", entityId: id });
}

export async function addPatientInsurance(user: SessionUser, patientId: string, input: { insuranceProviderId: string; memberNumber: string; coverageClass?: string | null; isPrimary?: boolean }) {
  requireTenant(user, user.organizationId);
  await getPatient(user, patientId);
  if (input.isPrimary) {
    await db().update(s.patientInsurances).set({ isPrimary: false }).where(eq(s.patientInsurances.patientId, patientId));
  }
  const rows = await db()
    .insert(s.patientInsurances)
    .values({ organizationId: user.organizationId, patientId, insuranceProviderId: input.insuranceProviderId, memberNumber: input.memberNumber, coverageClass: input.coverageClass || null, isPrimary: input.isPrimary ?? false, status: "ACTIVE" })
    .returning();
  return rows[0];
}

export async function getPatientTimeline(user: SessionUser, patientId: string) {
  await getPatient(user, patientId);
  type Event = { id: string; type: string; title: string; sub: string; date: Date; href: string };
  const events: Event[] = [];

  const visits = await db()
    .select({ id: s.visits.id, number: s.visits.visitNumber, date: s.visits.visitDate, status: s.visits.status })
    .from(s.visits)
    .where(eq(s.visits.patientId, patientId));
  for (const v of visits) events.push({ id: v.id, type: "Kunjungan", title: v.number, sub: `Status: ${v.status}`, date: new Date(`${v.date}T00:00:00`), href: `/visits/${v.id}` });

  const args = and(eq(s.medicalRecords.patientId, patientId));
  const mrs = await db()
    .select({ id: s.medicalRecords.id, date: s.medicalRecords.createdAt, status: s.medicalRecords.status })
    .from(s.medicalRecords)
    .where(args);
  for (const m of mrs) events.push({ id: m.id, type: "Rekam Medis", title: m.status, sub: "Catatan medis", date: m.date, href: `/visits/${m.id}` });

  const rxs = await db().select({ id: s.prescriptions.id, number: s.prescriptions.prescriptionNumber, date: s.prescriptions.createdAt, status: s.prescriptions.status }).from(s.prescriptions).where(eq(s.prescriptions.patientId, patientId));
  for (const r of rxs) events.push({ id: r.id, type: "Resep", title: r.number, sub: `Status: ${r.status}`, date: r.date, href: `/prescriptions/${r.id}` });

  const invs = await db().select({ id: s.invoices.id, number: s.invoices.invoiceNumber, invoiceDate: s.invoices.invoiceDate, status: s.invoices.status }).from(s.invoices).where(eq(s.invoices.patientId, patientId));
  for (const i of invs) events.push({ id: i.id, type: "Penagihan", title: i.number, sub: `Status: ${i.status}`, date: new Date(`${i.invoiceDate}T00:00:00`), href: `/billing/${i.id}` });

  const labs = await db().select({ id: s.laboratoryOrders.id, number: s.laboratoryOrders.orderNumber, date: s.laboratoryOrders.createdAt, status: s.laboratoryOrders.status }).from(s.laboratoryOrders).where(eq(s.laboratoryOrders.patientId, patientId));
  for (const l of labs) events.push({ id: l.id, type: "Laboratorium", title: l.number, sub: `Status: ${l.status}`, date: l.date, href: `/laboratory/${l.id}` });

  const rads = await db().select({ id: s.radiologyOrders.id, number: s.radiologyOrders.orderNumber, date: s.radiologyOrders.createdAt, status: s.radiologyOrders.status }).from(s.radiologyOrders).where(eq(s.radiologyOrders.patientId, patientId));
  for (const r of rads) events.push({ id: r.id, type: "Radiologi", title: r.number, sub: `Status: ${r.status}`, date: r.date, href: `/radiology/${r.id}` });

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}