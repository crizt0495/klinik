"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { stockOpnameAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";
import type { InventoryRow } from "./inventory-view";

export function StockOpnameForm({ inventory }: { inventory: InventoryRow[] }) {
  const router = useRouter();
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);
  const [selectedBatchId, setSelectedBatchId] = React.useState("");
  const selected = inventory.find((i) => i.batchId === selectedBatchId);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Stock Opname</CardTitle></CardHeader>
      <CardContent>
        <form action={async (fd: FormData) => {
          setPending(true);
          const res = await stockOpnameAction(state, fd);
          setPending(false);
          setState(res);
          if (res.success) { toast.success("Stok disesuaikan"); setSelectedBatchId(""); router.refresh(); } else toast.error(res.error ?? "Gagal");
        }} className="space-y-4 max-w-xl">
          {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
          <div>
            <Label className="text-xs">Pilih Batch Obat</Label>
            <select name="batchId" required value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
              <option value="">Pilih batch...</option>
              {inventory.map((i) => <option key={i.batchId} value={i.batchId}>{i.medicationName} ({i.batchNumber}) — stok: {i.quantityAvailable} {i.unit}</option>)}
            </select>
          </div>
          {selected && (
            <>
              <input type="hidden" name="medicationId" value={selected.medicationId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Stok Saat Ini (Sistem)</Label>
                  <p className="mt-1.5 text-lg font-bold">{selected.quantityAvailable} {selected.unit}</p>
                </div>
                <div>
                  <Label className="text-xs">Stok Aktual (Hitung Fisik)</Label>
                  <Input name="countedQuantity" type="number" min={0} required placeholder={String(selected.quantityAvailable)} className="mt-1.5" />
                </div>
              </div>
              <div><Label className="text-xs">Catatan (Opsional)</Label><Textarea name="notes" rows={2} placeholder="Alasan selisih..." className="mt-1.5" /></div>
              <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Opname"}</Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}