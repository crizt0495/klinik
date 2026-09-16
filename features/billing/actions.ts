"use server";

import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError } from "@/lib/errors";
import { createInvoiceForVisit, processPayment, processRefund } from "./service";
import { parseZod } from "@/lib/validation";
import { z } from "zod/v4";

const invoiceItemSchema = z.object({ serviceItemId: z.string().min(1), description: z.string().min(1), quantity: z.coerce.number().int().min(1), unitPrice: z.coerce.number().min(0) });
const createInvoiceSchema = z.object({ visitId: z.string().min(1), items: z.array(invoiceItemSchema).min(1) });
const paymentSchema = z.object({ invoiceId: z.string().min(1), method: z.string().min(1), amount: z.coerce.number().gt(0).transform(String), reference: z.string().optional(), notes: z.string().optional() });
const refundSchema = z.object({ invoiceId: z.string().min(1), amount: z.coerce.number().gt(0).transform(String), reason: z.string().min(1) });

export async function createInvoiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("billing.create");
    const input = parseZod(createInvoiceSchema, JSON.parse(String(fd.get("payload") ?? "{}")));
    await createInvoiceForVisit(user, input);
    revalidatePath("/billing");
    revalidatePath("/visits");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function processPaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("payments.create");
    const input = parseZod(paymentSchema, Object.fromEntries(fd));
    await processPayment(user, input);
    revalidatePath("/billing");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}

export async function processRefundAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("payments.refund");
    const input = parseZod(refundSchema, Object.fromEntries(fd));
    await processRefund(user, input);
    revalidatePath("/billing");
    return { success: true };
  } catch (err) { return { error: toAppError(err).message }; }
}