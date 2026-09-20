"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatIDR } from "@/lib/utils";

export interface PORow {
  id: string;
  number: string;
  status: string;
  supplierName: string;
  totalAmount: string;
  expectedDate: Date | string | null;
  createdAt: Date | string;
}

export function POView({ orders }: { orders: PORow[] }) {
  const router = useRouter();
  const columns: DataTableColumn<PORow>[] = [
    { id: "number", header: "No. PO", accessorFn: (r) => r.number, cell: (ctx) => <span className="font-medium">{ctx.row.original.number}</span> },
    { id: "supplierName", header: "Supplier", accessorFn: (r) => r.supplierName },
    { id: "totalAmount", header: "Total", cell: (ctx) => <span className="font-medium">{formatIDR(ctx.row.original.totalAmount)}</span> },
    { id: "expectedDate", header: "Tgl Diharapkan", cell: (ctx) => ctx.row.original.expectedDate ? formatDate(ctx.row.original.expectedDate) : "-" },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return <DataTable columns={columns} data={orders} searchPlaceholder="Cari PO..." emptyTitle="Tidak ada PO" emptyDescription="Belum ada purchase order." exportable exportFilename="purchase-order" onRowClick={(row) => router.push(`/purchasing/${row.id}`)} />;
}