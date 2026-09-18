import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeartPulse, ShieldCheck, Activity, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guard";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Masuk" };

const HIGHLIGHTS = [
  { icon: Activity, title: "Alur klinis terpadu", description: "Pendaftaran, antrean, rekam medis, farmasi, hingga billing dalam satu alur." },
  { icon: ShieldCheck, title: "Aman & teraudit", description: "Kontrol akses berbasis peran dan jejak audit untuk setiap tindakan." },
  { icon: Users, title: "Siap multi-peran", description: "Admin, dokter, perawat, apoteker, kasir, dan laboratorium." },
];

export default async function LoginPage() {
  try {
    await getSessionUser();
    redirect("/dashboard");
  } catch {
    // continue to render form
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="bg-mesh relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-card ring-1 ring-inset ring-white/10">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-[-0.01em]">Klinik Sehat</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">SIM Klinik</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-4">
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-balance">Satu sistem untuk seluruh layanan klinik Anda.</h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">Kelola pasien, jadwal, rekam medis, farmasi, dan keuangan dengan antarmuka yang tenang dan cepat.</p>
          </div>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/70 bg-card/70 text-primary shadow-2xs backdrop-blur">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium tracking-[-0.01em]">{item.title}</p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground text-pretty">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground/70">© {new Date().getFullYear()} Klinik Sehat. Seluruh hak dilindungi.</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-card">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-[-0.01em]">Klinik Sehat</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">SIM Klinik</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">Selamat datang kembali</h2>
            <p className="text-sm text-muted-foreground">Masuk untuk melanjutkan ke dashboard klinik.</p>
          </div>

          <LoginForm />
        </div>
      </main>
    </div>
  );
}
