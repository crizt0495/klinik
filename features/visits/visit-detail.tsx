"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatIDR, genderLabel, ageFromBirthDate } from "@/lib/utils";
import { startVisitAction, completeVisitAction, cancelVisitAction, saveSoapAction, finalizeMedicalRecordAction, addDiagnosesAction, addVitalSignsAction, createPrescriptionAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

export interface VisitDetailData {
  id: string; visitNumber: string; visitDate: string; status: string; chiefComplaint: string | null; patientName: string; patientMrn: string; patientBirthDate: string | null; patientGender: string; doctorName: string; departmentName: string; createdAt: Date | string;
  medicalRecord: { id: string; status: string; subjective: string | null; objective: string | null; assessment: string | null; plan: string | null } | null;
  diagnoses: Array<{ id: string; diagnosisId: string; code: string; name: string; diagnosisType: string; notes: string | null }>;
  procedures: Array<{ id: string; procedureName: string; quantity: number; price: string; notes: string | null }>;
  prescriptions: Array<{ id: string; number: string; status: string; notes: string | null; issuedAt: Date | string | null }>;
  prescriptionItems: Array<{ prescriptionId: string; name: string; quantity: number; dosage: string | null; frequency: string | null; route: string; duration: string | null; instructions: string | null; dispensedQuantity: number; status: string }>;
  vitalSigns: { temperature: string | null; systolic: number | null; diastolic: number | null; heartRate: number | null; respiratoryRate: number | null; weight: string | null; height: string | null; painScale: number | null } | null;
  labOrders: Array<{ id: string; orderNumber: string; status: string }>;
  radiologyOrders: Array<{ id: string; orderNumber: string; status: string }>;
  invoices: Array<{ id: string; number: string; total: string; status: string }>;
}

export interface MasterOptions {
  diagnoses: Array<{ id: string; code: string; name: string }>;
  procedures: Array<{ id: string; code: string; name: string; defaultPrice: string }>;
  medications: Array<{ id: string; code: string; name: string; unit: string; sellingPrice: string }>;
}

interface Props { visit: VisitDetailData; options: MasterOptions; canEdit: boolean; canFinalize: boolean; }

function ActionForm({ label, action, fields, onSuccess }: { label: string; action: (prev: ActionState, fd: FormData) => Promise<ActionState>; fields?: Array<{ name: string; type?: string; placeholder?: string; defaultValue?: string; required?: boolean }>; onSuccess?: () => void }) {
  const router = useRouter();
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);
  async function handleSubmit(fd: FormData) {
    setPending(true);
    const res = await action(state, fd);
    setPending(false);
    setState(res);
    if (res.success) { toast.success(label + " berhasil"); onSuccess?.(); router.refresh(); } else toast.error(res.error ?? "Gagal");
  }
  return (
    <>
      {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
      <form action={handleSubmit} className="space-y-3">
        {fields?.map((f) => (
          <div key={f.name}>
            <Label className="text-xs capitalize">{f.name.replace(/([A-Z])/g, " $1")}</Label>
            <Input name={f.name} type={f.type ?? "text"} defaultValue={f.defaultValue ?? ""} required={f.required} placeholder={f.placeholder} className="mt-1" />
          </div>
        ))}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Memproses..." : label}
        </Button>
      </form>
    </>
  );
}

export function VisitDetail({ visit, options, canEdit, canFinalize }: Props) {
  const router = useRouter();
  const [actionPending, setActionPending] = React.useState(false);
  const mr = visit.medicalRecord;

  async function runVisitAction(action: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
    setActionPending(true);
    const fd = new FormData();
    fd.set("visitId", visit.id);
    const res = await action({}, fd);
    setActionPending(false);
    if (res.success) { toast.success("Status diperbarui"); router.refresh(); } else toast.error(res.error ?? "Gagal");
  }

  return (
    <Tabs defaultValue="detail" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="detail">Detail</TabsTrigger>
        <TabsTrigger value="soap">Rekam Medis</TabsTrigger>
        <TabsTrigger value="resep">Resep</TabsTrigger>
        <TabsTrigger value="vital">Tanda Vital</TabsTrigger>
        <TabsTrigger value="lab">Lab</TabsTrigger>
        <TabsTrigger value="rad">Radiologi</TabsTrigger>
        <TabsTrigger value="billing">Penagihan</TabsTrigger>
      </TabsList>

      <TabsContent value="detail" className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 text-sm">
            <div><span className="text-muted-foreground">No. Kunjungan</span><p className="font-medium">{visit.visitNumber}</p></div>
            <div><span className="text-muted-foreground">Status</span><p><StatusBadge status={visit.status} /></p></div>
            <div><span className="text-muted-foreground">Pasien</span><p className="font-medium">{visit.patientName} ({visit.patientMrn})</p></div>
            <div><span className="text-muted-foreground">Usia/JK</span><p>{ageFromBirthDate(visit.patientBirthDate) ?? "-"} th · {genderLabel(visit.patientGender)}</p></div>
            <div><span className="text-muted-foreground">Dokter</span><p>{visit.doctorName}</p></div>
            <div><span className="text-muted-foreground">Poli</span><p>{visit.departmentName}</p></div>
            <div className="sm:col-span-2"><span className="text-muted-foreground">Keluhan Utama</span><p className="whitespace-pre-wrap">{visit.chiefComplaint ?? "-"}</p></div>
          </CardContent>
        </Card>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {visit.status === "CHECKED_IN" && <Button size="sm" disabled={actionPending} onClick={() => runVisitAction(startVisitAction)}>Mulai Periksa</Button>}
            {visit.status === "IN_PROGRESS" && <Button size="sm" disabled={actionPending} onClick={() => runVisitAction(completeVisitAction)}>Selesaikan Kunjungan</Button>}
            {visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
              <Button size="sm" variant="destructive" disabled={actionPending} onClick={() => { if (window.confirm("Batalkan kunjungan ini?")) runVisitAction(cancelVisitAction); }}>Batalkan</Button>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="soap" className="space-y-4">
        {canEdit && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Isi SOAP</CardTitle></CardHeader>
            <CardContent>
              <form action={async (fd: FormData) => { fd.append("visitId", visit.id); const res = await saveSoapAction({}, fd); if (res.success) { toast.success("SOAP tersimpan"); router.refresh(); } else toast.error(res.error ?? "Gagal"); }} className="space-y-3">
                {["subjective", "objective", "assessment", "plan"].map((f) => (
                  <div key={f}>
                    <Label className="text-xs capitalize">{f}</Label>
                    <Textarea name={f} rows={3} defaultValue={mr?.[f as keyof typeof mr] as string ?? ""} className="mt-1 font-mono text-sm" />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Simpan SOAP</Button>
                  {mr && mr.status === "DRAFT" && canFinalize && (
                    <Button type="button" variant="success" size="sm" disabled={actionPending} onClick={() => { if (window.confirm("Finalisasi rekam medis?")) runVisitAction(finalizeMedicalRecordAction); }}>Finalisasi</Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {visit.diagnoses.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Diagnosa</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {visit.diagnoses.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-2 rounded border p-2">
                    <div>
                      <p><span className="font-medium">{d.code}</span> — {d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.diagnosisType}{d.notes ? ` · ${d.notes}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {canEdit && mr && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Tambah Diagnosa</CardTitle></CardHeader>
            <CardContent>
              <ActionForm label="Tambah" action={addDiagnosesAction} fields={[{ name: "medicalRecordId", defaultValue: mr.id, required: true }, { name: "visitId", defaultValue: visit.id }, { name: "diagnosisId", required: true, placeholder: "ID diagnosa dari list" }]} onSuccess={() => router.refresh()} />
              <select className="mt-2 flex h-9 w-full max-w-sm rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                <option value="">Pilih kode diagnosa...</option>
                {options.diagnoses.map((d) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
              </select>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="resep" className="space-y-4">
        {visit.prescriptions.map((rx) => (
          <Card key={rx.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">{rx.number}</CardTitle>
              <StatusBadge status={rx.status} />
            </CardHeader>
            <CardContent>
              {visit.prescriptionItems.filter((i) => i.prescriptionId === rx.id).length > 0 ? (
                <div className="space-y-2 text-sm">
                  {visit.prescriptionItems.filter((i) => i.prescriptionId === rx.id).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity} {item.route} · {item.dosage ?? "-"} {item.frequency ?? ""} {item.duration ? `· ${item.duration}` : ""}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">Tidak ada item.</p>}
            </CardContent>
          </Card>
        ))}
        {canEdit && visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Tambah Resep</CardTitle></CardHeader>
            <CardContent>
              <form action={async (fd: FormData) => { fd.append("visitId", visit.id); fd.append("patientId", visit.id); fd.append("doctorId", ""); const res = await createPrescriptionAction({}, fd); if (res.success) { toast.success("Resep dibuat"); router.refresh(); } else toast.error(res.error ?? "Gagal"); }} className="space-y-3 text-sm">
                <select name="medicationId" required className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
                  <option value="">Pilih obat...</option>
                  {options.medications.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Jumlah</Label><Input name="quantity" type="number" required min={1} defaultValue={1} className="mt-1" /></div>
                  <div><Label className="text-xs">Dosis</Label><Input name="dosage" className="mt-1" /></div>
                  <div><Label className="text-xs">Frekuensi</Label><Input name="frequency" className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Rute</Label><Input name="route" defaultValue="ORAL" className="mt-1" /></div>
                  <div><Label className="text-xs">Durasi</Label><Input name="duration" className="mt-1" /></div>
                </div>
                <Button type="submit" size="sm">Simpan Resep</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="vital" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tanda Vital</CardTitle></CardHeader>
          <CardContent>
            {visit.vitalSigns && (
              <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Suhu</span><p>{visit.vitalSigns.temperature ?? "-"}</p></div>
                <div><span className="text-muted-foreground">TD</span><p>{visit.vitalSigns.systolic ?? "-"}/{visit.vitalSigns.diastolic ?? "-"}</p></div>
                <div><span className="text-muted-foreground">Nadi</span><p>{visit.vitalSigns.heartRate ?? "-"}</p></div>
                <div><span className="text-muted-foreground">RR</span><p>{visit.vitalSigns.respiratoryRate ?? "-"}</p></div>
                <div><span className="text-muted-foreground">BB</span><p>{visit.vitalSigns.weight ?? "-"} kg</p></div>
                <div><span className="text-muted-foreground">PB</span><p>{visit.vitalSigns.height ?? "-"} cm</p></div>
              </div>
            )}
            <ActionForm label="Simpan Tanda Vital" action={addVitalSignsAction} fields={[
              { name: "visitId", defaultValue: visit.id },
              { name: "temperature", placeholder: "36.5", defaultValue: visit.vitalSigns?.temperature ?? "" },
              { name: "systolic", placeholder: "120", defaultValue: String(visit.vitalSigns?.systolic ?? "") },
              { name: "diastolic", placeholder: "80", defaultValue: String(visit.vitalSigns?.diastolic ?? "") },
              { name: "heartRate", placeholder: "80", defaultValue: String(visit.vitalSigns?.heartRate ?? "") },
              { name: "respiratoryRate", placeholder: "16", defaultValue: String(visit.vitalSigns?.respiratoryRate ?? "") },
              { name: "weight", placeholder: "70", defaultValue: visit.vitalSigns?.weight ?? "" },
              { name: "height", placeholder: "170", defaultValue: visit.vitalSigns?.height ?? "" },
              { name: "painScale", placeholder: "0-10", defaultValue: String(visit.vitalSigns?.painScale ?? "") },
              { name: "notes", placeholder: "Catatan opsional", defaultValue: "" },
            ]} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="lab" className="space-y-4">
        {visit.labOrders.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada order laboratorium.</p> : (
          <div className="space-y-2">
            {visit.labOrders.map((lo) => <Card key={lo.id}><CardContent className="flex items-center justify-between pt-6 text-sm"><span>{lo.orderNumber}</span><StatusBadge status={lo.status} /></CardContent></Card>)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="rad" className="space-y-4">
        {visit.radiologyOrders.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada order radiologi.</p> : (
          <div className="space-y-2">
            {visit.radiologyOrders.map((ro) => <Card key={ro.id}><CardContent className="flex items-center justify-between pt-6 text-sm"><span>{ro.orderNumber}</span><StatusBadge status={ro.status} /></CardContent></Card>)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="billing" className="space-y-4">
        {visit.invoices.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada invoice untuk kunjungan ini.</p> : (
          <div className="space-y-2">
            {visit.invoices.map((inv) => (
              <Card key={inv.id}><CardContent className="flex items-center justify-between pt-6 text-sm">
                <div><p className="font-medium">{inv.number}</p><p className="text-xs text-muted-foreground">{formatIDR(inv.total)}</p></div>
                <StatusBadge status={inv.status} />
              </CardContent></Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}