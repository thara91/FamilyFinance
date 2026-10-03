import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeNext } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Masuk' };

const LINK_ERRORS: Record<string, string> = {
  tautan: 'Tautan masuk sudah kedaluwarsa atau sudah dipakai. Minta tautan baru di bawah.',
  konfigurasi: 'Supabase belum terhubung, jadi tautan tidak bisa diproses.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const linkError = params.galat ? LINK_ERRORS[params.galat] : undefined;
  const saving = next === '/mulai/simpan';

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section
        className="hidden flex-col justify-between gap-8 p-12 lg:flex"
        style={{ background: 'radial-gradient(120% 90% at 0% 0%, #5b3fe0 0%, #2a1f78 45%, #0f1224 100%)' }}
      >
        <Logo />
        <div className="flex max-w-[480px] flex-col gap-5">
          <p className="text-[36px] font-extrabold leading-[1.15] tracking-tight text-white">
            Satu tempat untuk uang, aset, dan rencana keluarga.
          </p>
          <p className="text-base leading-relaxed text-[#d6cff7]">
            Setelah masuk, isian kondisi keuangan awal disimpan ke akun Anda dan bisa dibuka dari perangkat mana pun.
          </p>
        </div>
        <span className="text-[13px] text-[#b9b0e8]">Setiap keluarga hanya bisa membaca datanya sendiri.</span>
      </section>

      <section className="flex flex-col px-4 py-6 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="card flex w-full max-w-[440px] flex-col gap-5 p-6 sm:p-8">
            {saving ? (
              <p className="rounded-[10px] border border-[#3e3290] bg-accent/10 px-4 py-3 text-[14px] text-label">
                Masuk dulu untuk menyimpan kondisi keuangan awal. Isian Anda tetap aman di perangkat ini.
              </p>
            ) : null}
            {linkError ? (
              <p role="alert" className="rounded-[10px] border border-warn/40 bg-warn/10 px-4 py-3 text-[14px]">
                {linkError}
              </p>
            ) : null}
            <LoginForm next={next} />
          </div>
        </div>
      </section>
    </div>
  );
}
