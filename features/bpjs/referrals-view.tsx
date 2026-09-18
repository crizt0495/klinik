"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { refreshReferralsAction, updateReferralAction } from "./actions";

export interface ReferralRow {
  id: string;
  noRujukan: string;
  jenisRujukan: string | null;
  jenisPelayanan: string | null;
  tglRujukan: string | null;
  tglAkhirRujukan: string | null;
  noKartu: string | null;
  nik: string | null;
  namaPeserta: string | null;
  asalFaskesNama: string | null;
  poliRujukanNama: string | null;
  poliRujukanKode: string | null;
  diagnosaNama: string | null;
  catatan: string | null;
  status: string;
}

interface Props {
  referrals: ReferralRow[];
  canRefresh: boolean;
  canUpdate: boolean;
}

export function ReferralsView({ referrals, canRefresh, canUpdate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [target, setTarget] = React.useState<ReferralRow | null>(null);
  const [kodePoli, setKodePoli] = React.useState("");
  const [kodeDokter, setKodeDokter] = React.useState("");

  async function refresh(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await refreshReferralsAction({}, fd);
      if (res.success) {
        const count = res.data && typeof res.data === "object" && "count" in res.data ? String((res.data as { count: unknown }).count) : "0";
        toast.success(`${count} rujukan dimuat dari BPJS`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal mengambil rujukan");
      }
    } finally {
      setBusy(false);
    }
  }

  async function updatePoli(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target) return;
    const fd = new FormData();
    fd.set("id", target.id);
    fd.set("kodePoli", kodePoli);
    if (kodeDokter) fd.set("kodeDokter", kodeDokter);
    const res = await updateReferralAction({}, fd);
    if (res.success) {
      toast.success("Poli rujukan diperbarui");
      setTarget(null);
      router.refresh();
    } else {
      toast.error(res.error ?? "Gagal memperbarui rujukan");
    }
  }

  const columns: DataTableColumn<ReferralRow>[] = [
    {
      id: "noRujukan",
      header: "No. Rujukan",
      accessorFn: (r) => r.noRujukan,
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.noRujukan}</p>
          <p className="text-xs text-muted-foreground">{ctx.row.original.tglRujukan ?? "-"}</p>
        </div>
      ),
    },
    {
      id: "peserta",
      header: "Peserta",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.namaPeserta ?? "-"}</p>
          <p className="text-xs text-muted-foreground">{ctx.row.original.noKartu}</p>
        </div>
      ),
    },
    { id: "asalFaskesNama", header: "Asal Faskes", accessorFn: (r) => r.asalFaskesNama },
    { id: "poliRujukanNama", header: "Poli Rujukan", accessorFn: (r) => r.poliRujukanNama ?? "-" },
    { id: "diagnosaNama", header: "Diagnosa", accessorFn: (r) => r.diagnosaNama ?? "-" },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "actions",
      header: "",
      cell: (ctx) => {
        if (!canUpdate) return null;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTarget(ctx.row.original);
                setKodePoli(ctx.row.original.poliRujukanKode ?? "");
                setKodeDokter("");
              }}
            >
              Ubah Poli
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {canRefresh && (
        <form onSubmit={refresh} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Nomor Kartu BPJS</Label>
            <Input name="noKartu" placeholder="0002000000000" minLength={11} required />
          </div>
          <Button type="submit" disabled={busy} className="h-9"><RefreshCw className="h-4 w-4" /> {busy ? "Memuat..." : "Muat Rujukan dari BPJS"}</Button>
        </form>
      )}
      <DataTable columns={columns} data={referrals} searchPlaceholder="Cari rujukan / peserta..." emptyTitle="Belum ada rujukan" emptyDescription="Muat rujukan peserta di atas untuk menampilkan data." />

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <form onSubmit={updatePoli} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Ubah Poli Rujukan</DialogTitle>
              <DialogDescription>{target?.noRujukan} · {target?.namaPeserta}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Kode Poli Tujuan</Label>
                <Input value={kodePoli} onChange={(e) => setKodePoli(e.target.value)} placeholder="e.g. 12" required />
              </div>
              <div className="space-y-1.5">
                <Label>Kode Dokter (opsional)</Label>
                <Input value={kodeDokter} onChange={(e) => setKodeDokter(e.target.value)} placeholder="e.g. 27" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}