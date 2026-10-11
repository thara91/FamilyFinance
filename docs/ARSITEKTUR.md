# Arsitektur Kas Keluarga

Dari gambaran besar ke fungsi. Kondisi per versi 0.3 (landing, kondisi keuangan awal, dashboard, transaksi dengan pindai struk dan impor e-statement, anggaran, halaman legal).

## 1. Sistem

```
Browser ──► Next.js di Vercel ──► Supabase
            (halaman, proxy sesi,   ├─ Auth: tautan masuk via email
             aksi server, API)      ├─ Postgres + Row Level Security
                   │                └─ Storage: bucket privat receipts/<household_id>/
                   └──► Claude API (Anthropic): membaca foto struk dan PDF e-statement, dari server saja
```

- **Browser** menyimpan draf isian di `localStorage` sampai pengguna memilih menyimpan. Tidak ada data keuangan yang dikirim sebelum itu.
- **Next.js** (App Router) merender halaman dan menjalankan `proxy.ts` yang memperbarui sesi Supabase serta menjaga rute privat.
- **Supabase** memegang identitas pengguna dan data. Setiap tabel memakai RLS, jadi database sendiri menolak akses ke data keluarga lain, apa pun yang dikirim browser. Foto struk disimpan di folder keluarga dengan aturan akses yang sama.
- **Claude API** hanya dipanggil dari route handler server dengan `ANTHROPIC_API_KEY`; kunci itu tidak pernah sampai ke browser. Tanpa kunci, struk tetap tersimpan sebagai lampiran dan impor e-statement menampilkan pesan belum aktif.

## 2. Alur pengguna

```
/  (landing, hitung cepat)
 └─► /mulai  (wizard 8 langkah, draf lokal)
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
| `/mulai` | klien | publik | Wizard 8 langkah: keluarga, rekening, pemasukan, pengeluaran, dana darurat, utang, aset, ringkasan |
| `/mulai/simpan` | klien | perlu masuk | Kirim draf ke `save_baseline`, lalu ke dashboard |
| `/masuk` | server + klien | publik | Minta tautan masuk (magic link) |
| `/auth/callback` | route handler | publik | Tukar kode tautan menjadi sesi |
| `/auth/keluar` | route handler (POST) | publik | Akhiri sesi |
| `/dashboard` | server | perlu masuk | Ringkasan, uang keluar-masuk bulan ini, anggaran vs realisasi, rincian |
| `/transaksi` | server | perlu masuk | Daftar per bulan per tanggal, filter jenis/kategori/kata, saldo rekening berjalan |
| `/transaksi/baru` | server + klien | owner, member | Form catat + pindai struk |
| `/transaksi/[id]` | server + klien | perlu masuk | Ubah, hapus (dengan konfirmasi), lihat lampiran struk; viewer hanya melihat |
| `/transaksi/impor` | server + klien | owner, member | Unggah PDF, tinjau baris + analisis pengeluaran, simpan terpilih |
| `/anggaran` | server + klien | perlu masuk | Batas per kategori, realisasi bulan terpilih, penanda posisi hari ini |
| `/api/struk` | route handler (POST) | owner, member | Simpan foto ke Storage, baca dengan Claude, kembalikan isian |
| `/api/mutasi` | route handler (POST) | owner, member | Baca PDF dengan Claude, tandai baris yang sudah pernah diimpor; PDF tidak disimpan |
| `/privasi`, `/ketentuan` | statis | publik | Kebijakan Privasi dan Syarat Layanan; isian pengelola di `lib/site.ts` |

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
| `households` | `name`, `earning_status` (freelance / lajang / menikah / menikah_anak), `emergency_target_months`, `emergency_allocation_pct`, `created_by` |
| `household_members` | `household_id`, `user_id`, `role` (owner / member / viewer), `display_name` |
| `accounts` | `name`, `kind` (tabungan, giro, ewallet, rdpu, tunai, deposito), `balance`, `is_emergency` (hanya tabungan, ewallet, rdpu) |
| `income_sources` | `name`, `earner`, `monthly_amount` |
| `monthly_expenses` | `category`, `monthly_amount`, `is_routine` (dasar dana darurat) |
| `debts` | `name`, `kind` (kpr, kendaraan, kartu_kredit, pinjaman), `principal_remaining`, `monthly_installment` |
| `assets` | `name`, `kind` (properti, kendaraan, emas, reksa_dana, saham, obligasi, lainnya), `current_value` |
| `transactions` | `occurred_on`, `direction` (masuk / keluar), `amount`, `category`, `description`, `account_id`, `note`, `source` (manual / struk / mutasi), `receipt_path`, `import_ref` |
| `budgets` | `category`, `monthly_limit` (satu baris per kategori, berlaku tiap bulan) |
| view `account_balances` | `opening_balance`, `balance_set_at`, `current_balance` = saldo awal + transaksi yang dicatat sesudahnya |

**Saldo berjalan**: `accounts.balance` adalah saldo pada `balance_set_at`. Transaksi dihitung bila bertanggal sesudah hari itu, atau bertanggal hari itu dan dicatat sesudahnya. Riwayat lama dari e-statement masuk laporan dan anggaran tanpa menggandakan saldo. Mengubah saldo di kondisi awal mencatat ulang `balance_set_at`.

**Rekening tetap**: `save_baseline` memperbarui rekening berdasarkan id, tidak menghapus lalu membuat ulang, sehingga transaksi tetap menempel. Rekening yang dihapus melepas transaksinya (`account_id` menjadi kosong), tidak ikut menghapusnya.

**Aturan di database**: pengali dana darurat harus cocok dengan status (12 / 3 / 6 / 9 atau 12), dan hanya tabungan bank, e-wallet, serta reksa dana pasar uang yang boleh ditandai sebagai penampung dana darurat. Isian yang melanggar ditolak, bukan disimpan setengah.

**Aturan akses (RLS)**: anggota keluarga boleh membaca; owner dan member boleh menulis; viewer hanya membaca. `household_members` tidak bisa ditulis langsung dari browser, hanya lewat fungsi database. Transaksi hanya boleh menunjuk rekening keluarga yang sama (foreign key gabungan `account_id, household_id`), lampiran harus berada di folder keluarga sendiri, dan `import_ref` unik per keluarga sehingga baris e-statement tidak bisa masuk dua kali.

## 5. Fungsi kunci

### Database

- `has_household_role(target uuid, allowed text[]) → boolean`: dipakai semua kebijakan RLS. `security definer` agar pengecekan keanggotaan tidak memicu kebijakan RLS di tabel keanggotaan itu sendiri.
- `save_baseline(payload jsonb) → uuid`: menyimpan seluruh isian dalam satu transaksi. Pertama kali: membuat keluarga dan menjadikan pemanggil owner. Berikutnya: mengganti baris kondisi awal keluarga yang ia miliki. Gagal di tengah berarti tidak ada yang tersimpan.

### `lib/baseline.ts`

- `emptyDraft()`: draf kosong dengan 9 kategori pengeluaran; kebutuhan pokok sudah ditandai rutin, hiburan dan lainnya tidak.
- `normalizeDraft(raw)`: melengkapi draf lama di perangkat dengan kolom baru.
- `validateStep(step, draft) → Errors`: galat per langkah, dikunci dengan `id` isian agar fokus bisa dipindah ke isian yang salah.
- `firstInvalidStep(draft)`: langkah pertama yang belum lengkap, dipakai saat menyimpan.
- `emergencyPlan(draft) → EmergencyPlan`: pengeluaran rutin × pengali status = target; saldo instrumen bertanda = terkumpul; pemasukan × persen alokasi = setoran per bulan; sisa ÷ setoran = bulan sampai tercapai.
- `summarize(draft) → Summary`: kekayaan bersih, arus kas, rasio cicilan (batas `DEBT_RATIO_LIMIT` 30%), rasio tabungan, dan rencana dana darurat.
- `signals(summary) → Signal[]`: kalimat bacaan dari angka, urut dari yang paling perlu perhatian.
- `toPayload(draft)`: bentuk yang diterima `save_baseline` (kategori bernilai nol dibuang).
- `fromRecord(record)`: membangun draf dari data tersimpan untuk tombol "Perbarui kondisi awal".

- `can_access_receipt(object_name, allowed)`: kebijakan Storage; folder pertama nama file harus id keluarga tempat pemanggil punya peran.

### `lib/transactions.ts`

- `validateTransaction(input, today) → TxErrors`: galat per isian (tanggal, jenis, jumlah, kategori, keterangan, rekening).
- `categoriesFor(direction, custom)`: kategori masuk atau keluar; kategori milik keluarga dari kondisi awal ikut. `isSpending` mengecualikan "Transfer & tarik tunai" dan "Tabungan & investasi".
- `totals(rows)`, `spendingByCategory(rows)`: masuk, keluar, belanja, dan belanja per kategori.
- `budgetLines(budgets, rows)`: batas vs realisasi, status aman / hampir (≥ 90%) / lewat, belanja tanpa batas di akhir.
- `monthElapsed(month, today)`: bagian bulan yang sudah lewat, untuk penanda di batang anggaran.
- `importRefs(accountId, rows)`: kunci tetap per baris e-statement; baris kembar di hari yang sama dibedakan urutannya.
- `analyzeStatement(rows)`: analisis pengeluaran hasil impor: masuk, keluar, belanja per kategori, belanja berulang (dikelompokkan dengan `merchantKey`), belanja terbesar.

### `lib/ai.ts` (server saja)

- `readReceipt(image, type, categories, today) → ReceiptFields`: toko, tanggal, total, kategori, daftar barang.
- `readStatement(pdf, categories) → StatementResult`: setiap baris mutasi dengan arah, jumlah, dan kategori; `truncated` bila PDF terlalu panjang.
- Keduanya memaksa Claude memanggil satu tool berskema JSON, lalu menyaring hasilnya: tanggal harus valid, jumlah bulat positif, kategori harus dari daftar.
- `explainAiError(err)`: pesan galat yang bisa ditindaklanjuti (kunci salah, terlalu banyak permintaan, PDF berkata sandi, layanan gangguan).

### `lib/household.ts`

- `getHousehold(next)`: sesi, keluarga, dan peran pengguna, sekali per request.
- `getAccounts(ctx)`: rekening dengan saldo berjalan dari view `account_balances`.

### `lib/money.ts`

- `parseRupiah("1.500.000") → 1500000`, `formatRupiah(1500000) → "Rp 1.500.000"`, `formatRupiahShort`, `formatPercent`.

### `lib/supabase/`

- `updateSession(request)`: menyegarkan token, mengalihkan ke `/masuk?next=…` bila rute privat dibuka tanpa sesi.
- `safeNext(next)`: hanya menerima jalur di situs ini, mencegah pengalihan ke situs lain setelah masuk.
- `publicOrigin(headers)`: alamat yang benar-benar dibuka pengguna, agar cookie sesi ikut saat dialihkan.

## 6. Pengujian

| Perintah | Menguji |
| --- | --- |
| `npm test` | Rupiah, kalkulasi, dana darurat, batas cicilan, validasi transaksi, bulan, anggaran, kunci impor, analisis e-statement (22 uji) |
| `npm run test:db` | Migrasi asli di Postgres lokal (PGlite): RLS antar keluarga, saldo berjalan, rekening tetap, impor ganda, anggaran, Storage struk, peran viewer (24 uji) |
| `tests/e2e/clickthrough.py` | Landing, wizard, login, dashboard, halaman legal, desktop 1280 px dan ponsel 375 px (88 pemeriksaan) |
| `tests/e2e/transaksi.py` | Navigasi, catat/ubah/hapus, pindai struk, impor e-statement, anggaran, rekening tetap setelah kondisi awal diubah (64 pemeriksaan) |

Uji ujung ke ujung memakai `tests/e2e/mock-supabase.mjs`, yang juga meniru Claude API, jadi tidak memerlukan kunci sungguhan. Ketepatan baca struk dan PDF bank yang sebenarnya hanya bisa diuji dengan kunci asli.

## 7. Tahap berikutnya

Sesuai blueprint: target tabungan, transfer antarrekening sendiri (sekarang dicatat sebagai keluar dari satu rekening saja), undangan anggota keluarga, AI insight dari ringkasan, lalu PWA.
