# SIM Klinik — Sistem Informasi Manajemen Klinik

Aplikasi manajemen klinik modern berbasis **Next.js (App Router)**, **PostgreSQL (Neon)**, dan **Drizzle ORM**. Mencakup alur pasien dari pendaftaran, antrean, rekam medis, farmasi & gudang, laboratorium/radiologi, hingga billing & pembayaran, dengan kontrol akses berbasis peran (RBAC) dan jejak audit.

## Fitur Utama

- **Pendaftaran & Antrean** — pasien, kunjungan, antrean poli dengan transisi status atomik dan nomor antrean otomatis.
- **Rekam Medis** — kunjungan, diagnosa, resep, tindakan; peran dokter/perawat; amend dengan kontrol versi.
- **Farmasi & Gudang** — batch inventory (FEFO), racik/serah obat, stok opname, purchase order & penerimaan.
- **Laboratorium & Radiologi** — permintaan pemeriksaan, proses, verifikasi hasil.
- **Billing** — invoice per kunjungan (unik), pembayaran parsial/lunas, refund.
- **RBAC** — 11 peran bawaan + peran kustom, 61 izin, super admin.
- **Keamanan** — password Argon2id, sesi server-side, rate-limit login & lockout, wajib ganti password bawaan, audit log.
- **Multi-organisasi & multi-cabang** sejak desain.

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| Bahasa | TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL — Neon (production), PGlite (lokal & test) |
| UI | Tailwind CSS + shadcn/ui style components |
| Test | Vitest (PGlite in-memory/dir) |

## Cara Menjalankan

### Prasyarat
- Node.js 20+ dan npm.
- (Opsional) Akun [Neon](https://neon.tech) untuk database PostgreSQL.

### 1. Install & konfigurasi

```bash
npm install
cp .env.example .env.local   # lalu isi DATABASE_URL
```

Minimal isi `.env.local`:

```bash
DATABASE_URL=postgresql://user:pass@host/db       # URL pooled Neon dengan SSL
# Opsional:
# DB_DRIVER=pglite                                # gunakan PGlite lokal (kecuali NODE_ENV=production)
# PGLITE_DATA_DIR=.pglite
```

> **Produksi:** pakai URL **pooled** dari Neon (`-pooler`) karena aplikasi memakai koneksi WebSocket untuk transaksi ACID. PG dari koneksi biasa juga tetap dibutuhkan untuk `db:migrate`/`db:push` (masukkan lewat `DATABASE_URL_PLAIN` bila perlu).

### 2. Inisialisasi database

```bash
npm run db:push      # sinkronkan skema ke database (dipakai di lingkungan Neon)
npm run db:seed      # isi data awal + akun demo
```

> Lingkungan lokal (`DB_DRIVER=pglite`) otomatis membuat skema saat aplikasi dijalankan; `db:seed` cukup dipanggil sekali.

### 3. Jalankan

```bash
npm run dev          # http://localhost:3000
```

### Script penting

| Script | Deskripsi |
|---|---|
| `npm run dev` | Mode pengembangan |
| `npm run build` / `start` | Build & jalankan produksi |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `tsc --noEmit` |
| `npm test` | Seluruh suite test (Vitest + PGlite) |
| `npm run db:push` | Sinkronkan skema ke DB |
| `npm run db:seed` | Data awal + akun demo |
| `npm run db:generate` | Generate migrasi Drizzle baru |
| `npm run db:migrate` | Terapkan migrasi Drizzle |

## Akun Demo

Akun berikut dibuat oleh `db:seed` dan **pada login pertama wajib mengganti password** (diarahkan ke halaman Profil → Keamanan).

| Username | Peran(default) |
|---|---|
| `owner` | Owner + Super Admin |
| `admin` | Admin Klinik |
| `doctor` | Dokter |
| `nurse` | Perawat |
| `receptionist` | Resepsionis |
| `pharmacist` | Apoteker |
| `cashier` | Kasir |
| `lab` | Petugas Laboratorium |
| `radiology` | Petugas Radiologi |
| `manager` | Manajer |

> **Jangan gunakan password bawaan di produksi.** System akan memaksa pergantian, tetapi pastikan setiap akun diubah dan aktifkan 2 langkah praktik: batasi akses DB dan rotasi kredensial.

## Arsitektur Singkat

```
app/                    # Route & layout (App Router)
  (app)/                #   area terautentikasi + guard RBAC per halaman
  (auth)/               #   login
  api/                  #   endpoint API (jika ada)
components/             # UI bersama (DataTable, dialogs, forms, dll)
db/
  schema/               # Skema Drizzle per domain
  migrations/           # Migrasi SQL
  seed.ts               # Data awal
  index.ts              # Koneksi DB (Neon/PGlite)
  transaction.ts        # Helper transaksi ACID (Neon WS pool / PGlite)
features/<modul>/       # service (logika bisnis) + server actions + view (client)
lib/
  auth/                 # sesi, RBAC, rate-limit, password
  permissions.ts        # definisi izin & peran
  services/             # audit, penomoran, notifikasi
tests/                  # Vitest integration (PGlite)
```

### Konsistensi data & transaksi

Operasi kritis yang melakukan baca→cek→tulis (dispensing obat, pembayaran, refund, penerimaan PO, pembuatan invoice per kunjungan, transisi antrean, stok opname) dijalankan di dalam **transaksi database** (`runInTransaction`). Pada produksi memakai koneksi WebSocket ke Neon sehingga `SELECT ... FOR UPDATE` benar-benar terserialisasi antar permintaan.

## Deploy ke Vercel

1. Push repo ke GitHub, import ke Vercel.
2. Set variabel env (lihat `.env.example`).
3. `npm run db:push` + `npm run db:seed` terlebih dahulu terhadap database tujuan.
4. Setiap push ke `main` ter-deploy otomatis.

## Checklist Produksi

- [ ] Database PostgreSQL (Neon) aktif, gunakan URL **pooled** untuk runtime.
- [ ] `DATABASE_URL` diatur; jangan pernah me-commit `.env.local`.
- [ ] Semua akun demo sudah mengganti password.
- [ ] Konfigurasi backup Neon (PITR) & uji restore.
- [ ] Pantau error (Vercel dashboard / Sentry bila dipasang).
- [ ] Tinjau izin peran (`/admin/roles`) sesuai kebijakan klinik.
- [ ] Gunakan audit/scan dependensi berkala.