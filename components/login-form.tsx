"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginAction, type LoginActionState } from "@/features/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      {pending ? "Memproses..." : "Masuk"}
    </Button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [state, setState] = React.useState<LoginActionState | null>(null);

  async function handleSubmit(formData: FormData) {
    const res = await loginAction(state ?? { error: undefined }, formData);
    setState(res);
    if (res.success) {
      if (res.mustChangePassword) {
        toast("Aman dulu: Anda wajib mengganti password bawaan sebelum lanjut.");
        router.replace("/profile?force=1");
        router.refresh();
        return;
      }
      toast.success("Berhasil masuk");
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <Card className="border-border/70 shadow-pop">
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" placeholder="cth. admin" autoComplete="username" required />
            {state?.fieldErrors?.username ? <p className="text-xs text-destructive">{state.fieldErrors.username}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {state?.fieldErrors?.password ? <p className="text-xs text-destructive">{state.fieldErrors.password}</p> : null}
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}