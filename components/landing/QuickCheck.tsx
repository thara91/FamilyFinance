'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEBT_RATIO_GUIDE, emptyDraft, hasContent, newId } from '@/lib/baseline';
import { loadDraft, saveDraft } from '@/lib/draft';
import { formatPercent, formatRupiah } from '@/lib/money';
import { Field, MoneyInput } from '@/components/Field';

/** Hero CTA that says "continue" instead of "start" when this device already holds an unsaved draft. */
export function StartButton() {
  const [resume, setResume] = useState(false);
  useEffect(() => {
    const d = loadDraft();
    setResume(d !== null && hasContent(d));
  }, []);
  return (
    <Link href="/mulai" className="btn btn-primary min-h-12 px-5 text-[15px]">
      {resume ? 'Lanjutkan isian Anda' : 'Isi kondisi keuangan awal'}
    </Link>
  );
}

export function QuickCheck() {
  const router = useRouter();
  const [income, setIncome] = useState(0);
  const [spend, setSpend] = useState(0);
  const [installment, setInstallment] = useState(0);

  const left = income - spend - installment;
  const ratio = income > 0 ? installment / income : null;
  const ready = income > 0;

  function carryOver() {
    const d = loadDraft() ?? emptyDraft();
    if (income > 0 && d.incomes.every((r) => r.amount === 0)) {
      d.incomes = [{ id: newId(), name: 'Pemasukan bulanan', earner: '', amount: income }];
    }
    if (spend > 0 && d.expenses.every((r) => r.amount === 0)) {
      d.expenses = [...d.expenses, { id: newId(), category: 'Total pengeluaran (rincikan nanti)', amount: spend }];
    }
    if (installment > 0 && d.debts.length === 0) {
      d.debts = [{ id: newId(), name: 'Cicilan', kind: 'pinjaman', principal: 0, installment }];
    }
    saveDraft(d);
    router.push('/mulai');
  }

  return (
    <section aria-labelledby="qc-h" className="card flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <h2 id="qc-h" className="text-base font-semibold">Hitung cepat sisa kas bulanan</h2>
        <p className="text-[13px] text-muted">Tiga angka kasar. Rinciannya bisa diisi nanti.</p>
      </div>
      <div className="grid gap-4">
        <Field id="qc-income" label="Pemasukan per bulan">
          {(a) => <MoneyInput {...a} value={income} onValueChange={setIncome} />}
        </Field>
        <Field id="qc-spend" label="Pengeluaran rutin per bulan" hint="Di luar cicilan utang.">
          {(a) => <MoneyInput {...a} value={spend} onValueChange={setSpend} />}
        </Field>
        <Field id="qc-inst" label="Total cicilan per bulan">
          {(a) => <MoneyInput {...a} value={installment} onValueChange={setInstallment} />}
        </Field>
      </div>
      <div aria-live="polite" className="rounded-[12px] border border-[#3e3290] bg-accent/10 p-4">
        {ready ? (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-muted">Sisa per bulan</span>
            <span className={`num text-[28px] font-bold leading-tight ${left < 0 ? 'text-down' : 'text-up'}`}>{formatRupiah(left)}</span>
            {ratio !== null && installment > 0 ? (
              <span className="num text-[13px] text-muted">
                Cicilan {formatPercent(ratio)} dari pemasukan
                {ratio > DEBT_RATIO_GUIDE ? `, di atas patokan umum ${formatPercent(DEBT_RATIO_GUIDE)}` : ''}.
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-[14px] text-muted">Isi pemasukan per bulan untuk melihat sisa kas.</span>
        )}
      </div>
      <button type="button" className="btn" disabled={!ready} onClick={carryOver}>
        Lanjutkan isian dengan angka ini
      </button>
    </section>
  );
}
