"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";

export interface MedicalRecordRow {
  id: string;
  visitId: string;
  patientName: string;
  patientMrn: string;
  doctorName: string | null;
  status: string;
  finalizedAt: Date | string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
}

export function MedicalRecordsView({ records }: { records: MedicalRecordRow[] }) {
  const router = useRouter();
  const columns: DataTableColumn<MedicalRecordRow>[] = [
    {
      id: "patientName",
      header: "Pasien",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.patientName}</p>
          <p className="nums text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p>
        </div>
      ),
    },
    { id: "doctorName", header: "Dokter", cell: (ctx) => ctx.row.original.doctorName ?? "-" },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "finalizedAt",
      header: "Finalisasi",
      cell: (ctx) => (ctx.row.original.finalizedAt ? formatDateTime(ctx.row.original.finalizedAt) : <span className="text-muted-foreground">Belum</span>),
    },
    { id: "updatedAt", header: "Diperbarui", cell: (ctx) => <span className="text-xs">{formatDate(ctx.row.original.updatedAt)}</span> },
    {
      id: "actions",
      header: "",
      cell: (ctx) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/visits/${ctx.row.original.visitId}`)}>
          <Eye className="h-4 w-4" />
          Detail
        </Button>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={records}
      searchPlaceholder="Cari rekam medis..."
      emptyTitle="Tidak ada rekam medis"
      emptyDescription="Belum ada rekam medis tercatat."
      exportable
      exportFilename="medical-records"
    />
  );
}
