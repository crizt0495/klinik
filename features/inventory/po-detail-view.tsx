"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatIDR } from "@/lib/utils";
import { receivePurchaseOrderAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

export interface PODetailItem { id: string; medicationName: string; unit: string; quantity: number; unitPrice: string; quantityReceived: number; subtotal: string; }
export interface PODetailData { id: string; poNumber: string; status: string; supplierName: string; totalAmount: string; expectedDate: Date | string | null; notes: string | null; createdAt: Date | string; items: PODetailItem[] }

export function PODetailView({ po }: { po: PODetailData }) {
  const router = useRouter();
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);
  const [receiveQuantities, setReceiveQuantities] = React.useState<Record<string, number>>({});

  function updateQty(itemId: string, qty: number) {
    setReceiveQuantities((prev) => ({ ...prev, [itemId]: qty }));
  }

  async function handleReceive() {
    const received = po.items
      .filter((i) => (receiveQuantities[i.id] ?? 0) > 0)
      .map((i) => ({ itemId: i.id, quantityReceived: receiveQuantities[i.id] ?? 0 }));
    if (received.length === 0) { setState({ error: "Masukkan jumlah terima minimal 1 item" }); return; }
    setPending(true);
    const fd = new FormData();
    fd.set("purchaseOrderId", po.id);
    fd.set("received", JSON.stringify(received));
    const res = await receivePurchaseOrderAction(state, fd);
    setPending(false);
    setState(res);
    if (res.success) { toast.success("Penerimaan PO diproses"); router.refresh(); setReceiveQuantities({}); } else toast.error(res.error ?? "Gagal");
  }

  const canReceive = po.status === "DRAFT" || po.status === "PARTIALLY_RECEIVED";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-3">
          <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{po.supplierName}</p></div>
          <div><span className="text-muted-foreground">Total</span><p className="font-medium">{formatIDR(po.totalAmount)}</p></div>
          <div><span className="text-muted-foreground">Diharapkan</span><p>{po.expectedDate ? formatDate(po.expectedDate) : "-"}</p></div>
          <div><span className="text-muted-foreground">Status</span><p><StatusBadge status={po.status} /></p></div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Catatan</span><p className="whitespace-pre-wrap">{po.notes ?? "-"}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Item</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {po.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.medicationName}</p>
                <p className="text-xs text-muted-foreground">{item.quantity} {item.unit} × {formatIDR(item.unitPrice)} = {formatIDR(item.subtotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">Sudah diterima: {item.quantityReceived}/{item.quantity}</p>
              </div>
              {canReceive && item.quantityReceived < item.quantity && (
                <div className="w-24">
                  <Label className="text-xs">Terima</Label>
                  <Input type="number" min={0} max={item.quantity - item.quantityReceived} value={receiveQuantities[item.id] ?? ""} onChange={(e) => updateQty(item.id, Number(e.target.value))} placeholder="0" className="mt-1" />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {state.error ? <p className="rounded-lg border border-destructive/20 bg-destructive/8 p-3 text-sm text-[color-mix(in_oklch,var(--destructive)_85%,black)] dark:text-destructive">{state.error}</p> : null}

      {canReceive && (
        <Button onClick={handleReceive} disabled={pending}>
          {pending ? "Memproses..." : "Terima Item Dipilih"}
        </Button>
      )}
    </div>
  );
}