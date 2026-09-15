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
import { createPatientAction, updatePatientAction } from "@/features/patients/actions";
import type { ActionState } from "@/lib/auth/action-guard";

export interface PatientFormValue {
  id?: string;
  fullName: string;
  nik?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  bloodType?: string | null;
  maritalStatus?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  occupation?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: PatientFormValue | null;
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} {required ? <span className="text-destructive">*</span> : null}</Label>
      {children}
    </div>
  );
}

export function PatientFormDialog({ open, onOpenChange, patient }: Props) {
  const router = useRouter();
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) setState({});
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState({});
    const formData = new FormData(e.currentTarget);
    const res = patient?.id ? await updatePatientAction(state, formData) : await createPatientAction(state, formData);
    setPending(false);
    setState(res);
    if (res.success) {
      toast.success(patient?.id ? "Pasien diperbarui" : "Pasien baru terdaftar");
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient?.id ? "Edit Pasien" : "Registrasi Pasien Baru"}</DialogTitle>
          <DialogDescription>
            {patient?.id ? "Perbarui data pasien." : "Nomor rekam medis akan dibuat otomatis."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {patient?.id ? <input type="hidden" name="id" value={patient.id} /> : null}
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nama Lengkap" required>
                <Input name="fullName" defaultValue={patient?.fullName ?? ""} required maxLength={255} />
              </Field>
            </div>
            <Field label="NIK">
              <Input name="nik" defaultValue={patient?.nik ?? ""} maxLength={16} inputMode="numeric" placeholder="16 digit" />
            </Field>
            <Field label="Jenis Kelamin" required>
              <select name="gender" defaultValue={patient?.gender ?? "MALE"} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="MALE">Laki-laki</option>
                <option value="FEMALE">Perempuan</option>
              </select>
            </Field>
            <Field label="Tanggal Lahir">
              <Input name="birthDate" type="date" defaultValue={patient?.birthDate ?? ""} />
            </Field>
            <Field label="Tempat Lahir">
              <Input name="birthPlace" defaultValue={patient?.birthPlace ?? ""} maxLength={128} />
            </Field>
            <Field label="Golongan Darah">
              <select name="bloodType" defaultValue={patient?.bloodType ?? ""} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="">-</option>
                {["A", "B", "AB", "O"].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Status Pernikahan">
              <select name="maritalStatus" defaultValue={patient?.maritalStatus ?? ""} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="">-</option>
                <option value="SINGLE">Belum Menikah</option>
                <option value="MARRIED">Menikah</option>
                <option value="WIDOWED">Janda/Duda</option>
              </select>
            </Field>
            <Field label="No. HP">
              <Input name="phone" defaultValue={patient?.phone ?? ""} maxLength={32} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={patient?.email ?? ""} maxLength={255} />
            </Field>
            <Field label="Pekerjaan">
              <Input name="occupation" defaultValue={patient?.occupation ?? ""} maxLength={128} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Alamat">
                <Textarea name="address" defaultValue={patient?.address ?? ""} rows={2} />
              </Field>
            </div>
            <Field label="Kontak Darurat - Nama">
              <Input name="emergencyContactName" defaultValue={patient?.emergencyContactName ?? ""} maxLength={255} />
            </Field>
            <Field label="Kontak Darurat - No. HP">
              <Input name="emergencyContactPhone" defaultValue={patient?.emergencyContactPhone ?? ""} maxLength={32} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
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