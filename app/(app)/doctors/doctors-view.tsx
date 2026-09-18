"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";

export interface DoctorRow {
  id: string;
  name: string;
  specialization: string | null;
}

export function DoctorsView({ doctors }: { doctors: DoctorRow[] }) {
  const columns: DataTableColumn<DoctorRow>[] = [
    { id: "name", header: "Nama Dokter", cell: (ctx) => <span className="font-medium">{ctx.row.original.name}</span> },
    { id: "specialization", header: "Spesialisasi", cell: (ctx) => ctx.row.original.specialization ?? "-" },
  ];
  return (
    <DataTable
      columns={columns}
      data={doctors}
      searchPlaceholder="Cari dokter..."
      emptyTitle="Tidak ada dokter"
      emptyDescription="Belum ada dokter terdaftar."
      exportable
      exportFilename="doctors"
    />
  );
}
