"use client";

import * as React from "react";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatientFormDialog, type PatientFormValue } from "./patient-form-dialog";

export function PatientEditButton({ patient }: { patient: PatientFormValue }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PenLine className="h-4 w-4" /> Edit
      </Button>
      <PatientFormDialog open={open} onOpenChange={setOpen} patient={patient} />
    </>
  );
}