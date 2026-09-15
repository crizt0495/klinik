"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default" | "success";
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Konfirmasi", cancelLabel = "Batal", variant = "default", onConfirm, loading }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-warning/15 p-2 text-warning">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription className="mt-1.5">{description}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant === "destructive" ? "destructive" : variant === "success" ? "success" : "default"} onClick={onConfirm} disabled={loading}>
            {loading ? "Memproses..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}