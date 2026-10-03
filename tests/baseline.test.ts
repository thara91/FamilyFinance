import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, summarize, signals, validateStep, firstInvalidStep, toPayload, fromRecord, type Draft } from '../lib/baseline.ts';
import { parseRupiah, formatRupiah, formatRupiahShort } from '../lib/money.ts';

function filled(): Draft {
  const d = emptyDraft();
  d.household.name = 'Keluarga Contoh';
  d.accounts = [{ id: 'a', name: 'Rek. Utama', kind: 'tabungan', balance: 30_000_000 }];
  d.incomes = [{ id: 'i', name: 'Gaji', earner: '', amount: 20_000_000 }];
  d.expenses = [{ id: 'e', category: 'Rumah tangga & makan', amount: 8_000_000 }, { id: 'z', category: 'Transportasi', amount: 0 }];
  d.debts = [{ id: 'd', name: 'KPR', kind: 'kpr', principal: 400_000_000, installment: 7_000_000 }];
  d.assets = [{ id: 's', name: 'Rumah', kind: 'properti', value: 800_000_000 }];
  return d;
}

test('parseRupiah reads Indonesian formatted input', () => {
  assert.equal(parseRupiah('1.500.000'), 1_500_000);
  assert.equal(parseRupiah('Rp 2 500 000'), 2_500_000);
  assert.equal(parseRupiah(''), 0);
  assert.equal(parseRupiah('abc'), 0);
  assert.ok(parseRupiah('9'.repeat(30)) <= Number.MAX_SAFE_INTEGER);
});

test('formatRupiah uses dots and a real minus sign', () => {
  assert.equal(formatRupiah(1_500_000).replace(/\s/g, ' '), 'Rp 1.500.000');
  assert.equal(formatRupiah(-2500).replace(/\s/g, ' '), '−Rp 2.500');
  assert.equal(formatRupiahShort(21_380_000).replace(/\s/g, ' '), 'Rp 21,4 jt');
});

test('summarize computes net worth, cash flow and ratios', () => {
  const s = summarize(filled());
  assert.equal(s.totalAssets, 830_000_000);
  assert.equal(s.netWorth, 430_000_000);
  assert.equal(s.freeCashflow, 5_000_000);
  assert.equal(s.monthlyOutflow, 15_000_000);
  assert.equal(s.emergencyMonths, 2);
  assert.equal(s.emergencyTargetAmount, 90_000_000);
  assert.equal(s.debtRatio, 0.35);
  assert.equal(s.savingsRate, 0.25);
});

test('summarize handles an empty household without dividing by zero', () => {
  const s = summarize(emptyDraft());
  assert.equal(s.emergencyMonths, null);
  assert.equal(s.debtRatio, null);
  assert.equal(s.savingsRate, null);
});

test('signals flag a deficit first and the high installment ratio', () => {
  const d = filled();
  d.incomes[0].amount = 12_000_000;
  const out = signals(summarize(d));
  assert.equal(out[0].tone, 'down');
  assert.match(out[0].text, /melebihi pemasukan/);
  assert.ok(out.some((x) => /patokan umum/.test(x.text)));
});

test('validation points at the exact field and the first broken step', () => {
  const d = emptyDraft();
  assert.deepEqual(Object.keys(validateStep('keluarga', d)), ['hh-name']);
  assert.equal(firstInvalidStep(d), 'keluarga');
  assert.equal(firstInvalidStep(filled()), null);
});

test('payload drops zero suggestions and trims names', () => {
  const d = filled();
  d.household.name = '  Keluarga Contoh  ';
  const p = toPayload(d);
  assert.equal(p.household.name, 'Keluarga Contoh');
  assert.deepEqual(p.expenses, [{ category: 'Rumah tangga & makan', amount: 8_000_000 }]);
});

test('fromRecord restores saved rows and keeps custom categories', () => {
  const d = fromRecord({
    household: { name: 'K', dependents: 1, emergency_target_months: 9, updated_at: '2026-10-03' },
    ownerName: 'Ibu',
    accounts: [{ name: 'Tunai', kind: 'tunai', balance: 100 }],
    incomes: [{ name: 'Gaji', earner: null, monthly_amount: 5 }],
    expenses: [{ category: 'Transportasi', monthly_amount: 7 }, { category: 'Hobi', monthly_amount: 3 }],
    debts: [],
    assets: [],
  });
  assert.equal(d.household.emergencyTargetMonths, 9);
  assert.equal(d.expenses.find((x) => x.category === 'Transportasi')?.amount, 7);
  assert.equal(d.expenses.at(-1)?.category, 'Hobi');
});
