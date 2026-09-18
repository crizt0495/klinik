"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, MoreHorizontal } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/utils";
import { cancelSepAction } from "./actions";
import { SepFormDialog, type SepProvider } from "./sep-form-dialog";

export interface SepRow {
  id: string;
  noSep: string | null;
  noKartu: string;
  nama: string | null;
  tglSep: string;
  jnsPelayanan: string;
  poliTujuan: string | null;
  diagnosa: string | null;
  statusSubmit: string;
  status: string;
  visitId: string | null;
  createdAt: Date | string;
}

interface Props {
  seps: SepRow[];
  providers: SepProvider[];
  canCreate: boolean;
  canCancel: boolean;
  defaultNoKartu?: string;
}

export function SepView({ seps, providers, canCreate, canCancel, defaultNoKartu }: Props) {
  const router = useRouter();

  const columns: DataTableColumn<SepRow>[] = [
    {
      id: "noSep",
      header: "No. SEP",
      accessorFn: (r) => r.noSep,
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.noSep ?? "-"}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(ctx.row.original.createdAt)}</p>
        </div>
      ),
    },
    {
      id: "peserta",
      header: "Peserta",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.nama ?? "-"}</p>
          <p className="text-xs text-muted-foreground">{ctx.row.original.noKartu}</p>
        </div>
      ),
    },
    { id: "tglSep", header: "Tanggal SEP", accessorFn: (r) => r.tglSep },
    { id: "poliTujuan", header: "Poli Tujuan", accessorFn: (r) => r.poliTujuan },
    {
      id: "statusSubmit",
      header: "Submit",
      cell: (ctx) => <StatusBadge status={ctx.row.original.statusSubmit} />,
    },
    {
      id: "status",
      header: "Status",
      cell: (ctx) => <StatusBadge status={ctx.row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: (ctx) => {
        const r = ctx.row.original;
        if (!canCancel) return null;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={r.status === "INACTIVE" || r.statusSubmit === "DELETED" || !r.noSep}
                  onSelect={async () => {
                    if (!window.confirm(`Batalkan SEP ${r.noSep}?`)) return;
                    const fd = new FormData();
                    fd.set("id", r.id);
                    const res = await cancelSepAction({}, fd);
                    if (res.success) {
                      toast.success("SEP dibatalkan");
                      router.refresh();
                    } else {
                      toast.error(res.error ?? "Gagal membatalkan SEP");
                    }
                  }}
                >
                  Batalkan SEP
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {canCreate ? <SepFormDialog providers={providers} defaultNoKartu={defaultNoKartu} /> : <span />}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Info className="h-4 w-4" /> Info Field</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Jenis Pelayanan SEP</DialogTitle>
              <DialogDescription>Kode yang dipakai pada form SEP.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-1.5 text-sm">
              <p><b>1</b> — Rawat Inap</p>
              <p><b>2</b> — Rawat Jalan</p>
              <p><b>3</b> — Ambulans</p>
              <p><b>4</b> — Rumah Medis Sosial</p>
              <p><b>5</b> — Skrining Kesehatan</p>
              <p><b>6</b> — Operasi</p>
              <p><b>7</b> — Persalinan</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={seps} searchPlaceholder="Cari SEP / peserta..." emptyTitle="Belum ada SEP" emptyDescription="Buat SEP pertama untuk pasien BPJS." />
    </div>
  );
}