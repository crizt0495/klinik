"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { changePasswordAction } from "@/features/auth/change-password";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
      {pending ? "Menyimpan..." : "Ganti Password"}
    </Button>
  );
}

function PasswordField({ id, label, placeholder, autoComplete }: { id: string; label: string; placeholder: string; autoComplete: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} name={id} type={show ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} required className="pr-10" />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        setError(null);
        const res = await changePasswordAction({}, fd);
        if (res.success) {
          toast.success("Password berhasil diubah");
          router.replace("/dashboard");
          router.refresh();
        } else if (res.error) {
          setError(res.error);
        }
      }}
      className="space-y-4"
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <PasswordField id="currentPassword" label="Password saat ini" placeholder="Masukkan password lama" autoComplete="current-password" />
      <PasswordField id="newPassword" label="Password baru" placeholder="Minimal 8 karakter" autoComplete="new-password" />
      <PasswordField id="confirmPassword" label="Konfirmasi password baru" placeholder="Ulangi password baru" autoComplete="new-password" />
      {forced ? (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Anda menggunakan password bawaan. Ganti dengan password pribadi untuk melanjutkan.</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}