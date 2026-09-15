"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { addPatientInsuranceAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

interface Props {
  patientId: string;
  providers: Array<{ id: string; name: string }>;
}

export function InsuranceDialog({ patientId, providers }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState({});
    const fd = new FormData(e.currentTarget);
    fd.set("patientId", patientId);
    const res = await addPatientInsuranceAction(state, fd);
    setPending(false);
    setState(res);
    if (res.success) {
      toast.success("Asuransi ditambahkan");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Tambah Asuransi</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Jaminan Asuransi</DialogTitle>
          <DialogDescription>Kaitkan asuransi/BPJS pada pasien.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {state.error ? (
            <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
          ) : null}
          <div className="space-y-2">
            <Label className="text-xs">Penyedia Asuransi</Label>
            <select name="insuranceProviderId" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">No. Anggota / Kartu</Label>
            <Input name="memberNumber" required maxLength={64} placeholder="cth. 0001234567890" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Kelas</Label>
            <Input name="coverageClass" maxLength={32} placeholder="cth. 2" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPrimary" className="h-4 w-4" />
            Jadikan jaminan utama
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
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