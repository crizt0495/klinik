"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createAppointmentAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

export interface AppointmentOptions {
  patients: Array<{ id: string; fullName: string; medicalRecordNumber: string }>;
  doctors: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  rooms: Array<{ id: string; name: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: AppointmentOptions;
}

export function AppointmentFormDialog({ open, onOpenChange, options }: Props) {
  const router = useRouter();
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) setState({});
    onOpenChange(open);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState({});
    const fd = new FormData(e.currentTarget);
    const res = await createAppointmentAction(state, fd);
    setPending(false);
    setState(res);
    if (res.success) {
      toast.success("Appointment dibuat");
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Appointment</DialogTitle>
          <DialogDescription>Sistem akan memeriksa jadwal dokter dan bentrok waktu.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {state.error ? (
            <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Pasien</Label>
              <select name="patientId" required className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="">Pilih pasien...</option>
                {options.patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} · {p.medicalRecordNumber}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Dokter</Label>
              <select name="doctorId" required className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="">Pilih dokter...</option>
                {options.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Poli</Label>
              <select name="departmentId" required className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="">Pilih poli...</option>
                {options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Tanggal</Label>
              <Input name="appointmentDate" type="date" required className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Ruangan</Label>
              <select name="roomId" className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="">-</option>
                {options.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Mulai</Label>
              <Input name="startTime" type="time" required className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Selesai</Label>
              <Input name="endTime" type="time" required className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Tipe</Label>
              <select name="appointmentType" className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="REGULAR">Rutin</option>
                <option value="FOLLOW_UP">Kontrol</option>
                <option value="EMERGENCY">Gawat</option>
                <option value="NEW_PATIENT">Pasien Baru</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Catatan</Label>
              <Textarea name="notes" rows={2} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Batal</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}