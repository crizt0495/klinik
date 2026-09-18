import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError, InvalidStateError, InsufficientStockError } from "@/lib/errors";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";

export async function listInvoices(user: SessionUser, status?: string) {
  const conditions = [eq(s.invoices.organizationId, user.organizationId)];
  if (status) conditions.push(eq(s.invoices.status, status));
  return db()
    .select({
      id: s.invoices.id,
      number: s.invoices.invoiceNumber,
      status: s.invoices.status,
      totalAmount: s.invoices.total,
      paidAmount: s.invoices.paidAmount,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      visitNumber: s.visits.visitNumber,
      createdAt: s.invoices.createdAt,
    })
    .from(s.invoices)
    .innerJoin(s.visits, eq(s.visits.id, s.invoices.visitId))
    .innerJoin(s.patients, eq(s.patients.id, s.visits.patientId))
    .where(and(...conditions))
    .orderBy(desc(s.invoices.createdAt));
}

export async function getInvoice(user: SessionUser, id: string) {
  const rows = await db().select().from(s.invoices).where(and(eq(s.invoices.id, id), eq(s.invoices.organizationId, user.organizationId))).limit(1);
  const inv = rows[0];
  if (!inv) throw new NotFoundError("Invoice tidak ditemukan");
  const items = await db().select().from(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, id));
  const payments = await db().select().from(s.payments).where(eq(s.payments.invoiceId, id)).orderBy(desc(s.payments.paymentDate));
  const patient = await db().select({ name: s.patients.fullName, mrn: s.patients.medicalRecordNumber }).from(s.patients).where(eq(s.patients.id, inv.patientId)).limit(1);
  return { invoice: inv, items, payments, patientName: patient[0]?.name ?? "", patientMrn: patient[0]?.mrn ?? "" };
}

export async function createInvoiceForVisit(user: SessionUser, data: { visitId: string; items: Array<{ serviceItemId: string; description: string; quantity: number; unitPrice: number }> }) {
  if (!data.items || data.items.length === 0) throw new InvalidStateError("Minimal 1 item");
  // Check if invoice already exists
  const existing = await db().select().from(s.invoices).where(and(eq(s.invoices.visitId, data.visitId), eq(s.invoices.organizationId, user.organizationId))).limit(1);
  if (existing.length > 0) throw new InvalidStateError("Sudah ada invoice untuk kunjungan ini");

  const visitRows = await db().select().from(s.visits).where(eq(s.visits.id, data.visitId)).limit(1);
  const visit = visitRows[0];
  if (!visit) throw new InvalidStateError("Kunjungan tidak ditemukan");

  let totalAmount = 0;
  for (const i of data.items) totalAmount += Number(i.unitPrice) * i.quantity;

  const number = `INV-${Date.now()}`;
  const [inv] = await db().insert(s.invoices).values({
    organizationId: user.organizationId, branchId: user.branchId ?? "", patientId: visit.patientId, visitId: data.visitId, invoiceNumber: number, invoiceDate: visit.visitDate, status: "ISSUED", total: String(totalAmount), paidAmount: "0",
  }).returning({ id: s.invoices.id });

  for (const item of data.items) {
    const subtotal = String(Number(item.unitPrice) * item.quantity);
    await db().insert(s.invoiceItems).values({ invoiceId: inv.id, itemType: "SERVICE", referenceId: item.serviceItemId, description: item.description, quantity: item.quantity, unitPrice: String(item.unitPrice), subtotal, discount: "0" });
  }

  await writeAuditLog({ user, action: "CREATE", entityType: "invoices", entityId: inv.id, newData: { number, totalAmount, itemCount: data.items.length } });
  return inv;
}

export async function processPayment(user: SessionUser, data: { invoiceId: string; method: string; amount: string; reference?: string }) {
  const rows = await db().select().from(s.invoices).where(and(eq(s.invoices.id, data.invoiceId), eq(s.invoices.organizationId, user.organizationId))).limit(1);
  const inv = rows[0];
  if (!inv) throw new NotFoundError("Invoice tidak ditemukan");
  if (inv.status === "VOID") throw new InvalidStateError("Invoice sudah void");
  if (inv.status === "REFUNDED") throw new InvalidStateError("Invoice sudah di-refund");
  const amountNum = Number(data.amount);
  const paidNum = Number(inv.paidAmount);
  const totalNum = Number(inv.total);
  if (amountNum <= 0) throw new InvalidStateError("Jumlah pembayaran harus positif");
  if (paidNum + amountNum > totalNum) throw new InvalidStateError(`Melebihi total tagihan (sisa: ${totalNum - paidNum})`);

  const [payment] = await db().insert(s.payments).values({
    organizationId: user.organizationId, branchId: user.branchId ?? "", invoiceId: data.invoiceId, paymentNumber: `PAY-${Date.now()}`, paymentMethod: data.method, amount: data.amount, referenceNumber: data.reference ?? null, status: "COMPLETED", receivedBy: user.id,
  }).returning({ id: s.payments.id });

  const newPaid = String(paidNum + amountNum);
  const newStatus = paidNum + amountNum >= totalNum ? "PAID" : "PARTIAL_PAID";
  await db().update(s.invoices).set({ paidAmount: newPaid, status: newStatus, updatedAt: new Date() }).where(eq(s.invoices.id, data.invoiceId));

  await writeAuditLog({ user, action: "PROCESS_PAYMENT", entityType: "invoices", entityId: data.invoiceId, newData: { paymentId: payment.id, method: data.method, amount: data.amount, newPaidAmount: newPaid } });
  return payment;
}

export async function processRefund(user: SessionUser, data: { invoiceId: string; amount: string; reason: string }) {
  const rows = await db().select().from(s.invoices).where(and(eq(s.invoices.id, data.invoiceId), eq(s.invoices.organizationId, user.organizationId))).limit(1);
  const inv = rows[0];
  if (!inv) throw new NotFoundError("Invoice tidak ditemukan");
  if (inv.status === "VOID") throw new InvalidStateError("Invoice sudah void");
  const amountNum = Number(data.amount);
  if (amountNum <= 0) throw new InvalidStateError("Jumlah refund harus positif");
  if (amountNum > Number(inv.paidAmount)) throw new InvalidStateError("Melebihi jumlah yang sudah dibayar");

  const [refund] = await db().insert(s.payments).values({
    organizationId: user.organizationId, branchId: user.branchId ?? "", invoiceId: data.invoiceId, paymentNumber: `REF-${Date.now()}`, paymentMethod: "REFUND", amount: `-${data.amount}`, referenceNumber: data.reason, status: "COMPLETED", receivedBy: user.id,
  }).returning({ id: s.payments.id });

  const newPaid = String(Number(inv.paidAmount) - amountNum);
  const newStatus = Number(newPaid) <= 0 ? "REFUNDED" : "PARTIAL_PAID";
  await db().update(s.invoices).set({ paidAmount: newPaid, status: newStatus, updatedAt: new Date() }).where(eq(s.invoices.id, data.invoiceId));

  await writeAuditLog({ user, action: "PROCESS_REFUND", entityType: "invoices", entityId: data.invoiceId, newData: { refundId: refund.id, amount: data.amount, reason: data.reason } });
  return refund;
}

export async function listServiceItems(user: SessionUser) {
  return db()
    .select({ id: s.services.id, code: s.services.code, name: s.services.name, price: s.services.price, category: s.serviceCategories.name, status: s.services.status })
    .from(s.services)
    .leftJoin(s.serviceCategories, eq(s.serviceCategories.id, s.services.categoryId))
    .where(and(eq(s.services.organizationId, user.organizationId), eq(s.services.status, "ACTIVE")))
    .orderBy(s.services.name);
}

export async function listPayments(user: SessionUser, invoiceId?: string) {
  const conditions = [eq(s.payments.organizationId, user.organizationId)];
  if (invoiceId) conditions.push(eq(s.payments.invoiceId, invoiceId));
  return db().select().from(s.payments).where(and(...conditions)).orderBy(desc(s.payments.paymentDate));
}

export async function listPaymentsDetailed(user: SessionUser) {
  return db()
    .select({
      id: s.payments.id,
      paymentNumber: s.payments.paymentNumber,
      paymentDate: s.payments.paymentDate,
      amount: s.payments.amount,
      paymentMethod: s.payments.paymentMethod,
      referenceNumber: s.payments.referenceNumber,
      status: s.payments.status,
      invoiceId: s.payments.invoiceId,
      invoiceNumber: s.invoices.invoiceNumber,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
    })
    .from(s.payments)
    .leftJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId))
    .leftJoin(s.patients, eq(s.patients.id, s.invoices.patientId))
    .where(and(eq(s.payments.organizationId, user.organizationId), sql`${s.payments.paymentMethod} <> 'REFUND'`))
    .orderBy(desc(s.payments.paymentDate));
}

export async function listRefunds(user: SessionUser) {
  return db()
    .select({
      id: s.payments.id,
      refundNumber: s.payments.paymentNumber,
      refundDate: s.payments.paymentDate,
      amount: s.payments.amount,
      reason: s.payments.referenceNumber,
      status: s.payments.status,
      invoiceId: s.payments.invoiceId,
      invoiceNumber: s.invoices.invoiceNumber,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
    })
    .from(s.payments)
    .leftJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId))
    .leftJoin(s.patients, eq(s.patients.id, s.invoices.patientId))
    .where(and(eq(s.payments.organizationId, user.organizationId), eq(s.payments.paymentMethod, "REFUND")))
    .orderBy(desc(s.payments.paymentDate));
}