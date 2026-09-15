import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getPrescription } from "@/features/pharmacy/service";
import { DispenseView, type DispensePrescription, type DispenseItem } from "@/features/pharmacy/dispense-view";

export const metadata: Metadata = { title: "Serahkan Resep" };

interface Props { params: Promise<{ id: string }> }

export default async function PharmacyDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  assertCan(user, "pharmacy.dispense");

  let data;
  try {
    data = await getPrescription(user, id);
  } catch {
    notFound();
  }

  const prescription: DispensePrescription = {
    id: data.prescription.id,
    prescriptionNumber: data.prescription.prescriptionNumber,
    status: data.prescription.status,
    patientName: data.prescription.patientName,
    patientMrn: data.prescription.patientMrn,
    doctorName: data.prescription.doctorName,
    issuedAt: data.prescription.issuedAt,
  };
  const items: DispenseItem[] = data.items.map((i) => ({
    id: i.id,
    medicationId: i.medicationId,
    name: i.name,
    unit: i.unit,
    quantity: i.quantity,
    dispensedQuantity: i.dispensedQuantity,
    status: i.status,
    dosage: i.dosage,
    frequency: i.frequency,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Resep ${data.prescription.prescriptionNumber}`}
        description="Serahkan item secara bertahap; stok dikurangi otomatis dari batch terdekat kadaluarsa (FEFO)."
        actions={<StatusBadge status={prescription.status} />}
      />
      <DispenseView prescription={prescription} items={items} />
    </div>
  );
}