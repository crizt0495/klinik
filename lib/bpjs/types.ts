export interface BpjsConnection {
  enabled: boolean;
  mockMode: boolean;
  serviceBaseUrl: string | null;
  consId: string;
  secretKey: string;
  userKey: string;
  faskesCode: string | null;
  faskesName: string | null;
}

export interface EligibilityInput {
  type: "nokartu" | "nik" | "nama";
  value: string;
  birthDate?: string | null;
  tglSep?: string | null;
}

export interface Participant {
  noKartu: string;
  nik: string | null;
  nama: string;
  tglLahir: string | null;
  sex: string | null;
  jnsPeserta: string | null;
  hakKelas: string | null;
  penjamin: string | null;
  noMR: string | null;
  statusPeserta: string | null;
  provUmum: string | null;
  kabUmum: string | null;
  asalFaskes: { kode: string; nama: string } | null;
  fktp: { kode: string; nama: string } | null;
  raw: unknown;
}

export interface SepPayload {
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
  user?: string | null;
  catatan?: string | null;
}

export interface SepResult {
  noSep: string;
  noKartu: string;
  nik: string | null;
  nama: string;
  tglLahir: string | null;
  jnsPelayanan: string | null;
  poli: string | null;
  poliEksekutif: string | null;
  asalRujukan: string | null;
  noRujukan: string | null;
  diagnosa: string | null;
  raw: unknown;
}

export interface Referral {
  noRujukan: string;
  jenisRujukan: string | null;
  jenisPelayanan: string | null;
  tglRujukan: string | null;
  tglKunjungan: string | null;
  tglAkhirRujukan: string | null;
  noKartu: string | null;
  nik: string | null;
  namaPeserta: string | null;
  asalFaskes: { kode: string; nama: string } | null;
  poliRujukan: { kode: string; nama: string } | null;
  poliTujuan: { kode: string; nama: string } | null;
  diagnosa: { kode: string; nama: string } | null;
  catatan: string | null;
  status: string | null;
  raw: unknown;
}

export interface TrialClaimPayload {
  noSep: string;
  diagnosa: string;
  tglPelayanan: string;
  tglPulang: string;
}

export interface TrialClaimGroup {
  kode: string;
  kdGroup: string;
  namaGroup: string;
  jumlah: number;
  biaya: number;
}

export interface TrialClaimResult {
  groupBy: TrialClaimGroup[];
  totalBy40: number;
  totalBySouth: number;
  ttlByGroup: number;
  raw: unknown;
}

export interface BpjsProvider {
  checkEligibility(input: EligibilityInput): Promise<Participant>;
  createSep(payload: SepPayload): Promise<SepResult>;
  updateSep(payload: SepPayload & { noSep: string }): Promise<SepResult>;
  deleteSep(payload: { noSep: string; user?: string; noKartu?: string }): Promise<{ noSep: string; status: string }>;
  getReferrals(noKartu: string): Promise<Referral[]>;
  getReferralHistory(noKartu: string): Promise<Referral[]>;
  getReferral(noRujukan: string): Promise<Referral>;
  updateReferral(payload: { noRujukan: string; kodePoli: string; kodeDokter?: string }): Promise<{ noRujukan: string; status: string }>;
  trialClaim(payload: TrialClaimPayload): Promise<TrialClaimResult>;
}

export class BpjsApiError extends Error {
  readonly code: string;
  readonly response: unknown;

  constructor(code: string, message: string, response?: unknown) {
    super(message);
    this.name = "BpjsApiError";
    this.code = code;
    this.response = response;
  }
}

export function toBpjsDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function fromBpjsDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return value.slice(0, 10);
  return `${m[3]}-${m[2]}-${m[1]}`;
}