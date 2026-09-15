"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError, ValidationError, formatZodError } from "@/lib/errors";
import { createAppointment, updateAppointmentStatus } from "./service";

const appointmentSchema = z.object({
  patientId: z.string().uuid("Pasien wajib dipilih"),
  doctorId: z.string().uuid("Dokter wajib dipilih"),
  departmentId: z.string().uuid("Poli wajib dipilih"),
  roomId: z.string().uuid().optional().or(z.literal("")),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Waktu mulai tidak valid"),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Waktu selesai tidak valid"),
  appointmentType: z.string().max(64).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

function parse<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const parsed = schema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) throw new ValidationError("Data tidak valid", formatZodError(parsed.error));
  return parsed.data;
}

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

export async function createAppointmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("appointments.create");
    const data = parse(appointmentSchema, fd);
    await createAppointment(user, {
      patientId: data.patientId,
      doctorId: data.doctorId,
      departmentId: data.departmentId,
      roomId: data.roomId || null,
      appointmentDate: data.appointmentDate,
      startTime: normalizeTime(data.startTime),
      endTime: normalizeTime(data.endTime),
      appointmentType: data.appointmentType || "REGULAR",
      notes: data.notes || null,
    });
    revalidatePath("/appointments");
    return { success: true };
  } catch (err) {
    const e = toAppError(err);
    return { error: e.message };
  }
}

export async function updateAppointmentStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("appointments.update");
    const data = parse(statusSchema, fd);
    await updateAppointmentStatus(user, data.id, data.status, data.notes || null);
    revalidatePath("/appointments");
    return { success: true };
  } catch (err) {
    const e = toAppError(err);
    return { error: e.message };
  }
}