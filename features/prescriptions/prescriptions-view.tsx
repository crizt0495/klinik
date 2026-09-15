"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatTime } from "@/lib/utils";

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

export function PrescriptionsView({ prescriptions }: { prescriptions: PrescriptionRow[] }) {
  const router = useRouter();
  const columns: DataTableColumn<PrescriptionRow>[] = [
    { id: "number", header: "No. Resep", accessorFn: (r) => r.number, cell: (ctx) => <span className="font-medium">{ctx.row.original.number}</span> },
    { id: "patientName", header: "Pasien", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.patientName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p></div> },
    { id: "doctorName", header: "Dokter", accessorFn: (r) => r.doctorName },
    { id: "issuedAt", header: "Waktu", cell: (ctx) => ctx.row.original.issuedAt ? formatTime(ctx.row.original.issuedAt) : "-" },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return <DataTable columns={columns} data={prescriptions} searchPlaceholder="Cari resep..." emptyTitle="Tidak ada resep" emptyDescription="Belum ada resep." exportable exportFilename="resep" />;
}