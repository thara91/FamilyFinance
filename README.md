# Kas Keluarga

Aplikasi keuangan keluarga. Versi ini: landing page, isian kondisi keuangan awal (7 langkah), dan dashboard ringkasan.

Next.js 16 · Supabase (Auth + Postgres + RLS) · Tailwind CSS 4 · Plus Jakarta Sans

- Arah desain: [`DESIGN.md`](DESIGN.md)
- Arsitektur sampai level fungsi: [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md)

## Menyiapkan Supabase (sekali)

1. Buka proyek Supabase Anda, masuk ke **SQL Editor**, tempel seluruh isi `supabase/migrations/20261003000000_kondisi_awal.sql`, lalu **Run**.
2. **Authentication > URL Configuration**:
   - Site URL: alamat Vercel Anda, misalnya `https://kas-keluarga.vercel.app`
   - Redirect URLs: tambahkan `https://kas-keluarga.vercel.app/auth/callback` dan `http://localhost:3000/auth/callback`
3. **Project Settings > API**: salin *Project URL* dan *Publishable key* (proyek lama menyebutnya *anon key*).

Email bawaan Supabase dibatasi beberapa email per jam. Untuk dipakai sekeluarga sehari-hari, pasang SMTP sendiri di **Authentication > Emails > SMTP Settings**.

## Menjalankan di komputer

```bash
cp .env.example .env.local   # isi dua nilai dari langkah 3
npm install
npm run dev                  # http://localhost:3000
```

## Deploy ke Vercel

1. Vercel > **Add New > Project** > pilih repo `FamilyFinance`.
2. Bila kode masih di branch `nextjs-supabase`, ubah *Production Branch* di **Settings > Git**, atau gabungkan dulu ke `main`.
3. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Deploy. Framework terdeteksi otomatis sebagai Next.js.

## Pengujian

```bash
npm test          # logika rupiah, kalkulasi, validasi
npm run test:db   # migrasi + RLS di Postgres lokal (tanpa Supabase)
npm run build
```

Uji klik di browser (butuh Python Playwright):

```bash
node tests/e2e/mock-supabase.mjs &
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm run build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npx next start -p 3100 &
python3 tests/e2e/clickthrough.py
```
