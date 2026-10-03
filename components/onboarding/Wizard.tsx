'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ACCOUNT_KINDS,
  ASSET_KINDS,
  DEBT_KINDS,
  EARNING_STATUSES,
  STEPS,
  canHoldEmergency,
  emergencyPlan,
  emptyDraft,
  monthsForStatus,
  firstInvalidStep,
  newId,
  summarize,
  validateStep,
  type Draft,
  type EarningStatus,
  type StepKey,
} from '@/lib/baseline';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { formatPercent, formatRupiah } from '@/lib/money';
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

        {current.key !== 'keluarga' && current.key !== 'ringkasan' && current.key !== 'darurat' ? <RunningTotals draft={draft} /> : null}
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
    case 'darurat':
      return <EmergencyStep draft={draft} update={update} errors={errors} />;
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
            onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, household: { ...d.household, name: value } }))} />
        )}
      </Field>
      <Field id="hh-owner" label="Nama panggilan Anda (opsional)">
        {(a) => (
          <input {...a} className="input" autoComplete="given-name" placeholder="Contoh: Ayah" value={h.ownerName}
            onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, household: { ...d.household, ownerName: value } }))} />
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
                  onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === r.id ? { ...x, name: value } : x)) }))} />
              )}
            </Field>
            <Field id={`acc-${r.id}-kind`} label="Jenis">
              {(a) => (
                <select {...a} className="input" value={r.kind}
                  onChange={(e) => {
                    const kind = e.currentTarget.value as typeof r.kind;
                    update((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === r.id ? { ...x, kind, isEmergency: x.isEmergency && canHoldEmergency(kind) } : x)) }));
                  }}>
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
        onClick={() => update((d) => ({ ...d, accounts: [...d.accounts, { id: newId(), name: '', kind: 'tabungan', balance: 0, isEmergency: false }] }))}>
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
                  onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, incomes: d.incomes.map((x) => (x.id === r.id ? { ...x, name: value } : x)) }))} />
              )}
            </Field>
            <Field id={`inc-${r.id}-earner`} label="Penerima (opsional)">
              {(a) => (
                <input {...a} className="input" autoComplete="off" placeholder="Contoh: Ibu" value={r.earner}
                  onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, incomes: d.incomes.map((x) => (x.id === r.id ? { ...x, earner: value } : x)) }))} />
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
  const routine = draft.expenses.reduce((t, r) => t + (r.isRoutine ? r.amount : 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Kategori umum sudah disiapkan. Biarkan kosong yang tidak relevan. Centang &quot;Rutin&quot; untuk kebutuhan yang tetap harus dibayar saat keadaan darurat; totalnya menjadi dasar dana darurat. Cicilan utang diisi di langkah Utang agar tidak terhitung dua kali.
      </p>
      <ul className="flex flex-col gap-3">
        {draft.expenses.map((r, i) => (
          <RowShell key={r.id} removeLabel={`Hapus kategori ${r.category || i + 1}`}
            onRemove={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== r.id) }))}>
            <Field id={`exp-${r.id}-category`} label="Kategori" error={errors[`exp-${r.id}-category`]}>
              {(a) => (
                <input {...a} className="input" autoComplete="off" value={r.category}
                  onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === r.id ? { ...x, category: value } : x)) }))} />
              )}
            </Field>
            <Field id={`exp-${r.id}-amt`} label="Rata-rata per bulan">
              {(a) => (
                <MoneyInput {...a} value={r.amount}
                  onValueChange={(v) => update((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === r.id ? { ...x, amount: v } : x)) }))} />
              )}
            </Field>
            <Check id={`exp-${r.id}-routine`} checked={r.isRoutine} className="sm:col-span-2 xl:col-span-1 xl:mt-[26px]"
              onChange={(v) => update((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === r.id ? { ...x, isRoutine: v } : x)) }))}>
              Rutin (dasar dana darurat)
            </Check>
          </RowShell>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AddButton id="expenses" onClick={() => update((d) => ({ ...d, expenses: [...d.expenses, { id: newId(), category: '', amount: 0, isRoutine: true }] }))}>
          Tambah kategori
        </AddButton>
        <div className="num flex flex-col items-start gap-0.5 text-[14px] sm:items-end">
          <span>Rutin <span className="font-semibold">{formatRupiah(routine)}</span> per bulan</span>
          <span className="text-muted">Semua pengeluaran {formatRupiah(total)}</span>
        </div>
      </div>
    </div>
  );
}

function Check({ id, checked, onChange, children, className = '', disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={`flex min-h-11 cursor-pointer items-center gap-3 text-[14px] ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}>
      <input id={id} type="checkbox" className="size-5 shrink-0 accent-[#6d4aff]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function EmergencyStep({ draft, update, errors }: Sub) {
  const h = draft.household;
  const plan = emergencyPlan(draft);
  const eligible = draft.accounts.filter((r) => canHoldEmergency(r.kind));
  const statusError = errors['ef-status-freelance'];
  const monthsError = errors['ef-months-9'];

  function pickStatus(status: EarningStatus) {
    const allowed = monthsForStatus(status);
    update((d) => ({
      ...d,
      household: { ...d.household, status, emergencyTargetMonths: allowed.includes(d.household.emergencyTargetMonths) ? d.household.emergencyTargetMonths : allowed[0] },
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2" aria-describedby={statusError ? 'ef-status-error' : undefined}>
        <legend className="mb-2 text-[13px] font-semibold text-label">Status Anda</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(EARNING_STATUSES) as EarningStatus[]).map((key) => {
            const s = EARNING_STATUSES[key];
            const on = h.status === key;
            return (
              <label key={key} htmlFor={`ef-status-${key}`}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] border px-4 py-3 ${on ? 'border-accent bg-accent/10' : 'border-line bg-inset hover:border-line-strong'}`}>
                <input id={`ef-status-${key}`} type="radio" name="ef-status" className="size-5 shrink-0 accent-[#6d4aff]" checked={on} onChange={() => pickStatus(key)} />
                <span className="flex flex-col">
                  <span className="font-semibold">{s.label}</span>
                  <span className="num text-[13px] text-muted">{s.months.join(' atau ')} bulan pengeluaran rutin</span>
                </span>
              </label>
            );
          })}
        </div>
        {statusError ? <span id="ef-status-error" className="text-[13px] text-down">{statusError}</span> : null}
      </fieldset>

      {h.status === 'menikah_anak' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold text-label">Target untuk keluarga dengan anak</legend>
          <div className="flex flex-wrap gap-2">
            {[9, 12].map((m) => (
              <label key={m} htmlFor={`ef-months-${m}`}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-4 ${h.emergencyTargetMonths === m ? 'border-accent bg-accent/10' : 'border-line bg-inset'}`}>
                <input id={`ef-months-${m}`} type="radio" name="ef-months" className="size-5 accent-[#6d4aff]" checked={h.emergencyTargetMonths === m}
                  onChange={() => update((d) => ({ ...d, household: { ...d.household, emergencyTargetMonths: m } }))} />
                <span className="num">{m} bulan</span>
              </label>
            ))}
          </div>
          <span className="text-xs text-muted">Pilih 12 bulan bila tanggungan banyak atau penghasilan hanya dari satu orang.</span>
          {monthsError ? <span className="text-[13px] text-down">{monthsError}</span> : null}
        </fieldset>
      ) : null}

      <Field id="ef-pct" label="Sisihkan dari pemasukan setiap bulan" error={errors['ef-pct']} hint="Aturan Kas Keluarga: 10% sampai target tercapai. Ubah bila perlu.">
        {(a) => (
          <div className="relative max-w-[160px]">
            <input {...a} type="text" inputMode="numeric" className="input num pr-9" value={h.allocationPct || ''}
              onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, household: { ...d.household, allocationPct: Number(value.replace(/\D/g, '').slice(0, 2)) } }))} />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">%</span>
          </div>
        )}
      </Field>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[13px] font-semibold text-label">Instrumen penampung dana darurat</legend>
        <span className="mb-1 text-xs text-muted">Hanya Tabungan bank, E-wallet, dan Reksa dana pasar uang. Saldo yang ditandai dihitung sebagai dana darurat terkumpul.</span>
        {eligible.length === 0 ? (
          <Empty>Belum ada Tabungan bank, E-wallet, atau Reksa dana pasar uang. Tambahkan di langkah Rekening &amp; kas.</Empty>
        ) : (
          eligible.map((r) => (
            <Check key={r.id} id={`ef-tag-${r.id}`} checked={r.isEmergency}
              onChange={(v) => update((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === r.id ? { ...x, isEmergency: v } : x)) }))}>
              <span className="font-semibold">{r.name || 'Tanpa nama'}</span>
              <span className="text-muted"> · {ACCOUNT_KINDS[r.kind]} · </span>
              <span className="num">{formatRupiah(r.balance)}</span>
            </Check>
          ))
        )}
      </fieldset>

      <EmergencyCalc plan={plan} />
    </div>
  );
}

function EmergencyCalc({ plan }: { plan: ReturnType<typeof emergencyPlan> }) {
  if (!plan.status) {
    return <p aria-live="polite" className="rounded-[12px] border border-[#3e3290] bg-accent/10 p-4 text-muted">Pilih status untuk melihat target dana darurat.</p>;
  }
  return (
    <ul aria-live="polite" className="num flex flex-col gap-2 rounded-[12px] border border-[#3e3290] bg-accent/10 p-4 text-[14px]">
      <li><span className="text-muted">Pengeluaran rutin: </span><span className="font-semibold">{formatRupiah(plan.routineSpending)}</span> per bulan</li>
      <li><span className="text-muted">Status: </span>{EARNING_STATUSES[plan.status].label} (target {plan.months}× = <span className="font-semibold">{formatRupiah(plan.target)}</span>)</li>
      <li><span className="text-muted">Sudah terkumpul: </span><span className="font-semibold">{formatRupiah(plan.saved)}</span></li>
      <li>
        <span className="text-muted">Alokasi per bulan ({formatPercent(plan.allocationPct / 100)}): </span>
        {plan.shortfall === 0
          ? 'target sudah tercapai.'
          : plan.monthsToTarget === null
            ? 'isi pemasukan dulu untuk menghitungnya.'
            : <>sisihkan <span className="font-semibold">{formatRupiah(plan.monthlyAllocation)}</span> dari pemasukan, tercapai dalam <span className="font-semibold">{plan.monthsToTarget} bulan</span>.</>}
      </li>
    </ul>
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
                    onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, debts: d.debts.map((x) => (x.id === r.id ? { ...x, name: value } : x)) }))} />
                )}
              </Field>
              <Field id={`debt-${r.id}-kind`} label="Jenis">
                {(a) => (
                  <select {...a} className="input" value={r.kind}
                    onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, debts: d.debts.map((x) => (x.id === r.id ? { ...x, kind: value as typeof r.kind } : x)) }))}>
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
                    onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, assets: d.assets.map((x) => (x.id === r.id ? { ...x, name: value } : x)) }))} />
                )}
              </Field>
              <Field id={`asset-${r.id}-kind`} label="Jenis">
                {(a) => (
                  <select {...a} className="input" value={r.kind}
                    onChange={({ currentTarget: { value } }) => update((d) => ({ ...d, assets: d.assets.map((x) => (x.id === r.id ? { ...x, kind: value as typeof r.kind } : x)) }))}>
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
