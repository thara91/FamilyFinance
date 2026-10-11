import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeStatement, budgetLines, categoriesFor, importRefs, isIsoDate, jakartaToday, merchantKey, monthElapsed, monthLabel,
  monthRange, parseMonth, shiftMonth, totals, validateTransaction, type StatementRow, type TransactionInput,
} from '../lib/transactions.ts';

const base: TransactionInput = {
  occurredOn: '2026-10-10', direction: 'keluar', amount: 125000, category: 'Rumah tangga & makan',
  description: 'Belanja pasar', accountId: null, note: '',
};

test('valid transaction has no errors', () => {
  assert.deepEqual(validateTransaction(base, '2026-10-11'), {});
});

test('validation names each broken field', () => {
  const e = validateTransaction({ ...base, occurredOn: '2026-02-30', amount: 0, category: ' ', description: '', accountId: 'abc' }, '2026-10-11');
  assert.deepEqual(Object.keys(e).sort(), ['accountId', 'amount', 'category', 'description', 'occurredOn']);
});

test('future dates beyond tomorrow are rejected', () => {
  assert.ok(validateTransaction({ ...base, occurredOn: '2026-10-13' }, '2026-10-11').occurredOn);
  assert.equal(validateTransaction({ ...base, occurredOn: '2026-10-12' }, '2026-10-11').occurredOn, undefined);
});

test('dates and months', () => {
  assert.equal(isIsoDate('2026-02-29'), false);
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(jakartaToday(new Date('2026-10-10T18:30:00Z')), '2026-10-11');
  assert.equal(parseMonth('2026-13', '2026-10-11'), '2026-10');
  assert.equal(parseMonth('2026-09', '2026-10-11'), '2026-09');
  assert.deepEqual(monthRange('2026-12'), { from: '2026-12-01', to: '2027-01-01' });
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(monthLabel('2026-10'), 'Oktober 2026');
  assert.ok(Math.abs(monthElapsed('2026-10', '2026-10-31') - 1) < 1e-9);
  assert.equal(monthElapsed('2026-11', '2026-10-31'), 0);
});

test('income and expense categories differ; custom household categories are included', () => {
  assert.ok(categoriesFor('masuk').includes('Gaji'));
  const out = categoriesFor('keluar', ['Les musik']);
  assert.ok(out.includes('Les musik'));
  assert.equal(out.at(-1), 'Lainnya');
});

test('totals keep transfers out of spending', () => {
  const t = totals([
    { occurred_on: '2026-10-01', direction: 'masuk', amount: 10_000_000, category: 'Gaji' },
    { occurred_on: '2026-10-02', direction: 'keluar', amount: 2_000_000, category: 'Rumah tangga & makan' },
    { occurred_on: '2026-10-03', direction: 'keluar', amount: 1_000_000, category: 'Transfer & tarik tunai' },
  ]);
  assert.deepEqual(t, { masuk: 10_000_000, keluar: 3_000_000, spending: 2_000_000, net: 7_000_000 });
});

test('budget lines: over limit first, unbudgeted spending last', () => {
  const lines = budgetLines(
    [{ category: 'Transportasi', monthly_limit: 1_000_000 }, { category: 'Rumah tangga & makan', monthly_limit: 2_000_000 }],
    [
      { occurred_on: '2026-10-02', direction: 'keluar', amount: 2_500_000, category: 'Rumah tangga & makan' },
      { occurred_on: '2026-10-02', direction: 'keluar', amount: 950_000, category: 'Transportasi' },
      { occurred_on: '2026-10-02', direction: 'keluar', amount: 300_000, category: 'Hiburan & makan di luar' },
    ],
  );
  assert.deepEqual(lines.map((l) => [l.category, l.status]), [
    ['Rumah tangga & makan', 'lewat'], ['Transportasi', 'hampir'], ['Hiburan & makan di luar', 'aman'],
  ]);
  assert.equal(lines[2].limit, 0);
});

const rows: StatementRow[] = [
  { date: '2026-09-02', description: 'QRIS KOPI KENANGAN 0231', direction: 'keluar', amount: 25_000, balanceAfter: null, category: 'Hiburan & makan di luar' },
  { date: '2026-09-02', description: 'QRIS KOPI KENANGAN 0231', direction: 'keluar', amount: 25_000, balanceAfter: null, category: 'Hiburan & makan di luar' },
  { date: '2026-09-09', description: 'QRIS KOPI KENANGAN 8812', direction: 'keluar', amount: 30_000, balanceAfter: null, category: 'Hiburan & makan di luar' },
  { date: '2026-09-25', description: 'GAJI SEPTEMBER', direction: 'masuk', amount: 18_000_000, balanceAfter: null, category: 'Gaji' },
  { date: '2026-09-26', description: 'TRF KE REK BERSAMA', direction: 'keluar', amount: 5_000_000, balanceAfter: null, category: 'Transfer & tarik tunai' },
  { date: '2026-09-27', description: 'PLN PRABAYAR 5223', direction: 'keluar', amount: 500_000, balanceAfter: null, category: 'Listrik, air, internet' },
];

test('import refs are stable and tell identical rows apart', () => {
  const a = importRefs('acc', rows);
  assert.equal(new Set(a).size, rows.length);
  assert.deepEqual(importRefs('acc', rows), a);
  assert.notDeepEqual(importRefs('other', rows), a);
  assert.ok(a.every((r) => r.length <= 80));
});

test('statement analysis: spending excludes transfers, repeats are grouped', () => {
  const s = analyzeStatement(rows);
  assert.equal(s.masuk, 18_000_000);
  assert.equal(s.spending, 580_000);
  assert.equal(s.byCategory[0].category, 'Listrik, air, internet');
  assert.deepEqual(s.recurring.map((r) => [r.count, r.total]), [[3, 80_000]]);
  assert.equal(s.largest?.amount, 500_000);
});

test('merchant key strips codes and dates', () => {
  assert.equal(merchantKey('QRIS 0123 KOPI KENANGAN 12/09'), merchantKey('QRIS 9988 Kopi Kenangan 01/10'));
});
