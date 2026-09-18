"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, CheckCircle2, SkipForward, MoreHorizontal, XCircle } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createQueueEntryAction, updateQueueStatusAction } from "./actions";
import { PRIORITY_LABEL } from "@/lib/constants";

export interface QueueRow {
  id: string;
  queueNumber: number;
  queueCode: string;
  priority: string;
  status: string;
  queueDate: string;
  calledAt: Date | string | null;
  servedAt: Date | string | null;
  completedAt: Date | string | null;
  patientName: string;
  patientMrn: string;
  patientId: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  visitId: string | null;
}

interface Props {
  queues: QueueRow[];
  options: { patients: Array<{ id: string; fullName: string; medicalRecordNumber: string }>; departments: Array<{ id: string; name: string }> };
  canManage: boolean;
}

export function QueueView({ queues, options, canManage }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [addPending, setAddPending] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  async function runStatus(queueId: string, status: string) {
    const fd = new FormData();
    fd.set("queueId", queueId);
    fd.set("status", status);
    const res = await updateQueueStatusAction({}, fd);
    if (res.success) {
      toast.success(`Status diperbarui ke ${status}`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Gagal memperbarui status");
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddPending(true);
    setAddError(null);
    const fd = new FormData(e.currentTarget);
    const res = await createQueueEntryAction({}, fd);
    setAddPending(false);
    if (res.success) {
      toast.success("Pasien ditambahkan ke antrian");
      setAddOpen(false);
      router.refresh();
    } else {
      setAddError(res.error ?? "Gagal menambah antrian");
    }
  }

  const columns: DataTableColumn<QueueRow>[] = [
    {
      id: "queueCode",
      header: "No.",
      cell: (ctx) => <span className="text-lg font-bold tabular-nums">{ctx.row.original.queueCode}</span>,
    },
    {
      id: "patientName",
      header: "Pasien",
      cell: (ctx) => (
        <div>
          <p className="font-medium">{ctx.row.original.patientName}</p>
          <p className="text-xs text-muted-foreground">{ctx.row.original.patientMrn}</p>
        </div>
      ),
    },
    {
      id: "priority",
      header: "Prioritas",
      cell: (ctx) => ctx.row.original.priority === "NORMAL" ? null : <Badge variant={ctx.row.original.priority === "EMERGENCY" ? "destructive" : "warning"}>{PRIORITY_LABEL[ctx.row.original.priority] ?? ctx.row.original.priority}</Badge>,
    },
    { id: "departmentCode", header: "Poli", accessorFn: (r) => r.departmentCode },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
    {
      id: "actions",
      header: "",
      cell: (ctx) => {
        const r = ctx.row.original;
        if (!canManage) return null;
        if (["COMPLETED", "CANCELLED", "SKIPPED"].includes(r.status)) return null;
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {r.status === "WAITING" && (
              <Button size="sm" variant="outline" onClick={() => runStatus(r.id, "CALLED")}>
                <BellRing className="h-4 w-4" /> Panggil
              </Button>
            )}
            {r.status === "CALLED" && (
              <Button size="sm" variant="outline" onClick={() => runStatus(r.id, "SERVING")}>Layani</Button>
            )}
            {r.status === "SERVING" && (
              <Button size="sm" variant="success" onClick={() => runStatus(r.id, "COMPLETED")}>
                <CheckCircle2 className="h-4 w-4" /> Selesai
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {r.status === "WAITING" && <DropdownMenuItem onSelect={() => runStatus(r.id, "SKIP")}>Lewati</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => runStatus(r.id, "CANCELLED")}>Batalkan</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        {canManage ? <Button onClick={() => setAddOpen(true)}>Tambah Antrian</Button> : null}
      </div>
      <DataTable
        columns={columns}
        data={queues}
        searchPlaceholder="Cari nomor antrian / pasien..."
        emptyTitle="Antrian kosong"
        emptyDescription="Tidak ada pasien dalam antrian hari ini."
        exportable
        exportFilename="antrian"
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Antrian Manual</DialogTitle>
            <DialogDescription>Pilih pasien dan poli tujuan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {addError ? <Alert variant="destructive"><AlertDescription>{addError}</AlertDescription></Alert> : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Pasien</Label>
              <select name="patientId" required className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="">Pilih pasien...</option>
                {options.patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} · {p.medicalRecordNumber}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Poli</Label>
              <select name="departmentId" required className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="">Pilih poli...</option>
                {options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prioritas</Label>
              <select name="priority" defaultValue="NORMAL" className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="NORMAL">Normal</option>
                <option value="PRIORITY">Prioritas</option>
                <option value="EMERGENCY">Gawat Darurat</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={addPending}>Batal</Button>
              <Button type="submit" disabled={addPending}>{addPending ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}