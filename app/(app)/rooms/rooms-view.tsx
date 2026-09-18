"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  roomType: string;
  status: string;
}

export function RoomsView({ rooms }: { rooms: RoomRow[] }) {
  const columns: DataTableColumn<RoomRow>[] = [
    { id: "code", header: "Kode", cell: (ctx) => <span className="font-mono text-xs font-medium">{ctx.row.original.code}</span> },
    { id: "name", header: "Nama Ruangan", cell: (ctx) => <span className="font-medium">{ctx.row.original.name}</span> },
    { id: "roomType", header: "Tipe", cell: (ctx) => ctx.row.original.roomType },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={rooms}
      searchPlaceholder="Cari ruangan..."
      emptyTitle="Tidak ada ruangan"
      emptyDescription="Belum ada data ruangan."
      exportable
      exportFilename="rooms"
    />
  );
}
