"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatIDR } from "@/lib/utils";

export interface InventoryRow {
  batchId: string;
  batchNumber: string;
  expiryDate: Date | string;
  quantityAvailable: number;
  quantityReceived: number;
  purchasePrice: string;
  medicationId: string;
  medicationCode: string;
  medicationName: string;
  unit: string;
  category: string | null;
}

export function InventoryView({ items }: { items: InventoryRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const columns: DataTableColumn<InventoryRow>[] = [
    { id: "medicationName", header: "Obat", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.medicationName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.medicationCode}</p></div> },
    { id: "batchNumber", header: "No. Batch", accessorFn: (r) => r.batchNumber },
    { id: "expiryDate", header: "Kadaluarsa", cell: (ctx) => {
      const exp = new Date(ctx.row.original.expiryDate);
      const isExpired = exp < new Date(today);
      const isSoon = !isExpired && (exp.getTime() - new Date(today).getTime()) < 90 * 86400000;
      return <span className={isExpired ? "font-medium text-red-600" : isSoon ? "text-amber-600" : ""}>{formatDate(exp)}</span>;
    }},
    { id: "quantityAvailable", header: "Stok", cell: (ctx) => <span className="font-medium">{ctx.row.original.quantityAvailable}</span> },
    { id: "unit", header: "Satuan", accessorFn: (r) => r.unit },
    { id: "purchasePrice", header: "Harga Beli", cell: (ctx) => formatIDR(ctx.row.original.purchasePrice) },
    { id: "category", header: "Kategori", cell: (ctx) => ctx.row.original.category ? <Badge variant="outline">{ctx.row.original.category}</Badge> : null },
  ];
  return <DataTable columns={columns} data={items} searchPlaceholder="Cari obat..." emptyTitle="Stok kosong" emptyDescription="Belum ada batch obat aktif." exportable exportFilename="inventori" />;
}