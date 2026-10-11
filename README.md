# Kas Keluarga

Aplikasi keuangan keluarga: kondisi keuangan awal, dashboard, transaksi (catat manual, pindai struk, impor e-statement PDF), dan anggaran.

Next.js 16 · Supabase (Auth + Postgres + RLS) · Tailwind CSS 4 · Plus Jakarta Sans

- Arah desain: [`DESIGN.md`](DESIGN.md)
- Arsitektur sampai level fungsi: [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md)

## Menyiapkan Supabase (sekali)

1. Buka proyek Supabase Anda, masuk ke **SQL Editor**, lalu jalankan file di `supabase/migrations/` satu per satu sesuai urutan nama:
   `20261003000000_kondisi_awal.sql`, `20261003010000_dana_darurat.sql`, `20261011000000_transaksi_anggaran.sql`,
   lalu `20261011010000_save_baseline_pertahankan_rekening.sql`. Migrasi ketiga juga membuat bucket Storage privat `receipts`.
2. **Authentication > URL Configuration**:
   - Site URL: alamat Vercel Anda, misalnya `https://kas-keluarga.vercel.app`
   - Redirect URLs: tambahkan `https://kas-keluarga.vercel.app/auth/callback` dan `http://localhost:3000/auth/callback`
3. **Project Settings > API**: salin *Project URL* dan *Publishable key* (proyek lama menyebutnya *anon key*).

Email bawaan Supabase dibatasi beberapa email per jam. Untuk dipakai sekeluarga sehari-hari, pasang SMTP sendiri di **Authentication > Emails > SMTP Settings**.

Sebelum mengundang orang di luar keluarga, isi nama pengelola, email kontak, dan region Supabase di `lib/site.ts`. Nilainya tampil di halaman Kebijakan Privasi dan Syarat Layanan.

## Aturan hitung

- Rasio cicilan: total cicilan maksimal 30% pemasukan.
- Target dana darurat: pengeluaran rutin per bulan × 12 (tidak berpenghasilan tetap), 3 (lajang), 6 (menikah tanpa anak), 9 atau 12 (menikah dengan anak).
- Alokasi dana darurat: 10% pemasukan per bulan (bisa diubah per keluarga), ditampung di tabungan bank, e-wallet, atau reksa dana pasar uang yang ditandai.

## Menjalankan di komputer

```bash
cp .env.example .env.local   # isi dua nilai dari langkah 3
npm install
npm run dev                  # http://localhost:3000
```

## Deploy ke Vercel

1. Vercel > **Add New > Project** > pilih repo `FamilyFinance`.
2. Bila kode masih di branch `nextjs-supabase`, ubah *Production Branch* di **Settings > Git**, atau gabungkan dulu ke `main`.
3. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `ANTHROPIC_API_KEY`
   (dari console.anthropic.com, untuk membaca struk dan e-statement; tandai *Sensitive*). Tanpa kunci ini aplikasi tetap jalan,
   tetapi struk hanya tersimpan sebagai lampiran dan impor e-statement belum aktif.
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
