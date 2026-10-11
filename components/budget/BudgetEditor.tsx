'use client';

import { useActionState, useState } from 'react';
import { saveBudgets, type BudgetState } from '@/app/(app)/anggaran/actions';
import { formatRupiah } from '@/lib/money';
import { MoneyInput } from '@/components/Field';

interface Props {
  categories: string[];
  current: Record<string, number>;
  fromBaseline: Record<string, number>;
  fromAverage: Record<string, number>;
  averageMonths: number;
  startOpen: boolean;
}

export function BudgetEditor({ categories, current, fromBaseline, fromAverage, averageMonths, startOpen }: Props) {
  const [open, setOpen] = useState(startOpen);
  const [limits, setLimits] = useState<Record<string, number>>(current);
  const [state, action, pending] = useActionState<BudgetState, FormData>(async (prev, form) => {
    const r = await saveBudgets(prev, form);
    if (r.saved) setOpen(false);
    return r;
  }, {});

  const total = Object.values(limits).reduce((t, v) => t + (v || 0), 0);
  const hasBaseline = Object.values(fromBaseline).some((v) => v > 0);
  const hasAverage = Object.values(fromAverage).some((v) => v > 0);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={() => setOpen(true)}>Ubah batas anggaran</button>
        {state.saved ? <p role="status" className="text-[14px] text-up">Anggaran tersimpan.</p> : null}
      </div>
    );
  }

  return (
    <form action={action} className="card flex flex-col gap-5 p-5 sm:p-7" aria-labelledby="edit-h">
      <div className="flex flex-col gap-1">
        <h2 id="edit-h" className="text-base font-semibold">Batas pengeluaran per bulan</h2>
        <p className="text-[13px] text-muted">Berlaku setiap bulan sampai diubah. Kosongkan untuk kategori yang tidak perlu dibatasi.</p>
      </div>
      {hasBaseline || hasAverage ? (
        <div className="flex flex-wrap gap-2">
          {hasBaseline ? (
            <button type="button" className="btn" onClick={() => setLimits((l) => ({ ...l, ...fromBaseline }))}>
              Isi dari pengeluaran di kondisi awal
            </button>
          ) : null}
          {hasAverage ? (
            <button type="button" className="btn" onClick={() => setLimits((l) => ({ ...l, ...fromAverage }))}>
              Isi dari rata-rata {averageMonths} bulan terakhir
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        {categories.map((c, i) => (
          <li key={c} className="grid grid-cols-[minmax(0,1fr)_minmax(0,180px)] items-center gap-3">
            <input type="hidden" name={`cat-${i}`} value={c} />
            <label htmlFor={`limit-${i}`} className="text-[14px]">{c}</label>
            <MoneyInput id={`limit-${i}`} name={`limit-${i}`} value={limits[c] ?? 0} onValueChange={(v) => setLimits((l) => ({ ...l, [c]: v }))} />
          </li>
        ))}
      </ul>
      {state.error ? <p role="alert" className="rounded-[10px] border border-down/40 bg-down/10 px-4 py-3 text-[14px]">{state.error}</p> : null}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="num text-[14px]">Total batas <span className="font-semibold">{formatRupiah(total)}</span> per bulan</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          {Object.keys(current).length ? <button type="button" className="btn" onClick={() => { setLimits(current); setOpen(false); }}>Batal</button> : null}
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan anggaran'}</button>
        </div>
      </div>
    </form>
  );
}
