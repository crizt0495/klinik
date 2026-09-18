"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

export interface InsuranceProviderRow {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
}

export function InsuranceView({ providers }: { providers: InsuranceProviderRow[] }) {
  const columns: DataTableColumn<InsuranceProviderRow>[] = [
    { id: "code", header: "Kode", cell: (ctx) => <span className="font-mono text-xs font-medium">{ctx.row.original.code}</span> },
    { id: "name", header: "Nama Asuransi", cell: (ctx) => <span className="font-medium">{ctx.row.original.name}</span> },
    { id: "phone", header: "Telepon", cell: (ctx) => ctx.row.original.phone ?? "-" },
    { id: "email", header: "Email", cell: (ctx) => ctx.row.original.email ?? "-" },
    { id: "address", header: "Alamat", cell: (ctx) => <span className="text-sm text-muted-foreground">{ctx.row.original.address ?? "-"}</span> },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={providers}
      searchPlaceholder="Cari asuransi..."
      emptyTitle="Tidak ada asuransi"
      emptyDescription="Belum ada penyedia asuransi."
      exportable
      exportFilename="insurance-providers"
    />
  );
}
