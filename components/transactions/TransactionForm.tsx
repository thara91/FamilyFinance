'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { saveTransaction, deleteTransaction, type FormState } from '@/app/(app)/transaksi/actions';
import type { ReceiptFields } from '@/lib/ai-shared';
import type { Direction } from '@/lib/transactions';
import { Field, MoneyInput } from '@/components/Field';
import { ReceiptScanner } from './ReceiptScanner';

export interface TxValues {
  id?: string;
  occurredOn: string;
  direction: Direction;
  amount: number;
  category: string;
  description: string;
  accountId: string;
  note: string;
}

interface Props {
  initial: TxValues;
  accounts: { id: string; name: string }[];
  categories: { masuk: string[]; keluar: string[] };
  today: string;
  receiptUrl?: string | null;
  source?: string;
}

export function TransactionForm({ initial, accounts, categories, today, receiptUrl, source }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTransaction, { errors: {} });
  const [v, setV] = useState<TxValues>(() => initial);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const editing = Boolean(initial.id);
  const e = state.errors;

  const shown = v;

  const set = <K extends keyof TxValues>(k: K, value: TxValues[K]) => setV((s) => ({ ...s, [k]: value }));

  function setDirection(direction: Direction) {
    setV((s) => ({ ...s, direction, category: categories[direction].includes(s.category) ? s.category : categories[direction][0] }));
  }

  function applyReceipt({ path, fields }: { path: string; fields: ReceiptFields | null }) {
    setReceipt(path);
    setScanned(Boolean(fields));
    if (!fields) return;
    const itemsNote = fields.items.length
      ? fields.items.slice(0, 12).map((i) => `${i.name} ${new Intl.NumberFormat('id-ID').format(i.amount)}`).join('; ')
      : '';
    setV((s) => ({
      ...s,
      direction: 'keluar',
      amount: fields.total ?? s.amount,
      occurredOn: fields.date && fields.date <= today ? fields.date : s.occurredOn,
      description: fields.merchant ? fields.merchant.slice(0, 140) : s.description,
      category: fields.category && categories.keluar.includes(fields.category) ? fields.category : categories.keluar.includes(s.category) ? s.category : 'Lainnya',
      note: itemsNote ? itemsNote.slice(0, 500) : s.note,
    }));
  }

  const options = categories[shown.direction].includes(shown.category) ? categories[shown.direction] : [shown.category, ...categories[shown.direction]];

  return (
    <div className="flex flex-col gap-5">
      {!editing ? <ReceiptScanner onResult={applyReceipt} /> : null}

      <form action={action} noValidate className="card flex flex-col gap-5 p-5 sm:p-7">
        <input type="hidden" name="id" value={initial.id ?? ''} />
        <input type="hidden" name="receiptPath" value={receipt ?? ''} />
        <input type="hidden" name="source" value={scanned || receipt ? 'struk' : 'manual'} />

        {e.form ? <p role="alert" className="rounded-[10px] border border-down/40 bg-down/10 px-4 py-3 text-[14px]">{e.form}</p> : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold text-label">Jenis</legend>
          <div className="grid grid-cols-2 gap-2 sm:max-w-[360px]">
            {(['keluar', 'masuk'] as const).map((d) => (
              <label key={d} htmlFor={`tx-dir-${d}`}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-semibold ${shown.direction === d ? 'border-accent bg-accent/15 text-white' : 'border-line-strong bg-inset text-label hover:border-[#3a4270]'}`}>
                <input id={`tx-dir-${d}`} type="radio" name="direction" value={d} checked={shown.direction === d} onChange={() => setDirection(d)} className="size-4 accent-[#6d4aff]" />
                {d === 'keluar' ? 'Uang keluar' : 'Uang masuk'}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tx-amount" label="Jumlah" error={e.amount}>
            {(a) => <MoneyInput {...a} name="amount" value={shown.amount} onValueChange={(n) => set('amount', n)} />}
          </Field>
          <Field id="tx-date" label="Tanggal" error={e.occurredOn}>
            {(a) => <input {...a} type="date" name="occurredOn" max={today} className="input" value={shown.occurredOn} onChange={(ev) => set('occurredOn', ev.currentTarget.value)} />}
          </Field>
          <Field id="tx-desc" label="Keterangan" error={e.description} hint="Nama toko, penerima, atau sumber uang.">
            {(a) => <input {...a} name="description" className="input" autoComplete="off" maxLength={140} placeholder="Contoh: Belanja Indomaret" value={shown.description} onChange={(ev) => set('description', ev.currentTarget.value)} />}
          </Field>
          <Field id="tx-cat" label="Kategori" error={e.category}>
            {(a) => (
              <select {...a} name="category" className="input" value={shown.category} onChange={(ev) => set('category', ev.currentTarget.value)}>
                {options.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </Field>
          <Field id="tx-acc" label="Rekening" error={e.accountId} hint={accounts.length ? 'Saldo rekening yang dipilih ikut berubah.' : 'Belum ada rekening; transaksi tetap dicatat tanpa rekening.'}>
            {(a) => (
              <select {...a} name="accountId" className="input" value={shown.accountId} onChange={(ev) => set('accountId', ev.currentTarget.value)}>
                <option value="">Tanpa rekening</option>
                {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            )}
          </Field>
          <Field id="tx-note" label="Catatan (opsional)" error={e.note}>
            {(a) => <textarea {...a} name="note" rows={2} maxLength={500} className="input min-h-[76px] py-2.5" value={shown.note} onChange={(ev) => set('note', ev.currentTarget.value)} />}
          </Field>
        </div>

        {receiptUrl ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-label">Lampiran struk</span>
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="self-start rounded-[8px] focus-visible:outline-2">
              {/* Signed URL expires in 10 minutes; next/image would cache it past that. */}
              <img src={receiptUrl} alt="Foto struk transaksi ini" className="h-40 w-auto rounded-[8px] border border-line object-contain" />
            </a>
          </div>
        ) : source === 'mutasi' ? (
          <p className="text-[13px] text-muted">Transaksi ini diimpor dari e-statement.</p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link href="/transaksi" className="btn">Batal</Link>
            {editing ? (
              <button type="button" className="btn border-down/50 text-down hover:bg-down/15" onClick={() => deleteRef.current?.showModal()}>
                Hapus transaksi
              </button>
            ) : null}
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan transaksi'}
          </button>
        </div>
      </form>

      {editing ? (
        <dialog ref={deleteRef} aria-labelledby="del-h"
          className="m-auto w-[min(440px,calc(100%-32px))] rounded-[16px] border border-line bg-card p-6 text-ink backdrop:bg-black/60">
          <h2 id="del-h" className="text-lg font-semibold">Hapus &ldquo;{initial.description}&rdquo;?</h2>
          <p className="mt-2 text-muted">Saldo rekening dan anggaran dihitung ulang tanpa transaksi ini. Foto struknya ikut terhapus. Tindakan ini tidak bisa dibatalkan.</p>
          <form action={deleteTransaction} className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <input type="hidden" name="id" value={initial.id} />
            <button type="button" className="btn" onClick={() => deleteRef.current?.close()}>Batal</button>
            <button type="submit" className="btn border-down bg-down/15 text-down hover:bg-down/25">Hapus transaksi</button>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
