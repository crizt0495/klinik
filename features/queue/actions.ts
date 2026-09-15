"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError, ValidationError, formatZodError } from "@/lib/errors";
import { createQueueEntry, updateQueueStatus } from "./service";

const queueSchema = z.object({
  patientId: z.string().uuid(),
  departmentId: z.string().uuid(),
  priority: z.enum(["NORMAL", "PRIORITY", "EMERGENCY"]),
});

const statusSchema = z.object({
  queueId: z.string().uuid(),
  status: z.enum(["CALLED", "SERVING", "COMPLETED", "CANCELLED", "SKIPPED"]),
});

function parse<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const parsed = schema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) throw new ValidationError("Data tidak valid", formatZodError(parsed.error));
  return parsed.data;
}

export async function createQueueEntryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("queue.create");
    const data = parse(queueSchema, fd);
    await createQueueEntry(user, data.patientId, data.departmentId, data.priority);
    revalidatePath("/queue");
    return { success: true };
  } catch (err) {
    return { error: toAppError(err).message };
  }
}

export async function updateQueueStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("queue.update");
    const data = parse(statusSchema, fd);
    await updateQueueStatus(user, data.queueId, data.status);
    revalidatePath("/queue");
    return { success: true };
  } catch (err) {
    return { error: toAppError(err).message };
  }
}