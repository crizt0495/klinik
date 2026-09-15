"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatIDR } from "@/lib/utils";

export interface InvoiceRow { id: string; number: string; status: string; totalAmount: string; paidAmount: string; patientName: string; patientMrn: string; visitNumber: string; createdAt: Date | string }

export function InvoicesView({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const columns: DataTableColumn<InvoiceRow>[] = [
    { id: "number", header: "No. Invoice", accessorFn: (r) => r.number, cell: (ctx) => <span className="font-medium">{ctx.row.original.number}</span> },
    { id: "patientName", header: "Pasien", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.patientName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p></div> },
    { id: "visitNumber", header: "Kunjungan", accessorFn: (r) => r.visitNumber },
    { id: "totalAmount", header: "Total", cell: (ctx) => <span className="font-medium">{formatIDR(ctx.row.original.totalAmount)}</span> },
    { id: "paidAmount", header: "Dibayar", cell: (ctx) => <span className="text-green-600">{formatIDR(ctx.row.original.paidAmount)}</span> },
    { id: "createdAt", header: "Waktu", cell: (ctx) => formatDateTime(ctx.row.original.createdAt) },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return <DataTable columns={columns} data={invoices} searchPlaceholder="Cari invoice..." emptyTitle="Tidak ada invoice" emptyDescription="Belum ada tagihan." exportable exportFilename="tagihan" onRowClick={(row) => router.push(`/billing/${row.id}`)} />;
}