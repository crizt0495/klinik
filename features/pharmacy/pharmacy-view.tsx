"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatTime } from "@/lib/utils";
import { dispensePrescriptionItemAction } from "./actions";

export interface PharmacyRow {
  id: string;
  number: string;
  status: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  issuedAt: Date | string | null;
  itemCount: number;
  dispensedCount: number;
}

export function PharmacyView({ prescriptions }: { prescriptions: PharmacyRow[] }) {
  const router = useRouter();

  const columns: DataTableColumn<PharmacyRow>[] = [
    { id: "number", header: "No. Resep", accessorFn: (r) => r.number, cell: (ctx) => <span className="font-medium">{ctx.row.original.number}</span> },
    { id: "patientName", header: "Pasien", cell: (ctx) => <div><p className="font-medium">{ctx.row.original.patientName}</p><p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p></div> },
    { id: "doctorName", header: "Dokter", accessorFn: (r) => r.doctorName },
    { id: "issuedAt", header: "Waktu", cell: (ctx) => ctx.row.original.issuedAt ? formatTime(ctx.row.original.issuedAt) : "-" },
    { id: "dispensedCount", header: "Progres", cell: (ctx) => <span className="text-xs">{ctx.row.original.dispensedCount}/{ctx.row.original.itemCount} item</span> },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "actions", header: "",
      cell: (ctx) => {
        const r = ctx.row.original;
        if (r.status !== "ISSUED" && r.status !== "PARTIALLY_DISPENSED") return null;
        return (
          <Button size="sm" variant="outline" onClick={() => router.push(`/pharmacy/${r.id}`)}>
            <PackageCheck className="h-4 w-4" /> Diserahkan
          </Button>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={prescriptions} searchPlaceholder="Cari resep / pasien..." emptyTitle="Tidak ada resep" emptyDescription="Belum ada resep yang perlu diserahkan." exportable exportFilename="farmasi" />;
}