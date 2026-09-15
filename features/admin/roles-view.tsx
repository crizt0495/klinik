"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface RoleRow { id: string; name: string; description: string | null; isSystem: boolean; createdAt: Date | string }

export function RolesView({ roles }: { roles: RoleRow[] }) {
  const columns: DataTableColumn<RoleRow>[] = [
    { id: "name", header: "Nama", cell: (ctx) => <span className="font-medium">{ctx.row.original.name}</span> },
    { id: "description", header: "Deskripsi", cell: (ctx) => ctx.row.original.description ?? "-" },
    { id: "isSystem", header: "Tipe", cell: (ctx) => <Badge variant={ctx.row.original.isSystem ? "default" : "secondary"}>{ctx.row.original.isSystem ? "System" : "Custom"}</Badge> },
  ];
  return (
    <div className="space-y-6">
      <DataTable columns={columns} data={roles} searchPlaceholder="Cari peran..." emptyTitle="Tidak ada peran" emptyDescription="Belum ada peran." />
      <Card>
        <CardHeader><CardTitle className="text-sm">Hak Akses</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Hak akses diatur otomatis oleh seed/role system. Untuk perubahan hak akses, hubungi administrator basis data atau gunakan API berikut:</p>
          <p className="mt-2 font-mono text-xs">POST /api/admin/roles/{`{roleId}`}/permissions</p>
        </CardContent>
      </Card>
    </div>
  );
}