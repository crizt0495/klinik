import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient, getPatientDetail } from "@/features/patients/service";
import { createAppointment, updateAppointmentStatus, getAppointment } from "@/features/appointments/service";
import { registerVisit, startVisit, completeVisit, cancelVisit, createOrUpdateSoap, addDiagnoses, addProcedures, addVitalSigns, finalizeMedicalRecord, getMedicalRecord, createPrescription, getVisit } from "@/features/visits/service";
import { updateQueueStatus, getQueue, getQueueStatsToday } from "@/features/queue/service";
import { getPrescription, dispensePrescriptionItem, listPharmacyQueue } from "@/features/pharmacy/service";
import { createInvoiceForVisit, processPayment, processRefund, getInvoice, listServiceItems } from "@/features/billing/service";
import { createLabOrder, completeLabOrder, listLabOrders, createRadiologyOrder, listRadiologyOrders } from "@/features/labs/service";
import { createStockOpname, createPurchaseOrder, receivePurchaseOrder, listPurchaseOrders, getPurchaseOrder, listSuppliers, listInventory } from "@/features/inventory/service";
import { listUsers, createUser, listRoles, getRolePermissions, assignRolePermissions, assignUserRole } from "@/features/admin/service";
import { getDashboardStats } from "@/features/dashboard/queries";
import { getMonthlyRevenue } from "@/features/reports/service";
import { NotFoundError, InvalidStateError, ConflictError, InsufficientStockError, ValidationError } from "@/lib/errors";

let admin: SessionUser;
let doctor: SessionUser;
let pharmacist: SessionUser;
let cashier: SessionUser;
let receptionist: SessionUser;
let labUser: SessionUser;
let radUser: SessionUser;

let seededDoctorId: string;
let seededDepartmentId: string;
let seededDiagnosisId: string;
let seededProcedureId: string;
let seededMedId: string;
let seededBatchId: string;
let seededServiceId: string;
let seededSupplierId: string;

async function session(username: string, password: string): Promise<SessionUser> {
  return (await loginWithPassword(username, password)).sessionUser;
}

function nextMonday(): string {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  await initDb();
  admin = await session("admin", "Admin@2026");
  doctor = await session("doctor", "Doctor@2026");
  pharmacist = await session("pharmacist", "Pharmacist@2026");
  cashier = await session("cashier", "Cashier@2026");
  receptionist = await session("receptionist", "Receptionist@2026");
  labUser = await session("lab", "Lab@2026");
  radUser = await session("radiology", "Radiology@2026");

  const doctorRow = await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1);
  seededDoctorId = doctorRow[0].id;
  const deptRow = await db().select().from(s.departments).where(and(eq(s.departments.organizationId, admin.organizationId), eq(s.departments.code, "UMUM"))).limit(1);
  seededDepartmentId = deptRow[0].id;
  const diagRow = await db().select().from(s.diagnoses).where(eq(s.diagnoses.organizationId, admin.organizationId)).limit(1);
  seededDiagnosisId = diagRow[0].id;
  const procRow = await db().select().from(s.procedures).where(eq(s.procedures.organizationId, admin.organizationId)).limit(1);
  seededProcedureId = procRow[0].id;
  const medRow = await db().select().from(s.medications).where(eq(s.medications.organizationId, admin.organizationId)).orderBy(asc(s.medications.code)).limit(1);
  seededMedId = medRow[0].id;
  const batchRow = await db().select().from(s.inventoryBatches).where(eq(s.inventoryBatches.medicationId, seededMedId)).orderBy(asc(s.inventoryBatches.expiryDate)).limit(1);
  seededBatchId = batchRow[0].id;
  const svcRow = await db().select().from(s.services).where(eq(s.services.organizationId, admin.organizationId)).limit(1);
  seededServiceId = svcRow[0].id;
  const supRow = await db().select().from(s.suppliers).where(eq(s.suppliers.organizationId, admin.organizationId)).limit(1);
  seededSupplierId = supRow[0].id;
}, 120000);

describe("alur end-to-end: pasien → appointment → kunjungan → RM → resep → farmasi → billing → lab → radiologi → inventory → admin → laporan", () => {
  it("1. membuat pasien baru (MRN otomatis)", async () => {
    const patient = await createPatient(receptionist, {
      fullName: "Test Pasien E2E",
      nik: "3273010101010001",
      birthDate: "1990-05-05",
      gender: "MALE",
      phone: "08123456099",
    });
    expect(patient).toHaveProperty("id");
    const detail = await getPatientDetail(admin, patient.id);
    expect(detail.patient.medicalRecordNumber).toMatch(/^MR-\d{4}-\d{6}$/);
  });

  it("2. membuat appointment dengan jadwal dokter", async () => {
    const date = nextMonday();
    const appt = await createAppointment(receptionist, {
      patientId: (await createPatient(receptionist, { fullName: "Pasien Janji", gender: "FEMALE" })).id,
      doctorId: seededDoctorId,
      departmentId: seededDepartmentId,
      appointmentDate: date,
      startTime: "08:30:00",
      endTime: "08:45:00",
      appointmentType: "KONSULTASI",
    });
    const fetched = await getAppointment(admin, appt.id);
    expect(fetched.status).toBe("SCHEDULED");
    await updateAppointmentStatus(receptionist, appt.id, "CONFIRMED");
    expect((await getAppointment(admin, appt.id)).status).toBe("CONFIRMED");
  });

  it("3. daftar kunjungan (buat antrian) lalu alur antrian", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien Berobat", gender: "MALE" });
    const res = await registerVisit(receptionist, {
      patientId: patient.id,
      doctorId: seededDoctorId,
      departmentId: seededDepartmentId,
      chiefComplaint: "Demam dan batuk sejak 2 hari",
    });
    expect(res.visit.status).toBe("CHECKED_IN");
    expect(res.queue.status).toBe("WAITING");

    const q = await updateQueueStatus(doctor, res.queue.id, "CALLED");
    expect(q.status).toBe("CALLED");
    await updateQueueStatus(doctor, res.queue.id, "SERVING");
    await updateQueueStatus(doctor, res.queue.id, "COMPLETED");
    expect((await getQueue(admin, res.queue.id)).status).toBe("COMPLETED");
    const stats = await getQueueStatsToday(admin, seededDepartmentId);
    expect(stats.some((r) => r.status === "COMPLETED")).toBe(true);

    await startVisit(doctor, res.visit.id);
    expect((await getVisit(doctor, res.visit.id)).status).toBe("IN_PROGRESS");
  });

  it("4. menulis rekam medis: SOAP, diagnosa, prosedur, vital signs, finalisasi", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien RM", gender: "FEMALE" });
    const res = await registerVisit(receptionist, { patientId: patient.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    await startVisit(doctor, res.visit.id);

    const soap = await createOrUpdateSoap(doctor, res.visit.id, {
      subjective: "Demam 38C, batuk berdahak",
      objective: "TD 110/70, RR 20",
      assessment: "ISPA akut",
      plan: "Parasetamol + antibiotik, kontrol 3 hari",
    });
    expect(soap.status).toBe("DRAFT");

    await addDiagnoses(doctor, soap.id, [{ diagnosisId: seededDiagnosisId, diagnosisType: "PRIMARY", notes: "Diagnosis utama" }]);
    await addProcedures(doctor, soap.id, [{ procedureId: seededProcedureId, quantity: 1, price: "150000" }]);
    await addVitalSigns(doctor, res.visit.id, { temperature: "38.2", systolic: 110, diastolic: 70, heartRate: 88, respiratoryRate: 20, oxygenSaturation: "97", weight: "62", height: "170" });
    await finalizeMedicalRecord(doctor, res.visit.id);

    const mr = await getMedicalRecord(doctor, res.visit.id);
    expect(mr?.status).toBe("FINALIZED");
  });

  it("5. menulis resep dan mendispense FEFO (stok berkurang)", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien Resep", gender: "MALE" });
    const res = await registerVisit(receptionist, { patientId: patient.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    await startVisit(doctor, res.visit.id);

    const rx = await createPrescription(doctor, res.visit.id, patient.id, seededDoctorId, [
      { medicationId: seededMedId, quantity: 10, dosage: "1x sehari", frequency: "Setelah makan", route: "Oral", duration: "5 hari", instructions: "Diminum pagi" },
    ]);
    expect(rx.status).toBe("ISSUED");

    const beforeQty = (await listInventory(admin)).find((i) => i.batchId === seededBatchId)?.quantityAvailable ?? 0;
    const rxDetail = await getPrescription(pharmacist, rx.id);
    expect(rxDetail.items).toHaveLength(1);
    await dispensePrescriptionItem(pharmacist, rxDetail.items[0].id);

    const after = await getPrescription(pharmacist, rx.id);
    expect(after.items[0].status).toBe("DISPENSED");
    expect(after.items[0].dispensedQuantity).toBe(10);
    expect(after.prescription.status).toBe("DISPENSED");
    const afterQty = (await listInventory(admin)).find((i) => i.batchId === seededBatchId)?.quantityAvailable ?? 0;
    expect(afterQty).toBe(beforeQty - 10);
    const pq = await listPharmacyQueue(pharmacist);
    expect(pq.find((p) => p.id === rx.id)).toBeUndefined();
  });

  it("6. tokcer: dispensing gagal saat stok tidak mencukupi", async () => {
    const catRow = await db().select().from(s.medicationCategories).where(eq(s.medicationCategories.organizationId, admin.organizationId)).limit(1);
    const [newMed] = await db().insert(s.medications).values({
      organizationId: admin.organizationId, categoryId: catRow[0].id, code: "OBT-E2E-NS", name: "Obat Tanpa Stok", genericName: "No Stock", dosageForm: "Tablet", strength: "10mg", unit: "strip", sellingPrice: "20000", purchasePrice: "12000", minimumStock: 5, status: "ACTIVE",
    }).returning();

    const patient = await createPatient(receptionist, { fullName: "Pasien Tanpa Stok", gender: "FEMALE" });
    const res = await registerVisit(receptionist, { patientId: patient.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    const rx = await createPrescription(doctor, res.visit.id, patient.id, seededDoctorId, [{ medicationId: newMed.id, quantity: 3 }]);
    const rxDetail = await getPrescription(pharmacist, rx.id);
    await expect(dispensePrescriptionItem(pharmacist, rxDetail.items[0].id)).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("7. billing: invoice, pembayaran 2x, refund", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien Billing", gender: "MALE" });
    const res = await registerVisit(receptionist, { patientId: patient.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    await startVisit(doctor, res.visit.id);
    await completeVisit(doctor, res.visit.id);

    const services = await listServiceItems(cashier);
    const konsultasi = services.find((sv) => sv.code === "SVC-001");
    const invoice = await createInvoiceForVisit(cashier, {
      visitId: res.visit.id,
      items: [{ serviceItemId: konsultasi?.id ?? seededServiceId, description: "Konsultasi Dokter Umum", quantity: 1, unitPrice: Number(konsultasi?.price ?? "100000") }],
    });
    expect(invoice).toHaveProperty("id");
    const inv1 = await getInvoice(cashier, invoice.id);
    expect(inv1.invoice.status).toBe("ISSUED");
    expect(inv1.invoice.total).toBe("100000");

    // Bayar 60rb → PARTIAL_PAID
    await processPayment(cashier, { invoiceId: invoice.id, method: "CASH", amount: "60000" });
    expect((await getInvoice(cashier, invoice.id)).invoice.status).toBe("PARTIAL_PAID");
    expect((await getInvoice(cashier, invoice.id)).invoice.paidAmount).toBe("60000");

    // Bayar 40rb → PAID
    await processPayment(cashier, { invoiceId: invoice.id, method: "CASH", amount: "40000" });
    expect((await getInvoice(cashier, invoice.id)).invoice.status).toBe("PAID");

    // Overpay ditolak
    await expect(processPayment(cashier, { invoiceId: invoice.id, method: "CASH", amount: "1000" })).rejects.toBeInstanceOf(InvalidStateError);

    // Refund 50000 → paidAmount 50000, PARTIAL_PAID
    await processRefund(cashier, { invoiceId: invoice.id, amount: "50000", reason: "Kelebihan bayar" });
    const invFinal = await getInvoice(cashier, invoice.id);
    expect(invFinal.invoice.status).toBe("PARTIAL_PAID");
    expect(invFinal.invoice.paidAmount).toBe("50000");
    expect(invFinal.payments.some((p) => p.paymentMethod === "REFUND")).toBe(true);
  });

  it("8. lab: order + hasil; radiologi: order", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien Lab", gender: "FEMALE" });
    const res = await registerVisit(receptionist, { patientId: patient.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });

    const labOrder = await createLabOrder(labUser, { visitId: res.visit.id, tests: [{ testName: "Darah Lengkap", specimenType: "DARAH" }, { testName: "Gula Darah Puasa", specimenType: "DARAH" }] });
    expect(labOrder).toHaveProperty("id");
    const labOrderRow = await db().select().from(s.laboratoryOrderItems).where(eq(s.laboratoryOrderItems.laboratoryOrderId, labOrder.id)).orderBy(asc(s.laboratoryOrderItems.testName));
    expect(labOrderRow).toHaveLength(2);
    await completeLabOrder(labUser, labOrder.id, labOrderRow.map((t) => ({ labOrderTestId: t.id, resultValue: "Normal", unit: "-", referenceRange: "Normal", flags: "NORMAL" })));
    const orders = await listLabOrders(labUser);
    expect(orders.find((o) => o.id === labOrder.id)?.status).toBe("COMPLETED");

    const radOrder = await createRadiologyOrder(radUser, { visitId: res.visit.id, images: [{ examType: "X-Ray Thorax", bodyPart: "DADA", modality: "X-RAY" }] });
    expect(radOrder).toHaveProperty("id");
    const radOrders = await listRadiologyOrders(radUser);
    expect(radOrders.find((o) => o.id === radOrder.id)?.status).toBe("ORDERED");
  });

  it("9. inventory: opname, pembelian (PO) dan penerimaan", async () => {
    const inv = await listInventory(admin);
    const target = inv.find((i) => i.batchId === seededBatchId);
    await createStockOpname(admin, seededMedId, seededBatchId, (target?.quantityAvailable ?? 50) + 5, "Cek fisik E2E");
    const after = (await listInventory(admin)).find((i) => i.batchId === seededBatchId);
    expect(after?.quantityAvailable).toBe((target?.quantityAvailable ?? 50) + 5);

    const poId = await createPurchaseOrder(admin, { supplierId: seededSupplierId, expectedDate: new Date().toISOString().slice(0, 10), notes: "PO E2E", items: [{ medicationId: seededMedId, quantity: 20, unitPrice: 3000 }] });
    const po = await getPurchaseOrder(admin, poId);
    expect(po.po.status).toBe("DRAFT");
    await receivePurchaseOrder(admin, poId, [{ itemId: po.items[0].id, quantityReceived: 20 }]);
    expect((await getPurchaseOrder(admin, poId)).po.status).toBe("RECEIVED");
    const pos = await listPurchaseOrders(admin);
    expect(pos.find((p) => p.id === poId)?.status).toBe("RECEIVED");
  });

  it("10. admin: buat user, tetapkan role & permission", async () => {
    const created = await createUser(admin, { username: "e2e.user", fullName: "User E2E", password: "E2E@2026" });
    expect(created).toHaveProperty("id");
    const roles = await listRoles(admin);
    const kasirRole = roles.find((r) => r.code === "KASIR");
    expect(kasirRole).toBeDefined();
    await assignUserRole(admin, created.id, [kasirRole!.id]);
    const permRow = await db().select({ id: s.permissions.id }).from(s.permissions).where(eq(s.permissions.code, "billing.view")).limit(1);
    expect(permRow[0]).toBeDefined();
    const billingViewId = permRow[0].id;
    const permsBefore = (await getRolePermissions(admin, kasirRole!.id)).map((p) => p.permissionId);
    if (!permsBefore.includes(billingViewId)) {
      await assignRolePermissions(admin, kasirRole!.id, [...permsBefore, billingViewId]);
    }
    expect((await getRolePermissions(admin, kasirRole!.id)).some((p) => p.permissionId === billingViewId)).toBe(true);
    const users = await listUsers(admin);
    expect(users.some((u) => u.username === "e2e.user")).toBe(true);
  });

  it("11. laporan & dashboard", async () => {
    const stats = await getDashboardStats(admin);
    expect(stats.totalPatients).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(stats.recentActivity)).toBe(true);
    const monthly = await getMonthlyRevenue(admin, 2026);
    expect(Array.isArray(monthly)).toBe(true);
  });

  it("12. validasi lintas modul: invoice ganda & urutan antrian salah ditolak", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien Cek Ganda", gender: "MALE" });
    const res = await registerVisit(receptionist, { patientId: patient.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    const services = await listServiceItems(cashier);
    await createInvoiceForVisit(cashier, { visitId: res.visit.id, items: [{ serviceItemId: services[0].id, description: "Konsultasi", quantity: 1, unitPrice: 50000 }] });
    await expect(createInvoiceForVisit(cashier, { visitId: res.visit.id, items: [{ serviceItemId: services[0].id, description: "Konsultasi", quantity: 1, unitPrice: 50000 }] })).rejects.toBeInstanceOf(InvalidStateError);

    const q = await updateQueueStatus(doctor, res.queue.id, "CALLED");
    expect(q.status).toBe("CALLED");
    await expect(updateQueueStatus(doctor, res.queue.id, "COMPLETED")).rejects.toBeInstanceOf(ConflictError);
  });

  it("13. pembatalan kunjungan valid & invalid", async () => {
    const patient = await createPatient(receptionist, { fullName: "Pasien Batal", gender: "FEMALE" });
    const res = await registerVisit(receptionist, { patientId: patient.id, doctorId: seededDoctorId, departmentId: seededDepartmentId });
    await cancelVisit(receptionist, res.visit.id);
    expect((await getVisit(admin, res.visit.id)).status).toBe("CANCELLED");
    await expect(cancelVisit(receptionist, res.visit.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("14. akses service ke data yang tidak ada / bukan milik org ditolak (404)", async () => {
    const patient = await createPatient(admin, { fullName: "Pasien Referensi", gender: "MALE" });
    await expect(getVisit(doctor, patient.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});