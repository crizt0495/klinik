"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { checkEligibilityAction } from "./actions";

export interface EligibilityRow {
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
  userName: string | null;
  createdAt: Date | string;
}

interface Props {
  recentChecks: EligibilityRow[];
}

export function ParticipantCheck({ recentChecks }: Props) {
  const router = useRouter();
  const [type, setType] = React.useState<"nokartu" | "nik" | "nama">("nokartu");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    status: string;
    errorMessage: string | null;
    noKartu: string | null;
    nama: string | null;
    jnsPeserta: string | null;
    hakKelas: string | null;
    statusPeserta: string | null;
  } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await checkEligibilityAction({}, fd);
      if (res.success && res.data && typeof res.data === "object") {
        const d = res.data as typeof result;
        setResult(d);
        toast.success("Peserta ditemukan");
        router.refresh();
      } else {
        const err = res.error ?? "Peserta tidak ditemukan / gagal diperiksa";
        setResult({ status: "FAILED", errorMessage: err, noKartu: null, nama: null, jnsPeserta: null, hakKelas: null, statusPeserta: null });
        toast.error(err);
      }
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<EligibilityRow>[] = [
    {
      id: "peserta",
      header: "Peserta",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.nama ?? ctx.row.original.lookupValue}</p>
          <p className="text-xs text-muted-foreground">{ctx.row.original.noKartu ?? ctx.row.original.lookupValue}</p>
        </div>
      ),
    },
    { id: "checkType", header: "Cek", accessorFn: (r) => r.checkType },
    { id: "jnsPeserta", header: "Jenis Peserta", accessorFn: (r) => r.jnsPeserta ?? "-" },
    { id: "hakKelas", header: "Hak Kelas", accessorFn: (r) => r.hakKelas ?? "-" },
    { id: "statusPeserta", header: "Status Peserta", accessorFn: (r) => r.statusPeserta ?? "-" },
    { id: "nama", header: "Kasir", accessorFn: (r) => r.userName ?? "-" },
    { id: "waktu", header: "Waktu", cell: (ctx) => formatDateTime(ctx.row.original.createdAt) },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[180px_1fr_auto] items-end">
            <div className="space-y-1.5">
              <Label>Jenis Pencarian</Label>
              <Select name="type" value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nokartu">No. Kartu BPJS</SelectItem>
                  <SelectItem value="nik">NIK</SelectItem>
                  <SelectItem value="nama">Nama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{type === "nokartu" ? "Nomor Kartu" : type === "nik" ? "NIK" : "Nama Peserta"}</Label>
              <div className="flex flex-wrap gap-3">
                <Input name="value" placeholder={type === "nama" ? "Nama lengkap peserta" : "Nomor tanpa spasi"} className="flex-1 sm:min-w-56" required minLength={type === "nama" ? 3 : 11} />
                {type === "nama" && <Input name="birthDate" type="date" className="sm:w-44" aria-label="Tanggal lahir" />}
              </div>
            </div>
            <Button type="submit" disabled={busy} className="h-9"><Search className="h-4 w-4" /> {busy ? "Memeriksa..." : "Cek Peserta"}</Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Hasil Pemeriksaan</h3>
                <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <p><span className="text-muted-foreground">No. Kartu:</span> <b>{result.noKartu ?? "-"}</b></p>
                  <p><span className="text-muted-foreground">Nama:</span> <b>{result.nama ?? "-"}</b></p>
                  <p><span className="text-muted-foreground">Jenis Peserta:</span> {result.jnsPeserta ?? "-"}</p>
                  <p><span className="text-muted-foreground">Hak Kelas:</span> {result.hakKelas ?? "-"}</p>
                  <p><span className="text-muted-foreground">Status Peserta:</span> {result.statusPeserta ?? "-"}</p>
                </div>
                {result.errorMessage && <p className="mt-2 text-sm text-red-600">{result.errorMessage}</p>}
              </div>
              {result.status === "SUCCESS" && result.noKartu && (
                <Button size="sm" variant="outline" onClick={() => router.push(`/bpjs/sep?noKartu=${encodeURIComponent(result.noKartu!)}`)}>
                  Buat SEP
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable columns={columns} data={recentChecks} searchPlaceholder="Cari riwayat cek peserta..." emptyTitle="Belum ada pemeriksaan" emptyDescription="Gunakan form di atas untuk memeriksa kelayakan peserta." />
    </div>
  );
}