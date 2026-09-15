"use server";

import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError } from "@/lib/errors";
import { createLabOrder, completeLabOrder, createRadiologyOrder } from "./service";
import { parseZod } from "@/lib/validation";
import { z } from "zod/v4";

const labTestSchema = z.object({ testName: z.string().min(1), specimenType: z.string().default("blood"), clinicalInfo: z.string().optional() });
const labOrderSchema = z.object({ visitId: z.string().min(1), tests: z.array(labTestSchema).min(1) });
const radImageSchema = z.object({ examType: z.string().min(1), bodyPart: z.string().min(1), clinicalInfo: z.string().optional(), modality: z.string().optional() });
const radOrderSchema = z.object({ visitId: z.string().min(1), images: z.array(radImageSchema).min(1) });

export async function createLabOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("lab.request");
    const input = parseZod(labOrderSchema, JSON.parse(String(fd.get("payload") ?? "{}")));
    await createLabOrder(user, input);
    revalidatePath("/lab");
    revalidatePath("/visits");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function completeLabOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("lab.result");
    const labOrderId = String(fd.get("labOrderId"));
    const results = JSON.parse(String(fd.get("results") ?? "[]"));
    await completeLabOrder(user, labOrderId, results);
    revalidatePath("/lab");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function createRadiologyOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("radiology.request");
    const input = parseZod(radOrderSchema, JSON.parse(String(fd.get("payload") ?? "{}")));
    await createRadiologyOrder(user, input);
    revalidatePath("/radiology");
    revalidatePath("/visits");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}