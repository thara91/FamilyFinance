'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { firstInvalidStep, toPayload, type Draft } from '@/lib/baseline';
import { clearDraft, loadDraft } from '@/lib/draft';
import { createClient } from '@/lib/supabase/client';
import { supabaseConfigured } from '@/lib/supabase/env';
import { Logo } from '@/components/Logo';

type State =
  | { kind: 'saving' }
  | { kind: 'empty' }
  | { kind: 'incomplete' }
  | { kind: 'error'; message: string };

function explain(message: string): string {
  if (/save_baseline|function .* does not exist|schema cache/i.test(message)) {
    return 'Database belum disiapkan. Jalankan file migrasi di folder supabase/migrations lewat SQL Editor Supabase, lalu coba lagi.';
  }
  if (/fetch|network/i.test(message)) return 'Koneksi ke server terputus. Periksa internet Anda, lalu coba lagi.';
  return `Server menolak isian: ${message}`;
}

export default function SavePage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'saving' });
  // React dev mode runs effects twice; two parallel first saves would create two households.
  const started = useRef(false);

  const save = useCallback(async (draft: Draft) => {
    setState({ kind: 'saving' });
    const supabase = createClient();
    const { error } = await supabase.rpc('save_baseline', { payload: toPayload(draft) });
    if (error) {
      setState({ kind: 'error', message: explain(error.message) });
      return;
    }
    clearDraft();
    router.replace('/dashboard');
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!supabaseConfigured) {
      setState({ kind: 'error', message: 'Supabase belum terhubung. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.' });
      return;
    }
    const draft = loadDraft();
    if (!draft) return setState({ kind: 'empty' });
    if (firstInvalidStep(draft)) return setState({ kind: 'incomplete' });
    void save(draft);
  }, [save]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-8 px-4 py-6">
      <Logo />
      <main className="card flex flex-col gap-4 p-6" aria-live="polite">
        {state.kind === 'saving' ? (
          <>
            <h1 className="text-xl font-bold">Menyimpan kondisi awal…</h1>
            <p className="text-muted">Jangan tutup halaman ini.</p>
          </>
        ) : null}
        {state.kind === 'empty' ? (
          <>
            <h1 className="text-xl font-bold">Tidak ada isian yang menunggu disimpan</h1>
            <p className="text-muted">Isian di perangkat ini sudah tersimpan atau sudah dikosongkan.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="btn btn-primary">Buka dashboard</Link>
              <Link href="/mulai" className="btn">Isi kondisi awal</Link>
            </div>
          </>
        ) : null}
        {state.kind === 'incomplete' ? (
          <>
            <h1 className="text-xl font-bold">Isian belum lengkap</h1>
            <p className="text-muted">Beberapa isian wajib masih kosong. Lengkapi dulu, lalu simpan dari langkah Ringkasan.</p>
            <Link href="/mulai" className="btn btn-primary self-start">Lengkapi isian</Link>
          </>
        ) : null}
        {state.kind === 'error' ? (
          <>
            <h1 className="text-xl font-bold">Belum tersimpan</h1>
            <p role="alert" className="text-label">{state.message}</p>
            <p className="text-[13px] text-muted">Isian Anda masih ada di perangkat ini, tidak ada yang hilang.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn btn-primary" onClick={() => { const d = loadDraft(); if (d) void save(d); }}>
                Coba simpan lagi
              </button>
              <Link href="/mulai" className="btn">Kembali ke isian</Link>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
