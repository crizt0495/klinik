"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createPurchaseOrderAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

interface Supplier { id: string; name: string; }
interface Med { id: string; name: string; unit: string; }
interface MedOption { id: string; name: string; unit: string; }

interface Props { suppliers: Supplier[]; medications: MedOption[]; }

export function PurchaseOrderFormDialog({ suppliers, medications }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);
  const [items, setItems] = React.useState<Array<{ medicationId: string; quantity: number; unitPrice: number }>>([{ medicationId: "", quantity: 1, unitPrice: 0 }]);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setState({});
      setItems([{ medicationId: "", quantity: 1, unitPrice: 0 }]);
    }
    setOpen(open);
  }

  function updateItem(idx: number, patch: Partial<typeof items[number]>) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const validItems = items.filter((i) => i.medicationId && i.quantity > 0 && i.unitPrice > 0);
    if (validItems.length === 0) { setState({ error: "Minimal 1 item valid" }); return; }
    fd.set("payload", JSON.stringify({
      supplierId: fd.get("supplierId"),
      expectedDate: fd.get("expectedDate"),
      notes: fd.get("notes"),
      items: validItems,
    }));
    setPending(true);
    const res = await createPurchaseOrderAction(state, fd);
    setPending(false);
    setState(res);
    if (res.success) { toast.success("PO dibuat"); setOpen(false); router.refresh(); }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Buat PO</Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Purchase Order</DialogTitle>
            <DialogDescription>Pesan obat dari supplier.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Supplier</Label>
                <select name="supplierId" required className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                  <option value="">Pilih supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Tanggal Diharapkan</Label><Input name="expectedDate" type="date" required className="mt-1.5" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Catatan</Label><Textarea name="notes" rows={2} className="mt-1.5" /></div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold">Item</p>
              {items.map((item, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Obat</Label>
                    <select value={item.medicationId} onChange={(e) => updateItem(idx, { medicationId: e.target.value })} required className="mt-1 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                      <option value="">Pilih obat...</option>
                      {medications.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                    </select>
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} className="mt-1" />
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Harga/Unit</Label>
                    <Input type="number" min={0} step={100} value={item.unitPrice || ""} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} className="mt-1" />
                  </div>
                  {items.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((prev) => [...prev, { medicationId: "", quantity: 1, unitPrice: 0 }])}><Plus className="h-4 w-4 mr-1" /> Tambah Item</Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
              <Button type="submit" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {pending ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}