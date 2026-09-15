"use server";

import { revalidatePath } from "next/cache";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError } from "@/lib/errors";
import { dispensePrescriptionItem } from "./service";

export async function dispensePrescriptionItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("pharmacy.dispense");
    await dispensePrescriptionItem(user, String(fd.get("prescriptionItemId")));
    revalidatePath("/pharmacy");
    revalidatePath("/prescriptions");
    return { success: true };
  } catch (err) {
    return { error: toAppError(err).message };
  }
}