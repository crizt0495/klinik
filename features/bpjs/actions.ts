"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getActionUser, type ActionState } from "@/lib/auth/action-guard";
import { toAppError } from "@/lib/errors";
import { parseZod } from "@/lib/validation";
import * as svc from "./service";

const uuid = z.string().min(1, "ID wajib diisi");
const optStr = z.string().optional().or(z.literal(""));

function norm<T extends Record<string, unknown>>(data: T): T {
  for (const key of Object.keys(data)) {
    const value = (data as Record<string, unknown>)[key];
    if (value === "" || value === null) (data as Record<string, unknown>)[key] = null;
  }
  return data;
}

const eligibilitySchema = z.object({
  type: z.enum(["nokartu", "nik", "nama"]),
  value: z.string().min(1, "Kartu / NIK / nama wajib diisi").max(255),
  birthDate: optStr,
  tglSep: optStr,
});

const createSepSchema = z.object({
  patientId: optStr,
  visitId: optStr,
  insuranceProviderId: uuid,
  noKartu: z.string().min(1, "Nomor kartu wajib diisi").max(32),
  tglSep: z.string().min(1, "Tanggal SEP wajib diisi").max(32),
  jnsPelayanan: z.string().min(1).max(32),
  asalRujukan: z.string().min(1).max(32),
  noRujukan: optStr,
  tglRujukan: optStr,
  ppkRujukan: optStr,
  poliTujuan: z.string().min(1, "Poli tujuan wajib diisi").max(64),
  poliEksekutif: optStr,
  klasRawatHak: optStr,
  klasRawatNaik: optStr,
  pembiayaan: optStr,
  penanggungPembiayaan: optStr,
  noMR: optStr,
  diagnosa: optStr,
  cob: optStr,
  katarak: optStr,
  lakaLantas: optStr,
  cpCob: optStr,
  tujuanKunj: optStr,
  catatan: optStr,
});

const cancelSepSchema = z.object({ id: uuid });

const refreshReferralsSchema = z.object({ noKartu: z.string().min(1, "Nomor kartu wajib diisi").max(32) });

const updateReferralSchema = z.object({
  id: uuid,
  kodePoli: z.string().min(1, "Kode poli wajib diisi").max(32),
  kodeDokter: optStr,
});

const createClaimSchema = z.object({
  visitId: uuid,
  noSep: optStr,
  diagnosa: optStr,
  tglPulang: optStr,
  notes: optStr,
});

const submitClaimSchema = z.object({ id: uuid });

const saveSettingsSchema = z.object({
  enabled: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  mockMode: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  serviceBaseUrl: optStr,
  consId: optStr,
  secretKey: optStr,
  userKey: optStr,
  faskesCode: optStr,
  faskesName: optStr,
});

export async function checkEligibilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.check");
    const data = parseZod(eligibilitySchema, Object.fromEntries(fd));
    const result = await svc.checkEligibility(user, { type: data.type, value: data.value, birthDate: data.birthDate ?? null, tglSep: data.tglSep ?? null });
    revalidatePath("/bpjs/participants");
    return { success: true, data: result };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function createSepAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.manage_sep");
    const data = parseZod(createSepSchema, norm(Object.fromEntries(fd)));
    const sep = await svc.createSep(user, {
      patientId: data.patientId ?? null,
      visitId: data.visitId ?? null,
      insuranceProviderId: data.insuranceProviderId,
      noKartu: data.noKartu,
      tglSep: data.tglSep,
      jnsPelayanan: data.jnsPelayanan,
      asalRujukan: data.asalRujukan,
      noRujukan: data.noRujukan ?? null,
      tglRujukan: data.tglRujukan ?? null,
      ppkRujukan: data.ppkRujukan ?? null,
      poliTujuan: data.poliTujuan,
      poliEksekutif: data.poliEksekutif ?? "0",
      klasRawatHak: data.klasRawatHak ?? null,
      klasRawatNaik: data.klasRawatNaik ?? null,
      pembiayaan: data.pembiayaan ?? null,
      penanggungPembiayaan: data.penanggungPembiayaan ?? null,
      noMR: data.noMR ?? null,
      diagnosa: data.diagnosa ?? null,
      cob: data.cob ?? "0",
      katarak: data.katarak ?? "0",
      lakaLantas: data.lakaLantas ?? "0",
      cpCob: data.cpCob ?? null,
      tujuanKunj: data.tujuanKunj ?? "0",
      catatan: data.catatan ?? null,
    });
    revalidatePath("/bpjs/sep");
    revalidatePath("/bpjs/participants");
    return { success: true, data: { id: sep.id, noSep: sep.noSep } };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function cancelSepAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.cancel_sep");
    const data = parseZod(cancelSepSchema, Object.fromEntries(fd));
    await svc.cancelSep(user, data.id);
    revalidatePath("/bpjs/sep");
    return { success: true };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function refreshReferralsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.view_referrals");
    const data = parseZod(refreshReferralsSchema, Object.fromEntries(fd));
    const count = await svc.refreshReferrals(user, data.noKartu);
    revalidatePath("/bpjs/referrals");
    return { success: true, data: { count } };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function updateReferralAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.manage_referrals");
    const data = parseZod(updateReferralSchema, norm(Object.fromEntries(fd)));
    await svc.updateReferralPoli(user, data.id, data.kodePoli, data.kodeDokter ?? null);
    revalidatePath("/bpjs/referrals");
    return { success: true };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function createClaimAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.create_claim");
    const data = parseZod(createClaimSchema, norm(Object.fromEntries(fd)));
    const claim = await svc.createClaim(user, {
      visitId: data.visitId,
      noSep: data.noSep ?? null,
      diagnosa: data.diagnosa ?? null,
      tglPulang: data.tglPulang ?? null,
      notes: data.notes ?? null,
    });
    revalidatePath("/bpjs/claims");
    return { success: true, data: { id: claim.id, claimNumber: claim.claimNumber } };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function submitClaimAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.submit_claim");
    const data = parseZod(submitClaimSchema, Object.fromEntries(fd));
    const result = await svc.submitClaim(user, data.id);
    revalidatePath("/bpjs/claims");
    return { success: true, data: result };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function saveSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.manage_settings");
    const data = parseZod(saveSettingsSchema, Object.fromEntries(fd));
    await svc.saveBpjsSettingsFromUser(user, {
      enabled: data.enabled,
      mockMode: data.mockMode,
      serviceBaseUrl: data.serviceBaseUrl ?? null,
      consId: data.consId ?? "",
      secretKey: data.secretKey ?? "",
      userKey: data.userKey ?? "",
      faskesCode: data.faskesCode ?? null,
      faskesName: data.faskesName ?? null,
    });
    revalidatePath("/bpjs/settings");
    return { success: true };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}

export async function testConnectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getActionUser("bpjs.manage_settings");
    const noKartu = fd.get("noKartu")?.toString().trim() || null;
    const result = await svc.testBpjsConnection(user, noKartu);
    if (!result.success) return { error: result.message };
    revalidatePath("/bpjs/settings");
    return { success: true, data: result };
  } catch (e) {
    return { error: toAppError(e).message };
  }
}