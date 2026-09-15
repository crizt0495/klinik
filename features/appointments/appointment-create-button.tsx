"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentFormDialog, type AppointmentOptions } from "./appointment-form-dialog";

export function AppointmentCreateButton({ options }: { options: AppointmentOptions }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Buat Appointment
      </Button>
      <AppointmentFormDialog open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}