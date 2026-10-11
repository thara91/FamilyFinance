import { EXPENSE_CATEGORIES } from './baseline.ts';

export type Direction = 'masuk' | 'keluar';
export type Source = 'manual' | 'struk' | 'mutasi';

export const INCOME_CATEGORIES = ['Gaji', 'Usaha & sampingan', 'Bonus & THR', 'Hasil investasi', 'Transfer masuk', 'Lainnya'] as const;

/** Money that leaves an account without being spent; never counted against a budget. */
export const NOT_SPENDING = ['Transfer & tarik tunai', 'Tabungan & investasi'] as const;

export const EXTRA_EXPENSE_CATEGORIES = ['Belanja pribadi', 'Cicilan utang', ...NOT_SPENDING] as const;

/** Spending categories: the household's own (from its baseline) first, then the shared defaults. */
export function expenseCategories(custom: readonly string[] = []): string[] {
  const all = [...EXPENSE_CATEGORIES.map((c) => c.category), ...EXTRA_EXPENSE_CATEGORIES, ...custom];
  const lainnya = all.filter((c) => c === 'Lainnya');
  return [...new Set(all.filter((c) => c !== 'Lainnya')), ...new Set(lainnya)];
}

export function categoriesFor(direction: Direction, custom: readonly string[] = []): string[] {
  return direction === 'masuk' ? [...INCOME_CATEGORIES] : expenseCategories(custom);
}

export function isSpending(category: string): boolean {
  return !(NOT_SPENDING as readonly string[]).includes(category);
}

export interface TransactionInput {
  occurredOn: string;
  direction: Direction;
  amount: number;
  category: string;
  description: string;
  accountId: string | null;
  note: string;
}

export type TxErrors = Partial<Record<keyof TransactionInput, string>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateTransaction(t: TransactionInput, today: string): TxErrors {
  const e: TxErrors = {};
  if (!isIsoDate(t.occurredOn)) e.occurredOn = 'Pilih tanggal transaksi.';
  else if (t.occurredOn > addDays(today, 1)) e.occurredOn = 'Tanggal belum boleh di masa depan.';
  if (t.direction !== 'masuk' && t.direction !== 'keluar') e.direction = 'Pilih uang masuk atau keluar.';
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0) e.amount = 'Isi jumlah lebih dari Rp 0.';
  if (t.category.trim() === '') e.category = 'Pilih kategori.';
  else if (t.category.trim().length > 60) e.category = 'Nama kategori maksimal 60 huruf.';
  if (t.description.trim() === '') e.description = 'Tulis keterangan singkat, misalnya "Belanja Indomaret".';
  else if (t.description.trim().length > 140) e.description = 'Keterangan maksimal 140 huruf.';
  if (t.note.length > 500) e.note = 'Catatan maksimal 500 huruf.';
  if (t.accountId !== null && !UUID.test(t.accountId)) e.accountId = 'Pilih rekening dari daftar.';
  return e;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's date in Jakarta, the calendar the household lives by. */
export function jakartaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function parseMonth(value: string | undefined | null, today: string): string {
  return value && MONTH.test(value) ? value : today.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
}

export interface TxLike {
  occurred_on: string;
  direction: Direction;
  amount: number;
  category: string;
}

export function totals(rows: TxLike[]) {
  let masuk = 0;
  let keluar = 0;
  let spending = 0;
  for (const r of rows) {
    if (r.direction === 'masuk') masuk += Number(r.amount);
    else {
      keluar += Number(r.amount);
      if (isSpending(r.category)) spending += Number(r.amount);
    }
  }
  return { masuk, keluar, spending, net: masuk - keluar };
}

export function spendingByCategory(rows: TxLike[]): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.direction !== 'keluar' || !isSpending(r.category)) continue;
    map.set(r.category, (map.get(r.category) ?? 0) + Number(r.amount));
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export interface BudgetLine {
  category: string;
  limit: number;
  spent: number;
  ratio: number;
  status: 'aman' | 'hampir' | 'lewat';
}

/** Budgets with this month's spending; categories spent without a budget come last with limit 0. */
export function budgetLines(budgets: { category: string; monthly_limit: number }[], rows: TxLike[]): BudgetLine[] {
  const spent = new Map(spendingByCategory(rows).map((r) => [r.category, r.amount]));
  const lines: BudgetLine[] = budgets.map((b) => {
    const s = spent.get(b.category) ?? 0;
    const limit = Number(b.monthly_limit);
    const ratio = limit > 0 ? s / limit : 0;
    return { category: b.category, limit, spent: s, ratio, status: ratio > 1 ? 'lewat' : ratio >= 0.9 ? 'hampir' : 'aman' };
  });
  const budgeted = new Set(budgets.map((b) => b.category));
  for (const [category, s] of spent) {
    if (!budgeted.has(category)) lines.push({ category, limit: 0, spent: s, ratio: 0, status: 'aman' });
  }
  const order = { lewat: 0, hampir: 1, aman: 2 };
  return lines.sort((a, b) => (a.limit === 0 ? 1 : 0) - (b.limit === 0 ? 1 : 0) || order[a.status] - order[b.status] || b.ratio - a.ratio);
}

/** Share of the month gone, so a budget can be read against time ("60% used, 40% of the month left"). */
export function monthElapsed(month: string, today: string): number {
  const { from, to } = monthRange(month);
  if (today < from) return 0;
  if (today >= to) return 1;
  const days = (Date.parse(to) - Date.parse(from)) / 864e5;
  return (Date.parse(today) - Date.parse(from)) / 864e5 / days + 1 / days;
}

export interface StatementRow {
  date: string;
  description: string;
  direction: Direction;
  amount: number;
  balanceAfter: number | null;
  category: string;
}

/**
 * Stable key for a statement row, so importing the same or an overlapping statement twice is caught.
 * Identical rows on the same day (two equal coffees) are told apart by their order of appearance.
 */
export function importRefs(accountId: string, rows: StatementRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = [accountId, r.date, r.direction, r.amount, r.description.trim().toLowerCase().replace(/\s+/g, ' ')].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `m:${hash(`${base}|${n}`)}`;
  });
}

/** FNV-1a, twice with different seeds, as 16 hex chars. Collisions only matter within one household. */
function hash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export interface StatementAnalysis {
  masuk: number;
  keluar: number;
  spending: number;
  byCategory: { category: string; amount: number; share: number }[];
  recurring: { description: string; count: number; total: number }[];
  largest: StatementRow | null;
}

/** Plain spending read of an imported statement: where the money went and what repeats. */
export function analyzeStatement(rows: StatementRow[]): StatementAnalysis {
  const tx = rows.map((r) => ({ occurred_on: r.date, direction: r.direction, amount: r.amount, category: r.category }));
  const t = totals(tx);
  const byCategory = spendingByCategory(tx).map((c) => ({ ...c, share: t.spending > 0 ? c.amount / t.spending : 0 }));
  const groups = new Map<string, { description: string; count: number; total: number }>();
  for (const r of rows) {
    if (r.direction !== 'keluar' || !isSpending(r.category)) continue;
    const key = merchantKey(r.description);
    if (!key) continue;
    const g = groups.get(key) ?? { description: r.description.trim(), count: 0, total: 0 };
    g.count += 1;
    g.total += r.amount;
    groups.set(key, g);
  }
  const recurring = [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.total - a.total).slice(0, 5);
  const largest = rows.filter((r) => r.direction === 'keluar' && isSpending(r.category)).sort((a, b) => b.amount - a.amount)[0] ?? null;
  return { masuk: t.masuk, keluar: t.keluar, spending: t.spending, byCategory, recurring, largest };
}

/** Strips dates, reference numbers and amounts so "QRIS 0123 KOPI KENANGAN 12/09" groups with its repeats. */
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?/g, ' ')
    .replace(/\b[a-z]*\d[a-z0-9]*\b/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}
