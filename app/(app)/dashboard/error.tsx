'use client';

import Link from 'next/link';

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-4 py-16">
      <div role="alert" className="card flex flex-col gap-3 p-6">
        <h1 className="text-xl font-bold">Data keluarga belum bisa dimuat</h1>
        <p className="text-muted">
          Server Supabase tidak menjawab atau tabelnya belum dibuat. Bila ini pemasangan baru, jalankan file migrasi di folder supabase/migrations
          lewat SQL Editor Supabase.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary" onClick={reset}>Muat ulang</button>
          <Link href="/" className="btn">Ke beranda</Link>
        </div>
      </div>
    </div>
  );
}
