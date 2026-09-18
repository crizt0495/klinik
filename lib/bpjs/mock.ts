import { createHash } from "crypto";
import type { BpjsConnection, EligibilityInput, Participant, Referral, SepPayload, SepResult, TrialClaimPayload, TrialClaimResult, BpjsProvider } from "./types";
import { BpjsApiError } from "./types";

/**
 * Deterministic sandbox/mock provider for BPJS VClaim.
 * Enabled when the connection is in mock mode (default) or when credentials
 * are missing. Produces realistic, reproducible data so the module is fully
 * usable for development, demos and automated tests.
 */
export class MockProvider implements BpjsProvider {
  private seed(value: string, salt = ""): string {
    return createHash("sha256")
      .update(`${value}|${salt}|BPJS-MOCK-SEED`)
      .digest("hex");
  }

  private digits(value: string, length: number, salt = ""): string {
    const hex = this.seed(value, salt);
    const num = BigInt(`0x${hex}`) % BigInt(10 ** length);
    return String(num).padStart(length, "0");
  }

  private normalizeCard(value: string): string {
    const clean = value.replace(/\D/g, "");
    if (clean.length >= 11) return `0002${clean.slice(-10)}`;
    return `0002${this.digits(clean, 10, "card")}`;
  }

  private nowIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async checkEligibility(input: EligibilityInput): Promise<Participant> {
    const upperValue = input.value.trim().toUpperCase();
    if (upperValue.includes("INVALID") || upperValue === "TIDAKDITEMUKAN") {
      throw new BpjsApiError("201", "Peserta tidak ditemukan");
    }
    const noKartu = input.type === "nokartu" ? this.normalizeCard(input.value) : `0002${this.digits(String(input.value), 10, "kartu")}`;
    const nik = input.type === "nik" ? input.value.trim().padEnd(16, "0") : `3171${this.digits(String(input.value), 12, "nik")}`;
    const nama = input.type === "nama" ? input.value.trim().toUpperCase() : `PESERTA ${this.digits(noKartu, 4).split("").join("")}`;
    const tglLahir = input.birthDate && input.birthDate !== "" ? input.birthDate : `1995-01-0${(this.digits(noKartu, 1) === "0" ? "1" : this.digits(noKartu, 1))}`;
    return {
      noKartu,
      nik,
      nama,
      tglLahir,
      sex: this.digits(noKartu, 1, "sex") === "0" ? "L" : "L",
      jnsPeserta: "PBPU",
      hakKelas: "3",
      penjamin: "BPJS KESEHATAN",
      noMR: `MR/${this.digits(noKartu, 6, "mr")}`,
      statusPeserta: "Aktif",
      provUmum: "DKI JAKARTA",
      kabUmum: "JAKARTA SELATAN",
      asalFaskes: { kode: this.digits(noKartu, 6, "faskes"), nama: "KLINIK SEHAT" },
      fktp: { kode: this.digits(noKartu, 6, "fktp"), nama: "KLINIK SEHAT" },
      raw: { peserta: { noKartu, nik, nama, tglLahir, sex: "L" }, statusPeserta: "Aktif" },
    };
  }

  async createSep(payload: SepPayload): Promise<SepResult> {
    const token = Date.now().toString(36).toUpperCase();
    const noSep = `${this.digits(payload.noKartu, 2, "sep-prefix")}${token.slice(-4)}${this.digits(payload.noKartu + payload.tglSep + token, 8, "sep")}`;
    const tglLahir = "1995-01-01";
    return {
      noSep,
      noKartu: payload.noKartu,
      nik: `3171${this.digits(payload.noKartu, 12, "nik")}`,
      nama: `PESERTA ${this.digits(payload.noKartu, 4)}`,
      tglLahir,
      jnsPelayanan: payload.jnsPelayanan,
      poli: payload.poliTujuan,
      poliEksekutif: payload.poliEksekutif ?? "0",
      asalRujukan: payload.asalRujukan,
      noRujukan: payload.noRujukan ?? null,
      diagnosa: payload.diagnosa ?? null,
      raw: { sep: { noSep, noKartu: payload.noKartu } },
    };
  }

  async updateSep(payload: SepPayload & { noSep: string }): Promise<SepResult> {
    return {
      noSep: payload.noSep,
      noKartu: payload.noKartu,
      nik: null,
      nama: "PESERTA",
      tglLahir: null,
      jnsPelayanan: payload.jnsPelayanan,
      poli: payload.poliTujuan,
      poliEksekutif: payload.poliEksekutif ?? "0",
      asalRujukan: payload.asalRujukan,
      noRujukan: payload.noRujukan ?? null,
      diagnosa: payload.diagnosa ?? null,
      raw: { sep: { noSep: payload.noSep } },
    };
  }

  async deleteSep(payload: { noSep: string; user?: string }): Promise<{ noSep: string; status: string }> {
    return { noSep: payload.noSep, status: "DELETED" };
  }

  private mockReferral(index: number, noKartu: string): Referral {
    const noRujukan = `00${this.digits(noKartu + String(index), 4, "rujukan")}${index}`;
    const poliList = [
      { kode: "P", nama: "Penyakit Dalam" },
      { kode: "C", nama: "Jantung & Pembuluh Darah" },
      { kode: "A", nama: "Anak" },
    ];
    const diagList = [
      { kode: "J06.9", nama: "Infeksi Saluran Pernapasan Akut" },
      { kode: "I10", nama: "Hipertensi Esensial" },
      { kode: "E11.9", nama: "Diabetes Melitus Tipe 2" },
    ];
    const tglRujukan = new Date(Date.now() - index * 86400000).toISOString().slice(0, 10);
    const tglAkhir = new Date(Date.now() + (30 - index) * 86400000).toISOString().slice(0, 10);
    return {
      noRujukan,
      jenisRujukan: "0",
      jenisPelayanan: "1",
      tglRujukan,
      tglKunjungan: tglRujukan,
      tglAkhirRujukan: tglAkhir,
      noKartu,
      nik: `3171${this.digits(noKartu, 12, "nik")}`,
      namaPeserta: `PESERTA ${this.digits(noKartu, 4)}`,
      asalFaskes: { kode: this.digits(noKartu, 6, "asal"), nama: "FASKES ASAL SEHAT" },
      poliRujukan: poliList[index % poliList.length],
      poliTujuan: null,
      diagnosa: diagList[index % diagList.length],
      catatan: index === 0 ? "Rujukan aktif" : "Rujukan reguler",
      status: index === 0 ? "1" : "0",
      raw: {},
    };
  }

  async getReferrals(noKartu: string): Promise<Referral[]> {
    return [this.mockReferral(0, noKartu), this.mockReferral(1, noKartu)];
  }

  async getReferralHistory(noKartu: string): Promise<Referral[]> {
    return [this.mockReferral(2, noKartu), this.mockReferral(3, noKartu), this.mockReferral(4, noKartu)];
  }

  async getReferral(noRujukan: string): Promise<Referral> {
    const clean = noRujukan.replace(/\D/g, "");
    return this.mockReferral(clean.length % 2, `0002${this.digits(noRujukan, 10, "kartu")}`);
  }

  async updateReferral(payload: { noRujukan: string; kodePoli: string }): Promise<{ noRujukan: string; status: string }> {
    return { noRujukan: payload.noRujukan, status: "200" };
  }

  async trialClaim(payload: TrialClaimPayload): Promise<TrialClaimResult> {
    const base = Number(this.digits(payload.noSep, 5)) % 950000 + 100000;
    const groups = [
      { kode: "1", kdGroup: "GA", namaGroup: "Administrasi", jumlah: 1, biaya: 20000 },
      { kode: "2", kdGroup: "CBG", namaGroup: "Tindakan", jumlah: 1, biaya: base },
      { kode: "3", kdGroup: "OBS", namaGroup: "Penunjang", jumlah: 2, biaya: 85000 },
      { kode: "4", kdGroup: "OB", namaGroup: "Obat", jumlah: 1, biaya: 50000 },
    ];
    const totalBy40 = 23000;
    const totalBySouth = 54000;
    const ttlByGroup = groups.reduce((sum, g) => sum + g.biaya, 0);
    return {
      groupBy: groups,
      totalBy40,
      totalBySouth,
      ttlByGroup,
      raw: { noSep: payload.noSep, groupBy: groups, totalBy40, totalBySouth, ttlByGroup },
    };
  }
}

export function createMockProvider(): BpjsProvider {
  return new MockProvider();
}

export function isMockConnection(conn: Pick<BpjsConnection, "enabled" | "mockMode" | "consId" | "secretKey" | "userKey">): boolean {
  return conn.mockMode || !conn.enabled || !conn.consId || !conn.secretKey || !conn.userKey;
}