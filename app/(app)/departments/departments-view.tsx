"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

export interface DepartmentRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
}

export function DepartmentsView({ departments }: { departments: DepartmentRow[] }) {
  const columns: DataTableColumn<DepartmentRow>[] = [
    { id: "code", header: "Kode", cell: (ctx) => <span className="font-mono text-xs font-medium">{ctx.row.original.code}</span> },
    { id: "name", header: "Nama Poli", cell: (ctx) => <span className="font-medium">{ctx.row.original.name}</span> },
    { id: "description", header: "Deskripsi", cell: (ctx) => <span className="text-sm text-muted-foreground">{ctx.row.original.description ?? "-"}</span> },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={departments}
      searchPlaceholder="Cari poli..."
      emptyTitle="Tidak ada poli"
      emptyDescription="Belum ada data poli."
      exportable
      exportFilename="departments"
    />
  );
}
