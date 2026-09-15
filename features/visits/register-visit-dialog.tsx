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
import { registerVisitAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

interface Options {
  patients: Array<{ id: string; fullName: string; medicalRecordNumber: string }>;
  doctors: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
}

export function RegisterVisitDialog({ options }: { options: Options }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => { if (open) setState({}); }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await registerVisitAction(state, new FormData(e.currentTarget));
    setPending(false);
    setState(res);
    if (res.success) {
      toast.success("Pasien terdaftar ke kunjungan dan antrian");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Registrasi Kunjungan</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrasi Kunjungan Baru</DialogTitle>
            <DialogDescription>Pasien akan masuk ke antrian dengan otomatis.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Pasien</Label>
                <select name="patientId" required className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">Pilih pasien...</option>
                  {options.patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} · {p.medicalRecordNumber}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Dokter</Label>
                <select name="doctorId" required className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">Pilih dokter...</option>
                  {options.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Poli</Label>
                <select name="departmentId" required className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">Pilih poli...</option>
                  {options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Prioritas Antrian</Label>
                <select name="priority" className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="NORMAL">Normal</option>
                  <option value="PRIORITY">Prioritas</option>
                  <option value="EMERGENCY">Gawat</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Keluhan Utama</Label>
                <Textarea name="chiefComplaint" rows={2} className="mt-1.5" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? "Mendaftarkan..." : "Daftarkan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}