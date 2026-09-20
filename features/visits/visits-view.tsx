"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";

export interface VisitRow {
  id: string;
  visitNumber: string;
  visitDate: string;
  visitType: string;
  status: string;
  chiefComplaint: string | null;
  patientName: string;
  patientMrn: string;
  patientId: string;
  doctorName: string;
  departmentName: string;
}

interface Props {
  visits: VisitRow[];
}

export function VisitsView({ visits }: Props) {
  const router = useRouter();
  const columns: DataTableColumn<VisitRow>[] = [
    { id: "visitNumber", header: "No. Kunjungan", accessorFn: (r) => r.visitNumber, cell: (ctx) => <span className="font-medium">{ctx.row.original.visitNumber}</span> },
    { id: "visitDate", header: "Tanggal", accessorFn: (r) => formatDate(r.visitDate) },
    { id: "patientName", header: "Pasien", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.patientName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p></div> },
    { id: "doctorName", header: "Dokter", accessorFn: (r) => r.doctorName },
    { id: "departmentName", header: "Poli", accessorFn: (r) => r.departmentName },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    { id: "chiefComplaint", header: "Keluhan Utama", accessorFn: (r) => r.chiefComplaint ?? "-", cell: (ctx) => <p className="max-w-[200px] truncate text-xs text-muted-foreground" title={ctx.row.original.chiefComplaint ?? ""}>{ctx.row.original.chiefComplaint ?? "-"}</p> },
  ];
  return (
    <DataTable
      columns={columns}
      data={visits}
      searchPlaceholder="Cari no. kunjungan / pasien..."
      emptyTitle="Tidak ada kunjungan"
      emptyDescription="Registrasikan kunjungan pasien baru."
      onRowClick={(row) => router.push(`/visits/${row.id}`)}
      exportable
      exportFilename="kunjungan"
    />
  );
}