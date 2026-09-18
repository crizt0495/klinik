"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

const DAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "-";
}

export interface ScheduleRow {
  id: string;
  doctorName: string;
  specialization: string | null;
  departmentName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatients: number;
  status: string;
}

export function SchedulesView({ schedules }: { schedules: ScheduleRow[] }) {
  const columns: DataTableColumn<ScheduleRow>[] = [
    {
      id: "doctorName",
      header: "Dokter",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.doctorName}</p>
          {ctx.row.original.specialization ? <p className="text-xs text-muted-foreground">{ctx.row.original.specialization}</p> : null}
        </div>
      ),
    },
    { id: "departmentName", header: "Poli", cell: (ctx) => ctx.row.original.departmentName },
    { id: "dayOfWeek", header: "Hari", cell: (ctx) => DAY_LABELS[ctx.row.original.dayOfWeek] ?? "-" },
    {
      id: "time",
      header: "Jam",
      cell: (ctx) => (
        <span className="nums text-xs">
          {clock(ctx.row.original.startTime)} - {clock(ctx.row.original.endTime)}
        </span>
      ),
    },
    { id: "slotDurationMinutes", header: "Slot", cell: (ctx) => <span className="nums text-xs">{ctx.row.original.slotDurationMinutes} mnt</span> },
    { id: "maxPatients", header: "Maks. Pasien", cell: (ctx) => <span className="nums text-xs">{ctx.row.original.maxPatients}</span> },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={schedules}
      searchPlaceholder="Cari jadwal dokter..."
      emptyTitle="Tidak ada jadwal"
      emptyDescription="Belum ada jadwal dokter."
      exportable
      exportFilename="schedules"
    />
  );
}
