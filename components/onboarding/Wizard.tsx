'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ACCOUNT_KINDS,
  ASSET_KINDS,
  DEBT_KINDS,
  STEPS,
  emptyDraft,
  firstInvalidStep,
  newId,
  summarize,
  validateStep,
  type Draft,
  type StepKey,
} from '@/lib/baseline';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { formatRupiah } from '@/lib/money';
import { Field, MoneyInput } from '@/components/Field';
import { SummaryView } from '@/components/SummaryView';
import { IconBack, IconCheck, IconNext, IconPlus, IconTrash } from '@/components/icons';

type Storage = 'idle' | 'saved' | 'unavailable';

export function Wizard() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [storage, setStorage] = useState<Storage>('idle');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resetRef = useRef<HTMLDialogElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const saved = loadDraft();
    if (saved) {
      setDraft(saved);
      const r = Math.min(saved.reached ?? 0, STEPS.length - 1);
      setReached(r);
      setStep(r);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // Written on every change, not debounced: a debounce loses the last edit when the tab closes inside the delay.
    setStorage(saveDraft({ ...draft, reached }) ? 'saved' : 'unavailable');
  }, [draft, reached, loaded]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const current = STEPS[step];
  const errors = validateStep(current.key, draft);
  const visibleErrors = showErrors ? errors : {};
  const summary = summarize(draft);

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => fn(structuredClone(d)));

  function goTo(index: number) {
    setShowErrors(false);
    setStep(index);
    setReached((r) => Math.max(r, index));
    window.scrollTo({ top: 0 });
  }

  function next() {
    const keys = Object.keys(errors);
    if (keys.length > 0) {
      setShowErrors(true);
      requestAnimationFrame(() => document.getElementById(keys[0])?.focus());
      return;
    }
    goTo(step + 1);
  }

  function finish() {
    const broken = firstInvalidStep(draft);
    if (broken) {
      goTo(STEPS.findIndex((s) => s.key === broken));
      setShowErrors(true);
      return;
    }
    saveDraft({ ...draft, reached });
    router.push('/mulai/simpan');
  }

  function resetAll() {
    clearDraft();
    setDraft(emptyDraft());
    setReached(0);
    setStep(0);
    setShowErrors(false);
    resetRef.current?.close();
  }

  if (!loaded) {
    return <p className="p-6 text-muted" role="status">Memuat isian…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:hidden">
          <p className="num text-[13px] text-muted">
            Langkah {step + 1} dari {STEPS.length}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-accent" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <nav aria-label="Langkah isian" className="hidden lg:block">
          <ol className="flex flex-col gap-1">
            {STEPS.map((s, i) => {
              const done = i < reached && Object.keys(validateStep(s.key, draft)).length === 0;
              const isCurrent = i === step;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={i > reached}
                    onClick={() => goTo(i)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm ${
                      isCurrent ? 'bg-accent font-semibold text-white' : 'text-muted hover:bg-hover hover:text-ink disabled:hover:bg-transparent disabled:hover:text-muted'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span
                      aria-hidden="true"
                      className={`num grid size-6 shrink-0 place-items-center rounded-full border text-xs ${
                        isCurrent ? 'border-white/60' : done ? 'border-up text-up' : 'border-line-strong'
                      }`}
                    >
                      {done && !isCurrent ? <IconCheck size={14} /> : i + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <p className="hidden text-xs leading-snug text-muted lg:block" aria-live="polite">
          {storage === 'saved' && 'Isian tersimpan di perangkat ini sampai Anda menyimpannya ke akun.'}
          {storage === 'unavailable' && 'Browser ini tidak mengizinkan penyimpanan lokal. Selesaikan isian sebelum menutup halaman.'}
        </p>
        <button type="button" className="link hidden min-h-11 self-start text-sm lg:inline-flex lg:items-center" onClick={() => resetRef.current?.showModal()}>
          Kosongkan semua isian
        </button>
      </aside>

      <section className="card flex flex-col gap-6 p-5 sm:p-7" aria-labelledby="step-h">
        <header className="flex flex-col gap-1">
          <h1 id="step-h" ref={headingRef} tabIndex={-1} className="text-[22px] font-bold tracking-tight outline-none sm:text-[26px]">
            {current.title}
          </h1>
          <p className="text-muted">{current.hint}</p>
        </header>

        {showErrors && Object.keys(errors).length > 0 ? (
          <p role="alert" className="rounded-[10px] border border-down/40 bg-down/10 px-4 py-3 text-[14px]">
            Ada {Object.keys(errors).length} isian yang perlu dilengkapi di langkah ini.
          </p>
        ) : null}

        <StepBody step={current.key} draft={draft} update={update} errors={visibleErrors} />

        {current.key !== 'keluarga' && current.key !== 'ringkasan' ? <RunningTotals draft={draft} /> : null}
        {current.key === 'ringkasan' ? <SummaryView s={summary} /> : null}

        <footer className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <button type="button" className="btn" onClick={() => goTo(step - 1)}>
              <IconBack />
              Kembali
            </button>
          ) : (
            <span />
          )}
          {current.key === 'ringkasan' ? (
            <button type="button" className="btn btn-primary" onClick={finish}>
              Simpan kondisi awal
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={next}>
              Lanjut ke {STEPS[step + 1].title.toLowerCase()}
              <IconNext />
            </button>
          )}
        </footer>
        <button type="button" className="link min-h-11 self-start text-sm lg:hidden" onClick={() => resetRef.current?.showModal()}>
          Kosongkan semua isian
        </button>
      </section>

      <dialog
        ref={resetRef}
        aria-labelledby="reset-h"
        className="m-auto w-[min(420px,calc(100%-32px))] rounded-[16px] border border-line bg-card p-6 text-ink backdrop:bg-black/60"
      >
        <h2 id="reset-h" className="text-lg font-semibold">Kosongkan semua isian?</h2>
        <p className="mt-2 text-muted">Semua angka yang belum disimpan ke akun akan dihapus dari perangkat ini. Data yang sudah tersimpan di akun tidak berubah.</p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn" onClick={() => resetRef.current?.close()}>
            Batal
          </button>
          <button type="button" className="btn border-down bg-down/15 text-down hover:bg-down/25" onClick={resetAll}>
            Kosongkan isian
          </button>
        </div>
      </dialog>
    </div>
  );
}

function RunningTotals({ draft }: { draft: Draft }) {
  const s = summarize(draft);
  const items = [
    { label: 'Kas & rekening', value: s.cash },
    { label: 'Sisa per bulan', value: s.freeCashflow },
    { label: 'Kekayaan bersih', value: s.netWorth },
  ];
  return (
    <div aria-live="polite" className="grid gap-3 rounded-[12px] border border-[#3e3290] bg-accent/10 p-4 sm:grid-cols-3">
      {items.map((x) => (
        <div key={x.label} className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted">{x.label}</span>
          <span className={`num font-semibold ${x.value < 0 ? 'text-down' : ''}`}>{formatRupiah(x.value)}</span>
        </div>
      ))}
    </div>
  );
}

interface StepProps {
  step: StepKey;
  draft: Draft;
  update: (fn: (d: Draft) => Draft) => void;
  errors: Record<string, string>;
}

function StepBody({ step, draft, update, errors }: StepProps) {
  switch (step) {
    case 'keluarga':
      return <FamilyStep draft={draft} update={update} errors={errors} />;
    case 'rekening':
      return <AccountsStep draft={draft} update={update} errors={errors} />;
    case 'pemasukan':
      return <IncomeStep draft={draft} update={update} errors={errors} />;
    case 'pengeluaran':
      return <ExpenseStep draft={draft} update={update} errors={errors} />;
    case 'utang':
      return <DebtStep draft={draft} update={update} errors={errors} />;
    case 'aset':
      return <AssetStep draft={draft} update={update} errors={errors} />;
    case 'ringkasan':
      return (
        <p className="text-muted">
          Angka di bawah dihitung dari isian Anda. Untuk mengubahnya, kembali ke langkah yang bersangkutan. Setelah disimpan, Anda bisa memperbaruinya kapan saja dari dashboard.
        </p>
      );
  }
}

type Sub = Omit<StepProps, 'step'>;

function RowShell({ children, onRemove, removeLabel }: { children: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <li className="grid items-start gap-3 rounded-[12px] border border-line bg-inset p-4 md:grid-cols-[minmax(0,1fr)_44px]">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-flow-col xl:grid-cols-none xl:auto-cols-fr">{children}</div>
      <button type="button" className="btn size-11 justify-self-end p-0 md:mt-[26px]" aria-label={removeLabel} onClick={onRemove}>
        <IconTrash />
      </button>
    </li>
  );
}

function AddButton({ id, onClick, children, error }: { id: string; onClick: () => void; children: ReactNode; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <button id={id} type="button" className="btn self-start" onClick={onClick} aria-describedby={error ? `${id}-error` : undefined}>
        <IconPlus />
        {children}
      </button>
      {error ? <span id={`${id}-error`} className="text-[13px] text-down">{error}</span> : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-5 text-muted">{children}</p>;
}

function FamilyStep({ draft, update, errors }: Sub) {
  const h = draft.household;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="hh-name" label="Nama keluarga" error={errors['hh-name']} hint="Tampil di dashboard dan undangan anggota.">
        {(a) => (
          <input {...a} className="input" autoComplete="off" placeholder="Contoh: Keluarga Ramdani" value={h.name}
            onChange={(e) => update((d) => ({ ...d, household: { ...d.household, name: e.target.value } }))} />
        )}
      </Field>
      <Field id="hh-owner" label="Nama panggilan Anda (opsional)">
        {(a) => (
          <input {...a} className="input" autoComplete="given-name" placeholder="Contoh: Ayah" value={h.ownerName}
            onChange={(e) => update((d) => ({ ...d, household: { ...d.household, ownerName: e.target.value } }))} />
        )}
      </Field>
      <Field id="hh-dep" label="Jumlah tanggungan" hint="Anak atau anggota keluarga yang biayanya Anda tanggung.">
        {(a) => (
          <select {...a} className="input" value={h.dependents}
            onChange={(e) => update((d) => ({ ...d, household: { ...d.household, dependents: Number(e.target.value) } }))}>
            {Array.from({ length: 11 }, (_, n) => (
              <option key={n} value={n}>{n === 0 ? 'Tidak ada' : `${n} orang`}</option>
            ))}
          </select>
        )}
      </Field>
      <Field id="hh-target" label="Target dana darurat"
        hint="Patokan yang sering dipakai perencana keuangan: 3 bulan untuk lajang, 6 bulan untuk pasangan, 9 sampai 12 bulan bila punya tanggungan.">
        {(a) => (
          <select {...a} className="input" value={h.emergencyTargetMonths}
            onChange={(e) => update((d) => ({ ...d, household: { ...d.household, emergencyTargetMonths: Number(e.target.value) } }))}>
            {[3, 6, 9, 12].map((m) => (
              <option key={m} value={m}>{m} bulan pengeluaran</option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}

function AccountsStep({ draft, update, errors }: Sub) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">Cukup nama dan saldo. Nomor rekening tidak diminta dan tidak disimpan.</p>
      <ul className="flex flex-col gap-3">
        {draft.accounts.map((r, i) => (
          <RowShell key={r.id} removeLabel={`Hapus ${r.name || `rekening ${i + 1}`}`}
            onRemove={() => update((d) => ({ ...d, accounts: d.accounts.filter((x) => x.id !== r.id) }))}>
            <Field id={`acc-${r.id}-name`} label="Nama" error={errors[`acc-${r.id}-name`]}>
              {(a) => (
                <input {...a} className="input" autoComplete="off" placeholder="Contoh: Rek. Utama" value={r.name}
                  onChange={(e) => update((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) }))} />
              )}
            </Field>
            <Field id={`acc-${r.id}-kind`} label="Jenis">
              {(a) => (
                <select {...a} className="input" value={r.kind}
                  onChange={(e) => update((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === r.id ? { ...x, kind: e.target.value as typeof r.kind } : x)) }))}>
                  {Object.entries(ACCOUNT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
            </Field>
            <Field id={`acc-${r.id}-bal`} label="Saldo hari ini">
              {(a) => (
                <MoneyInput {...a} value={r.balance}
                  onValueChange={(v) => update((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === r.id ? { ...x, balance: v } : x)) }))} />
              )}
            </Field>
          </RowShell>
        ))}
      </ul>
      {draft.accounts.length === 0 ? <Empty>Belum ada rekening. Tambahkan minimal satu, misalnya uang tunai di rumah.</Empty> : null}
      <AddButton id="accounts" error={errors['accounts']}
        onClick={() => update((d) => ({ ...d, accounts: [...d.accounts, { id: newId(), name: '', kind: 'tabungan', balance: 0 }] }))}>
        Tambah rekening
      </AddButton>
    </div>
  );
}

function IncomeStep({ draft, update, errors }: Sub) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">Isi jumlah bersih yang masuk ke rekening setiap bulan. Penghasilan tidak tetap bisa diisi rata-ratanya.</p>
      <ul className="flex flex-col gap-3">
        {draft.incomes.map((r, i) => (
          <RowShell key={r.id} removeLabel={`Hapus ${r.name || `pemasukan ${i + 1}`}`}
            onRemove={() => update((d) => ({ ...d, incomes: d.incomes.filter((x) => x.id !== r.id) }))}>
            <Field id={`inc-${r.id}-name`} label="Sumber" error={errors[`inc-${r.id}-name`]}>
              {(a) => (
                <input {...a} className="input" autoComplete="off" placeholder="Contoh: Gaji" value={r.name}
                  onChange={(e) => update((d) => ({ ...d, incomes: d.incomes.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) }))} />
              )}
            </Field>
            <Field id={`inc-${r.id}-earner`} label="Penerima (opsional)">
              {(a) => (
                <input {...a} className="input" autoComplete="off" placeholder="Contoh: Ibu" value={r.earner}
                  onChange={(e) => update((d) => ({ ...d, incomes: d.incomes.map((x) => (x.id === r.id ? { ...x, earner: e.target.value } : x)) }))} />
              )}
            </Field>
            <Field id={`inc-${r.id}-amt`} label="Jumlah per bulan">
              {(a) => (
                <MoneyInput {...a} value={r.amount}
                  onValueChange={(v) => update((d) => ({ ...d, incomes: d.incomes.map((x) => (x.id === r.id ? { ...x, amount: v } : x)) }))} />
              )}
            </Field>
          </RowShell>
        ))}
      </ul>
      {draft.incomes.length === 0 ? <Empty>Belum ada pemasukan. Tambahkan gaji atau penghasilan rutin lain.</Empty> : null}
      <AddButton id="incomes" error={errors['incomes']}
        onClick={() => update((d) => ({ ...d, incomes: [...d.incomes, { id: newId(), name: '', earner: '', amount: 0 }] }))}>
        Tambah pemasukan
      </AddButton>
    </div>
  );
}

function ExpenseStep({ draft, update, errors }: Sub) {
  const total = draft.expenses.reduce((t, r) => t + r.amount, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Kategori umum sudah disiapkan. Biarkan kosong yang tidak relevan. Cicilan utang diisi di langkah berikutnya agar tidak terhitung dua kali.
      </p>
      <ul className="flex flex-col gap-3">
        {draft.expenses.map((r, i) => (
          <RowShell key={r.id} removeLabel={`Hapus kategori ${r.category || i + 1}`}
            onRemove={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== r.id) }))}>
            <Field id={`exp-${r.id}-category`} label="Kategori" error={errors[`exp-${r.id}-category`]}>
              {(a) => (
                <input {...a} className="input" autoComplete="off" value={r.category}
                  onChange={(e) => update((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === r.id ? { ...x, category: e.target.value } : x)) }))} />
              )}
            </Field>
            <Field id={`exp-${r.id}-amt`} label="Rata-rata per bulan">
              {(a) => (
                <MoneyInput {...a} value={r.amount}
                  onValueChange={(v) => update((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === r.id ? { ...x, amount: v } : x)) }))} />
              )}
            </Field>
          </RowShell>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AddButton id="expenses" onClick={() => update((d) => ({ ...d, expenses: [...d.expenses, { id: newId(), category: '', amount: 0 }] }))}>
          Tambah kategori
        </AddButton>
        <p className="num text-[14px]">
          Total <span className="font-semibold">{formatRupiah(total)}</span> per bulan
        </p>
      </div>
    </div>
  );
}

function DebtStep({ draft, update, errors }: Sub) {
  return (
    <div className="flex flex-col gap-4">
      {draft.debts.length === 0 ? (
        <Empty>Belum ada utang yang dicatat. Lewati langkah ini bila keluarga tidak punya utang atau cicilan.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {draft.debts.map((r, i) => (
            <RowShell key={r.id} removeLabel={`Hapus ${r.name || `utang ${i + 1}`}`}
              onRemove={() => update((d) => ({ ...d, debts: d.debts.filter((x) => x.id !== r.id) }))}>
              <Field id={`debt-${r.id}-name`} label="Nama" error={errors[`debt-${r.id}-name`]}>
                {(a) => (
                  <input {...a} className="input" autoComplete="off" placeholder="Contoh: KPR rumah" value={r.name}
                    onChange={(e) => update((d) => ({ ...d, debts: d.debts.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) }))} />
                )}
              </Field>
              <Field id={`debt-${r.id}-kind`} label="Jenis">
                {(a) => (
                  <select {...a} className="input" value={r.kind}
                    onChange={(e) => update((d) => ({ ...d, debts: d.debts.map((x) => (x.id === r.id ? { ...x, kind: e.target.value as typeof r.kind } : x)) }))}>
                    {Object.entries(DEBT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                )}
              </Field>
              <Field id={`debt-${r.id}-principal`} label="Sisa pokok" error={errors[`debt-${r.id}-principal`]}>
                {(a) => (
                  <MoneyInput {...a} value={r.principal}
                    onValueChange={(v) => update((d) => ({ ...d, debts: d.debts.map((x) => (x.id === r.id ? { ...x, principal: v } : x)) }))} />
                )}
              </Field>
              <Field id={`debt-${r.id}-inst`} label="Cicilan per bulan">
                {(a) => (
                  <MoneyInput {...a} value={r.installment}
                    onValueChange={(v) => update((d) => ({ ...d, debts: d.debts.map((x) => (x.id === r.id ? { ...x, installment: v } : x)) }))} />
                )}
              </Field>
            </RowShell>
          ))}
        </ul>
      )}
      <AddButton id="debts" onClick={() => update((d) => ({ ...d, debts: [...d.debts, { id: newId(), name: '', kind: 'kpr', principal: 0, installment: 0 }] }))}>
        Tambah utang
      </AddButton>
    </div>
  );
}

function AssetStep({ draft, update, errors }: Sub) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">Pakai perkiraan nilai jual hari ini. Rekening dan uang tunai tidak perlu diisi lagi di sini.</p>
      {draft.assets.length === 0 ? (
        <Empty>Belum ada aset yang dicatat. Tambahkan rumah, kendaraan, emas, atau investasi bila ada.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {draft.assets.map((r, i) => (
            <RowShell key={r.id} removeLabel={`Hapus ${r.name || `aset ${i + 1}`}`}
              onRemove={() => update((d) => ({ ...d, assets: d.assets.filter((x) => x.id !== r.id) }))}>
              <Field id={`asset-${r.id}-name`} label="Nama" error={errors[`asset-${r.id}-name`]}>
                {(a) => (
                  <input {...a} className="input" autoComplete="off" placeholder="Contoh: Emas batangan" value={r.name}
                    onChange={(e) => update((d) => ({ ...d, assets: d.assets.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) }))} />
                )}
              </Field>
              <Field id={`asset-${r.id}-kind`} label="Jenis">
                {(a) => (
                  <select {...a} className="input" value={r.kind}
                    onChange={(e) => update((d) => ({ ...d, assets: d.assets.map((x) => (x.id === r.id ? { ...x, kind: e.target.value as typeof r.kind } : x)) }))}>
                    {Object.entries(ASSET_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                )}
              </Field>
              <Field id={`asset-${r.id}-val`} label="Nilai saat ini">
                {(a) => (
                  <MoneyInput {...a} value={r.value}
                    onValueChange={(v) => update((d) => ({ ...d, assets: d.assets.map((x) => (x.id === r.id ? { ...x, value: v } : x)) }))} />
                )}
              </Field>
            </RowShell>
          ))}
        </ul>
      )}
      <AddButton id="assets" onClick={() => update((d) => ({ ...d, assets: [...d.assets, { id: newId(), name: '', kind: 'properti', value: 0 }] }))}>
        Tambah aset
      </AddButton>
    </div>
  );
}
