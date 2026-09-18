"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

export interface StaffRow {
  id: string;
  employeeNumber: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  staffType: string;
  status: string;
  username: string | null;
}

export function StaffView({ staff }: { staff: StaffRow[] }) {
  const columns: DataTableColumn<StaffRow>[] = [
    { id: "employeeNumber", header: "No. Pegawai", cell: (ctx) => <span className="nums font-mono text-xs font-medium">{ctx.row.original.employeeNumber}</span> },
    { id: "fullName", header: "Nama", cell: (ctx) => <span className="font-medium">{ctx.row.original.fullName}</span> },
    { id: "staffType", header: "Tipe", cell: (ctx) => ctx.row.original.staffType },
    { id: "username", header: "Akun", cell: (ctx) => ctx.row.original.username ?? <span className="text-muted-foreground">-</span> },
    { id: "phone", header: "Telepon", cell: (ctx) => ctx.row.original.phone ?? "-" },
    { id: "email", header: "Email", cell: (ctx) => ctx.row.original.email ?? "-" },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={staff}
      searchPlaceholder="Cari tenaga medis..."
      emptyTitle="Tidak ada tenaga medis"
      emptyDescription="Belum ada tenaga medis terdaftar."
      exportable
      exportFilename="staff"
    />
  );
}
