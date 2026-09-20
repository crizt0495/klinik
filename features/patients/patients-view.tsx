"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine, Plus, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { genderLabel, ageFromBirthDate } from "@/lib/utils";
import { PatientFormDialog, type PatientFormValue } from "./patient-form-dialog";
import { deletePatientAction } from "./actions";

interface Row {
  id: string;
  medicalRecordNumber: string;
  fullName: string;
  nik: string | null;
  gender: string;
  birthDate: string | null;
  phone: string | null;
  status: string;
  visitCount: number;
}

interface Props {
  patients: Row[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function PatientsView({ patients, canCreate, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PatientFormValue | null>(null);
  const [deleting, setDeleting] = React.useState<Row | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const columns: DataTableColumn<Row>[] = [
    {
      id: "fullName",
      header: "Nama",
      accessorFn: (r) => r.fullName,
      cell: (ctx) => {
        const r = ctx.row.original;
        return (
          <div>
            <p className="font-medium">{r.fullName}</p>
            <p className="text-xs text-muted-foreground">{r.medicalRecordNumber}</p>
          </div>
        );
      },
    },
    { id: "gender", header: "Jenis Kelamin", accessorFn: (r) => genderLabel(r.gender), cell: (ctx) => genderLabel(ctx.row.original.gender) },
    {
      id: "age",
      header: "Usia",
      cell: (ctx) => {
        const age = ageFromBirthDate(ctx.row.original.birthDate);
        return age == null ? "-" : `${age} th`;
      },
    },
    { id: "nik", header: "NIK", accessorFn: (r) => r.nik ?? "-" },
    { id: "phone", header: "No. HP", accessorFn: (r) => r.phone ?? "-" },
    { id: "visitCount", header: "Kunjungan", accessorFn: (r) => r.visitCount },
    {
      id: "status",
      header: "Status",
      cell: (ctx) => <StatusBadge status={ctx.row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: (ctx) => {
        const r = ctx.row.original;
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setEditing({
                    id: r.id,
                    fullName: r.fullName,
                    nik: r.nik,
                    gender: r.gender,
                    birthDate: r.birthDate,
                    phone: r.phone,
                  });
                  setFormOpen(true);
                }}
              >
                <PenLine className="h-4 w-4" />
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(r)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const fd = new FormData();
    fd.set("id", deleting.id);
    const res = await deletePatientAction({}, fd);
    setDeletePending(false);
    if (res.success) {
      toast.success("Pasien dihapus");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error(res.error ?? "Gagal menghapus");
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2">
        {canCreate ? (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!canCreate}>
            <Plus className="h-4 w-4" /> Registrasi Pasien Baru
          </Button>
        ) : null}
      </div>
      <DataTable
        columns={columns}
        data={patients}
        searchPlaceholder="Cari nama, No. RM, atau NIK..."
        emptyTitle="Belum ada pasien"
        emptyDescription="Daftarkan pasien pertama Anda."
        onRowClick={(row) => router.push(`/patients/${row.id}`)}
        exportable
        exportFilename="pasien"
      />
      <PatientFormDialog open={formOpen} onOpenChange={setFormOpen} patient={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Hapus Pasien"
        description={deleting ? `Hapus ${deleting.fullName}? Data dapat dipulihkan oleh admin.` : undefined}
        confirmLabel="Hapus"
        variant="destructive"
        loading={deletePending}
        onConfirm={confirmDelete}
      />
    </>
  );
}