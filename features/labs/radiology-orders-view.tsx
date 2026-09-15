"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";

export interface RadOrderRow { id: string; orderNumber: string; status: string; visitNumber: string; patientName: string; patientMrn: string; createdAt: Date | string }
export function RadiologyOrdersView({ orders }: { orders: RadOrderRow[] }) {
  const columns: DataTableColumn<RadOrderRow>[] = [
    { id: "orderNumber", header: "No. Order", cell: (ctx) => <span className="font-medium">{ctx.row.original.orderNumber}</span> },
    { id: "patientName", header: "Pasien", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.patientName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p></div> },
    { id: "visitNumber", header: "Kunjungan", accessorFn: (r) => r.visitNumber },
    { id: "createdAt", header: "Waktu", cell: (ctx) => formatDateTime(ctx.row.original.createdAt) },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return <DataTable columns={columns} data={orders} searchPlaceholder="Cari order radiologi..." emptyTitle="Tidak ada order" emptyDescription="Belum ada order radiologi." exportable exportFilename="radiologi" />;
}