"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TriangleAlert, RotateCw } from "lucide-react";

/**
 * Error boundary khusus segmen /bpjs (route group level).
 *
 * Sebelumnya halaman BPJS yang melempar unhandled server exception tampil
 * dengan layar error bawaan Next.js ("This page couldn't load — A server
 * error occurred"), yang terasa membingungkan bagi staff klinik. Boundary ini
 * menangkap exception di level segment BPJS dan menampilkan pesan ramah
 * berbahasa Indonesia + tombol "Coba Lagi", plus detail teknis yang bisa
 * disalin untuk membantu pelaporan.
 */

export default function BpjsSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [detailOpen, setDetailOpen] = React.useState(false);
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="leading-tight">Halaman BPJS gagal dimuat</CardTitle>
              <CardDescription className="mt-1">
                Terjadi kesalahan saat memuat halaman ini. Ini biasanya sementara — coba muat ulang dulu.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {detailOpen ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Detail teknis (untuk dilaporkan):</p>
              <pre className="scrollbar-thin max-h-40 overflow-auto rounded-md border border-border/70 bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                {error.message || "Terjadi kesalahan tanpa pesan."}
                {error.digest ? `\n\nDigest: ${error.digest}` : ""}
              </pre>
              <p className="text-xs text-muted-foreground">
                Kalau masih muncul setelah dicoba ulang, beri tahu admin dengan menyertakan teks di atas.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Silakan coba lagi. Jika error tetap muncul, periksa pengaturan koneksi BPJS di halaman{" "}
              <Button variant="link" className="h-auto p-0 text-sm" asChild>
                <a href="/bpjs/settings">Pengaturan BPJS</a>
              </Button>{" "}
              — atau hubungi admin.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={reset}>
            <RotateCw className="mr-2 h-4 w-4" aria-hidden />
            Coba Lagi
          </Button>
          <Button variant="ghost" onClick={() => setDetailOpen((v) => !v)}>
            {detailOpen ? "Sembunyikan detail" : "Lihat detail"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
