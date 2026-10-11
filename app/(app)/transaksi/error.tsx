'use client';

import Link from 'next/link';

export default function SectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto mt-8 flex max-w-[560px] flex-col gap-3 p-6">
      <h1 className="text-xl font-bold">Data belum bisa dimuat</h1>
      <p className="text-muted">
        Server Supabase tidak menjawab, atau tabel transaksi dan anggaran belum dibuat. Bila ini pemasangan baru, jalankan migrasi terbaru di folder
        supabase/migrations.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn btn-primary" onClick={reset}>Muat ulang</button>
        <Link href="/dashboard" className="btn">Ke dashboard</Link>
      </div>
    </div>
  );
}
