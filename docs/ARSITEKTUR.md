# Arsitektur Kas Keluarga

Dari gambaran besar ke fungsi. Kondisi per versi 0.1 (landing + isian kondisi keuangan awal + dashboard).

## 1. Sistem

```
Browser ──► Next.js di Vercel ──► Supabase
            (halaman, proxy sesi)   ├─ Auth: tautan masuk via email
                                    └─ Postgres + Row Level Security
```

- **Browser** menyimpan draf isian di `localStorage` sampai pengguna memilih menyimpan. Tidak ada data keuangan yang dikirim sebelum itu.
- **Next.js** (App Router) merender halaman dan menjalankan `proxy.ts` yang memperbarui sesi Supabase serta menjaga rute privat.
- **Supabase** memegang identitas pengguna dan data. Setiap tabel memakai RLS, jadi database sendiri menolak akses ke data keluarga lain, apa pun yang dikirim browser.

## 2. Alur pengguna

```
/  (landing, hitung cepat)
 └─► /mulai  (wizard 7 langkah, draf lokal)
       └─► Simpan ─► /mulai/simpan ─(belum masuk)─► /masuk ─► email ─► /auth/callback
                          │                                                  │
                          └──────────────── rpc save_baseline ◄──────────────┘
                                              │
                                              ▼
                                         /dashboard ─► Perbarui kondisi awal ─► /mulai
```

| Rute | Jenis | Akses | Isi |
| --- | --- | --- | --- |
| `/` | statis | publik | Penjelasan, hitung cepat sisa kas, ajakan mengisi |
| `/mulai` | klien | publik | Wizard: keluarga, rekening, pemasukan, pengeluaran, utang, aset, ringkasan |
| `/mulai/simpan` | klien | perlu masuk | Kirim draf ke `save_baseline`, lalu ke dashboard |
| `/masuk` | server + klien | publik | Minta tautan masuk (magic link) |
| `/auth/callback` | route handler | publik | Tukar kode tautan menjadi sesi |
| `/auth/keluar` | route handler (POST) | publik | Akhiri sesi |
| `/dashboard` | server | perlu masuk | Ringkasan + rincian dari database |

## 3. Struktur folder

```
app/                    rute (lihat tabel di atas), globals.css berisi token desain
components/
  Field.tsx             label + isian + petunjuk + galat, dan MoneyInput (rupiah)
  SummaryView.tsx       kartu kekayaan bersih, arus kas, dana darurat (wizard & dashboard)
  onboarding/Wizard.tsx wizard 7 langkah
  landing/QuickCheck.tsx hitung cepat + tombol mulai
  auth/LoginForm.tsx    formulir tautan masuk
  dashboard/…           tombol perbarui
lib/
  money.ts              baca dan tulis rupiah
  baseline.ts           model data, validasi, kalkulasi, konversi ke/dari database
  draft.ts              simpan draf di localStorage
  supabase/             klien browser, klien server, pembaruan sesi, env
proxy.ts                pembaruan sesi + proteksi rute (nama Next.js 16 untuk middleware)
supabase/migrations/    skema, RLS, fungsi save_baseline
tests/                  uji logika, uji database, uji klik di browser
```

## 4. Model data

Semua nominal rupiah bulat (`bigint`). Satu baris `households` per keluarga, semua tabel lain menempel lewat `household_id`.

| Tabel | Kolom penting |
| --- | --- |
| `households` | `name`, `dependents`, `emergency_target_months`, `created_by` |
| `household_members` | `household_id`, `user_id`, `role` (owner / member / viewer), `display_name` |
| `accounts` | `name`, `kind` (tabungan, giro, ewallet, tunai, deposito), `balance` |
| `income_sources` | `name`, `earner`, `monthly_amount` |
| `monthly_expenses` | `category`, `monthly_amount` |
| `debts` | `name`, `kind` (kpr, kendaraan, kartu_kredit, pinjaman), `principal_remaining`, `monthly_installment` |
| `assets` | `name`, `kind` (properti, kendaraan, emas, reksa_dana, saham, obligasi, lainnya), `current_value` |

**Aturan akses (RLS)**: anggota keluarga boleh membaca; owner dan member boleh menulis; viewer hanya membaca. `household_members` tidak bisa ditulis langsung dari browser, hanya lewat fungsi database.

## 5. Fungsi kunci

### Database

- `has_household_role(target uuid, allowed text[]) → boolean`: dipakai semua kebijakan RLS. `security definer` agar pengecekan keanggotaan tidak memicu kebijakan RLS di tabel keanggotaan itu sendiri.
- `save_baseline(payload jsonb) → uuid`: menyimpan seluruh isian dalam satu transaksi. Pertama kali: membuat keluarga dan menjadikan pemanggil owner. Berikutnya: mengganti baris kondisi awal keluarga yang ia miliki. Gagal di tengah berarti tidak ada yang tersimpan.

### `lib/baseline.ts`

- `emptyDraft()`: draf kosong dengan 7 kategori pengeluaran umum yang sudah disiapkan.
- `validateStep(step, draft) → Errors`: galat per langkah, dikunci dengan `id` isian agar fokus bisa dipindah ke isian yang salah.
- `firstInvalidStep(draft)`: langkah pertama yang belum lengkap, dipakai saat menyimpan.
- `summarize(draft) → Summary`: kekayaan bersih, arus kas, ketahanan dana darurat, rasio cicilan, rasio tabungan.
- `signals(summary) → Signal[]`: kalimat bacaan dari angka, urut dari yang paling perlu perhatian.
- `toPayload(draft)`: bentuk yang diterima `save_baseline` (kategori bernilai nol dibuang).
- `fromRecord(record)`: membangun draf dari data tersimpan untuk tombol "Perbarui kondisi awal".

### `lib/money.ts`

- `parseRupiah("1.500.000") → 1500000`, `formatRupiah(1500000) → "Rp 1.500.000"`, `formatRupiahShort`, `formatPercent`.

### `lib/supabase/`

- `updateSession(request)`: menyegarkan token, mengalihkan ke `/masuk?next=…` bila rute privat dibuka tanpa sesi.
- `safeNext(next)`: hanya menerima jalur di situs ini, mencegah pengalihan ke situs lain setelah masuk.
- `publicOrigin(headers)`: alamat yang benar-benar dibuka pengguna, agar cookie sesi ikut saat dialihkan.

## 6. Pengujian

| Perintah | Menguji |
| --- | --- |
| `npm test` | Format rupiah, kalkulasi ringkasan, validasi, konversi data (8 uji) |
| `npm run test:db` | Migrasi asli di Postgres lokal (PGlite): RLS antar keluarga, `save_baseline`, penolakan data tidak valid (10 uji) |
| `tests/e2e/clickthrough.py` | Klik semua kontrol di desktop 1280 px dan ponsel 375 px, dari landing sampai keluar, terhadap Supabase tiruan (70 pemeriksaan) |

## 7. Tahap berikutnya

Sesuai blueprint: transaksi harian dan kategori, target tabungan, undangan anggota keluarga, AI insight dari ringkasan (di server), lalu PWA.
