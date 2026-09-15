import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guard";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  try {
    await getSessionUser();
    redirect("/dashboard");
  } catch {
    // continue to render form
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">SIM Klinik</h1>
            <p className="text-sm text-muted-foreground">Sistem Informasi Manajemen Klinik</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}