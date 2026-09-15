"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { updateAppointmentStatusAction } from "./actions";

const STATUS_ACTIONS: Record<string, Array<{ status: string; label: string; confirm?: boolean }>> = {
  SCHEDULED: [
    { status: "CONFIRMED", label: "Konfirmasi" },
    { status: "CANCELLED", label: "Batalkan", confirm: true },
    { status: "NO_SHOW", label: "Tandai tidak hadir", confirm: true },
  ],
  CONFIRMED: [
    { status: "CHECKED_IN", label: "Check-in" },
    { status: "CANCELLED", label: "Batalkan", confirm: true },
    { status: "NO_SHOW", label: "Tandai tidak hadir", confirm: true },
  ],
  CHECKED_IN: [
    { status: "COMPLETED", label: "Selesaikan" },
  ],
};

export interface AppointmentRow {
  id: string;
  appointmentNumber: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  status: string;
  patientName: string;
  patientMrn: string;
  patientId: string;
  doctorName: string;
  departmentName: string;
  notes: string | null;
}

interface Props {
  appointments: AppointmentRow[];
  canUpdate: boolean;
}

export function AppointmentsView({ appointments, canUpdate }: Props) {
  const router = useRouter();

  async function runAction(id: string, status: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    const res = await updateAppointmentStatusAction({}, fd);
    if (res.success) {
      toast.success("Status diperbarui");
      router.refresh();
    } else {
      toast.error(res.error ?? "Gagal memperbarui status");
    }
  }

  const columns: DataTableColumn<AppointmentRow>[] = [
    {
      id: "schedule",
      header: "Jadwal",
      cell: (ctx) => {
        const r = ctx.row.original;
        return (
          <div>
            <p className="font-medium">{r.appointmentNumber}</p>
            <p className="text-xs text-muted-foreground">{formatDate(r.appointmentDate)} · {r.startTime.slice(0, 5)}-{r.endTime.slice(0, 5)}</p>
          </div>
        );
      },
    },
    {
      id: "patientName",
      header: "Pasien",
      accessorFn: (r) => r.patientName,
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.patientName}</p>
          <p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p>
        </div>
      ),
    },
    { id: "doctorName", header: "Dokter", accessorFn: (r) => r.doctorName },
    { id: "departmentName", header: "Poli", accessorFn: (r) => r.departmentName },
    { id: "appointmentType", header: "Tipe", accessorFn: (r) => r.appointmentType },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "actions",
      header: "",
      cell: (ctx) => {
        const r = ctx.row.original;
        const actions = (STATUS_ACTIONS[r.status] ?? []).filter((a) => a.status !== "CONFIRMED");
        if (!canUpdate || actions.length === 0) return null;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((a) => (
                  <DropdownMenuItem
                    key={a.status}
                    onSelect={() => {
                      if (a.confirm && !window.confirm(`Lanjutkan "${a.label}" untuk ${r.patientName}?`)) return;
                      runAction(r.id, a.status);
                    }}
                  >
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={appointments}
      searchPlaceholder="Cari no. appointment / pasien / dokter..."
      emptyTitle="Tidak ada appointment"
      emptyDescription="Buat appointment untuk pasien."
      exportable
      exportFilename="appointments"
    />
  );
}