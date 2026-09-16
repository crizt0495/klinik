import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";

export async function getDashboardStats(user: SessionUser, dateFrom: string, dateTo: string) {
  const cond = [eq(s.visits.organizationId, user.organizationId), sql`${s.visits.visitDate} >= ${dateFrom}`, sql`${s.visits.visitDate} <= ${dateTo}`];

  const [visitCount] = await db().select({ count: sql<number>`count(*)::int` }).from(s.visits).where(and(...cond));
  const [income] = await db().select({ total: sql<string>`coalesce(sum(payments.amount::numeric), 0)::text` }).from(s.payments).innerJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId)).where(and(eq(s.payments.organizationId, user.organizationId), eq(s.payments.status, "COMPLETED"), sql`${s.payments.paymentDate} >= ${dateFrom}`, sql`${s.payments.paymentDate} <= ${dateTo}`));

  const [patientCount] = await db().select({ count: sql<number>`count(*)::int` }).from(s.patients).where(and(eq(s.patients.organizationId, user.organizationId), sql`${s.patients.createdAt} >= ${dateFrom}`, sql`${s.patients.createdAt} <= ${dateTo}`));

  const topDiagnoses = await db().select({ code: s.diagnoses.code, name: s.diagnoses.name, count: sql<number>`count(*)::int` }).from(s.medicalRecordDiagnoses).innerJoin(s.diagnoses, eq(s.diagnoses.id, s.medicalRecordDiagnoses.diagnosisId)).innerJoin(s.medicalRecords, eq(s.medicalRecords.id, s.medicalRecordDiagnoses.medicalRecordId)).innerJoin(s.visits, eq(s.visits.id, s.medicalRecords.visitId)).where(and(eq(s.visits.organizationId, user.organizationId), sql`${s.visits.visitDate} >= ${dateFrom}`, sql`${s.visits.visitDate} <= ${dateTo}`)).groupBy(s.diagnoses.code, s.diagnoses.name).orderBy(desc(sql`count(*)`)).limit(10);

  const topMedications = await db().select({ name: s.medications.name, count: sql<number>`sum(prescription_items.quantity)::int` }).from(s.prescriptionItems).innerJoin(s.medications, eq(s.medications.id, s.prescriptionItems.medicationId)).innerJoin(s.prescriptions, eq(s.prescriptions.id, s.prescriptionItems.prescriptionId)).where(and(eq(s.prescriptions.organizationId, user.organizationId), sql`${s.prescriptions.createdAt} >= ${dateFrom}`, sql`${s.prescriptions.createdAt} <= ${dateTo}`)).groupBy(s.medications.name).orderBy(desc(sql`sum(prescription_items.quantity)`)).limit(10);

  return {
    totalVisits: visitCount?.count ?? 0,
    totalIncome: income?.total ?? "0",
    totalPatients: patientCount?.count ?? 0,
    topDiagnoses,
    topMedications,
  };
}

export async function getMonthlyRevenue(user: SessionUser, year: number) {
  return db().select({
    month: sql<string>`to_char(payments.payment_date, 'YYYY-MM')`,
    total: sql<string>`coalesce(sum(payments.amount::numeric), 0)::text`,
    count: sql<number>`count(*)::int`,
  }).from(s.payments).where(and(eq(s.payments.organizationId, user.organizationId), eq(s.payments.status, "COMPLETED"), sql`extract(year from payments.payment_date) = ${year}`)).groupBy(sql`to_char(payments.payment_date, 'YYYY-MM')`).orderBy(sql`to_char(payments.payment_date, 'YYYY-MM')`);
}