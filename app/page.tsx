import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { IconShield } from '@/components/icons';
import { QuickCheck, StartButton } from '@/components/landing/QuickCheck';
import { STEPS } from '@/lib/baseline';

const METRICS = [
  { name: 'Kekayaan bersih', how: 'Kas, rekening, dan aset dikurangi sisa pokok semua utang.' },
  { name: 'Sisa kas per bulan', how: 'Pemasukan dikurangi pengeluaran rutin dan cicilan.' },
  { name: 'Target dana darurat', how: 'Pengeluaran rutin per bulan dikali 12 (freelance), 3 (lajang), 6 (menikah tanpa anak), atau 9 sampai 12 (menikah dengan anak).' },
  { name: 'Alokasi dana darurat', how: 'Sisihkan 10% pemasukan per bulan ke tabungan bank, e-wallet, atau reksa dana pasar uang sampai target tercapai.' },
  { name: 'Rasio cicilan', how: 'Total cicilan dibagi pemasukan. Batasnya 30%; di atas itu ditandai.' },
  { name: 'Pembagian pemasukan', how: 'Porsi pemasukan untuk pengeluaran rutin, cicilan, dan yang tersisa.' },
];

export default function Landing() {
  const dataSteps = STEPS.filter((s) => s.key !== 'ringkasan');

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-4 sm:py-6">
        <Logo />
        <Link href="/masuk" className="btn">
          Masuk
        </Link>
      </header>

      <main className="flex flex-col">
        <section className="grid items-start gap-10 py-8 sm:py-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex flex-col gap-6 lg:pt-6">
            <h1 className="text-[32px] font-extrabold leading-[1.12] tracking-tight sm:text-[44px] lg:text-[52px]">
              Lihat kondisi keuangan keluarga dalam satu halaman.
            </h1>
            <p className="max-w-[56ch] text-base leading-relaxed text-label sm:text-[17px]">
              Isi rekening, pemasukan, pengeluaran rutin, utang, dan aset sekali saja. Kas Keluarga menghitung kekayaan bersih, sisa kas
              per bulan, dan berapa lama dana darurat Anda bertahan.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartButton />
              <Link href="/masuk" className="link inline-flex min-h-11 items-center px-1">
                Sudah punya akun? Masuk
              </Link>
            </div>
            <p className="max-w-[52ch] text-[13px] text-muted">
              Tidak perlu membuat akun untuk mulai. Isian tersimpan di perangkat ini dan baru dikirim saat Anda memilih menyimpannya.
            </p>
          </div>
          <QuickCheck />
        </section>

        <section aria-labelledby="isi-h" className="grid gap-8 border-t border-line py-12 sm:py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-3">
            <h2 id="isi-h" className="text-2xl font-bold tracking-tight">Yang Anda isi</h2>
            <p className="max-w-[40ch] text-muted">
              {dataSteps.length} bagian, masing-masing satu layar. Bagian utang dan aset boleh dilewati. Angka bisa diperbarui kapan saja.
            </p>
          </div>
          <ol className="grid gap-x-8 sm:grid-cols-2">
            {dataSteps.map((s, i) => (
              <li key={s.key} className="flex gap-4 border-t border-line py-4">
                <span className="num w-6 shrink-0 pt-0.5 text-[13px] font-semibold text-link">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-[13px] text-muted">{s.hint}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="hitung-h" className="flex flex-col gap-6 border-t border-line py-12 sm:py-16">
          <h2 id="hitung-h" className="text-2xl font-bold tracking-tight">Yang dihitung dari isian Anda</h2>
          <dl className="card divide-y divide-line p-0">
            {METRICS.map((m) => (
              <div key={m.name} className="grid gap-1 px-5 py-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                <dt className="font-semibold">{m.name}</dt>
                <dd className="text-muted">{m.how}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="data-h" className="mb-12 flex flex-col gap-4 rounded-[16px] border border-line bg-inset p-6 sm:flex-row sm:gap-6 sm:p-8">
          <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-up/15 text-up">
            <IconShield size={20} />
          </span>
          <div className="flex flex-col gap-2">
            <h2 id="data-h" className="text-lg font-semibold">Data Anda</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-label marker:text-muted">
              <li>Tidak meminta nomor rekening, PIN, atau kata sandi bank.</li>
              <li>Data tersimpan di database Supabase proyek ini. Setiap keluarga hanya bisa membaca datanya sendiri.</li>
              <li>Masuk cukup dengan tautan yang dikirim ke email, tanpa kata sandi baru.</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-3 border-t border-line py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>Kas Keluarga · versi awal untuk penggunaan keluarga</span>
        <nav aria-label="Dokumen hukum" className="flex gap-4">
          <Link href="/privasi" className="link inline-flex min-h-11 items-center">Kebijakan Privasi</Link>
          <Link href="/ketentuan" className="link inline-flex min-h-11 items-center">Syarat Layanan</Link>
        </nav>
      </footer>
    </div>
  );
}
