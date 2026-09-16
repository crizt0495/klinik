"use server";

import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError } from "@/lib/errors";
import { createStockOpname, createPurchaseOrder, receivePurchaseOrder } from "./service";
import { parseZod } from "@/lib/validation";
import { z } from "zod/v4";

const opnameSchema = z.object({ batchId: z.string().min(1), medicationId: z.string().min(1), countedQuantity: z.coerce.number().int().min(0), notes: z.string().optional() });
const poItemSchema = z.object({ medicationId: z.string().min(1), quantity: z.coerce.number().int().min(1), unitPrice: z.coerce.number().min(0) });
const poSchema = z.object({ supplierId: z.string().min(1), expectedDate: z.string().min(1), notes: z.string().optional(), items: z.array(poItemSchema).min(1) });

export async function stockOpnameAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("inventory.opname");
    const input = parseZod(opnameSchema, Object.fromEntries(fd));
    await createStockOpname(user, input.medicationId, input.batchId, input.countedQuantity, input.notes);
    revalidatePath("/inventory");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function createPurchaseOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("purchases.create");
    const raw = JSON.parse(String(fd.get("payload") ?? "{}"));
    const input = parseZod(poSchema, raw);
    await createPurchaseOrder(user, input);
    revalidatePath("/inventory");
    revalidatePath("/purchasing");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function receivePurchaseOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("purchases.receive");
    const purchaseOrderId = String(fd.get("purchaseOrderId"));
    const received = JSON.parse(String(fd.get("received") ?? "[]")) as Array<{ itemId: string; quantityReceived: number }>;
    await receivePurchaseOrder(user, purchaseOrderId, received);
    revalidatePath("/inventory");
    revalidatePath("/purchasing");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}