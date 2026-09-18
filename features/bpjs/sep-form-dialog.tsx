"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createSepAction } from "./actions";

export interface SepProvider { id: string; code: string; name: string }

const JNS_PELAYANAN: Array<[string, string]> = [
  ["1", "Rawat Inap"],
  ["2", "Rawat Jalan"],
  ["3", "Ambulans"],
  ["4", "Rumah Medis Sosial"],
  ["5", "Skrining Kesehatan"],
  ["6", "Operasi"],
  ["7", "Persalinan"],
];

const ASAL_RUJUKAN: Array<[string, string]> = [
  ["0", "Rujukan RS"],
  ["1", "Rujukan Puskesmas"],
  ["3", "Rujukan Faskes Lain"],
  ["4", "Manajemen Kasus"],
  ["5", "Kontrol dari Faskes"],
  ["6", "Lokal / Inisiatif Sendiri"],
  ["7", "Rujukan dari Dokter"],
  ["8", "Kecelakaan Kerja"],
  ["10", "Kontrol Post Rawat Inap"],
];

interface Props {
  providers: SepProvider[];
  defaultNoKartu?: string;
  triggerLabel?: string;
}

export function SepFormDialog({ providers, defaultNoKartu, triggerLabel = "Buat SEP" }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const bpjsProvider = providers.find((p) => p.code.toLowerCase().includes("bpjs"));
  const [noKartu, setNoKartu] = React.useState(defaultNoKartu ?? "");
  const [poliEksekutif, setPoliEksekutif] = React.useState("0");
  const [jnsPelayanan, setJnsPelayanan] = React.useState("2");
  const [asalRujukan, setAsalRujukan] = React.useState("6");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await createSepAction({}, fd);
      if (res.success && res.data && typeof res.data === "object" && "noSep" in res.data) {
        toast.success(`SEP ${String((res.data as { noSep: unknown }).noSep)} berhasil dibuat`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal membuat SEP");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> {triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat SEP Baru</DialogTitle>
          <DialogDescription>Surat Eligibilitas Peserta BPJS Kesehatan (VClaim).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <input type="hidden" name="insuranceProviderId" value={bpjsProvider?.id ?? providers[0]?.id ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nomor Kartu</Label>
              <Input name="noKartu" value={noKartu} onChange={(e) => setNoKartu(e.target.value)} placeholder="0002000000000" required minLength={11} />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal SEP</Label>
              <Input name="tglSep" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Jenis Pelayanan</Label>
              <Select name="jnsPelayanan" value={jnsPelayanan} onValueChange={setJnsPelayanan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JNS_PELAYANAN.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Asal Rujukan</Label>
              <Select name="asalRujukan" value={asalRujukan} onValueChange={setAsalRujukan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASAL_RUJUKAN.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Poli Tujuan</Label>
              <Input name="poliTujuan" placeholder="e.g. 12 / Penyakit Dalam" required />
            </div>
            <div className="space-y-1.5">
              <Label>Poli Eksekutif</Label>
              <Select name="poliEksekutif" value={poliEksekutif} onValueChange={setPoliEksekutif}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tidak</SelectItem>
                  <SelectItem value="1">Ya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>No. Rujukan</Label>
              <Input name="noRujukan" placeholder="(opsional)" />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Rujukan</Label>
              <Input name="tglRujukan" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>PPK Rujukan</Label>
              <Input name="ppkRujukan" placeholder="(opsional)" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>No. MR</Label>
              <Input name="noMR" placeholder="(opsional)" />
            </div>
            <div className="space-y-1.5">
              <Label>Diagnosa</Label>
              <Input name="diagnosa" placeholder="Diagnosa conforme ICD-10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Textarea name="catatan" placeholder="(opsional)" rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={busy || !bpjsProvider}>Simpan SEP</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}