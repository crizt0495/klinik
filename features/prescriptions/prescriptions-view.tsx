"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatTime } from "@/lib/utils";

export interface PrescriptionRow {
  id: string;
  number: string;
  status: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  issuedAt: Date | string | null;
  notes: string | null;
}

export interface PrescriptionItemDetail {
  id: string;
  medicationId: string;
  name: string;
  unit: string | null;
  quantity: number;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  instructions: string | null;
  dispensedQuantity: number;
  status: string;
}

export function PrescriptionsView({ prescriptions, details }: { prescriptions: PrescriptionRow[]; details: Array<{ prescriptionId: string; items: PrescriptionItemDetail[] }> }) {
  const [tab, setTab] = React.useState("all");
  const statuses = Array.from(new Set(prescriptions.map((p) => p.status)));
  const filtered = tab === "all" ? prescriptions : prescriptions.filter((p) => p.status === tab);

  const columns: DataTableColumn<PrescriptionRow>[] = [
    { id: "number", header: "No. Resep", accessorFn: (r) => r.number, cell: (ctx) => <span className="font-medium">{ctx.row.original.number}</span> },
    { id: "patientName", header: "Pasien", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.patientName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p></div> },
    { id: "doctorName", header: "Dokter", accessorFn: (r) => r.doctorName },
    { id: "issuedAt", header: "Waktu", cell: (ctx) => ctx.row.original.issuedAt ? formatTime(ctx.row.original.issuedAt) : "-" },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "detail",
      header: "",
      cell: (ctx) => {
        const r = ctx.row.original;
        const itemRows = details.find((d) => d.prescriptionId === r.id)?.items ?? [];
        return (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" /> Detail
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Detail Resep {r.number}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{r.patientName}</span>
                  <span>({r.patientMrn})</span>
                  <span className="text-muted-foreground">· {r.doctorName}</span>
                  <span className="text-muted-foreground">·</span>
                  <StatusBadge status={r.status} />
                </DialogDescription>
              </DialogHeader>
              {r.issuedAt ? <p className="text-sm text-muted-foreground">Diterbitkan {formatDateTime(r.issuedAt)}</p> : null}
              {r.notes ? (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium">Catatan</p>
                  <p className="mt-0.5 text-muted-foreground">{r.notes}</p>
                </div>
              ) : null}
              <Drx items={itemRows} />
            </DialogContent>
          </Dialog>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">Semua</TabsTrigger>
          {statuses.map((s) => (
            <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable columns={columns} data={filtered} searchPlaceholder="Cari resep..." emptyTitle="Tidak ada resep" emptyDescription="Belum ada resep." exportable exportFilename="resep" />
    </div>
  );
}

function Drx({ items }: { items: PrescriptionItemDetail[] }) {
  const columns: DataTableColumn<PrescriptionItemDetail>[] = [
    { id: "name", header: "Obat", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.name}</p>{ctx.row.original.unit ? <p className="text-xs text-muted-foreground">{ctx.row.original.unit}</p> : null}</div> },
    { id: "quantity", header: "Jumlah", cell: (ctx) => ctx.row.original.quantity },
    { id: "dosage", header: "Dosis", cell: (ctx) => ctx.row.original.dosage ?? "-" },
    { id: "frequency", header: "Frekuensi", cell: (ctx) => ctx.row.original.frequency ?? "-" },
    { id: "route", header: "Rute", cell: (ctx) => ctx.row.original.route ?? "-" },
    { id: "duration", header: "Durasi", cell: (ctx) => ctx.row.original.duration ?? "-" },
    { id: "dispensedQuantity", header: "Diberikan", cell: (ctx) => `${ctx.row.original.dispensedQuantity ?? 0} / ${ctx.row.original.quantity}` },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return <DataTable columns={columns} data={items} searchable={false} emptyTitle="Tidak ada item" emptyDescription="Resep tidak memiliki item obat." />;
}