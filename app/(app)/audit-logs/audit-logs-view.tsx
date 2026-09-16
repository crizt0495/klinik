"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userName: string;
  ip: string | null;
  oldData?: unknown;
  newData?: unknown;
  createdAt: Date | string;
}

export function AuditLogsView({ logs }: { logs: AuditLogRow[] }) {
  const [selected, setSelected] = React.useState<AuditLogRow | null>(null);
  const columns: DataTableColumn<AuditLogRow>[] = [
    { id: "createdAt", header: "Waktu", cell: (ctx) => <span className="text-xs">{formatDateTime(ctx.row.original.createdAt)}</span> },
    { id: "userName", header: "User", accessorFn: (r) => r.userName },
    { id: "action", header: "Aksi", cell: (ctx) => <span className="font-mono text-xs font-medium">{ctx.row.original.action}</span> },
    { id: "entityType", header: "Entitas", cell: (ctx) => ctx.row.original.entityType ?? "-" },
    { id: "entityId", header: "ID", cell: (ctx) => <span className="font-mono text-xs truncate max-w-[200px] block">{ctx.row.original.entityId ?? "-"}</span> },
    { id: "ip", header: "IP", cell: (ctx) => <span className="text-xs">{ctx.row.original.ip ?? "-"}</span> },
    {
      id: "detail",
      header: "Detail",
      cell: (ctx) => (
        <Button variant="outline" size="sm" onClick={() => setSelected(ctx.row.original)}>
          <Eye className="h-4 w-4" />
          Detail
        </Button>
      ),
    },
  ];
  return (
    <React.Fragment>
      <DataTable columns={columns} data={logs} searchPlaceholder="Cari audit log..." emptyTitle="Tidak ada log" emptyDescription="Tidak ada aktivitas tercatat." exportable exportFilename="audit-logs" />
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Audit Log</DialogTitle>
            <DialogDescription>Informasi lengkap dari entri audit log.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">Waktu</dt>
                <dd className="text-xs">{selected ? formatDateTime(selected.createdAt) : "-"}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">User</dt>
                <dd className="text-xs">{selected?.userName ?? "-"}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">Aksi</dt>
                <dd className="font-mono text-xs font-medium">{selected?.action ?? "-"}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">Entitas</dt>
                <dd className="text-xs">{selected?.entityType ?? "-"}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">Entity ID</dt>
                <dd className="font-mono text-xs">{selected?.entityId ?? "-"}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">IP</dt>
                <dd className="font-mono text-xs">{selected?.ip ?? "-"}</dd>
              </div>
            </dl>
            {selected && selected.oldData == null && selected.newData == null ? (
              <p className="text-xs text-muted-foreground">Tidak ada perubahan data</p>
            ) : (
              <React.Fragment>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground">Data Lama</h4>
                  {selected?.oldData != null ? (
                    <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(selected.oldData, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">-</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground">Data Baru</h4>
                  {selected?.newData != null ? (
                    <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(selected.newData, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">-</p>
                  )}
                </div>
              </React.Fragment>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
}