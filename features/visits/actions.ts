"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError, ValidationError, formatZodError } from "@/lib/errors";
import * as svc from "./service";

const uuid = z.string().uuid("ID tidak valid");
const str = (max: number) => z.string().max(max).optional().or(z.literal(""));

const registerSchema = z.object({
  patientId: uuid,
  doctorId: uuid,
  departmentId: uuid,
  appointmentId: uuid.optional().or(z.literal("")),
  chiefComplaint: str(2000),
  priority: z.enum(["NORMAL", "PRIORITY", "EMERGENCY"]).optional().default("NORMAL"),
});

const soapSchema = z.object({
  visitId: uuid,
  subjective: str(4000),
  objective: str(4000),
  assessment: str(4000),
  plan: str(4000),
});

const addDiagSchema = z.object({
  medicalRecordId: uuid,
  diagnosisId: uuid,
  diagnosisType: z.string().max(16).optional().default("PRIMARY"),
  notes: str(500),
});

const addProcSchema = z.object({
  medicalRecordId: uuid,
  procedureId: uuid,
  quantity: z.coerce.number().int().min(1).default(1),
  price: z.string(),
  notes: str(500),
});

const amendSchema = z.object({
  visitId: uuid,
  reason: z.string().min(3, "Alasan amend wajib diisi").max(2000),
  subjective: str(4000),
  objective: str(4000),
  assessment: str(4000),
  plan: str(4000),
});

const prescriptionSchema = z.object({
  visitId: uuid,
  patientId: uuid,
  doctorId: uuid,
  medicationId: uuid,
  quantity: z.coerce.number().int().min(1),
  dosage: str(64),
  frequency: str(64),
  route: z.string().max(64).optional().default("ORAL"),
  duration: str(64),
  instructions: str(500),
  notes: str(500),
});

const vitalSignsSchema = z.object({
  visitId: uuid,
  temperature: str(16),
  systolic: str(16),
  diastolic: str(16),
  heartRate: str(16),
  respiratoryRate: str(16),
  oxygenSaturation: str(16),
  weight: str(16),
  height: str(16),
  painScale: str(16),
  notes: str(500),
});

function parse<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const p = schema.safeParse(Object.fromEntries(fd.entries()));
  if (!p.success) throw new ValidationError("Data tidak valid", formatZodError(p.error));
  return p.data;
}
function ok(): ActionState { return { success: true }; }
function fail(e: unknown): ActionState { return { error: toAppError(e).message }; }

export async function registerVisitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("queue.create");
    const d = parse(registerSchema, fd);
    await svc.registerVisit(user, { patientId: d.patientId, doctorId: d.doctorId, departmentId: d.departmentId, appointmentId: d.appointmentId || null, chiefComplaint: d.chiefComplaint, priority: d.priority });
    revalidatePath("/visits");
    revalidatePath("/queue");
    return ok();
  } catch (e) { return fail(e); }
}

export async function startVisitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.create");
    await svc.startVisit(user, String(fd.get("visitId")));
    revalidatePath("/visits");
    return ok();
  } catch (e) { return fail(e); }
}

export async function completeVisitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.update");
    await svc.completeVisit(user, String(fd.get("visitId")));
    revalidatePath("/visits");
    return ok();
  } catch (e) { return fail(e); }
}

export async function cancelVisitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.update");
    await svc.cancelVisit(user, String(fd.get("visitId")));
    revalidatePath("/visits");
    return ok();
  } catch (e) { return fail(e); }
}

export async function saveSoapAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.create");
    const d = parse(soapSchema, fd);
    await svc.createOrUpdateSoap(user, d.visitId, { subjective: d.subjective, objective: d.objective, assessment: d.assessment, plan: d.plan });
    revalidatePath(`/visits/${d.visitId}`);
    return ok();
  } catch (e) { return fail(e); }
}

export async function finalizeMedicalRecordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.finalize");
    await svc.finalizeMedicalRecord(user, String(fd.get("visitId")));
    revalidatePath(`/visits/${String(fd.get("visitId"))}`);
    return ok();
  } catch (e) { return fail(e); }
}

export async function amendMedicalRecordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.amend");
    const d = parse(amendSchema, fd);
    await svc.amendMedicalRecord(user, d.visitId, d.reason, { subjective: d.subjective, objective: d.objective, assessment: d.assessment, plan: d.plan });
    revalidatePath(`/visits/${d.visitId}`);
    return ok();
  } catch (e) { return fail(e); }
}

export async function addDiagnosesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.create");
    const d = parse(addDiagSchema, fd);
    await svc.addDiagnoses(user, d.medicalRecordId, [{ diagnosisId: d.diagnosisId, diagnosisType: d.diagnosisType, notes: d.notes }]);
    revalidatePath(`/visits/${String(fd.get("visitId"))}`);
    return ok();
  } catch (e) { return fail(e); }
}

export async function addProceduresAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.create");
    const d = parse(addProcSchema, fd);
    await svc.addProcedures(user, d.medicalRecordId, [{ procedureId: d.procedureId, quantity: d.quantity, price: d.price, notes: d.notes }]);
    revalidatePath(`/visits/${String(fd.get("visitId"))}`);
    return ok();
  } catch (e) { return fail(e); }
}

export async function addVitalSignsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("medical_records.create");
    const d = parse(vitalSignsSchema, fd);
    await svc.addVitalSigns(user, d.visitId, { temperature: d.temperature, systolic: d.systolic, diastolic: d.diastolic, heartRate: d.heartRate, respiratoryRate: d.respiratoryRate, oxygenSaturation: d.oxygenSaturation, weight: d.weight, height: d.height, painScale: d.painScale, notes: d.notes });
    revalidatePath(`/visits/${d.visitId}`);
    return ok();
  } catch (e) { return fail(e); }
}

export async function createPrescriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("prescriptions.create");
    const d = parse(prescriptionSchema, fd);
    await svc.createPrescription(user, d.visitId, d.patientId, d.doctorId, [{ medicationId: d.medicationId, quantity: d.quantity, dosage: d.dosage, frequency: d.frequency, route: d.route, duration: d.duration, instructions: d.instructions }], d.notes);
    revalidatePath(`/visits/${d.visitId}`);
    return ok();
  } catch (e) { return fail(e); }
}