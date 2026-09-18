"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatIDR } from "@/lib/utils";

export interface PaymentRow {
  id: string;
  paymentNumber: string;
  paymentDate: Date | string;
  amount: string;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  invoiceNumber: string | null;
  patientName: string | null;
  patientMrn: string | null;
}

export function PaymentsView({ payments }: { payments: PaymentRow[] }) {
  const columns: DataTableColumn<PaymentRow>[] = [
    { id: "paymentNumber", header: "No. Pembayaran", cell: (ctx) => <span className="nums font-mono text-xs font-medium">{ctx.row.original.paymentNumber}</span> },
    { id: "paymentDate", header: "Tanggal", cell: (ctx) => <span className="text-xs">{formatDateTime(ctx.row.original.paymentDate)}</span> },
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
    { id: "paymentMethod", header: "Metode", cell: (ctx) => ctx.row.original.paymentMethod },
    { id: "amount", header: "Jumlah", cell: (ctx) => <span className="nums font-medium">{formatIDR(ctx.row.original.amount)}</span> },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={payments}
      searchPlaceholder="Cari pembayaran..."
      emptyTitle="Tidak ada pembayaran"
      emptyDescription="Belum ada transaksi pembayaran."
      exportable
      exportFilename="payments"
    />
  );
}
