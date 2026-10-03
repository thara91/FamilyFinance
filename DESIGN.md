# DESIGN.md: Kas Keluarga

Sumber arah: mockup "Mockup Keuangan Pribadi" (canvas Kas Keluarga, 12 artboard) milik pemilik produk, terutama artboard Komponen UI, Masuk, Dashboard, dan Formulir isian. File ini hanya mentranskripsi keputusan yang sudah ada di mockup itu.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

## Identitas

- Nama produk: Kas Keluarga.
- Penanda: kotak "KK" radius 11 px, teks putih tebal di atas gradasi ungu (#8B6CFF ke #4F46E5).
- Pengguna: keluarga muda Indonesia, satu admin (biasanya Ayah atau Ibu) dan anggota dengan peran.
- Bahasa: Indonesia, kalimat biasa, sapaan "Anda" di halaman masuk dan "kamu" tidak dipakai.
- Nada: tenang, jelas, berpatokan angka. Setiap kartu menjawab satu pertanyaan ("Ke mana uang September pergi?").

## Warna

Tema gelap.

| Token | Nilai | Dipakai untuk |
| --- | --- | --- |
| bg | #0B0D1A | latar halaman |
| sidebar | #0F1224 | sidebar, panel samping |
| card | #141830 | kartu |
| card-inset | #10142A | kartu di dalam kartu |
| field | #0F1328 | latar isian |
| line | #222846 | garis kartu |
| line-strong | #2C3355 | garis isian dan tombol sekunder |
| text | #ECEEF7 | teks utama |
| text-muted | #9CA3C2 | label dan keterangan |
| text-label | #D5D9EC | label isian |
| accent | #6D4AFF | tombol utama, menu aktif, progres |
| accent-hover | #5B3BEB | hover tombol utama |
| link | #A996FF | tautan teks |
| up | #34D399 | penerimaan, naik, sesuai jadwal |
| down | #FB7185 | pengeluaran, turun, melewati batas |
| invest | #60A5FA | investasi (teks #7FB5FF) |
| warn | #FBBF24 | peringatan |

Chip dan ikon kategori memakai warna semantik di atas dengan latar transparan 14 sampai 18 persen.

## Tipografi

- Satu keluarga huruf: Plus Jakarta Sans, 400 sampai 800.
- Skala: judul halaman 26/700, judul kartu 16/600, isi 14/500, label 13 redup, angka utama 32/700.
- Angka selalu `font-variant-numeric: tabular-nums`.

## Bentuk dan jarak

- Radius: kartu 16, tombol dan isian 10, tombol ikon 12, chip dan progress bar penuh (99).
- Jarak dasar 4/8 px. Padding kartu 20, konten halaman 26/32 di desktop dan 20/16 di ponsel.
- Target sentuh minimal 44 px untuk semua tombol, tautan menu, dan isian.
- Bayangan hanya pada menu aktif sidebar.

## Tata letak

- Aplikasi: sidebar 240 px + bilah atas + konten. Di bawah 820 px sidebar menjadi bilah horizontal di atas.
- Halaman masuk: dua kolom, panel merek bergradasi radial ungu di kiri, formulir di kanan. Panel merek disembunyikan di ponsel.
- Formulir: label di atas isian, grid 2 atau 3 kolom yang menjadi 1 kolom di bawah 820 px. Kotak kalkulasi hidup di bawah isian.
- Ikon: garis 1,8 px, ujung membulat, digambar sendiri sebagai SVG inline.

## Gerak

- Hanya hover dan fokus. Tidak ada animasi masuk atau loop.
