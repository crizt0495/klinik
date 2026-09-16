"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/constants";

export interface LabOrderRow { id: string; orderNumber: string; status: string; visitNumber: string; patientName: string; patientMrn: string; createdAt: Date | string }
export interface LabItem {
  id: string;
  testCode: string;
  testName: string;
  referenceRange: string | null;
  resultValue: string | null;
  unit: string | null;
  resultFlag: string | null;
  notes: string | null;
  status: string;
  processedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
interface LabDetail { orderId: string; items: LabItem[]; patientName: string; patientMrn: string; visitNumber: string }

export function LabOrdersView({ orders, details }: { orders: LabOrderRow[]; details: LabDetail[] }) {
  const detailMap = React.useMemo(() => new Map(details.map((d) => [d.orderId, d])), [details]);
  const statuses = React.useMemo(() => Array.from(new Set(orders.map((o) => o.status))), [orders]);
  const [filter, setFilter] = React.useState("Semua");
  const filteredOrders = filter === "Semua" ? orders : orders.filter((o) => o.status === filter);

  const columns: DataTableColumn<LabOrderRow>[] = [
    { id: "orderNumber", header: "No. Order", cell: (ctx) => <span className="font-medium">{ctx.row.original.orderNumber}</span> },
    { id: "patientName", header: "Pasien", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.patientName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p></div> },
    { id: "visitNumber", header: "Kunjungan", accessorFn: (r) => r.visitNumber },
    { id: "createdAt", header: "Waktu", cell: (ctx) => formatDateTime(ctx.row.original.createdAt) },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "detail",
      header: "",
      enableSorting: false,
      cell: (ctx) => {
        const d = detailMap.get(ctx.row.original.id);
        if (!d) return <span className="text-xs text-muted-foreground">-</span>;
        return <LabDetailDialog order={ctx.row.original} detail={d} />;
      },
    },
  ];

  return (
    <div className="space-y-4">
      {statuses.length > 0 ? (
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="Semua">Semua</TabsTrigger>
            {statuses.map((s) => (
              <TabsTrigger key={s} value={s}>{STATUS_LABEL[s] ?? s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <DataTable columns={columns} data={filteredOrders} searchPlaceholder="Cari order lab..." emptyTitle="Tidak ada order" emptyDescription="Belum ada order laboratorium." exportable exportFilename="lab" />
    </div>
  );
}

function LabDetailDialog({ order, detail }: { order: LabOrderRow; detail: LabDetail }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Eye className="h-4 w-4" /> Detail</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Order Lab</DialogTitle>
          <DialogDescription>Nomor order {order.orderNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Pasien</p>
              <p className="font-medium">{detail.patientName}</p>
              <p className="text-xs text-muted-foreground">{detail.patientMrn}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kunjungan</p>
              <p className="font-medium">{detail.visitNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Waktu Order</p>
              <p className="font-medium">{formatDateTime(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={order.status} />
            </div>
          </div>
          {detail.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada item pemeriksaan.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Tes</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Klinis</TableHead>
                  <TableHead>Hasil</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Rujukan</TableHead>
                  <TableHead>Waktu Proses</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.testName}</TableCell>
                    <TableCell className="text-muted-foreground">{it.testCode}</TableCell>
                    <TableCell className="text-muted-foreground">{it.notes ?? "-"}</TableCell>
                    <TableCell>{it.resultValue ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{it.unit ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{it.referenceRange ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{it.resultValue && it.processedBy ? formatDateTime(it.updatedAt) : "-"}</TableCell>
                    <TableCell><StatusBadge status={it.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}