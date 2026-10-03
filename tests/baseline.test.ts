import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDraft, summarize, signals, validateStep, firstInvalidStep, toPayload, fromRecord, normalizeDraft, type Draft,
} from '../lib/baseline.ts';
import { parseRupiah, formatRupiah, formatRupiahShort } from '../lib/money.ts';

function filled(): Draft {
  const d = emptyDraft();
  d.household = { name: 'Keluarga Contoh', ownerName: '', status: 'menikah', emergencyTargetMonths: 6, allocationPct: 10 };
  d.accounts = [
    { id: 'a', name: 'Rek. Utama', kind: 'tabungan', balance: 30_000_000, isEmergency: true },
    { id: 'b', name: 'Dompet', kind: 'tunai', balance: 1_000_000, isEmergency: false },
  ];
  d.incomes = [{ id: 'i', name: 'Gaji', earner: '', amount: 20_000_000 }];
  d.expenses = [
    { id: 'e', category: 'Rumah tangga & makan', amount: 8_000_000, isRoutine: true },
    { id: 'f', category: 'Hiburan & makan di luar', amount: 2_000_000, isRoutine: false },
    { id: 'z', category: 'Transportasi', amount: 0, isRoutine: true },
  ];
  d.debts = [{ id: 'd', name: 'KPR', kind: 'kpr', principal: 400_000_000, installment: 7_000_000 }];
  d.assets = [{ id: 's', name: 'Rumah', kind: 'properti', value: 800_000_000 }];
  return d;
}

test('parseRupiah reads Indonesian formatted input', () => {
  assert.equal(parseRupiah('1.500.000'), 1_500_000);
  assert.equal(parseRupiah('Rp 2 500 000'), 2_500_000);
  assert.equal(parseRupiah(''), 0);
  assert.ok(parseRupiah('9'.repeat(30)) <= Number.MAX_SAFE_INTEGER);
});

test('formatRupiah uses dots and a real minus sign', () => {
  assert.equal(formatRupiah(1_500_000), 'Rp 1.500.000');
  assert.equal(formatRupiah(-2500), '−Rp 2.500');
  assert.equal(formatRupiahShort(21_380_000), 'Rp 21,4 jt');
});

test("owner's example: single, routine Rp4.000.000, 10% of a Rp6.000.000 salary", () => {
  const d = emptyDraft();
  d.household = { name: 'K', ownerName: '', status: 'lajang', emergencyTargetMonths: 3, allocationPct: 10 };
  d.incomes = [{ id: 'i', name: 'Gaji', earner: '', amount: 6_000_000 }];
  d.expenses = [{ id: 'e', category: 'Rumah tangga & makan', amount: 4_000_000, isRoutine: true }];
  d.accounts = [{ id: 'a', name: 'Tabungan', kind: 'tabungan', balance: 0, isEmergency: true }];
  const e = summarize(d).emergency;
  assert.equal(e.routineSpending, 4_000_000);
  assert.equal(e.target, 12_000_000);
  assert.equal(e.monthlyAllocation, 600_000);
  assert.equal(e.monthsToTarget, 20);
});

test('emergency fund counts only routine spending and tagged instruments', () => {
  const e = summarize(filled()).emergency;
  assert.equal(e.routineSpending, 8_000_000);
  assert.equal(e.target, 48_000_000);
  assert.equal(e.saved, 30_000_000);
  assert.equal(e.shortfall, 18_000_000);
  assert.equal(e.monthlyAllocation, 2_000_000);
  assert.equal(e.monthsToTarget, 9);
});

test('summarize computes net worth, cash flow and debt ratio', () => {
  const s = summarize(filled());
  assert.equal(s.netWorth, 431_000_000);
  assert.equal(s.freeCashflow, 3_000_000);
  assert.equal(s.debtRatio, 0.35);
});

test('installments above 30% are flagged with the allowed maximum', () => {
  const out = signals(summarize(filled()));
  const hit = out.find((x) => /melewati batas 30%/.test(x.text));
  assert.ok(hit);
  assert.equal(hit.tone, 'down');
  assert.match(hit.text, /Cicilan maksimal Rp 6\.000\.000/);
});

test('installments at exactly 30% pass', () => {
  const d = filled();
  d.debts[0].installment = 6_000_000;
  assert.ok(signals(summarize(d)).some((x) => /di bawah batas 30%/.test(x.text)));
});

test('married with children allows 9 or 12 months only', () => {
  const d = filled();
  d.household.status = 'menikah_anak';
  d.household.emergencyTargetMonths = 6;
  assert.deepEqual(Object.keys(validateStep('darurat', d)), ['ef-months-9']);
  d.household.emergencyTargetMonths = 12;
  assert.deepEqual(validateStep('darurat', d), {});
});

test('validation points at the exact field and the first broken step', () => {
  const d = emptyDraft();
  assert.deepEqual(Object.keys(validateStep('keluarga', d)), ['hh-name']);
  assert.equal(firstInvalidStep(d), 'keluarga');
  assert.equal(firstInvalidStep(filled()), null);
});

test('payload drops zero suggestions, keeps flags, never tags cash', () => {
  const d = filled();
  d.accounts[1].isEmergency = true;
  const p = toPayload(d);
  assert.equal(p.expenses.length, 2);
  assert.equal(p.expenses[1].isRoutine, false);
  assert.equal(p.accounts[1].isEmergency, false);
  assert.equal(p.household.earningStatus, 'menikah');
});

test('older drafts without the new fields still load', () => {
  const old = { version: 1, household: { name: 'Lama', ownerName: '', dependents: 2, emergencyTargetMonths: 6 }, accounts: [{ id: 'a', name: 'R', kind: 'tabungan', balance: 1 }], expenses: [{ id: 'e', category: 'X', amount: 5 }] };
  const d = normalizeDraft(old as unknown as Draft);
  assert.equal(d.household.status, '');
  assert.equal(d.household.allocationPct, 10);
  assert.equal(d.accounts[0].isEmergency, false);
  assert.equal(d.expenses[0].isRoutine, true);
  assert.equal(firstInvalidStep(d), 'pemasukan');
});

test('fromRecord restores saved rows, flags and custom categories', () => {
  const d = fromRecord({
    household: { name: 'K', earning_status: 'menikah_anak', emergency_target_months: 12, emergency_allocation_pct: 15, updated_at: '2026-10-03' },
    ownerName: 'Ibu',
    accounts: [{ name: 'RDPU', kind: 'rdpu', balance: 100, is_emergency: true }],
    incomes: [{ name: 'Gaji', earner: null, monthly_amount: 5 }],
    expenses: [{ category: 'Transportasi', monthly_amount: 7, is_routine: false }, { category: 'Hobi', monthly_amount: 3, is_routine: false }],
    debts: [],
    assets: [],
  });
  assert.equal(d.household.emergencyTargetMonths, 12);
  assert.equal(d.household.allocationPct, 15);
  assert.equal(d.accounts[0].isEmergency, true);
  const t = d.expenses.find((x) => x.category === 'Transportasi');
  assert.equal(t?.amount, 7);
  assert.equal(t?.isRoutine, false);
  assert.equal(d.expenses.at(-1)?.category, 'Hobi');
});
