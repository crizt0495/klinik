import { and, eq, desc, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError, InvalidStateError, ForbiddenError } from "@/lib/errors";
import { generateBusinessNumber, datePeriodMonth } from "@/lib/services/numbering";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";
import { createBpjsProvider, loadBpjsConnection, saveBpjsSettings } from "@/lib/bpjs/client";
import type { BpjsConnection, EligibilityInput, SepPayload, TrialClaimPayload } from "@/lib/bpjs/types";
import { toBpjsDate } from "@/lib/bpjs/types";

// ─────────────────────────────────────────────────────────────────────────────
// Overview / Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getBpjsOverview(user: SessionUser) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)).toISOString().slice(0, 10);

  const orgFilter = [eq(s.bpjsSep.organizationId, user.organizationId)];

  const sepCurrentMonth = await db()
    .select({ count: sql<number>`count(*)` })
    .from(s.bpjsSep)
    .where(and(...orgFilter, sql`${s.bpjsSep.tglSep} >= ${monthStart}`, sql`${s.bpjsSep.tglSep} <= ${monthEnd}`));

  const claimCountByStatus = await db()
    .select({ status: s.bpjsClaims.status, count: sql<number>`count(*)`, total: sql<string>`COALESCE(sum(${s.bpjsClaims.jumlahTagihan}::numeric), 0)` })
    .from(s.bpjsClaims)
    .where(eq(s.bpjsClaims.organizationId, user.organizationId))
    .groupBy(s.bpjsClaims.status);

  const activeReferrals = await db()
    .select({ count: sql<number>`count(*)` })
    .from(s.bpjsReferrals)
    .where(and(eq(s.bpjsReferrals.organizationId, user.organizationId), eq(s.bpjsReferrals.status, "ACTIVE")));

  const eligibilityCountToday = await db()
    .select({ count: sql<number>`count(*)` })
    .from(s.bpjsEligibilityChecks)
    .where(
      and(
        eq(s.bpjsEligibilityChecks.organizationId, user.organizationId),
        sql`date_trunc('day', ${s.bpjsEligibilityChecks.createdAt}) = date_trunc('day', now())`
      )
    );

  const recentSep = await db()
    .select({
      id: s.bpjsSep.id,
      noSep: s.bpjsSep.noSep,
      nama: s.bpjsSep.nama,
      tglSep: s.bpjsSep.tglSep,
      poliTujuan: s.bpjsSep.poliTujuan,
      status: s.bpjsSep.status,
      statusSubmit: s.bpjsSep.statusSubmit,
    })
    .from(s.bpjsSep)
    .where(and(...orgFilter))
    .orderBy(desc(s.bpjsSep.createdAt))
    .limit(5);

  const claimSummary: Record<string, { count: number; total: number }> = {};
  for (const row of claimCountByStatus) claimSummary[row.status] = { count: Number(row.count), total: Number(row.total) };
  const totalSubmittedClaims = (claimSummary["SUBMITTED"]?.total ?? 0) + (claimSummary["ACCEPTED"]?.total ?? 0) + (claimSummary["PARTIALLY_ACCEPTED"]?.total ?? 0);
  const totalRejectedClaims = claimSummary["REJECTED"]?.total ?? 0;

  return {
    sepCurrentMonth: Number(sepCurrentMonth[0]?.count ?? 0),
    eligibilityCountToday: Number(eligibilityCountToday[0]?.count ?? 0),
    activeReferrals: Number(activeReferrals[0]?.count ?? 0),
    claimSummary,
    totalSubmittedClaims,
    totalRejectedClaims,
    recentSep,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckEligibilityResult {
  id: string;
  checkType: string;
  lookupValue: string;
  noKartu: string | null;
  nama: string | null;
  jnsPeserta: string | null;
  hakKelas: string | null;
  statusPeserta: string | null;
  status: string;
  errorMessage: string | null;
}

export async function checkEligibility(user: SessionUser, input: EligibilityInput): Promise<CheckEligibilityResult> {
  const provider = await createBpjsProvider(user.organizationId);
  let status = "SUCCESS";
  let errorMessage: string | null = null;
  let resultData: Record<string, unknown> | null = null;
  let noKartu: string | null = null;
  let nama: string | null = null;
  let jnsPeserta: string | null = null;
  let hakKelas: string | null = null;
  let statusPeserta: string | null = null;

  try {
    const participant = await provider.checkEligibility(input);
    resultData = participant.raw as Record<string, unknown>;
    noKartu = participant.noKartu;
    nama = participant.nama;
    jnsPeserta = participant.jnsPeserta;
    hakKelas = participant.hakKelas;
    statusPeserta = participant.statusPeserta;
  } catch (err) {
    status = "FAILED";
    errorMessage = err instanceof Error ? err.message : "Gagal memeriksa data peserta";
  }

  const inserted = await db()
    .insert(s.bpjsEligibilityChecks)
    .values({
      organizationId: user.organizationId,
      branchId: user.branchId,
      userId: user.id,
      checkType: input.type,
      lookupValue: input.value,
      birthDate: input.birthDate ?? null,
      status,
      noKartu,
      nama,
      jnsPeserta,
      hakKelas,
      statusPeserta,
      responseJson: resultData,
      errorMessage,
    })
    .returning();

  await writeAuditLog({
    user,
    action: "BPJS_ELIGIBILITY_CHECK",
    entityType: "bpjs_eligibility_checks",
    entityId: inserted[0].id,
    newData: { type: input.type, lookupValue: input.value, status, noKartu },
  });

  return {
    id: inserted[0].id,
    checkType: input.type,
    lookupValue: input.value,
    noKartu,
    nama,
    jnsPeserta,
    hakKelas,
    statusPeserta,
    status,
    errorMessage,
  };
}

export async function listEligibilityChecks(user: SessionUser) {
  return db()
    .select({
      id: s.bpjsEligibilityChecks.id,
      checkType: s.bpjsEligibilityChecks.checkType,
      lookupValue: s.bpjsEligibilityChecks.lookupValue,
      noKartu: s.bpjsEligibilityChecks.noKartu,
      nama: s.bpjsEligibilityChecks.nama,
      jnsPeserta: s.bpjsEligibilityChecks.jnsPeserta,
      hakKelas: s.bpjsEligibilityChecks.hakKelas,
      statusPeserta: s.bpjsEligibilityChecks.statusPeserta,
      status: s.bpjsEligibilityChecks.status,
      errorMessage: s.bpjsEligibilityChecks.errorMessage,
      userName: s.users.fullName,
      createdAt: s.bpjsEligibilityChecks.createdAt,
    })
    .from(s.bpjsEligibilityChecks)
    .leftJoin(s.users, eq(s.users.id, s.bpjsEligibilityChecks.userId))
    .where(eq(s.bpjsEligibilityChecks.organizationId, user.organizationId))
    .orderBy(desc(s.bpjsEligibilityChecks.createdAt));
}

// ─────────────────────────────────────────────────────────────────────────────
// SEP
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSepInput {
  patientId?: string | null;
  visitId?: string | null;
  insuranceProviderId: string;
  noKartu: string;
  tglSep: string;
  jnsPelayanan: string;
  asalRujukan: string;
  noRujukan?: string | null;
  tglRujukan?: string | null;
  ppkRujukan?: string | null;
  poliTujuan: string;
  poliEksekutif?: string;
  klasRawatHak?: string | null;
  klasRawatNaik?: string | null;
  pembiayaan?: string | null;
  penanggungPembiayaan?: string | null;
  noMR?: string | null;
  diagnosa?: string | null;
  cob?: string;
  katarak?: string;
  lakaLantas?: string;
  cpCob?: string | null;
  tujuanKunj?: string;
  catatan?: string | null;
}

function sepPayloadFromInput(input: CreateSepInput): SepPayload {
  return {
    noKartu: input.noKartu,
    tglSep: input.tglSep,
    jnsPelayanan: input.jnsPelayanan,
    asalRujukan: input.asalRujukan,
    noRujukan: input.noRujukan ?? null,
    tglRujukan: input.tglRujukan ?? null,
    ppkRujukan: input.ppkRujukan ?? null,
    poliTujuan: input.poliTujuan,
    poliEksekutif: input.poliEksekutif ?? "0",
    klasRawatHak: input.klasRawatHak ?? null,
    klasRawatNaik: input.klasRawatNaik ?? null,
    pembiayaan: input.pembiayaan ?? null,
    penanggungPembiayaan: input.penanggungPembiayaan ?? null,
    noMR: input.noMR ?? null,
    diagnosa: input.diagnosa ?? null,
    cob: input.cob ?? "0",
    katarak: input.katarak ?? "0",
    lakaLantas: input.lakaLantas ?? "0",
    cpCob: input.cpCob ?? null,
    tujuanKunj: input.tujuanKunj ?? "0",
    catatan: input.catatan ?? null,
  };
}

export async function createSep(user: SessionUser, input: CreateSepInput) {
  const provider = await createBpjsProvider(user.organizationId);
  let participantPayload: { nama: string | null; tglLahir: string | null; nik: string | null } | null = null;

  try {
    const participant = await provider.checkEligibility({ type: "nokartu", value: input.noKartu, tglSep: input.tglSep });
    participantPayload = { nama: participant.nama, tglLahir: participant.tglLahir, nik: participant.nik };
  } catch {
    participantPayload = null;
  }

  const result = await provider.createSep(sepPayloadFromInput(input));
  const nama = participantPayload?.nama ?? result.nama;
  const tglLahir = participantPayload?.tglLahir ?? result.tglLahir;
  const nik = participantPayload?.nik ?? result.nik;

  const inserted = await db()
    .insert(s.bpjsSep)
    .values({
      organizationId: user.organizationId,
      branchId: user.branchId,
      visitId: input.visitId ?? null,
      patientInsuranceId: null,
      insuranceProviderId: input.insuranceProviderId,
      noSep: result.noSep,
      noKartu: input.noKartu,
      nik,
      nama,
      tglLahir,
      gender: null,
      tglSep: input.tglSep,
      jnsPelayanan: input.jnsPelayanan,
      asalRujukan: input.asalRujukan,
      noRujukan: input.noRujukan ?? null,
      tglRujukan: input.tglRujukan ?? null,
      ppkRujukan: input.ppkRujukan ?? null,
      poliTujuan: input.poliTujuan,
      poliEksekutif: input.poliEksekutif ?? "0",
      klasRawatHak: input.klasRawatHak ?? null,
      klasRawatNaik: input.klasRawatNaik ?? null,
      pembiayaan: input.pembiayaan ?? null,
      penanggungPembiayaan: input.penanggungPembiayaan ?? null,
      noMR: input.noMR ?? null,
      diagnosa: input.diagnosa ?? null,
      cob: input.cob ?? "0",
      katarak: input.katarak ?? "0",
      lakaLantas: input.lakaLantas ?? "0",
      cpCob: input.cpCob ?? null,
      tujuanKunj: input.tujuanKunj ?? "0",
      user: user.username,
      catatan: input.catatan ?? null,
      statusSubmit: "INSERTED",
      metaJson: result.raw as Record<string, unknown>,
      status: "ACTIVE",
    })
    .returning();

  await writeAuditLog({ user, action: "BPJS_SEP_CREATE", entityType: "bpjs_sep", entityId: inserted[0].id, newData: { noSep: result.noSep, noKartu: input.noKartu } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "bpjs_sep_created", entityType: "bpjs_sep", entityId: inserted[0].id, meta: { noSep: result.noSep } });
  return inserted[0];
}

export async function listSep(user: SessionUser, status?: string) {
  const conditions = [eq(s.bpjsSep.organizationId, user.organizationId)];
  if (status) conditions.push(eq(s.bpjsSep.status, status));
  return db()
    .select({
      id: s.bpjsSep.id,
      noSep: s.bpjsSep.noSep,
      noKartu: s.bpjsSep.noKartu,
      nama: s.bpjsSep.nama,
      tglSep: s.bpjsSep.tglSep,
      jnsPelayanan: s.bpjsSep.jnsPelayanan,
      poliTujuan: s.bpjsSep.poliTujuan,
      diagnosa: s.bpjsSep.diagnosa,
      statusSubmit: s.bpjsSep.statusSubmit,
      status: s.bpjsSep.status,
      visitId: s.bpjsSep.visitId,
      createdAt: s.bpjsSep.createdAt,
    })
    .from(s.bpjsSep)
    .where(and(...conditions))
    .orderBy(desc(s.bpjsSep.createdAt));
}

export async function getSepDetail(user: SessionUser, id: string) {
  const rows = await db().select().from(s.bpjsSep).where(and(eq(s.bpjsSep.id, id), eq(s.bpjsSep.organizationId, user.organizationId))).limit(1);
  const sep = rows[0];
  if (!sep) throw new NotFoundError("SEP tidak ditemukan");
  let patientName: string | null = null;
  let visitNumber: string | null = null;
  if (sep.visitId) {
    const v = await db().select({ patientName: s.patients.fullName, visitNumber: s.visits.visitNumber }).from(s.visits).innerJoin(s.patients, eq(s.patients.id, s.visits.patientId)).where(eq(s.visits.id, sep.visitId)).limit(1);
    patientName = v[0]?.patientName ?? null;
    visitNumber = v[0]?.visitNumber ?? null;
  }
  return { sep, patientName, visitNumber };
}

export async function updateSepStatus(user: SessionUser, id: string, statusSubmit: string, metaJson?: unknown) {
  const rows = await db().select().from(s.bpjsSep).where(and(eq(s.bpjsSep.id, id), eq(s.bpjsSep.organizationId, user.organizationId))).limit(1);
  const sep = rows[0];
  if (!sep) throw new NotFoundError("SEP tidak ditemukan");
  await db()
    .update(s.bpjsSep)
    .set({ statusSubmit, metaJson: metaJson ?? sep.metaJson, updatedAt: new Date() })
    .where(eq(s.bpjsSep.id, id));
  await writeAuditLog({ user, action: "BPJS_SEP_UPDATE", entityType: "bpjs_sep", entityId: id, newData: { statusSubmit } });
}

export async function cancelSep(user: SessionUser, id: string) {
  const rows = await db().select().from(s.bpjsSep).where(and(eq(s.bpjsSep.id, id), eq(s.bpjsSep.organizationId, user.organizationId))).limit(1);
  const sep = rows[0];
  if (!sep) throw new NotFoundError("SEP tidak ditemukan");
  if (sep.status === "INACTIVE") throw new InvalidStateError("SEP sudah nonaktif");
  if (sep.statusSubmit === "DELETED") throw new InvalidStateError("SEP sudah dihapus dari BPJS");

  const provider = await createBpjsProvider(user.organizationId);
  try {
    await provider.deleteSep({ noSep: sep.noSep!, user: user.username, noKartu: sep.noKartu });
  } catch {
    // BPJS might reject (active services). Still mark local as cancelled.
  }

  await db().update(s.bpjsSep).set({ status: "INACTIVE", statusSubmit: "DELETED", updatedAt: new Date() }).where(eq(s.bpjsSep.id, id));
  await writeAuditLog({ user, action: "BPJS_SEP_CANCEL", entityType: "bpjs_sep", entityId: id, oldData: { status: sep.status }, newData: { status: "INACTIVE", statusSubmit: "DELETED" } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Referrals
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferralInput {
  noKartu: string;
  patientId?: string | null;
}

export async function refreshReferrals(user: SessionUser, noKartu: string): Promise<number> {
  const provider = await createBpjsProvider(user.organizationId);
  const referrals = await provider.getReferrals(noKartu);
  try {
    const history = await provider.getReferralHistory(noKartu);
    const existingNos = new Set(referrals.map((r) => r.noRujukan));
    for (const r of history) if (!existingNos.has(r.noRujukan)) referrals.push(r);
  } catch {
    // history optional
  }

  let count = 0;
  for (const r of referrals) {
    const existing = await db().select({ id: s.bpjsReferrals.id }).from(s.bpjsReferrals).where(and(eq(s.bpjsReferrals.organizationId, user.organizationId), eq(s.bpjsReferrals.noRujukan, r.noRujukan))).limit(1);
    const isActive = r.status === "1" || r.status?.toUpperCase() === "ACTIVE";
    const rowStatus = isActive ? "ACTIVE" : "EXPIRED";

    if (existing.length > 0) {
      await db()
        .update(s.bpjsReferrals)
        .set({
          jenisRujukan: r.jenisRujukan,
          jenisPelayanan: r.jenisPelayanan,
          tglKunjungan: r.tglKunjungan,
          tglRujukan: r.tglRujukan,
          tglAkhirRujukan: r.tglAkhirRujukan,
          namaPeserta: r.namaPeserta,
          asalFaskesKode: r.asalFaskes?.kode ?? null,
          asalFaskesNama: r.asalFaskes?.nama ?? null,
          poliRujukanKode: r.poliRujukan?.kode ?? null,
          poliRujukanNama: r.poliRujukan?.nama ?? null,
          diagnosaKode: r.diagnosa?.kode ?? null,
          diagnosaNama: r.diagnosa?.nama ?? null,
          catatan: r.catatan,
          status: rowStatus,
          responseJson: r.raw as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(s.bpjsReferrals.id, existing[0].id));
    } else {
      await db()
        .insert(s.bpjsReferrals)
        .values({
          organizationId: user.organizationId,
          branchId: user.branchId,
          noRujukan: r.noRujukan,
          jenisRujukan: r.jenisRujukan,
          jenisPelayanan: r.jenisPelayanan,
          tglKunjungan: r.tglKunjungan,
          tglRujukan: r.tglRujukan,
          tglAkhirRujukan: r.tglAkhirRujukan,
          noKartu,
          nik: r.nik,
          namaPeserta: r.namaPeserta,
          asalFaskesKode: r.asalFaskes?.kode ?? null,
          asalFaskesNama: r.asalFaskes?.nama ?? null,
          poliRujukanKode: r.poliRujukan?.kode ?? null,
          poliRujukanNama: r.poliRujukan?.nama ?? null,
          diagnosaKode: r.diagnosa?.kode ?? null,
          diagnosaNama: r.diagnosa?.nama ?? null,
          catatan: r.catatan,
          status: rowStatus,
          source: "VCLAIM",
          responseJson: r.raw as Record<string, unknown>,
        });
    }
    count++;
  }

  await writeAuditLog({ user, action: "BPJS_REFERRALS_REFRESH", entityType: "bpjs_referrals", newData: { noKartu, count } });
  return count;
}

export async function listReferrals(user: SessionUser, noKartu?: string) {
  const conditions = [eq(s.bpjsReferrals.organizationId, user.organizationId)];
  if (noKartu) conditions.push(eq(s.bpjsReferrals.noKartu, noKartu));
  return db().select().from(s.bpjsReferrals).where(and(...conditions)).orderBy(desc(s.bpjsReferrals.tglRujukan));
}

export async function updateReferralPoli(user: SessionUser, id: string, kodePoli: string, kodeDokter?: string | null) {
  const rows = await db().select().from(s.bpjsReferrals).where(and(eq(s.bpjsReferrals.id, id), eq(s.bpjsReferrals.organizationId, user.organizationId))).limit(1);
  const ref = rows[0];
  if (!ref) throw new NotFoundError("Rujukan tidak ditemukan");
  const provider = await createBpjsProvider(user.organizationId);
  try {
    await provider.updateReferral({ noRujukan: ref.noRujukan, kodePoli, kodeDokter: kodeDokter ?? undefined });
  } catch {
    throw new InvalidStateError("Gagal memperbarui rujukan di BPJS");
  }
  await db()
    .update(s.bpjsReferrals)
    .set({ poliRujukanKode: kodePoli, updatedAt: new Date() })
    .where(eq(s.bpjsReferrals.id, id));
  await writeAuditLog({ user, action: "BPJS_REFERRAL_UPDATE", entityType: "bpjs_referrals", entityId: id, newData: { kodePoli, kodeDokter } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Claims
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateClaimInput {
  visitId: string;
  noSep?: string | null;
  diagnosa?: string | null;
  tglPulang?: string | null;
  notes?: string | null;
}

export async function createClaim(user: SessionUser, input: CreateClaimInput) {
  const visit = await db().select().from(s.visits).where(and(eq(s.visits.id, input.visitId), eq(s.visits.organizationId, user.organizationId))).limit(1);
  if (visit.length === 0) throw new NotFoundError("Kunjungan tidak ditemukan");
  const v = visit[0];

  let sepRow: typeof s.bpjsSep.$inferSelect | null = null;
  if (input.noSep) {
    const rows = await db().select().from(s.bpjsSep).where(and(eq(s.bpjsSep.organizationId, user.organizationId), eq(s.bpjsSep.noSep, input.noSep), eq(s.bpjsSep.status, "ACTIVE"))).limit(1);
    sepRow = rows[0] ?? null;
  }
  if (!sepRow) {
    const rows = await db().select().from(s.bpjsSep).where(and(eq(s.bpjsSep.organizationId, user.organizationId), eq(s.bpjsSep.visitId, input.visitId), eq(s.bpjsSep.status, "ACTIVE"))).limit(1);
    sepRow = rows[0] ?? null;
  }

  let invoiceTotal = "0";
  let invoiceId: string | null = null;
  const invRows = await db().select().from(s.invoices).where(eq(s.invoices.visitId, input.visitId)).limit(1);
  if (invRows.length > 0) {
    invoiceTotal = invRows[0].total ?? "0";
    invoiceId = invRows[0].id;
  }

  const claimNumber = await generateBusinessNumber({ organizationId: user.organizationId, branchId: user.branchId, prefix: "CLM", scope: "BPJS-CLAIM", period: datePeriodMonth() });

  const inserted = await db()
    .insert(s.bpjsClaims)
    .values({
      organizationId: user.organizationId,
      branchId: user.branchId,
      visitId: input.visitId,
      invoiceId,
      sepId: sepRow?.id ?? null,
      claimNumber,
      noSep: sepRow?.noSep ?? null,
      noKartu: sepRow?.noKartu ?? null,
      namaPeserta: sepRow?.nama ?? null,
      tglPulang: input.tglPulang ?? v.visitDate,
      diagnosa: input.diagnosa ?? sepRow?.diagnosa ?? null,
      jenisPelayanan: "RAWAT_JALAN",
      jumlahTagihan: invoiceTotal,
      status: "DRAFT",
      notes: input.notes ?? null,
    })
    .returning();

  await writeAuditLog({ user, action: "BPJS_CLAIM_CREATE", entityType: "bpjs_claims", entityId: inserted[0].id, newData: { claimNumber, invoiceTotal } });
  return inserted[0];
}

export async function submitClaim(user: SessionUser, id: string) {
  const rows = await db().select().from(s.bpjsClaims).where(and(eq(s.bpjsClaims.id, id), eq(s.bpjsClaims.organizationId, user.organizationId))).limit(1);
  const claim = rows[0];
  if (!claim) throw new NotFoundError("Klaim tidak ditemukan");
  if (claim.status !== "DRAFT" && claim.status !== "REJECTED") throw new InvalidStateError("Hanya klaim DRAFT/REJECTED yang dapat diajukan");
  if (!claim.noSep) throw new InvalidStateError("Klaim harus memiliki nomor SEP");

  const provider = await createBpjsProvider(user.organizationId);
  const tglSepForClaim = claim.tglPulang ?? claim.createdAt.toISOString().slice(0, 10);
  const payload: TrialClaimPayload = {
    noSep: claim.noSep,
    diagnosa: claim.diagnosa ?? "",
    tglPelayanan: toBpjsDate(tglSepForClaim),
    tglPulang: toBpjsDate(claim.tglPulang ?? tglSepForClaim),
  };

  const result = await provider.trialClaim(payload);
  const totalBy40 = String(result.totalBy40);
  const totalBySouth = String(result.totalBySouth);
  const ttlByGroup = String(result.ttlByGroup);

  await db()
    .update(s.bpjsClaims)
    .set({
      totalBy40,
      totalBySouth,
      ttlByGroup,
      groupByJson: result.groupBy as unknown as Record<string, unknown>[],
      responseJson: result.raw as Record<string, unknown>,
      status: "SUBMITTED",
      submittedBy: user.id,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(s.bpjsClaims.id, id));

  await writeAuditLog({ user, action: "BPJS_CLAIM_SUBMIT", entityType: "bpjs_claims", entityId: id, newData: { totalBy40, totalBySouth, ttlByGroup } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "bpjs_claim_submitted", entityType: "bpjs_claims", entityId: id });

  return { id, totalBy40, totalBySouth, ttlByGroup };
}

export async function listClaims(user: SessionUser, status?: string) {
  const conditions = [eq(s.bpjsClaims.organizationId, user.organizationId)];
  if (status) conditions.push(eq(s.bpjsClaims.status, status));
  return db()
    .select({
      id: s.bpjsClaims.id,
      claimNumber: s.bpjsClaims.claimNumber,
      noSep: s.bpjsClaims.noSep,
      noKartu: s.bpjsClaims.noKartu,
      namaPeserta: s.bpjsClaims.namaPeserta,
      tglPulang: s.bpjsClaims.tglPulang,
      diagnosa: s.bpjsClaims.diagnosa,
      jumlahTagihan: s.bpjsClaims.jumlahTagihan,
      ttlByGroup: s.bpjsClaims.ttlByGroup,
      status: s.bpjsClaims.status,
      createdAt: s.bpjsClaims.createdAt,
    })
    .from(s.bpjsClaims)
    .where(and(...conditions))
    .orderBy(desc(s.bpjsClaims.createdAt));
}

export async function getClaimDetail(user: SessionUser, id: string) {
  const rows = await db().select().from(s.bpjsClaims).where(and(eq(s.bpjsClaims.id, id), eq(s.bpjsClaims.organizationId, user.organizationId))).limit(1);
  const claim = rows[0];
  if (!claim) throw new NotFoundError("Klaim tidak ditemukan");
  let visitNumber: string | null = null;
  let patientMrn: string | null = null;
  if (claim.visitId) {
    const v = await db().select({ visitNumber: s.visits.visitNumber, patientMrn: s.patients.medicalRecordNumber }).from(s.visits).innerJoin(s.patients, eq(s.patients.id, s.visits.patientId)).where(eq(s.visits.id, claim.visitId)).limit(1);
    visitNumber = v[0]?.visitNumber ?? null;
    patientMrn = v[0]?.patientMrn ?? null;
  }
  return { claim, visitNumber, patientMrn };
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

export interface BpjsSettingsView extends BpjsConnection {
  lastTestedAt: string | null;
  lastTestStatus: string | null;
}

export async function getBpjsSettingsView(user: SessionUser): Promise<BpjsSettingsView> {
  const conn = await loadBpjsConnection(user.organizationId);
  const row = await db()
    .select({ lastTestedAt: s.bpjsSettings.lastTestedAt, lastTestStatus: s.bpjsSettings.lastTestStatus })
    .from(s.bpjsSettings)
    .where(eq(s.bpjsSettings.organizationId, user.organizationId))
    .limit(1);
  return {
    ...conn,
    lastTestedAt: row[0]?.lastTestedAt ? new Date(row[0].lastTestedAt).toISOString() : null,
    lastTestStatus: row[0]?.lastTestStatus ?? null,
  };
}

export async function saveBpjsSettingsFromUser(user: SessionUser, input: {
  enabled?: boolean;
  mockMode?: boolean;
  serviceBaseUrl?: string | null;
  consId?: string;
  secretKey?: string;
  userKey?: string;
  faskesCode?: string | null;
  faskesName?: string | null;
}) {
  const current = await loadBpjsConnection(user.organizationId);
  if (current.managedByEnv) {
    throw new ForbiddenError("Pengaturan BPJS ini dikelola melalui environment variable pada server dan tidak dapat diubah dari aplikasi.");
  }
  await saveBpjsSettings(user.organizationId, input);
  await writeAuditLog({ user, action: "BPJS_SETTINGS_UPDATE", entityType: "bpjs_settings", newData: { enabled: input.enabled, mockMode: input.mockMode } });
}

export async function testBpjsConnection(user: SessionUser, noKartu?: string | null) {
  const provider = await createBpjsProvider(user.organizationId);
  const start = Date.now();
  try {
    await provider.checkEligibility({ type: "nokartu", value: noKartu || "0002000000000", tglSep: new Date().toISOString().slice(0, 10) });
    const elapsed = Date.now() - start;
    await db()
      .update(s.bpjsSettings)
      .set({ lastTestedAt: new Date(), lastTestStatus: `OK (${elapsed}ms)` })
      .where(eq(s.bpjsSettings.organizationId, user.organizationId));
    return { success: true, message: `Berhasil dalam ${elapsed}ms` };
  } catch (err) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await db()
      .update(s.bpjsSettings)
      .set({ lastTestedAt: new Date(), lastTestStatus: `GAGAL: ${msg}` })
      .where(eq(s.bpjsSettings.organizationId, user.organizationId));
    return { success: false, message: `Gagal (${elapsed}ms): ${msg}` };
  }
}

export async function listActiveInsuranceProviders(user: SessionUser) {
  return db().select({ id: s.insuranceProviders.id, code: s.insuranceProviders.code, name: s.insuranceProviders.name }).from(s.insuranceProviders).where(and(eq(s.insuranceProviders.organizationId, user.organizationId), eq(s.insuranceProviders.status, "ACTIVE")));
}

export async function listVisitsForBpjs(user: SessionUser) {
  return db()
    .select({
      id: s.visits.id,
      visitNumber: s.visits.visitNumber,
      visitDate: s.visits.visitDate,
      status: s.visits.status,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
    })
    .from(s.visits)
    .innerJoin(s.patients, eq(s.patients.id, s.visits.patientId))
    .where(and(eq(s.visits.organizationId, user.organizationId), isNull(s.patients.deletedAt)))
    .orderBy(desc(s.visits.visitDate))
    .limit(100);
}

export async function listActiveSep(user: SessionUser) {
  return db()
    .select({ id: s.bpjsSep.id, noSep: s.bpjsSep.noSep, nama: s.bpjsSep.nama })
    .from(s.bpjsSep)
    .where(and(eq(s.bpjsSep.organizationId, user.organizationId), eq(s.bpjsSep.status, "ACTIVE")))
    .orderBy(desc(s.bpjsSep.createdAt))
    .limit(100);
}