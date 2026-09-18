import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { registerVisit } from "@/features/visits/service";
import { createInvoiceForVisit, getInvoice, processPayment, processRefund, listInvoices, listPayments, listServiceItems } from "@/features/billing/service";
import { InvalidStateError, NotFoundError } from "@/lib/errors";

let admin: SessionUser;
let receptionist: SessionUser;
let cashier: SessionUser;
let doctorId: string;
let departmentId: string;
let serviceId: string;
let servicePrice: string;

async function newVisit(name: string) {
  const patient = await createPatient(receptionist, { fullName: name, gender: "MALE" });
  const res = await registerVisit(receptionist, { patientId: patient.id, doctorId, departmentId });
  return res.visit;
}

async function newInvoice(name: string, qty = 1) {
  const visit = await newVisit(name);
  const invoice = await createInvoiceForVisit(cashier, {
    visitId: visit.id,
    items: [{ serviceItemId: serviceId, description: "Konsultasi Dokter", quantity: qty, unitPrice: Number(servicePrice) }],
  });
  return invoice.id;
}

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  cashier = (await loginWithPassword("cashier", "Cashier@2026")).sessionUser;
  doctorId = (await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1))[0].id;
  departmentId = (await db().select({ id: s.departments.id }).from(s.departments).where(and(eq(s.departments.organizationId, admin.organizationId), eq(s.departments.code, "UMUM"))).limit(1))[0].id;
  const services = await listServiceItems(cashier);
  const primary = services.find((sv) => sv.code === "SVC-001") ?? services[0];
  serviceId = primary.id;
  servicePrice = primary.price;
}, 120000);

describe("modul billing & pembayaran", () => {
  it("1. membuat invoice untuk kunjungan (ISSUED, total dari item)", async () => {
    const visit = await newVisit("Billing Dasar");
    const invoice = await createInvoiceForVisit(cashier, {
      visitId: visit.id,
      items: [{ serviceItemId: serviceId, description: "Konsultasi", quantity: 2, unitPrice: 50000 }],
    });
    const detail = await getInvoice(cashier, invoice.id);
    expect(detail.invoice.status).toBe("ISSUED");
    expect(detail.invoice.total).toBe("100000");
    expect(detail.invoice.paidAmount).toBe("0");
    expect(detail.invoice.invoiceNumber).toMatch(/^INV-/);
  });

  it("2. getInvoice mengembalikan item & daftar pembayaran", async () => {
    const id = await newInvoice("Billing Struktur");
    const detail = await getInvoice(cashier, id);
    expect(detail.items.length).toBe(1);
    expect(Array.isArray(detail.payments)).toBe(true);
    expect(detail.patientName).toBe("Billing Struktur");
  });

  it("3. invoice ganda untuk satu kunjungan ditolak", async () => {
    const visit = await newVisit("Billing Ganda");
    const items = [{ serviceItemId: serviceId, description: "Konsultasi", quantity: 1, unitPrice: 50000 }];
    await createInvoiceForVisit(cashier, { visitId: visit.id, items });
    await expect(createInvoiceForVisit(cashier, { visitId: visit.id, items })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("4. invoice tanpa item ditolak", async () => {
    const visit = await newVisit("Billing Tanpa Item");
    await expect(createInvoiceForVisit(cashier, { visitId: visit.id, items: [] })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("5. invoice untuk kunjungan tidak ada ditolak", async () => {
    await expect(
      createInvoiceForVisit(cashier, { visitId: "00000000-0000-0000-0000-000000000000", items: [{ serviceItemId: serviceId, description: "x", quantity: 1, unitPrice: 10000 }] }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("6. pembayaran sebagian menghasilkan PARTIAL_PAID", async () => {
    const id = await newInvoice("Billing Partial");
    await processPayment(cashier, { invoiceId: id, method: "CASH", amount: "60000" });
    const detail = await getInvoice(cashier, id);
    expect(detail.invoice.status).toBe("PARTIAL_PAID");
    expect(detail.invoice.paidAmount).toBe("60000");
  });

  it("7. pembayaran melebihi tagihan ditolak", async () => {
    const id = await newInvoice("Billing Overpay");
    await expect(processPayment(cashier, { invoiceId: id, method: "CASH", amount: String(Number(servicePrice) + 1000) })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("8. pembayaran penuh menghasilkan PAID", async () => {
    const id = await newInvoice("Billing Lunas");
    await processPayment(cashier, { invoiceId: id, method: "TRANSFER", amount: servicePrice });
    expect((await getInvoice(cashier, id)).invoice.status).toBe("PAID");
  });

  it("9. refund melebihi jumlah dibayar ditolak", async () => {
    const id = await newInvoice("Billing Refund Salah");
    await processPayment(cashier, { invoiceId: id, method: "CASH", amount: "50000" });
    await expect(processRefund(cashier, { invoiceId: id, amount: String(Number(servicePrice)), reason: "x" })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("10. refund penuh mengubah status menjadi REFUNDED", async () => {
    const id = await newInvoice("Billing Refund Penuh");
    await processPayment(cashier, { invoiceId: id, method: "CASH", amount: servicePrice });
    await processRefund(cashier, { invoiceId: id, amount: servicePrice, reason: "Batal" });
    const detail = await getInvoice(cashier, id);
    expect(detail.invoice.status).toBe("REFUNDED");
    expect(detail.payments.some((p) => p.paymentMethod === "REFUND")).toBe(true);
  });

  it("11. listInvoices dapat difilter status PAID", async () => {
    const id = await newInvoice("Billing Filter");
    await processPayment(cashier, { invoiceId: id, method: "CASH", amount: servicePrice });
    const paid = await listInvoices(cashier, "PAID");
    expect(paid.some((inv) => inv.id === id)).toBe(true);
  });

  it("12. listPayments dapat difilter per invoice", async () => {
    const id = await newInvoice("Billing Payment List");
    await processPayment(cashier, { invoiceId: id, method: "CASH", amount: "30000" });
    const payments = await listPayments(cashier, id);
    expect(payments.length).toBeGreaterThanOrEqual(1);
    expect(payments.every((p) => p.invoiceId === id)).toBe(true);
  });

  it("13. getInvoice tidak ditemukan menolak 404", async () => {
    await expect(getInvoice(cashier, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });
});
