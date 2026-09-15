"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError, ValidationError, formatZodError } from "@/lib/errors";
import { createPatient, updatePatient, deletePatient, addPatientInsurance } from "./service";

const patientSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap wajib diisi").max(255),
  nik: z.string().regex(/^\d{15,16}$/, "NIK harus 15-16 digit").optional().or(z.literal("")),
  birthPlace: z.string().max(128).optional().or(z.literal("")),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE"]),
  bloodType: z.string().max(8).optional().or(z.literal("")),
  maritalStatus: z.string().max(16).optional().or(z.literal("")),
  phone: z.string().max(32).optional().or(z.literal("")),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  address: z.string().max(2000).optional().or(z.literal("")),
  emergencyContactName: z.string().max(255).optional().or(z.literal("")),
  emergencyContactPhone: z.string().max(32).optional().or(z.literal("")),
  occupation: z.string().max(128).optional().or(z.literal("")),
});

const insuranceSchema = z.object({
  patientId: z.string().uuid(),
  insuranceProviderId: z.string().uuid(),
  memberNumber: z.string().min(3, "Nomor kartu wajib diisi").max(64),
  coverageClass: z.string().max(32).optional().or(z.literal("")),
  isPrimary: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

function parse<T extends z.ZodTypeAny>(schema: T, formData: FormData): z.infer<T> {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new ValidationError("Data tidak valid", formatZodError(parsed.error));
  return parsed.data;
}

const clean = (v: string | null | undefined) => (v == null || v === "" ? null : v);

export async function createPatientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("patients.create");
    const data = parse(patientSchema, formData);
    await createPatient(user, {
      fullName: data.fullName,
      nik: clean(data.nik),
      birthPlace: clean(data.birthPlace),
      birthDate: clean(data.birthDate),
      gender: data.gender,
      bloodType: clean(data.bloodType),
      maritalStatus: clean(data.maritalStatus),
      phone: clean(data.phone),
      email: clean(data.email),
      address: clean(data.address),
      emergencyContactName: clean(data.emergencyContactName),
      emergencyContactPhone: clean(data.emergencyContactPhone),
      occupation: clean(data.occupation),
    });
    revalidatePath("/patients");
    return { success: true };
  } catch (err) {
    const e = toAppError(err);
    return { error: e.message };
  }
}

export async function updatePatientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("patients.update");
    const id = formData.get("id") as string;
    const data = parse(patientSchema, formData);
    await updatePatient(user, id, {
      fullName: data.fullName,
      nik: clean(data.nik),
      birthPlace: clean(data.birthPlace),
      birthDate: clean(data.birthDate),
      gender: data.gender,
      bloodType: clean(data.bloodType),
      maritalStatus: clean(data.maritalStatus),
      phone: clean(data.phone),
      email: clean(data.email),
      address: clean(data.address),
      emergencyContactName: clean(data.emergencyContactName),
      emergencyContactPhone: clean(data.emergencyContactPhone),
      occupation: clean(data.occupation),
    });
    revalidatePath(`/patients/${id}`);
    revalidatePath("/patients");
    return { success: true };
  } catch (err) {
    const e = toAppError(err);
    return { error: e.message };
  }
}

export async function deletePatientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("patients.delete");
    const id = formData.get("id") as string;
    await deletePatient(user, id);
    revalidatePath("/patients");
    return { success: true };
  } catch (err) {
    const e = toAppError(err);
    return { error: e.message };
  }
}

export async function addPatientInsuranceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("patients.update");
    const data = parse(insuranceSchema, formData);
    await addPatientInsurance(user, data.patientId, { insuranceProviderId: data.insuranceProviderId, memberNumber: data.memberNumber, coverageClass: clean(data.coverageClass), isPrimary: data.isPrimary });
    revalidatePath(`/patients/${data.patientId}`);
    return { success: true };
  } catch (err) {
    const e = toAppError(err);
    return { error: e.message };
  }
}