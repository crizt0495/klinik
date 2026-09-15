"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatDateTime } from "@/lib/utils";

export interface AuditLogRow { id: string; action: string; entityType: string | null; entityId: string | null; userName: string; ip: string | null; createdAt: Date | string }

export function AuditLogsView({ logs }: { logs: AuditLogRow[] }) {
  const columns: DataTableColumn<AuditLogRow>[] = [
    { id: "createdAt", header: "Waktu", cell: (ctx) => <span className="text-xs">{formatDateTime(ctx.row.original.createdAt)}</span> },
    { id: "userName", header: "User", accessorFn: (r) => r.userName },
    { id: "action", header: "Aksi", cell: (ctx) => <span className="font-mono text-xs font-medium">{ctx.row.original.action}</span> },
    { id: "entityType", header: "Entitas", cell: (ctx) => ctx.row.original.entityType ?? "-" },
    { id: "entityId", header: "ID", cell: (ctx) => <span className="font-mono text-xs truncate max-w-[200px] block">{ctx.row.original.entityId ?? "-"}</span> },
    { id: "ip", header: "IP", cell: (ctx) => <span className="text-xs">{ctx.row.original.ip ?? "-"}</span> },
  ];
  return <DataTable columns={columns} data={logs} searchPlaceholder="Cari audit log..." emptyTitle="Tidak ada log" emptyDescription="Tidak ada aktivitas tercatat." exportable exportFilename="audit-logs" />;
}