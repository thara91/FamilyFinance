import { formatPercent, formatRupiah } from './money.ts';

export const ACCOUNT_KINDS = {
  tabungan: 'Tabungan',
  giro: 'Giro',
  ewallet: 'E-wallet',
  tunai: 'Tunai',
  deposito: 'Deposito',
} as const;

export const DEBT_KINDS = {
  kpr: 'KPR',
  kendaraan: 'Kredit kendaraan',
  kartu_kredit: 'Kartu kredit',
  pinjaman: 'Pinjaman lain',
} as const;

export const ASSET_KINDS = {
  properti: 'Properti',
  kendaraan: 'Kendaraan',
  emas: 'Emas',
  reksa_dana: 'Reksa dana',
  saham: 'Saham',
  obligasi: 'Obligasi / SBN',
  lainnya: 'Lainnya',
} as const;

export const EXPENSE_CATEGORIES = [
  'Rumah tangga & makan',
  'Pendidikan anak',
  'Transportasi',
  'Listrik, air, internet',
  'Kesehatan & asuransi',
  'Zakat, infak, sedekah',
  'Lainnya',
] as const;

/** Rule of thumb many Indonesian banks and planners use for total installments vs income. */
export const DEBT_RATIO_GUIDE = 0.3;

export type AccountKind = keyof typeof ACCOUNT_KINDS;
export type DebtKind = keyof typeof DEBT_KINDS;
export type AssetKind = keyof typeof ASSET_KINDS;

export interface AccountRow { id: string; name: string; kind: AccountKind; balance: number }
export interface IncomeRow { id: string; name: string; earner: string; amount: number }
export interface ExpenseRow { id: string; category: string; amount: number }
export interface DebtRow { id: string; name: string; kind: DebtKind; principal: number; installment: number }
export interface AssetRow { id: string; name: string; kind: AssetKind; value: number }

export interface Draft {
  version: 1;
  household: { name: string; ownerName: string; dependents: number; emergencyTargetMonths: number };
  accounts: AccountRow[];
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  debts: DebtRow[];
  assets: AssetRow[];
  /** Furthest step the person has opened, so a reload returns them there. */
  reached?: number;
}

export const STEPS = [
  { key: 'keluarga', title: 'Keluarga', hint: 'Nama keluarga dan target dana darurat' },
  { key: 'rekening', title: 'Rekening & kas', hint: 'Saldo tabungan, e-wallet, dan uang tunai hari ini' },
  { key: 'pemasukan', title: 'Pemasukan bulanan', hint: 'Gaji dan penghasilan rutin setiap bulan' },
  { key: 'pengeluaran', title: 'Pengeluaran rutin', hint: 'Biaya bulanan di luar cicilan utang' },
  { key: 'utang', title: 'Utang & cicilan', hint: 'KPR, kredit kendaraan, kartu kredit, pinjaman' },
  { key: 'aset', title: 'Aset & investasi', hint: 'Properti, kendaraan, emas, reksa dana, saham' },
  { key: 'ringkasan', title: 'Ringkasan', hint: 'Periksa hasil hitungan, lalu simpan' },
] as const;

export type StepKey = (typeof STEPS)[number]['key'];

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyDraft(): Draft {
  return {
    version: 1,
    household: { name: '', ownerName: '', dependents: 0, emergencyTargetMonths: 6 },
    accounts: [{ id: newId(), name: '', kind: 'tabungan', balance: 0 }],
    incomes: [{ id: newId(), name: '', earner: '', amount: 0 }],
    expenses: EXPENSE_CATEGORIES.map((category) => ({ id: newId(), category, amount: 0 })),
    debts: [],
    assets: [],
  };
}

const sum = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);

/** True once the person has typed anything worth keeping. */
export function hasContent(d: Draft): boolean {
  return (
    d.household.name.trim() !== '' ||
    d.accounts.some((r) => r.name.trim() !== '' || r.balance > 0) ||
    d.incomes.some((r) => r.name.trim() !== '' || r.amount > 0) ||
    d.expenses.some((r) => r.amount > 0) ||
    d.debts.length > 0 ||
    d.assets.length > 0
  );
}

export interface Summary {
  cash: number;
  otherAssets: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  income: number;
  expenses: number;
  installments: number;
  freeCashflow: number;
  monthlyOutflow: number;
  /** Months the cash would cover current expenses and installments; null when there is no outflow. */
  emergencyMonths: number | null;
  emergencyTargetMonths: number;
  emergencyTargetAmount: number;
  debtRatio: number | null;
  savingsRate: number | null;
}

export function summarize(d: Draft): Summary {
  const cash = sum(d.accounts, (r) => r.balance);
  const otherAssets = sum(d.assets, (r) => r.value);
  const totalDebt = sum(d.debts, (r) => r.principal);
  const income = sum(d.incomes, (r) => r.amount);
  const expenses = sum(d.expenses, (r) => r.amount);
  const installments = sum(d.debts, (r) => r.installment);
  const monthlyOutflow = expenses + installments;
  const freeCashflow = income - monthlyOutflow;
  const target = d.household.emergencyTargetMonths;
  return {
    cash,
    otherAssets,
    totalAssets: cash + otherAssets,
    totalDebt,
    netWorth: cash + otherAssets - totalDebt,
    income,
    expenses,
    installments,
    freeCashflow,
    monthlyOutflow,
    emergencyMonths: monthlyOutflow > 0 ? cash / monthlyOutflow : null,
    emergencyTargetMonths: target,
    emergencyTargetAmount: monthlyOutflow * target,
    debtRatio: income > 0 ? installments / income : null,
    savingsRate: income > 0 ? freeCashflow / income : null,
  };
}

export type Tone = 'up' | 'down' | 'warn';
export interface Signal { tone: Tone; text: string }

/** Plain-language readings of the summary, worst first. Only states what the entered numbers show. */
export function signals(s: Summary): Signal[] {
  const out: Signal[] = [];
  if (s.income === 0) {
    out.push({ tone: 'warn', text: 'Pemasukan bulanan belum diisi, jadi sisa kas dan rasio cicilan belum bisa dihitung.' });
  } else if (s.freeCashflow < 0) {
    out.push({ tone: 'down', text: `Pengeluaran rutin dan cicilan melebihi pemasukan sebesar ${formatRupiah(-s.freeCashflow)} per bulan.` });
  } else {
    out.push({ tone: 'up', text: `Setelah pengeluaran rutin dan cicilan, tersisa ${formatRupiah(s.freeCashflow)} per bulan (${formatPercent(s.savingsRate ?? 0)} dari pemasukan).` });
  }
  if (s.debtRatio !== null && s.debtRatio > DEBT_RATIO_GUIDE) {
    out.push({ tone: 'warn', text: `Cicilan menyerap ${formatPercent(s.debtRatio)} pemasukan, di atas patokan umum ${formatPercent(DEBT_RATIO_GUIDE)}.` });
  }
  if (s.emergencyMonths !== null) {
    const months = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(s.emergencyMonths);
    if (s.emergencyMonths < s.emergencyTargetMonths) {
      out.push({ tone: 'warn', text: `Kas yang ada cukup untuk ${months} bulan pengeluaran, target Anda ${s.emergencyTargetMonths} bulan. Kurang ${formatRupiah(s.emergencyTargetAmount - s.cash)}.` });
    } else {
      out.push({ tone: 'up', text: `Kas yang ada cukup untuk ${months} bulan pengeluaran, sudah memenuhi target ${s.emergencyTargetMonths} bulan.` });
    }
  }
  const order: Record<Tone, number> = { down: 0, warn: 1, up: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

export type Errors = Record<string, string>;

const blank = (v: string) => v.trim() === '';

/** Field errors for one step, keyed by the input's id so the form can point at the exact field. */
export function validateStep(step: StepKey, d: Draft): Errors {
  const e: Errors = {};
  switch (step) {
    case 'keluarga':
      if (blank(d.household.name)) e['hh-name'] = 'Isi nama keluarga, misalnya "Keluarga Ramdani".';
      break;
    case 'rekening':
      if (d.accounts.length === 0) e['accounts'] = 'Tambahkan minimal satu rekening atau uang tunai.';
      d.accounts.forEach((r) => { if (blank(r.name)) e[`acc-${r.id}-name`] = 'Beri nama, misalnya "Rek. Utama".'; });
      break;
    case 'pemasukan':
      if (d.incomes.length === 0) e['incomes'] = 'Tambahkan minimal satu sumber pemasukan.';
      d.incomes.forEach((r) => { if (blank(r.name)) e[`inc-${r.id}-name`] = 'Beri nama, misalnya "Gaji".'; });
      break;
    case 'pengeluaran':
      d.expenses.forEach((r) => { if (r.amount > 0 && blank(r.category)) e[`exp-${r.id}-category`] = 'Beri nama kategori.'; });
      break;
    case 'utang':
      d.debts.forEach((r) => {
        if (blank(r.name)) e[`debt-${r.id}-name`] = 'Beri nama, misalnya "KPR rumah".';
        if (r.installment > 0 && r.principal === 0) e[`debt-${r.id}-principal`] = 'Isi sisa pokok utang.';
      });
      break;
    case 'aset':
      d.assets.forEach((r) => { if (blank(r.name)) e[`asset-${r.id}-name`] = 'Beri nama aset.'; });
      break;
    case 'ringkasan':
      break;
  }
  return e;
}

/** The first step with errors, so saving can send the person straight to what needs fixing. */
export function firstInvalidStep(d: Draft): StepKey | null {
  for (const s of STEPS) {
    if (Object.keys(validateStep(s.key, d)).length > 0) return s.key;
  }
  return null;
}

/** Shape expected by the save_baseline() database function. */
export function toPayload(d: Draft) {
  return {
    household: {
      name: d.household.name.trim(),
      ownerName: d.household.ownerName.trim(),
      dependents: d.household.dependents,
      emergencyTargetMonths: d.household.emergencyTargetMonths,
    },
    accounts: d.accounts.map((r) => ({ name: r.name.trim(), kind: r.kind, balance: r.balance })),
    incomes: d.incomes.map((r) => ({ name: r.name.trim(), earner: r.earner.trim(), amount: r.amount })),
    // Prefilled categories left at zero are suggestions, not data.
    expenses: d.expenses.filter((r) => r.amount > 0).map((r) => ({ category: r.category.trim(), amount: r.amount })),
    debts: d.debts.map((r) => ({ name: r.name.trim(), kind: r.kind, principal: r.principal, installment: r.installment })),
    assets: d.assets.map((r) => ({ name: r.name.trim(), kind: r.kind, value: r.value })),
  };
}

export interface BaselineRecord {
  household: { name: string; dependents: number; emergency_target_months: number; updated_at: string };
  ownerName: string | null;
  accounts: { name: string; kind: AccountKind; balance: number }[];
  incomes: { name: string; earner: string | null; monthly_amount: number }[];
  expenses: { category: string; monthly_amount: number }[];
  debts: { name: string; kind: DebtKind; principal_remaining: number; monthly_installment: number }[];
  assets: { name: string; kind: AssetKind; current_value: number }[];
}

/** Rebuilds a draft from saved rows so the wizard can edit what is already stored. */
export function fromRecord(r: BaselineRecord): Draft {
  const saved = new Map(r.expenses.map((x) => [x.category, Number(x.monthly_amount)]));
  const expenses: ExpenseRow[] = EXPENSE_CATEGORIES.map((category) => ({ id: newId(), category, amount: saved.get(category) ?? 0 }));
  for (const x of r.expenses) {
    if (!EXPENSE_CATEGORIES.includes(x.category as (typeof EXPENSE_CATEGORIES)[number])) {
      expenses.push({ id: newId(), category: x.category, amount: Number(x.monthly_amount) });
    }
  }
  return {
    version: 1,
    household: {
      name: r.household.name,
      ownerName: r.ownerName ?? '',
      dependents: r.household.dependents,
      emergencyTargetMonths: r.household.emergency_target_months,
    },
    accounts: r.accounts.map((x) => ({ id: newId(), name: x.name, kind: x.kind, balance: Number(x.balance) })),
    incomes: r.incomes.map((x) => ({ id: newId(), name: x.name, earner: x.earner ?? '', amount: Number(x.monthly_amount) })),
    expenses,
    debts: r.debts.map((x) => ({ id: newId(), name: x.name, kind: x.kind, principal: Number(x.principal_remaining), installment: Number(x.monthly_installment) })),
    assets: r.assets.map((x) => ({ id: newId(), name: x.name, kind: x.kind, value: Number(x.current_value) })),
  };
}
