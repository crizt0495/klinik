import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { createAppointment, getAppointment } from "@/features/appointments/service";
import {
  registerVisit, listVisits, getVisit, startVisit, completeVisit, cancelVisit,
  getMedicalRecord, createOrUpdateSoap, addDiagnoses, addProcedures, addVitalSigns,
  finalizeMedicalRecord, amendMedicalRecord, getMedicalRecordVersions, createPrescription,
} from "@/features/visits/service";
import { InvalidStateError, NotFoundError } from "@/lib/errors";

let admin: SessionUser;
let doctor: SessionUser;
let receptionist: SessionUser;
let doctorId: string;
let departmentId: string;
let diagnosisId: string;
let procedureId: string;
let medicationId: string;

function nextMonday(): string {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

async function newVisit(name: string) {
  const patient = await createPatient(receptionist, { fullName: name, gender: "FEMALE" });
  const res = await registerVisit(receptionist, { patientId: patient.id, doctorId, departmentId, chiefComplaint: "Keluhan uji" });
  return { patient, ...res };
}

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  doctor = (await loginWithPassword("doctor", "Doctor@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  doctorId = (await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1))[0].id;
  departmentId = (await db().select({ id: s.departments.id }).from(s.departments).where(and(eq(s.departments.organizationId, admin.organizationId), eq(s.departments.code, "UMUM"))).limit(1))[0].id;
  diagnosisId = (await db().select({ id: s.diagnoses.id }).from(s.diagnoses).where(eq(s.diagnoses.organizationId, admin.organizationId)).limit(1))[0].id;
  procedureId = (await db().select({ id: s.procedures.id }).from(s.procedures).where(eq(s.procedures.organizationId, admin.organizationId)).limit(1))[0].id;
  medicationId = (await db().select({ id: s.medications.id }).from(s.medications).where(eq(s.medications.organizationId, admin.organizationId)).limit(1))[0].id;
}, 120000);

describe("modul kunjungan & rekam medis", () => {
  it("1. registerVisit membuat kunjungan CHECKED_IN + antrian WAITING", async () => {
    const { visit, queue } = await newVisit("Kunjungan Dasar");
    expect(visit.status).toBe("CHECKED_IN");
    expect(visit.visitNumber).toBeTruthy();
    expect(queue.status).toBe("WAITING");
  });

  it("2. registerVisit dengan appointment menandai appointment CHECKED_IN", async () => {
    const patient = await createPatient(receptionist, { fullName: "Kunjungan Via Appt", gender: "MALE" });
    const appt = await createAppointment(receptionist, { patientId: patient.id, doctorId, departmentId, appointmentDate: nextMonday(), startTime: "08:00:00", endTime: "08:15:00" });
    await registerVisit(receptionist, { patientId: patient.id, doctorId, departmentId, appointmentId: appt.id });
    expect((await getAppointment(admin, appt.id)).status).toBe("CHECKED_IN");
  });

  it("3. startVisit mengubah status ke IN_PROGRESS", async () => {
    const { visit } = await newVisit("Kunjungan Mulai");
    await startVisit(doctor, visit.id);
    expect((await getVisit(doctor, visit.id)).status).toBe("IN_PROGRESS");
  });

  it("4. startVisit pada kunjungan yang sudah berjalan ditolak", async () => {
    const { visit } = await newVisit("Kunjungan Mulai Ganda");
    await startVisit(doctor, visit.id);
    await expect(startVisit(doctor, visit.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("5. completeVisit sebelum berjalan ditolak", async () => {
    const { visit } = await newVisit("Kunjungan Selesai Dini");
    await expect(completeVisit(doctor, visit.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("6. completeVisit menyelesaikan kunjungan", async () => {
    const { visit } = await newVisit("Kunjungan Selesai");
    await startVisit(doctor, visit.id);
    await completeVisit(doctor, visit.id);
    expect((await getVisit(doctor, visit.id)).status).toBe("COMPLETED");
  });

  it("7. cancelVisit membatalkan kunjungan, pembatalan ulang ditolak", async () => {
    const { visit } = await newVisit("Kunjungan Batal");
    await cancelVisit(receptionist, visit.id);
    expect((await getVisit(admin, visit.id)).status).toBe("CANCELLED");
    await expect(cancelVisit(receptionist, visit.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("8. cancelVisit pada kunjungan selesai ditolak", async () => {
    const { visit } = await newVisit("Kunjungan Selesai Batal");
    await startVisit(doctor, visit.id);
    await completeVisit(doctor, visit.id);
    await expect(cancelVisit(receptionist, visit.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("9. SOAP draft lalu finalisasi menjadi FINALIZED", async () => {
    const { visit } = await newVisit("Kunjungan SOAP");
    const soap = await createOrUpdateSoap(doctor, visit.id, { subjective: "Demam", objective: "Suhu 38", assessment: "ISPA", plan: "Istirahat" });
    expect(soap.status).toBe("DRAFT");
    await finalizeMedicalRecord(doctor, visit.id);
    expect((await getMedicalRecord(doctor, visit.id))?.status).toBe("FINALIZED");
  });

  it("10. mengubah SOAP yang sudah finalisasi ditolak", async () => {
    const { visit } = await newVisit("Kunjungan SOAP Final");
    await createOrUpdateSoap(doctor, visit.id, { subjective: "A" });
    await finalizeMedicalRecord(doctor, visit.id);
    await expect(createOrUpdateSoap(doctor, visit.id, { subjective: "B" })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("11. amend rekam medis final mengembalikan ke DRAFT + versi tersimpan", async () => {
    const { visit } = await newVisit("Kunjungan Amend");
    const soap = await createOrUpdateSoap(doctor, visit.id, { subjective: "Awal", assessment: "Diagnosa A" });
    await finalizeMedicalRecord(doctor, visit.id);
    await amendMedicalRecord(doctor, visit.id, "Koreksi hasil lab", { assessment: "Diagnosa B" });
    const mr = await getMedicalRecord(doctor, visit.id);
    expect(mr?.status).toBe("DRAFT");
    const versions = await getMedicalRecordVersions(doctor, soap.id);
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  it("12. amend rekam medis yang belum final ditolak", async () => {
    const { visit } = await newVisit("Kunjungan Amend Dini");
    await createOrUpdateSoap(doctor, visit.id, { subjective: "Draft" });
    await expect(amendMedicalRecord(doctor, visit.id, "x", { subjective: "y" })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("13. addDiagnoses tercermin pada detail kunjungan", async () => {
    const { visit } = await newVisit("Kunjungan Diagnosa");
    const soap = await createOrUpdateSoap(doctor, visit.id, { subjective: "Batuk" });
    await addDiagnoses(doctor, soap.id, [{ diagnosisId, diagnosisType: "PRIMARY", notes: "Utama" }]);
    const detail = await getVisit(doctor, visit.id);
    expect(detail.diagnoses).toHaveLength(1);
    expect(detail.diagnoses[0].diagnosisId).toBe(diagnosisId);
  });

  it("14. addProcedures tercermin pada detail kunjungan", async () => {
    const { visit } = await newVisit("Kunjungan Prosedur");
    const soap = await createOrUpdateSoap(doctor, visit.id, { subjective: "Nyeri" });
    await addProcedures(doctor, soap.id, [{ procedureId, quantity: 2, price: "75000" }]);
    const detail = await getVisit(doctor, visit.id);
    expect(detail.procedures).toHaveLength(1);
    expect(detail.procedures[0].quantity).toBe(2);
  });

  it("15. addVitalSigns tercermin sebagai tanda vital terbaru", async () => {
    const { visit } = await newVisit("Kunjungan Vital");
    await startVisit(doctor, visit.id);
    await addVitalSigns(doctor, visit.id, { temperature: "37.5", systolic: 120, diastolic: 80, heartRate: 80, respiratoryRate: 18, oxygenSaturation: "98", weight: "60", height: "165" });
    const detail = await getVisit(doctor, visit.id);
    expect(detail.vitalSigns).toBeTruthy();
  });

  it("16. getMedicalRecord null untuk kunjungan tanpa RM", async () => {
    const { visit } = await newVisit("Kunjungan Tanpa RM");
    expect(await getMedicalRecord(doctor, visit.id)).toBeNull();
  });

  it("17. finalisasi tanpa rekam medis ditolak", async () => {
    const { visit } = await newVisit("Kunjungan Final Kosong");
    await expect(finalizeMedicalRecord(doctor, visit.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("18. createPrescription membuat resep ISSUED", async () => {
    const { visit, patient } = await newVisit("Kunjungan Resep");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId, quantity: 5 }]);
    expect(rx.status).toBe("ISSUED");
    expect(rx.prescriptionNumber).toMatch(/^RX-/);
  });

  it("19. listVisits memuat kunjungan berdasarkan tanggal", async () => {
    const { visit } = await newVisit("Kunjungan List");
    const list = await listVisits(admin);
    expect(list.some((v) => v.id === visit.id)).toBe(true);
  });

  it("20. getVisit tidak ditemukan menolak 404", async () => {
    await expect(getVisit(doctor, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });
});
