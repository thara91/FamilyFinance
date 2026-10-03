import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
      <p className="text-muted">Alamat ini tidak ada di Kas Keluarga.</p>
      <Link href="/" className="btn btn-primary self-start">Ke beranda</Link>
    </div>
  );
}
