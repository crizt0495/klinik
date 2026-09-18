"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatIDR } from "@/lib/utils";

export interface RefundRow {
  id: string;
  refundNumber: string;
  refundDate: Date | string;
  amount: string;
  reason: string | null;
  status: string;
  invoiceNumber: string | null;
  patientName: string | null;
  patientMrn: string | null;
}

export function RefundsView({ refunds }: { refunds: RefundRow[] }) {
  const columns: DataTableColumn<RefundRow>[] = [
    { id: "refundNumber", header: "No. Refund", cell: (ctx) => <span className="nums font-mono text-xs font-medium">{ctx.row.original.refundNumber}</span> },
    { id: "refundDate", header: "Tanggal", cell: (ctx) => <span className="text-xs">{formatDateTime(ctx.row.original.refundDate)}</span> },
    {
      id: "patientName",
      header: "Pasien",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.patientName ?? "-"}</p>
          {ctx.row.original.patientMrn ? <p className="nums text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p> : null}
        </div>
      ),
    },
    { id: "invoiceNumber", header: "Invoice", cell: (ctx) => <span className="nums font-mono text-xs">{ctx.row.original.invoiceNumber ?? "-"}</span> },
    { id: "amount", header: "Jumlah", cell: (ctx) => <span className="nums font-medium text-destructive">{formatIDR(ctx.row.original.amount)}</span> },
    { id: "reason", header: "Alasan", cell: (ctx) => <span className="text-sm text-muted-foreground">{ctx.row.original.reason ?? "-"}</span> },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={refunds}
      searchPlaceholder="Cari refund..."
      emptyTitle="Tidak ada refund"
      emptyDescription="Belum ada transaksi refund."
      exportable
      exportFilename="refunds"
    />
  );
}
