"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/constants";

export interface RadOrderRow { id: string; orderNumber: string; status: string; visitNumber: string; patientName: string; patientMrn: string; createdAt: Date | string }
interface RadDetail { orderId: string; procedureName: string; clinicalInformation: string | null; status: string; createdAt: Date | string; patientName: string; patientMrn: string; visitNumber: string }

export function RadiologyOrdersView({ orders, details }: { orders: RadOrderRow[]; details: RadDetail[] }) {
  const detailMap = React.useMemo(() => new Map(details.map((d) => [d.orderId, d])), [details]);
  const statuses = React.useMemo(() => Array.from(new Set(orders.map((o) => o.status))), [orders]);
  const [filter, setFilter] = React.useState("Semua");
  const filteredOrders = filter === "Semua" ? orders : orders.filter((o) => o.status === filter);

  const columns: DataTableColumn<RadOrderRow>[] = [
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
        return <RadDetailDialog order={ctx.row.original} detail={d} />;
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
      <DataTable columns={columns} data={filteredOrders} searchPlaceholder="Cari order radiologi..." emptyTitle="Tidak ada order" emptyDescription="Belum ada order radiologi." exportable exportFilename="radiologi" />
    </div>
  );
}

function RadDetailDialog({ order, detail }: { order: RadOrderRow; detail: RadDetail }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Eye className="h-4 w-4" /> Detail</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Order Radiologi</DialogTitle>
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
              <p className="font-medium">{formatDateTime(detail.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={detail.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prosedur</p>
            <p className="font-medium">{detail.procedureName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Informasi Klinis</p>
            <p className="text-sm">{detail.clinicalInformation ?? "-"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}