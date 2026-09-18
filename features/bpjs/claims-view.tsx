"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { createClaimAction, submitClaimAction } from "./actions";

export interface ClaimRow {
  id: string;
  claimNumber: string;
  noSep: string | null;
  noKartu: string | null;
  namaPeserta: string | null;
  tglPulang: string | null;
  diagnosa: string | null;
  jumlahTagihan: string;
  ttlByGroup: string | null;
  status: string;
  createdAt: Date | string;
}

export interface VisitOption { id: string; visitNumber: string; visitDate: string; status: string; patientName: string; patientMrn: string }
export interface SepOption { id: string; noSep: string | null; nama: string | null }

interface Props {
  claims: ClaimRow[];
  visits: VisitOption[];
  seps: SepOption[];
  canCreate: boolean;
  canSubmit: boolean;
}

export function ClaimsView({ claims, visits, seps, canCreate, canSubmit }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await createClaimAction({}, fd);
      if (res.success) {
        toast.success("Klaim tersimpan sebagai DRAFT");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal membuat klaim");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runSubmit(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    const res = await submitClaimAction({}, fd);
    if (res.success) {
      toast.success("Klaim berhasil diajukan ke BPJS (trial claim)");
      router.refresh();
    } else {
      toast.error(res.error ?? "Gagal mengajukan klaim");
    }
  }

  const columns: DataTableColumn<ClaimRow>[] = [
    {
      id: "claimNumber",
      header: "No. Klaim",
      accessorFn: (r) => r.claimNumber,
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.claimNumber}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(ctx.row.original.createdAt)}</p>
        </div>
      ),
    },
    {
      id: "peserta",
      header: "Peserta / SEP",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.namaPeserta ?? "-"}</p>
          <p className="text-xs text-muted-foreground">{ctx.row.original.noSep ?? "-"}</p>
        </div>
      ),
    },
    { id: "tglPulang", header: "Tanggal Pulang", accessorFn: (r) => r.tglPulang },
    { id: "diagnosa", header: "Diagnosa", accessorFn: (r) => r.diagnosa ?? "-" },
    { id: "jumlahTagihan", header: "Tagihan", cell: (ctx) => <span className="font-medium">{formatIDR(ctx.row.original.jumlahTagihan)}</span> },
    { id: "ttlByGroup", header: "Hasil Trial", accessorFn: (r) => (r.ttlByGroup ? formatIDR(r.ttlByGroup) : "-") },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "actions",
      header: "",
      cell: (ctx) => {
        const r = ctx.row.original;
        const submitable = canSubmit && (r.status === "DRAFT" || r.status === "REJECTED");
        if (!submitable) return null;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.confirm(`Ajukan klaim ${r.claimNumber} ke BPJS (trial claim)?`)) return;
                runSubmit(r.id);
              }}
            >
              <Send className="h-3.5 w-3.5" /> Ajukan
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Buat Klaim</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Klaim BPJS</DialogTitle>
                <DialogDescription>Buat draft klaim dari kunjungan pasien BPJS.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>Kunjungan</Label>
                  <Select name="visitId" required>
                    <SelectTrigger><SelectValue placeholder="Pilih kunjungan" /></SelectTrigger>
                    <SelectContent>
                      {visits.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.visitNumber} — {v.patientName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>No. SEP (opsional)</Label>
                  <Select name="noSep">
                    <SelectTrigger><SelectValue placeholder="Otomatis dari kunjungan" /></SelectTrigger>
                    <SelectContent>
                      {seps.map((s) => s.noSep ? (
                        <SelectItem key={s.id} value={s.noSep}>{s.noSep} — {s.nama ?? ""}</SelectItem>
                      ) : null)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Tanggal Pulang</Label>
                    <Input name="tglPulang" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Diagnosa</Label>
                    <Input name="diagnosa" placeholder="Diagnosa ICD-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Catatan</Label>
                  <Textarea name="notes" rows={2} placeholder="(opsional)" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={busy}>Simpan Draft</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <DataTable columns={columns} data={claims} searchPlaceholder="Cari klaim / peserta..." emptyTitle="Belum ada klaim" emptyDescription="Buat draft klaim dari kunjungan pasien BPJS." />
    </div>
  );
}