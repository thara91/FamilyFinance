'use client';

import { useId, useRef, useState } from 'react';
import type { ReceiptFields } from '@/lib/ai-shared';
import { IconCamera, IconCheck, IconAlert } from '@/components/icons';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; step: string }
  | { kind: 'done'; filled: string[]; preview: string }
  | { kind: 'saved-only'; message: string; preview: string }
  | { kind: 'error'; message: string };

const MAX_EDGE = 1600;

/** Phone photos are several megabytes; a 1600 px JPEG keeps totals legible and stays under Vercel's 4.5 MB request cap. */
async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Format foto ini belum bisa dibaca browser. Pakai foto JPG atau PNG.');
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Foto gagal diproses. Coba ambil ulang.');
  return blob;
}

export function ReceiptScanner({ onResult }: { onResult: (r: { path: string; fields: ReceiptFields | null }) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handle(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus({ kind: 'error', message: 'Pilih file foto (JPG atau PNG). Untuk PDF mutasi bank, pakai Impor e-statement.' });
      return;
    }
    try {
      setStatus({ kind: 'busy', step: 'Menyiapkan foto…' });
      const blob = await shrink(file);
      const preview = URL.createObjectURL(blob);
      setStatus({ kind: 'busy', step: 'Membaca struk… biasanya 5 sampai 15 detik.' });
      const body = new FormData();
      body.set('file', blob, 'struk.jpg');
      const res = await fetch('/api/struk', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { path?: string; fields?: ReceiptFields | null; notice?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error ?? 'Server tidak menjawab. Coba lagi sebentar lagi.');
      onResult({ path: data.path, fields: data.fields ?? null });
      if (data.fields) {
        const filled = [
          data.fields.total ? 'jumlah' : null,
          data.fields.date ? 'tanggal' : null,
          data.fields.merchant ? 'keterangan' : null,
          data.fields.category ? 'kategori' : null,
        ].filter(Boolean) as string[];
        setStatus({ kind: 'done', filled, preview });
      } else {
        setStatus({ kind: 'saved-only', message: data.notice ?? 'Foto tersimpan sebagai lampiran. Isi transaksinya di bawah.', preview });
      }
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Struk gagal dibaca.' });
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  const busy = status.kind === 'busy';
  return (
    <section id="struk" aria-labelledby={`${id}-h`} className="flex flex-col gap-3 rounded-[12px] border border-dashed border-line-strong bg-inset p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-h`} className="font-semibold">Isi dari foto struk atau nota</h2>
        <p className="text-[13px] text-muted">Jumlah, tanggal, toko, dan kategori diisi otomatis. Foto disimpan sebagai lampiran transaksi.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          id={`${id}-file`}
          type="file"
          accept="image/*"
          capture="environment"
          className="peer sr-only"
          disabled={busy}
          onChange={(e) => void handle(e.currentTarget.files?.[0])}
        />
        <label
          htmlFor={`${id}-file`}
          className={`btn peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link peer-focus-visible:outline ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <IconCamera />
          {status.kind === 'idle' || status.kind === 'error' ? 'Pilih atau foto struk' : 'Ganti foto'}
        </label>
        <p aria-live="polite" className="text-[14px]">
          {status.kind === 'busy' ? <span className="text-label">{status.step}</span> : null}
        </p>
      </div>
      {status.kind === 'done' || status.kind === 'saved-only' ? (
        <div className="flex items-start gap-3">
          <img src={status.preview} alt="Foto struk yang diunggah" className="h-24 w-auto rounded-[8px] border border-line object-cover" />
          {status.kind === 'done' ? (
            <p role="status" className="flex gap-2 text-[14px]">
              <IconCheck className="mt-0.5 shrink-0 text-up" />
              <span>
                {status.filled.length ? `Terisi: ${status.filled.join(', ')}.` : 'Struk terbaca, tapi angkanya tidak jelas.'} Periksa isiannya sebelum menyimpan.
              </span>
            </p>
          ) : (
            <p role="status" className="flex gap-2 text-[14px]"><IconAlert className="mt-0.5 shrink-0 text-warn" /><span>{status.message}</span></p>
          )}
        </div>
      ) : null}
      {status.kind === 'error' ? <p role="alert" className="text-[14px] text-down">{status.message}</p> : null}
    </section>
  );
}
