import { createHmac, createDecipheriv, createHash } from "crypto";
import type { BpjsConnection, EligibilityInput, Participant, Referral, SepPayload, SepResult, TrialClaimPayload, TrialClaimResult, BpjsProvider } from "./types";
import { BpjsApiError, fromBpjsDate } from "./types";

/**
 * VClaim (BPJS Kesehatan) REST client.
 *
 * Authentication follows the VClaim specification:
 *  - X-cons-id        : identitas aplikasi (Consumer ID)
 *  - X-timestamp      : epoch milliseconds
 *  - X-signature      : HMAC-SHA256 hex of `<consId>&<timestamp>` signed with secret key
 *  - X-authorization  : Basic base64(`<userKey>:<userKey>`)
 *
 * On newer VClaim environments the `response` field is encrypted with
 * AES-256-CBC using `md5(secretKey)` as the key and the first 16 bytes of the
 * ciphertext as the IV. Plain-JSON responses are accepted as well.
 *
 * Endpoint paths below are centralized — when integrating with a live
 * environment, adjust the path template to your provisioned service version
 * if necessary (SEP 1.1 vs 2.0).
 */

const PATHS = {
  pesertaNokartu: (noKartu: string, tglSep: string) => `/Peserta/nokartu/${encodeURIComponent(noKartu)}/tglSEP/${encodeURIComponent(tglSep)}`,
  pesertaNik: (nik: string, tglSep: string) => `/Peserta/nik/${encodeURIComponent(nik)}/tglSEP/${encodeURIComponent(tglSep)}`,
  pesertaName: (nama: string, jenis: string, tglSep: string, prov: string, kab: string) =>
    `/Peserta/namafaskes/${encodeURIComponent(nama)}/jenis/${encodeURIComponent(jenis)}/tglSEP/${encodeURIComponent(tglSep)}/provinsi/${encodeURIComponent(prov)}/kabupaten/${encodeURIComponent(kab)}`,
  sepInsert: () => `/SEP/1.1/Insert`,
  sepUpdate: () => `/SEP/1.1/Update`,
  sepDelete: () => `/SEP/1.1/Delete`,
  rujukanPeserta: (noKartu: string) => `/Rujukan/Peserta/${encodeURIComponent(noKartu)}`,
  rujukanHistory: (noKartu: string) => `/Rujukan/List/Peserta/${encodeURIComponent(noKartu)}`,
  rujukanDetail: (noRujukan: string) => `/Rujukan/${encodeURIComponent(noRujukan)}`,
  rujukanUpdate: () => `/Rujukan/Update`,
  trialClaim: () => `/TrialClaim`,
};

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

export function decryptVClaimResponse(secretKey: string, encrypted: string): string {
  const key = Buffer.from(md5(secretKey), "utf8");
  const data = Buffer.from(encrypted, "base64");
  if (data.length < 16) {
    throw new BpjsApiError("DECRYPT", "Respon BPJS tidak valid (terlalu pendek)", encrypted);
  }
  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

function extractResponse(secretKey: string, body: unknown): { metaData: { code: string; message: string } | null; response: unknown } {
  const metaData = (body as { metaData?: { code?: string; message?: string } })?.metaData ?? null;
  const rawResponse = (body as { response?: unknown })?.response;
  let response: unknown = rawResponse;

  if (typeof rawResponse === "string") {
    const asJson = safeJson(rawResponse);
    if (asJson !== null) {
      response = asJson;
    } else if (secretKey) {
      try {
        const decrypted = decryptVClaimResponse(secretKey, rawResponse);
        response = safeJson(decrypted) ?? decrypted;
      } catch {
        response = rawResponse;
      }
    }
  }
  if (response === undefined) response = null;
  return { metaData: metaData as { code: string; message: string } | null, response };
}

export class VClaimProvider implements BpjsProvider {
  private readonly cfg: BpjsConnection;
  private readonly commonExtraHeaders: Record<string, string>;

  constructor(cfg: BpjsConnection) {
    this.cfg = cfg;
    this.commonExtraHeaders = {};
    if (process.env.BPJS_EXTRA_HEADERS) {
      try {
        const parsed = JSON.parse(process.env.BPJS_EXTRA_HEADERS) as Record<string, string>;
        for (const [k, v] of Object.entries(parsed)) this.commonExtraHeaders[k] = v;
      } catch {
        // ignore malformed extra headers
      }
    }
  }

  private headers(): Record<string, string> {
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", this.cfg.secretKey)
      .update(`${this.cfg.consId}&${timestamp}`)
      .digest("hex");
    const auth = Buffer.from(`${this.cfg.userKey}:${this.cfg.userKey}`).toString("base64");
    return {
      "X-cons-id": this.cfg.consId,
      "X-timestamp": timestamp,
      "X-signature": signature,
      "X-authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.commonExtraHeaders,
    };
  }

  private async request(method: string, path: string, body?: unknown): Promise<{ metaData: { code: string; message: string } | null; response: unknown }> {
    if (!this.cfg.serviceBaseUrl) {
      throw new BpjsApiError("CONFIG", "URL layanan BPJS belum dikonfigurasi");
    }
    const url = `${this.cfg.serviceBaseUrl.replace(/\/$/, "")}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new BpjsApiError("NETWORK", `Tidak dapat terhubung ke layanan BPJS: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    const parsed = safeJson(text);
    const payload = parsed !== null ? parsed : { response: text };
    const { metaData, response } = extractResponse(this.cfg.secretKey, payload);

    if (metaData && metaData.code && metaData.code !== "200") {
      throw new BpjsApiError(String(metaData.code), metaData.message || "Layanan BPJS menolak permintaan", payload);
    }
    if (!res.ok) {
      throw new BpjsApiError(String(res.status), `HTTP ${res.status} dari layanan BPJS`, payload);
    }
    return { metaData, response };
  }

  private participantFromResponse(response: unknown): Participant {
    const r = (response ?? {}) as Record<string, unknown>;
    const peserta = (r.peserta ?? {}) as Record<string, unknown>;
    const hakKelas = (peserta.hakKelas ?? {}) as Record<string, unknown>;
    const jns = (peserta.jnsPeserta ?? {}) as Record<string, unknown>;
    const mr = (peserta.mr ?? {}) as Record<string, unknown>;
    const provUmum = (peserta.provUmum ?? {}) as Record<string, unknown>;
    const kabUmum = (peserta.kabUmum ?? {}) as Record<string, unknown>;
    const asalFaskes = (peserta.asalFaskes ?? {}) as Record<string, unknown>;
    const fktp = (peserta.fktp ?? {}) as Record<string, unknown>;
    return {
      noKartu: String(peserta.noKartu ?? ""),
      nik: peserta.nik ? String(peserta.nik) : null,
      nama: String(peserta.nama ?? ""),
      tglLahir: fromBpjsDate(peserta.tglLahir ? String(peserta.tglLahir) : null),
      sex: peserta.sex ? String(peserta.sex) : null,
      jnsPeserta: String(jns.nmJenisPeserta ?? peserta.jnsPeserta ?? ""),
      hakKelas: hakKelas.kdKelas ? String(hakKelas.kdKelas) : null,
      penjamin: String(r.penjamin ?? ""),
      noMR: mr.noMR ? String(mr.noMR) : null,
      statusPeserta: r.statusPeserta ? String(r.statusPeserta) : null,
      provUmum: provUmum.nmProvinsi ? String(provUmum.nmProvinsi) : null,
      kabUmum: kabUmum.nmKabupaten ? String(kabUmum.nmKabupaten) : null,
      asalFaskes: asalFaskes.nama ? { kode: String(asalFaskes.kode ?? ""), nama: String(asalFaskes.nama) } : null,
      fktp: fktp.nama ? { kode: String(fktp.kode ?? ""), nama: String(fktp.nama) } : null,
      raw: response,
    };
  }

  async checkEligibility(input: EligibilityInput): Promise<Participant> {
    const tglSep = input.tglSep ?? new Date().toISOString().slice(0, 10);
    let path = "";
    if (input.type === "nokartu") path = PATHS.pesertaNokartu(input.value, tglSep);
    else if (input.type === "nik") path = PATHS.pesertaNik(input.value, tglSep);
    else {
      const jenis = "2";
      const prov = "0";
      const kab = "0";
      path = PATHS.pesertaName(input.value, jenis, tglSep, prov, kab);
    }
    const { response } = await this.request("GET", path);
    return this.participantFromResponse(response);
  }

  private buildSepBody(payload: SepPayload & { noSep?: string }): unknown {
    const t_sep: Record<string, unknown> = {
      noKartu: payload.noKartu,
      tglSep: payload.tglSep,
      ppkPelayanan: this.cfg.faskesCode ?? "",
      jnsPelayanan: payload.jnsPelayanan,
      klsRawat: {
        klsRawatHak: payload.klasRawatHak ?? "",
        klsRawatNaik: payload.klasRawatNaik ?? "",
        pembiayaan: payload.pembiayaan ?? "1",
        penanggungPembiayaan: payload.penanggungPembiayaan ?? "1",
        klsRawatCatatan: "",
      },
      noMR: payload.noMR ?? "",
      rujukan: {
        asalRujukan: payload.asalRujukan,
        tglRujukan: payload.tglRujukan ?? "",
        noRujukan: payload.noRujukan ?? "",
        ppkRujukan: payload.ppkRujukan ?? "",
      },
      catatan: payload.catatan ?? "",
      diagAwal: payload.diagnosa ?? "",
      poli: {
        tujuan: payload.poliTujuan,
        eksekutif: payload.poliEksekutif ?? "0",
      },
      cob: { cob: payload.cob ?? "0" },
      katarak: { katarak: payload.katarak ?? "0" },
      jaminan: {
        lakaLantas: payload.lakaLantas ?? "0",
        penjamin: {
          tglKejadian: "",
          keterangan: "",
          suplesi: { suplesi: "0", noSepSuplesi: "", lokasiLaka: "" },
        },
      },
      tujuanKunj: payload.tujuanKunj ?? "0",
      flagProcedure: "0",
      kdPenunjang: [],
      assesmentPel: "0",
    };
    if (payload.noSep) t_sep.noSep = payload.noSep;
    if (payload.user) t_sep.user = payload.user;
    return { request: { t_sep } };
  }

  private sepFromResponse(response: unknown): SepResult {
    const r = (response ?? {}) as Record<string, unknown>;
    const sep = (r.sep ?? {}) as Record<string, unknown>;
    return {
      noSep: String(sep.noSep ?? r.noSep ?? ""),
      noKartu: String(sep.noKartu ?? r.noKartu ?? ""),
      nik: sep.nik ? String(sep.nik) : null,
      nama: String(sep.nama ?? r.nama ?? ""),
      tglLahir: fromBpjsDate(sep.tglLahir ? String(sep.tglLahir) : null),
      jnsPelayanan: sep.jnsPelayanan ? String(sep.jnsPelayanan) : null,
      poli: sep.poli ? String(sep.poli) : null,
      poliEksekutif: sep.poliEksekutif ? String(sep.poliEksekutif) : null,
      asalRujukan: sep.asalRujukan ? String(sep.asalRujukan) : null,
      noRujukan: sep.noRujukan ? String(sep.noRujukan) : null,
      diagnosa: sep.diagAwal ? String(sep.diagAwal) : null,
      raw: response,
    };
  }

  async createSep(payload: SepPayload): Promise<SepResult> {
    const { response } = await this.request("POST", PATHS.sepInsert(), this.buildSepBody(payload));
    return this.sepFromResponse(response);
  }

  async updateSep(payload: SepPayload & { noSep: string }): Promise<SepResult> {
    const body = this.buildSepBody(payload);
    const sepBody = (body as { request: { t_sep: Record<string, unknown> } }).request.t_sep;
    sepBody.noSep = payload.noSep;
    sepBody.user = payload.user ?? "";
    const { response } = await this.request("POST", PATHS.sepUpdate(), { request: { t_sep: sepBody } });
    return this.sepFromResponse(response);
  }

  async deleteSep(payload: { noSep: string; user?: string; noKartu?: string }): Promise<{ noSep: string; status: string }> {
    const body = { request: { t_sep: { noSep: payload.noSep, user: payload.user ?? "" } } };
    await this.request("DELETE", PATHS.sepDelete(), body);
    return { noSep: payload.noSep, status: "DELETED" };
  }

  private referralFromResponse(item: Record<string, unknown>): Referral {
    const asal = (item.asalFaskes ?? {}) as Record<string, unknown>;
    const poli = (item.poliRujukan ?? {}) as Record<string, unknown>;
    const poliTujuan = (item.poliTujuan ?? {}) as Record<string, unknown>;
    const diag = (item.diagnosa ?? {}) as Record<string, unknown>;
    return {
      noRujukan: String(item.noRujukan ?? ""),
      jenisRujukan: item.jenisRujukan ? String(item.jenisRujukan) : null,
      jenisPelayanan: item.jenisPelayanan ? String(item.jenisPelayanan) : null,
      tglRujukan: fromBpjsDate(item.tglRujukan ? String(item.tglRujukan) : null),
      tglKunjungan: fromBpjsDate(item.tglKunjungan ? String(item.tglKunjungan) : null),
      tglAkhirRujukan: fromBpjsDate(item.tglAkhirRujukan ? String(item.tglAkhirRujukan) : null),
      noKartu: item.noKartu ? String(item.noKartu) : null,
      nik: item.nik ? String(item.nik) : null,
      namaPeserta: String(item.nama ?? item.namaPeserta ?? ""),
      asalFaskes: asal.nama ? { kode: String(asal.kode ?? ""), nama: String(asal.nama) } : null,
      poliRujukan: poli.nama ? { kode: String(poli.kode ?? ""), nama: String(poli.nama) } : null,
      poliTujuan: poliTujuan.nama ? { kode: String(poliTujuan.kode ?? ""), nama: String(poliTujuan.nama) } : null,
      diagnosa: diag.nama ? { kode: String(diag.kode ?? ""), nama: String(diag.nama) } : null,
      catatan: item.catatan ? String(item.catatan) : null,
      status: item.status ? String(item.status) : null,
      raw: item,
    };
  }

  async getReferrals(noKartu: string): Promise<Referral[]> {
    const { response } = await this.request("GET", PATHS.rujukanPeserta(noKartu));
    const list = (response as { rujukan?: unknown[] })?.rujukan ?? [];
    return list.map((r) => this.referralFromResponse(r as Record<string, unknown>));
  }

  async getReferralHistory(noKartu: string): Promise<Referral[]> {
    const { response } = await this.request("GET", PATHS.rujukanHistory(noKartu));
    const list = (response as { rujukan?: unknown[] })?.rujukan ?? [];
    return list.map((r) => this.referralFromResponse(r as Record<string, unknown>));
  }

  async getReferral(noRujukan: string): Promise<Referral> {
    const { response } = await this.request("GET", PATHS.rujukanDetail(noRujukan));
    return this.referralFromResponse((response ?? {}) as Record<string, unknown>);
  }

  async updateReferral(payload: { noRujukan: string; kodePoli: string; kodeDokter?: string }): Promise<{ noRujukan: string; status: string }> {
    const body = {
      request: {
        t_rujukan: {
          noRujukan: payload.noRujukan,
          kodePoli: payload.kodePoli,
          kodeDokter: payload.kodeDokter ?? "",
        },
      },
    };
    const { response } = await this.request("POST", PATHS.rujukanUpdate(), body);
    const r = (response ?? {}) as Record<string, unknown>;
    return { noRujukan: String(r.noRujukan ?? payload.noRujukan), status: String(r.status ?? "200") };
  }

  async trialClaim(payload: TrialClaimPayload): Promise<TrialClaimResult> {
    const body = {
      noSep: payload.noSep,
      diagnosa: payload.diagnosa,
      tglPelayanan: payload.tglPelayanan,
      tglPulang: payload.tglPulang,
    };
    const { response } = await this.request("POST", PATHS.trialClaim(), body);
    return this.trialClaimFromResponse(response);
  }

  private trialClaimFromResponse(response: unknown): TrialClaimResult {
    const r = (response ?? {}) as Record<string, unknown>;
    const rawGroup = Array.isArray(r.groupBy) ? (r.groupBy as Record<string, unknown>[]) : [];
    const groupBy = rawGroup.map((g) => ({
      kode: String(g.kode ?? g.kdGroup ?? ""),
      kdGroup: String(g.kdGroup ?? g.kode ?? ""),
      namaGroup: String(g.namaGroup ?? ""),
      jumlah: Number(g.jumlah ?? 0),
      biaya: Number(g.biaya ?? 0),
    }));
    return {
      groupBy,
      totalBy40: Number(r.totalBy40 ?? 0),
      totalBySouth: Number(r.totalBySouth ?? 0),
      ttlByGroup: Number(r.ttlByGroup ?? 0),
      raw: response,
    };
  }
}