import { formatPercent, formatRupiah } from './money.ts';

export const ACCOUNT_KINDS = {
  tabungan: 'Tabungan bank',
  giro: 'Giro',
  ewallet: 'E-wallet',
  rdpu: 'Reksa dana pasar uang',
  tunai: 'Tunai',
  deposito: 'Deposito',
} as const;

/** Instruments the owner allows to hold the emergency fund: liquid within a day or two. */
export const EMERGENCY_INSTRUMENTS = ['tabungan', 'ewallet', 'rdpu'] as const;

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

/** Prefilled categories. `routine` marks needs that must keep running during an emergency. */
export const EXPENSE_CATEGORIES = [
  { category: 'Rumah tangga & makan', routine: true },
  { category: 'Sewa / kontrakan', routine: true },
  { category: 'Pendidikan anak', routine: true },
  { category: 'Transportasi', routine: true },
  { category: 'Listrik, air, internet', routine: true },
  { category: 'Kesehatan & asuransi', routine: true },
  { category: 'Zakat, infak, sedekah', routine: true },
  { category: 'Hiburan & makan di luar', routine: false },
  { category: 'Lainnya', routine: false },
] as const;

/** Owner's rule: total installments may not exceed this share of income. */
export const DEBT_RATIO_LIMIT = 0.3;

/** Owner's rule: emergency fund = routine monthly spending × the multiplier for the earner's status. */
export const EARNING_STATUSES = {
  freelance: { label: 'Tidak berpenghasilan tetap (freelance)', months: [12] },
  lajang: { label: 'Lajang', months: [3] },
  menikah: { label: 'Menikah tanpa anak', months: [6] },
  menikah_anak: { label: 'Menikah dengan anak', months: [9, 12] },
} as const;

export const DEFAULT_ALLOCATION_PCT = 10;

export type AccountKind = keyof typeof ACCOUNT_KINDS;
export type DebtKind = keyof typeof DEBT_KINDS;
export type AssetKind = keyof typeof ASSET_KINDS;
export type EarningStatus = keyof typeof EARNING_STATUSES;

export interface AccountRow { id: string; name: string; kind: AccountKind; balance: number; isEmergency: boolean }
export interface IncomeRow { id: string; name: string; earner: string; amount: number }
export interface ExpenseRow { id: string; category: string; amount: number; isRoutine: boolean }
export interface DebtRow { id: string; name: string; kind: DebtKind; principal: number; installment: number }
export interface AssetRow { id: string; name: string; kind: AssetKind; value: number }

export interface Household {
  name: string;
  ownerName: string;
  status: EarningStatus | '';
  emergencyTargetMonths: number;
  allocationPct: number;
}

export interface Draft {
  version: 1;
  household: Household;
  accounts: AccountRow[];
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  debts: DebtRow[];
  assets: AssetRow[];
  /** Furthest step the person has opened, so a reload returns them there. */
  reached?: number;
}

export const STEPS = [
  { key: 'keluarga', title: 'Keluarga', hint: 'Nama keluarga yang tampil di dashboard' },
  { key: 'rekening', title: 'Rekening & kas', hint: 'Saldo tabungan, e-wallet, reksa dana pasar uang, dan uang tunai hari ini' },
  { key: 'pemasukan', title: 'Pemasukan bulanan', hint: 'Gaji dan penghasilan rutin setiap bulan' },
  { key: 'pengeluaran', title: 'Pengeluaran rutin', hint: 'Biaya bulanan di luar cicilan utang' },
  { key: 'darurat', title: 'Dana darurat', hint: 'Status, target, alokasi bulanan, dan instrumen penampung' },
  { key: 'utang', title: 'Utang & cicilan', hint: 'KPR, kredit kendaraan, kartu kredit, pinjaman' },
  { key: 'aset', title: 'Aset & investasi', hint: 'Properti, kendaraan, emas, reksa dana, saham' },
  { key: 'ringkasan', title: 'Ringkasan', hint: 'Periksa hasil hitungan, lalu simpan' },
] as const;

export type StepKey = (typeof STEPS)[number]['key'];

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function canHoldEmergency(kind: AccountKind): boolean {
  return (EMERGENCY_INSTRUMENTS as readonly string[]).includes(kind);
}

export function emptyDraft(): Draft {
  return {
    version: 1,
    household: { name: '', ownerName: '', status: '', emergencyTargetMonths: 0, allocationPct: DEFAULT_ALLOCATION_PCT },
    accounts: [{ id: newId(), name: '', kind: 'tabungan', balance: 0, isEmergency: false }],
    incomes: [{ id: newId(), name: '', earner: '', amount: 0 }],
    expenses: EXPENSE_CATEGORIES.map((c) => ({ id: newId(), category: c.category, amount: 0, isRoutine: c.routine })),
    debts: [],
    assets: [],
  };
}

/** Fills fields added after a draft was first stored on the device, so older drafts keep working. */
export function normalizeDraft(raw: Partial<Draft>): Draft {
  const base = emptyDraft();
  const h = { ...base.household, ...(raw.household ?? {}) } as Household & { dependents?: number };
  delete h.dependents;
  if (!(h.status in EARNING_STATUSES)) h.status = '';
  return {
    ...base,
    ...raw,
    version: 1,
    household: h,
    accounts: (raw.accounts ?? base.accounts).map((r) => ({ ...r, isEmergency: Boolean(r.isEmergency) && canHoldEmergency(r.kind) })),
    expenses: (raw.expenses ?? base.expenses).map((r) => ({ ...r, isRoutine: r.isRoutine ?? true })),
  };
}

export function monthsForStatus(status: EarningStatus): readonly number[] {
  return EARNING_STATUSES[status].months;
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

export interface EmergencyPlan {
  status: EarningStatus | '';
  months: number;
  routineSpending: number;
  target: number;
  saved: number;
  shortfall: number;
  allocationPct: number;
  monthlyAllocation: number;
  /** Months of allocation left until the target is met; 0 when met, null when it can never be met. */
  monthsToTarget: number | null;
  instruments: { name: string; kind: AccountKind; balance: number }[];
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
  debtRatio: number | null;
  savingsRate: number | null;
  emergency: EmergencyPlan;
}

export function emergencyPlan(d: Draft): EmergencyPlan {
  const routineSpending = sum(d.expenses.filter((r) => r.isRoutine), (r) => r.amount);
  const months = d.household.status ? d.household.emergencyTargetMonths : 0;
  const target = routineSpending * months;
  const instruments = d.accounts.filter((r) => r.isEmergency && canHoldEmergency(r.kind));
  const saved = sum(instruments, (r) => r.balance);
  const shortfall = Math.max(0, target - saved);
  const income = sum(d.incomes, (r) => r.amount);
  const monthlyAllocation = Math.round((income * d.household.allocationPct) / 100);
  return {
    status: d.household.status,
    months,
    routineSpending,
    target,
    saved,
    shortfall,
    allocationPct: d.household.allocationPct,
    monthlyAllocation,
    monthsToTarget: shortfall === 0 ? 0 : monthlyAllocation > 0 ? Math.ceil(shortfall / monthlyAllocation) : null,
    instruments: instruments.map((r) => ({ name: r.name, kind: r.kind, balance: r.balance })),
  };
}

export function summarize(d: Draft): Summary {
  const cash = sum(d.accounts, (r) => r.balance);
  const otherAssets = sum(d.assets, (r) => r.value);
  const totalDebt = sum(d.debts, (r) => r.principal);
  const income = sum(d.incomes, (r) => r.amount);
  const expenses = sum(d.expenses, (r) => r.amount);
  const installments = sum(d.debts, (r) => r.installment);
  const freeCashflow = income - expenses - installments;
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
    debtRatio: income > 0 ? installments / income : null,
    savingsRate: income > 0 ? freeCashflow / income : null,
    emergency: emergencyPlan(d),
  };
}

export type Tone = 'up' | 'down' | 'warn';
export interface Signal { tone: Tone; text: string }

/** Plain-language readings of the summary, worst first. Only states what the entered numbers show. */
export function signals(s: Summary): Signal[] {
  const out: Signal[] = [];
  const e = s.emergency;
  if (s.income === 0) {
    out.push({ tone: 'warn', text: 'Pemasukan bulanan belum diisi, jadi sisa kas, rasio cicilan, dan alokasi dana darurat belum bisa dihitung.' });
  } else if (s.freeCashflow < 0) {
    out.push({ tone: 'down', text: `Pengeluaran dan cicilan melebihi pemasukan sebesar ${formatRupiah(-s.freeCashflow)} per bulan.` });
  } else {
    out.push({ tone: 'up', text: `Setelah pengeluaran dan cicilan, tersisa ${formatRupiah(s.freeCashflow)} per bulan (${formatPercent(s.savingsRate ?? 0)} dari pemasukan).` });
  }
  if (s.debtRatio !== null && s.debtRatio > DEBT_RATIO_LIMIT) {
    const allowed = Math.floor(s.income * DEBT_RATIO_LIMIT);
    out.push({ tone: 'down', text: `Cicilan ${formatPercent(s.debtRatio)} dari pemasukan, melewati batas ${formatPercent(DEBT_RATIO_LIMIT)}. Cicilan maksimal ${formatRupiah(allowed)} per bulan, kelebihan ${formatRupiah(s.installments - allowed)}.` });
  } else if (s.debtRatio !== null && s.installments > 0) {
    out.push({ tone: 'up', text: `Cicilan ${formatPercent(s.debtRatio)} dari pemasukan, masih di bawah batas ${formatPercent(DEBT_RATIO_LIMIT)}.` });
  }
  if (e.status && e.target > 0) {
    if (e.shortfall === 0) {
      out.push({ tone: 'up', text: `Dana darurat sudah mencapai target ${formatRupiah(e.target)}.` });
    } else if (e.monthsToTarget === null) {
      out.push({ tone: 'warn', text: `Dana darurat kurang ${formatRupiah(e.shortfall)}. Isi pemasukan agar alokasi bulanan bisa dihitung.` });
    } else {
      out.push({ tone: 'warn', text: `Dana darurat kurang ${formatRupiah(e.shortfall)}. Dengan menyisihkan ${formatRupiah(e.monthlyAllocation)} per bulan, target tercapai dalam ${e.monthsToTarget} bulan.` });
    }
    if (s.income > 0 && e.shortfall > 0 && e.monthlyAllocation > Math.max(0, s.freeCashflow)) {
      out.push({ tone: 'warn', text: `Alokasi dana darurat ${formatRupiah(e.monthlyAllocation)} lebih besar dari sisa kas ${formatRupiah(Math.max(0, s.freeCashflow))} per bulan.` });
    }
    if (e.instruments.length === 0) {
      out.push({ tone: 'warn', text: 'Belum ada instrumen yang ditandai sebagai penampung dana darurat.' });
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
    case 'darurat': {
      const s = d.household.status;
      if (!s) e['ef-status-freelance'] = 'Pilih status yang paling sesuai.';
      else if (!(monthsForStatus(s) as readonly number[]).includes(d.household.emergencyTargetMonths)) e['ef-months-9'] = 'Pilih 9 atau 12 bulan.';
      const pct = d.household.allocationPct;
      if (!Number.isInteger(pct) || pct < 1 || pct > 50) e['ef-pct'] = 'Isi angka 1 sampai 50.';
      break;
    }
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
      earningStatus: d.household.status,
      emergencyTargetMonths: d.household.emergencyTargetMonths,
      allocationPct: d.household.allocationPct,
    },
    accounts: d.accounts.map((r) => ({ name: r.name.trim(), kind: r.kind, balance: r.balance, isEmergency: r.isEmergency && canHoldEmergency(r.kind) })),
    incomes: d.incomes.map((r) => ({ name: r.name.trim(), earner: r.earner.trim(), amount: r.amount })),
    // Prefilled categories left at zero are suggestions, not data.
    expenses: d.expenses.filter((r) => r.amount > 0).map((r) => ({ category: r.category.trim(), amount: r.amount, isRoutine: r.isRoutine })),
    debts: d.debts.map((r) => ({ name: r.name.trim(), kind: r.kind, principal: r.principal, installment: r.installment })),
    assets: d.assets.map((r) => ({ name: r.name.trim(), kind: r.kind, value: r.value })),
  };
}

export interface BaselineRecord {
  household: { name: string; earning_status: EarningStatus | null; emergency_target_months: number; emergency_allocation_pct: number; updated_at: string };
  ownerName: string | null;
  accounts: { name: string; kind: AccountKind; balance: number; is_emergency: boolean }[];
  incomes: { name: string; earner: string | null; monthly_amount: number }[];
  expenses: { category: string; monthly_amount: number; is_routine: boolean }[];
  debts: { name: string; kind: DebtKind; principal_remaining: number; monthly_installment: number }[];
  assets: { name: string; kind: AssetKind; current_value: number }[];
}

/** Rebuilds a draft from saved rows so the wizard can edit what is already stored. */
export function fromRecord(r: BaselineRecord): Draft {
  const saved = new Map(r.expenses.map((x) => [x.category, x]));
  const expenses: ExpenseRow[] = EXPENSE_CATEGORIES.map((c) => {
    const x = saved.get(c.category);
    return { id: newId(), category: c.category, amount: x ? Number(x.monthly_amount) : 0, isRoutine: x ? x.is_routine : c.routine };
  });
  const known = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.category));
  for (const x of r.expenses) {
    if (!known.has(x.category)) expenses.push({ id: newId(), category: x.category, amount: Number(x.monthly_amount), isRoutine: x.is_routine });
  }
  const status = r.household.earning_status ?? '';
  return {
    version: 1,
    household: {
      name: r.household.name,
      ownerName: r.ownerName ?? '',
      status,
      emergencyTargetMonths: status ? r.household.emergency_target_months : 0,
      allocationPct: r.household.emergency_allocation_pct ?? DEFAULT_ALLOCATION_PCT,
    },
    accounts: r.accounts.map((x) => ({ id: newId(), name: x.name, kind: x.kind, balance: Number(x.balance), isEmergency: x.is_emergency })),
    incomes: r.incomes.map((x) => ({ id: newId(), name: x.name, earner: x.earner ?? '', amount: Number(x.monthly_amount) })),
    expenses,
    debts: r.debts.map((x) => ({ id: newId(), name: x.name, kind: x.kind, principal: Number(x.principal_remaining), installment: Number(x.monthly_installment) })),
    assets: r.assets.map((x) => ({ id: newId(), name: x.name, kind: x.kind, value: Number(x.current_value) })),
  };
}
