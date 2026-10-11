'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { importStatement } from '@/app/(app)/transaksi/actions';
import type { StatementResult } from '@/lib/ai-shared';
import { formatPercent, formatRupiah } from '@/lib/money';
import { analyzeStatement, dayLabel, type StatementRow } from '@/lib/transactions';
import { IconAlert, IconFile } from '@/components/icons';

type Row = StatementResult['rows'][number] & { duplicate: boolean; keep: boolean };
type Phase = { kind: 'pick' } | { kind: 'reading' } | { kind: 'review'; meta: Omit<StatementResult, 'rows'> } | { kind: 'error'; message: string };

interface Props {
  accounts: { id: string; name: string; balanceDate: string }[];
  categories: { masuk: string[]; keluar: string[] };
  aiReady: boolean;
}

const fmtDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

export function StatementImport({ accounts, categories, aiReady }: Props) {
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : '');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [rows, setRows] = useState<Row[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [pickError, setPickError] = useState<{ account?: string; file?: string }>({});

  const account = accounts.find((a) => a.id === accountId);
  const kept = rows.filter((r) => r.keep);
  const analysis = useMemo(() => analyzeStatement(kept), [kept]);
  const beforeOpening = account ? kept.filter((r) => r.date < account.balanceDate).length : 0;

  async function read() {
    const errs = { account: accountId ? undefined : 'Pilih rekening pemilik e-statement.', file: file ? undefined : 'Pilih file PDF e-statement.' };
    setPickError(errs);
    if (errs.account || errs.file) {
      document.getElementById(errs.account ? 'imp-acc' : 'imp-file')?.focus();
      return;
    }
    setPhase({ kind: 'reading' });
    const body = new FormData();
    body.set('file', file!);
    body.set('accountId', accountId);
    try {
      const res = await fetch('/api/mutasi', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as Partial<Omit<StatementResult, 'rows'>> & { rows?: (StatementResult['rows'][number] & { duplicate: boolean })[]; error?: string };
      if (!res.ok || !data.rows) throw new Error(data.error ?? 'Server tidak menjawab. Coba lagi sebentar lagi.');
      if (data.rows.length === 0) throw new Error('Tidak ada baris transaksi yang terbaca. Pastikan ini PDF mutasi rekening, bukan ringkasan atau tagihan.');
      setRows(data.rows.map((r) => ({ ...r, keep: !r.duplicate })));
      setPhase({ kind: 'review', meta: { bank: data.bank ?? null, periodStart: data.periodStart ?? null, periodEnd: data.periodEnd ?? null, truncated: Boolean(data.truncated) } });
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'E-statement gagal dibaca.' });
    }
  }

  function save() {
    setSaveError(null);
    const payload: StatementRow[] = kept.map(({ date, description, direction, amount, balanceAfter, category }) => ({ date, description, direction, amount, balanceAfter, category }));
    startSave(async () => {
      const r = await importStatement(accountId, payload);
      if (r?.error) setSaveError(r.error);
    });
  }

  const update = (i: number, patch: Partial<Row>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const allChecked = rows.length > 0 && rows.every((r) => r.keep || r.duplicate);

  if (!aiReady) {
    return (
      <div role="alert" className="card flex flex-col gap-2">
        <h2 className="font-semibold">Pembacaan e-statement belum aktif</h2>
        <p className="text-muted">Isi ANTHROPIC_API_KEY di Vercel (Settings &gt; Environment Variables), lalu deploy ulang. Sambil menunggu, transaksi tetap bisa dicatat manual.</p>
        <Link href="/transaksi/baru" className="btn self-start">Catat manual</Link>
      </div>
    );
  }

  if (phase.kind === 'review') {
    const dupCount = rows.filter((r) => r.duplicate).length;
    return (
      <div className="flex flex-col gap-5">
        <section aria-labelledby="ana-h" className="card flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="ana-h" className="text-base font-semibold">
              Ke mana uang pergi{phase.meta.periodStart && phase.meta.periodEnd ? ` (${fmtDate(phase.meta.periodStart)} sampai ${fmtDate(phase.meta.periodEnd)})` : ''}
            </h2>
            <p className="text-[13px] text-muted">
              {phase.meta.bank ? `${phase.meta.bank} · ` : ''}{account?.name} · dihitung dari {kept.length} baris yang dicentang. Transfer ke rekening sendiri, tarik tunai, dan setoran investasi tidak dihitung sebagai belanja.
            </p>
          </div>
          <dl className="num grid grid-cols-3 gap-3 text-center">
            <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Masuk</dt><dd className="font-semibold text-up">{formatRupiah(analysis.masuk)}</dd></div>
            <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Keluar</dt><dd className="font-semibold">{formatRupiah(analysis.keluar)}</dd></div>
            <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Belanja</dt><dd className="font-semibold">{formatRupiah(analysis.spending)}</dd></div>
          </dl>
          {analysis.byCategory.length ? (
            <ul className="flex flex-col gap-2.5 border-t border-line pt-4">
              {analysis.byCategory.slice(0, 6).map((c) => (
                <li key={c.category} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span>{c.category}</span>
                    <span className="num text-muted">{formatRupiah(c.amount)} · {formatPercent(c.share)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line" aria-hidden="true"><div className="h-full rounded-full bg-accent" style={{ width: `${c.share * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : null}
          {analysis.recurring.length || analysis.largest ? (
            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              {analysis.recurring.length ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold text-label">Berulang di periode ini</h3>
                  <ul className="flex flex-col gap-1.5 text-[14px]">
                    {analysis.recurring.map((r) => (
                      <li key={r.description} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">{r.description}</span>
                        <span className="num shrink-0 text-muted">{r.count}× · {formatRupiah(r.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {analysis.largest ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold text-label">Belanja terbesar</h3>
                  <p className="text-[14px]">{analysis.largest.description}<br /><span className="num text-muted">{fmtDate(analysis.largest.date)} · {formatRupiah(analysis.largest.amount)}</span></p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {phase.meta.truncated ? (
          <p role="alert" className="flex gap-2 rounded-[10px] border border-warn/40 bg-warn/10 px-4 py-3 text-[14px]">
            <IconAlert className="mt-0.5 shrink-0 text-warn" />E-statement ini terlalu panjang untuk dibaca sekaligus; baris di akhir periode belum masuk. Simpan yang ada, lalu impor sisa periodenya dari file terpisah.
          </p>
        ) : null}
        {dupCount ? <p className="text-[14px] text-muted">{dupCount} baris sudah pernah diimpor dan tidak dicentang.</p> : null}
        {beforeOpening ? (
          <p className="text-[14px] text-muted">
            {beforeOpening} baris bertanggal sebelum {fmtDate(account!.balanceDate)}, hari saldo rekening ini dicatat. Baris itu masuk riwayat dan anggaran, tapi tidak mengubah saldo karena sudah termasuk di saldo tersebut.
          </p>
        ) : null}

        <section aria-labelledby="rows-h" className="card p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 id="rows-h" className="text-base font-semibold">{rows.length} baris terbaca</h2>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px]">
              <input type="checkbox" className="size-5 accent-[#6d4aff]" checked={allChecked}
                onChange={(e) => { const on = e.currentTarget.checked; setRows((all) => all.map((r) => ({ ...r, keep: on && !r.duplicate }))); }} />
              Centang semua
            </label>
          </div>
          <ul>
            {rows.map((r, i) => (
              <li key={i} className={`grid gap-x-3 gap-y-2 border-t border-line px-5 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_240px_140px] sm:items-center ${r.keep ? '' : 'opacity-60'}`}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" aria-label={`Simpan ${r.description}, ${formatRupiah(r.amount)}`} className="size-5 accent-[#6d4aff]"
                    checked={r.keep} onChange={(e) => update(i, { keep: e.currentTarget.checked })} />
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words">{r.description}</span>
                    <span className="text-[13px] text-muted">
                      {dayLabel(r.date)}{r.duplicate ? ' · sudah pernah diimpor' : ''}
                    </span>
                  </span>
                </label>
                <select aria-label={`Kategori untuk ${r.description}`} className="input w-full" value={r.category}
                  onChange={(e) => update(i, { category: e.currentTarget.value })}>
                  {categories[r.direction].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className={`num whitespace-nowrap text-right font-semibold ${r.direction === 'masuk' ? 'text-up' : ''}`}>
                  {r.direction === 'masuk' ? '+' : '−'}{formatRupiah(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {saveError ? <p role="alert" className="rounded-[10px] border border-down/40 bg-down/10 px-4 py-3 text-[14px]">{saveError}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" className="btn" onClick={() => { setRows([]); setPhase({ kind: 'pick' }); }}>Pilih file lain</button>
          <button type="button" className="btn btn-primary" disabled={saving || kept.length === 0} onClick={save}>
            {saving ? 'Menyimpan…' : `Simpan ${kept.length} transaksi ke ${account?.name ?? 'rekening'}`}
          </button>
        </div>
      </div>
    );
  }

  const reading = phase.kind === 'reading';
  return (
    <div className="card flex flex-col gap-5 p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="imp-acc" className="text-[13px] font-semibold text-label">Rekening pemilik e-statement</label>
          <select id="imp-acc" className="input" value={accountId} disabled={reading} aria-invalid={pickError.account ? true : undefined}
            aria-describedby={pickError.account ? 'imp-acc-error' : undefined}
            onChange={(e) => { setAccountId(e.currentTarget.value); setPickError((p) => ({ ...p, account: undefined })); }}>
            <option value="">Pilih rekening</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {pickError.account ? <span id="imp-acc-error" className="text-[13px] text-down">{pickError.account}</span> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="imp-file" className="text-[13px] font-semibold text-label">File PDF</label>
          <input id="imp-file" type="file" accept="application/pdf,.pdf" disabled={reading} aria-invalid={pickError.file ? true : undefined}
            aria-describedby={`imp-file-hint${pickError.file ? ' imp-file-error' : ''}`}
            className="input py-2.5 file:mr-3 file:rounded-[8px] file:border-0 file:bg-hover file:px-3 file:py-1.5 file:font-semibold file:text-ink"
            onChange={(e) => { setFile(e.currentTarget.files?.[0] ?? null); setPickError((p) => ({ ...p, file: undefined })); }} />
          <span id="imp-file-hint" className="text-xs leading-snug text-muted">Maksimal 4 MB, satu bulan per file. PDF berkata sandi perlu dibuka lalu disimpan ulang tanpa sandi.</span>
          {pickError.file ? <span id="imp-file-error" className="text-[13px] text-down">{pickError.file}</span> : null}
        </div>
      </div>
      {phase.kind === 'error' ? <p role="alert" className="rounded-[10px] border border-down/40 bg-down/10 px-4 py-3 text-[14px]">{phase.message}</p> : null}
      <p aria-live="polite" className="text-[14px] text-label">{reading ? 'Membaca e-statement… biasanya 20 sampai 60 detik untuk satu bulan. Jangan tutup halaman ini.' : ''}</p>
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
        <Link href="/transaksi" className="btn">Batal</Link>
        <button type="button" className="btn btn-primary" disabled={reading} onClick={() => void read()}>
          <IconFile />{reading ? 'Membaca…' : 'Baca e-statement'}
        </button>
      </div>
    </div>
  );
}
