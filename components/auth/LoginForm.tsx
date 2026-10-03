'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { supabaseConfigured } from '@/lib/supabase/env';
import { Field } from '@/components/Field';
import { IconMail } from '@/components/icons';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function explain(message: string): string {
  if (/rate limit|too many/i.test(message)) return 'Terlalu banyak permintaan tautan dalam waktu singkat. Tunggu beberapa menit, lalu coba lagi.';
  if (/fetch|network/i.test(message)) return 'Koneksi ke server terputus. Periksa internet Anda, lalu coba lagi.';
  return `Tautan belum terkirim: ${message}`;
}

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const invalid = !EMAIL.test(email.trim());
  const fieldError = touched && invalid ? 'Tulis alamat email lengkap, misalnya nama@gmail.com.' : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) {
      document.getElementById('email')?.focus();
      return;
    }
    setStatus({ kind: 'sending' });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setStatus(error ? { kind: 'error', message: explain(error.message) } : { kind: 'sent', email: email.trim() });
  }

  if (!supabaseConfigured) {
    return (
      <div role="alert" className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Supabase belum terhubung</h2>
        <p className="text-muted">
          Isi <code className="text-label">NEXT_PUBLIC_SUPABASE_URL</code> dan <code className="text-label">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> di
          file <code className="text-label">.env.local</code> atau di pengaturan Environment Variables Vercel, lalu muat ulang halaman.
        </p>
      </div>
    );
  }

  if (status.kind === 'sent') {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <span className="grid size-11 place-items-center rounded-[12px] bg-up/15 text-up">
          <IconMail size={20} />
        </span>
        <h2 className="text-[26px] font-bold">Cek email Anda</h2>
        <p className="leading-relaxed text-label">
          Tautan masuk sudah dikirim ke <strong className="text-ink">{status.email}</strong>. Buka email itu di perangkat ini, lalu ketuk tautannya.
        </p>
        <p className="text-[13px] text-muted">Tidak masuk dalam 5 menit? Periksa folder spam atau promosi.</p>
        <button type="button" className="btn self-start" onClick={() => setStatus({ kind: 'idle' })}>
          Pakai email lain
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[26px] font-bold">Masuk</h2>
        <p className="text-muted">Tanpa kata sandi. Kami kirim tautan masuk ke email Anda. Email baru otomatis dibuatkan akun.</p>
      </div>
      <Field id="email" label="Email" error={fieldError}>
        {(a) => (
          <input
            {...a}
            type="email"
            autoComplete="email"
            inputMode="email"
            className="input min-h-12 text-[15px]"
            placeholder="email@contoh.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        )}
      </Field>
      {status.kind === 'error' ? (
        <p role="alert" className="rounded-[10px] border border-down/40 bg-down/10 px-4 py-3 text-[14px]">
          {status.message}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary min-h-12 text-[15px]" disabled={status.kind === 'sending'}>
        {status.kind === 'sending' ? 'Mengirim tautan…' : 'Kirim tautan masuk'}
      </button>
      <div className="flex flex-col gap-0.5 text-[13px] text-muted">
        <span>Dengan masuk, Anda menyetujui:</span>
        <span className="flex flex-wrap gap-x-5">
          <Link href="/ketentuan" className="link inline-flex min-h-11 items-center">Syarat Layanan</Link>
          <Link href="/privasi" className="link inline-flex min-h-11 items-center">Kebijakan Privasi</Link>
        </span>
      </div>
    </form>
  );
}
