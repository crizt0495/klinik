import { and, eq, gte, lt, sql, count, sum, or, lte } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { todayISO } from "@/lib/utils";

export interface DashboardStats {
  totalPatients: number;
  todayVisits: number;
  todayAppointments: number;
  todayOnQueue: number;
  todayRevenue: number;
  outstandingInvoices: number;
  outstandingAmount: number;
  lowStock: number;
  expiringSoon: number;
  pendingPrescriptions: number;
  pendingLab: number;
  pendingRad: number;
  recentActivity: Array<{ id: string; action: string; entityType: string; createdAt: Date }>;
}

export async function getDashboardStats(user: SessionUser): Promise<DashboardStats> {
  const orgId = user.organizationId;
  const today = todayISO();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 7, 0, 0, 0);

  const totalPatients = await db().select({ c: count() }).from(s.patients).where(and(eq(s.patients.organizationId, orgId), sql`${s.patients.deletedAt} IS NULL`));

  const todayVisitsRow = await db()
    .select({ c: count() })
    .from(s.visits)
    .where(and(eq(s.visits.organizationId, orgId), eq(s.visits.visitDate, today)));

  const todayAppointmentsRow = await db()
    .select({ c: count() })
    .from(s.appointments)
    .where(and(eq(s.appointments.organizationId, orgId), eq(s.appointments.appointmentDate, today)));

  const todayQueueRow = await db()
    .select({ c: count() })
    .from(s.queues)
    .where(and(eq(s.queues.organizationId, orgId), sql`${s.queues.queueDate} = ${today}`));

  const revenueRow = await db()
    .select({ total: sum(sql`${s.payments.amount}::numeric`) })
    .from(s.payments)
    .where(and(eq(s.payments.organizationId, orgId), eq(s.payments.status, "COMPLETED"), gte(s.payments.paymentDate, new Date(startOfDay)), lt(s.payments.paymentDate, new Date(endOfDay))));

  const outstandingRow = await db().select({ c: count(), total: sum(sql`${s.invoices.dueAmount}::numeric`) }).from(s.invoices).where(and(eq(s.invoices.organizationId, orgId), sql`${s.invoices.dueAmount}::numeric > 0`, or(eq(s.invoices.status, "ISSUED"), eq(s.invoices.status, "PARTIALLY_PAID"))));

  const expiringSoonRow = await db()
    .select({ c: count() })
    .from(s.inventoryBatches)
    .where(and(eq(s.inventoryBatches.organizationId, orgId), eq(s.inventoryBatches.status, "ACTIVE"), sql`${s.inventoryBatches.quantityAvailable} > 0`, lte(s.inventoryBatches.expiryDate, sql`CURRENT_DATE + INTERVAL '90 days'`)));

  const pendingPrescriptionsRow = await db()
    .select({ c: count() })
    .from(s.prescriptions)
    .where(and(eq(s.prescriptions.organizationId, orgId), or(eq(s.prescriptions.status, "ISSUED"), eq(s.prescriptions.status, "PARTIALLY_DISPENSED"))));

  const pendingLabRow = await db().select({ c: count() }).from(s.laboratoryOrders).where(and(eq(s.laboratoryOrders.organizationId, orgId), or(eq(s.laboratoryOrders.status, "ORDERED"), eq(s.laboratoryOrders.status, "COLLECTED"), eq(s.laboratoryOrders.status, "PROCESSING"))));

  const pendingRadRow = await db().select({ c: count() }).from(s.radiologyOrders).where(and(eq(s.radiologyOrders.organizationId, orgId), or(eq(s.radiologyOrders.status, "ORDERED"), eq(s.radiologyOrders.status, "SCHEDULED"), eq(s.radiologyOrders.status, "IN_PROGRESS"))));

  // low stock actual count based on batch availability
  const batchRows = await db()
    .select({ medicationId: s.inventoryBatches.medicationId, available: sql<number>`sum(${s.inventoryBatches.quantityAvailable})` })
    .from(s.inventoryBatches)
    .where(and(eq(s.inventoryBatches.organizationId, orgId), eq(s.inventoryBatches.status, "ACTIVE")))
    .groupBy(s.inventoryBatches.medicationId);

  const availMap = new Map<string, number>();
  for (const row of batchRows) availMap.set(row.medicationId, Number(row.available ?? 0));

  const medRows = await db().select({ id: s.medications.id, min: s.medications.minimumStock }).from(s.medications).where(and(eq(s.medications.organizationId, orgId), eq(s.medications.status, "ACTIVE")));
  const lowStock = medRows.filter((m) => (availMap.get(m.id) ?? 0) <= m.min).length;

  const activityRows = await db()
    .select({ id: s.activityLogs.id, action: s.activityLogs.action, entityType: s.activityLogs.entityType, createdAt: s.activityLogs.createdAt })
    .from(s.activityLogs)
    .where(eq(s.activityLogs.organizationId, orgId))
    .orderBy(sql`${s.activityLogs.createdAt} desc`)
    .limit(8);

  return {
    totalPatients: totalPatients[0]?.c ?? 0,
    todayVisits: todayVisitsRow[0]?.c ?? 0,
    todayAppointments: todayAppointmentsRow[0]?.c ?? 0,
    todayOnQueue: todayQueueRow[0]?.c ?? 0,
    todayRevenue: Number(revenueRow[0]?.total ?? 0),
    outstandingInvoices: outstandingRow[0]?.c ?? 0,
    outstandingAmount: Number(outstandingRow[0]?.total ?? 0),
    lowStock,
    expiringSoon: expiringSoonRow[0]?.c ?? 0,
    pendingPrescriptions: pendingPrescriptionsRow[0]?.c ?? 0,
    pendingLab: pendingLabRow[0]?.c ?? 0,
    pendingRad: pendingRadRow[0]?.c ?? 0,
    recentActivity: activityRows as DashboardStats["recentActivity"],
  };
}