"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { processPaymentAction, processRefundAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

export interface InvoiceItem { id: string; description: string; quantity: number; unitPrice: string; subtotal: string; discount: string }
export interface InvoicePayment { id: string; paymentNumber: string; method: string; amount: string; reference: string | null; status: string; paidAt: Date | string }
export interface InvoiceDetailData {
  id: string; invoiceNumber: string; status: string; totalAmount: string; paidAmount: string; patientName: string; patientMrn: string; visitNumber: string; createdAt: Date | string
  items: InvoiceItem[]; payments: InvoicePayment[];
}

export function InvoiceDetailView({ invoice }: { invoice: InvoiceDetailData }) {
  const router = useRouter();
  const [payState, setPayState] = React.useState<ActionState>({});
  const [refState, setRefState] = React.useState<ActionState>({});
  const [payPending, setPayPending] = React.useState(false);
  const [refPending, setRefPending] = React.useState(false);

  const totalNum = Number(invoice.totalAmount);
  const paidNum = Number(invoice.paidAmount);
  const remaining = totalNum - paidNum;
  const canPay = invoice.status !== "VOID" && invoice.status !== "REFUNDED" && remaining > 0;
  const canRefund = invoice.status === "PAID" || (invoice.status === "PARTIAL_PAID" && paidNum > 0);

  async function handlePay(fd: FormData) {
    fd.set("invoiceId", invoice.id);
    setPayPending(true);
    const res = await processPaymentAction(payState, fd);
    setPayPending(false);
    setPayState(res);
    if (res.success) { toast.success("Pembayaran diterima"); router.refresh(); }
  }

  async function handleRefund(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("invoiceId", invoice.id);
    setRefPending(true);
    const res = await processRefundAction(refState, fd);
    setRefPending(false);
    setRefState(res);
    if (res.success) { toast.success("Refund diproses"); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-3">
          <div><span className="text-muted-foreground">Pasien</span><p className="font-medium">{invoice.patientName} ({invoice.patientMrn})</p></div>
          <div><span className="text-muted-foreground">Kunjungan</span><p className="font-medium">{invoice.visitNumber}</p></div>
          <div><span className="text-muted-foreground">Status</span><p><StatusBadge status={invoice.status} /></p></div>
          <div><span className="text-muted-foreground">Total</span><p className="text-lg font-bold">{formatIDR(invoice.totalAmount)}</p></div>
          <div><span className="text-muted-foreground">Sudah Dibayar</span><p className="text-lg font-bold text-green-600">{formatIDR(invoice.paidAmount)}</p></div>
          <div><span className="text-muted-foreground">Sisa</span><p className="text-lg font-bold text-amber-600">{formatIDR(String(remaining))}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Item Tagihan</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {invoice.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div><p className="font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{item.quantity} × {formatIDR(item.unitPrice)} {Number(item.discount) > 0 ? `- diskon ${formatIDR(item.discount)}` : ""}</p></div>
              <p className="font-medium">{formatIDR(item.subtotal)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Riwayat Pembayaran</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {invoice.payments.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p> : invoice.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div><p className="font-medium">{p.paymentNumber}</p><p className="text-xs text-muted-foreground">{p.method} · {formatDateTime(p.paidAt)} {p.reference ? `· ${p.reference}` : ""}</p></div>
              <p className={`font-medium ${Number(p.amount) < 0 ? "text-red-600" : "text-green-600"}`}>{formatIDR(p.amount)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {canPay && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Proses Pembayaran</CardTitle></CardHeader>
          <CardContent>
            <form action={handlePay} className="space-y-3 max-w-md">
              {payState.error ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{payState.error}</p> : null}
              <div>
                <Label className="text-xs">Metode</Label>
                <select name="method" required className="mt-1.5 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="CASH">Tunai</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="E_WALLET">E-Wallet</option>
                  <option value="BPJS">BPJS</option>
                  <option value="CREDIT_CARD">Kartu Kredit</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Jumlah (maks. {formatIDR(String(remaining))})</Label>
                <Input name="amount" type="number" min={1} max={remaining} required className="mt-1.5" />
              </div>
              <div><Label className="text-xs">Referensi</Label><Input name="reference" placeholder="No. referensi / transaksi" className="mt-1.5" /></div>
              <div><Label className="text-xs">Catatan</Label><Textarea name="notes" rows={2} className="mt-1.5" /></div>
              <Button type="submit" disabled={payPending}><CreditCard className="h-4 w-4 mr-1" /> {payPending ? "Memproses..." : "Bayar"}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {canRefund && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Refund</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleRefund} className="space-y-3 max-w-md">
              {refState.error ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{refState.error}</p> : null}
              <div><Label className="text-xs">Jumlah Refund</Label><Input name="amount" type="number" min={1} max={paidNum} required className="mt-1.5" /></div>
              <div><Label className="text-xs">Alasan</Label><Textarea name="reason" required rows={2} className="mt-1.5" /></div>
              <Button type="submit" variant="destructive" disabled={refPending}><XCircle className="h-4 w-4 mr-1" /> {refPending ? "Memproses..." : "Refund"}</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}