"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";
import { dispensePrescriptionItemAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

export interface DispenseItem {
  id: string;
  medicationId: string;
  name: string;
  unit: string;
  quantity: number;
  dispensedQuantity: number;
  status: string;
  dosage: string | null;
  frequency: string | null;
}

export interface DispensePrescription {
  id: string;
  prescriptionNumber: string;
  status: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  issuedAt: Date | string | null;
}

export function DispenseView({ prescription, items }: { prescription: DispensePrescription; items: DispenseItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function dispense(itemId: string) {
    setPendingId(itemId);
    setError(null);
    const fd = new FormData();
    fd.set("prescriptionItemId", itemId);
    const res: ActionState = await dispensePrescriptionItemAction({}, fd);
    setPendingId(null);
    if (res.success) {
      toast.success("Item diserahkan (stok dikurangi sesuai FEFO)");
      router.refresh();
    } else {
      setError(res.error ?? "Gagal");
    }
  }

  const remaining = items.filter((i) => i.status !== "DISPENSED");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-3">
          <div><span className="text-muted-foreground">Pasien</span><p className="font-medium">{prescription.patientName} ({prescription.patientMrn})</p></div>
          <div><span className="text-muted-foreground">Dokter</span><p className="font-medium">{prescription.doctorName}</p></div>
          <div><span className="text-muted-foreground">Waktu</span><p>{formatDateTime(prescription.issuedAt)}</p></div>
        </CardContent>
      </Card>

      {error ? <p className="rounded-lg border border-destructive/20 bg-destructive/8 p-3 text-sm text-[color-mix(in_oklch,var(--destructive)_85%,black)] dark:text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="min-w-0">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} {item.unit} · {item.dosage ?? "-"} {item.frequency ? `· ${item.frequency}` : ""}
                </p>
                <p className="mt-1 text-xs">
                  Diserahkan: <span className="font-medium">{item.dispensedQuantity}/{item.quantity}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={item.status} />
                {item.status !== "DISPENSED" && (
                  <Button size="sm" disabled={pendingId === item.id} onClick={() => dispense(item.id)}>
                    <PackageCheck className="h-4 w-4" /> {pendingId === item.id ? "Memproses..." : "Serahkan (FEFO)"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {remaining.length === 0 ? (
        <p className="text-sm text-muted-foreground">Semua item resep telah diserahkan.</p>
      ) : null}
    </div>
  );
}