import type { Metadata } from 'next';
import Link from 'next/link';
import { aiConfigured } from '@/lib/ai';
import { canWrite, getCustomCategories, getHousehold } from '@/lib/household';
import { formatPercent, formatRupiah } from '@/lib/money';
import {
  budgetLines, expenseCategories, isSpending, jakartaToday, monthElapsed, monthLabel, monthRange, parseMonth, shiftMonth, spendingByCategory,
} from '@/lib/transactions';
import { BudgetBar } from '@/components/budget/BudgetBar';
import { BudgetEditor } from '@/components/budget/BudgetEditor';
import { IconBack, IconNext } from '@/components/icons';

export const metadata: Metadata = { title: 'Anggaran' };
export const dynamic = 'force-dynamic';

const AVERAGE_MONTHS = 3;

export default async function BudgetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await getHousehold('/anggaran');
  if (!ctx.household) {
    return (
      <section className="card mx-auto mt-8 flex max-w-[560px] flex-col gap-4 p-6">
        <h1 className="text-[22px] font-bold">Isi kondisi keuangan awal dulu</h1>
        <p className="text-muted">Anggaran disusun dari pengeluaran rutin keluarga di kondisi awal.</p>
        <Link href="/mulai" className="btn btn-primary self-start">Isi kondisi keuangan awal</Link>
      </section>
    );
  }

  const hid = ctx.household.id;
  const today = jakartaToday();
  const month = parseMonth(params.bulan, today);
  const range = monthRange(month);
  const thisMonth = today.slice(0, 7);
  const avgFrom = monthRange(shiftMonth(thisMonth, -AVERAGE_MONTHS)).from;
  const avgTo = monthRange(thisMonth).from;

  const [budgets, monthTx, pastTx, baseline, custom] = await Promise.all([
    ctx.supabase.from('budgets').select('category, monthly_limit').eq('household_id', hid),
    ctx.supabase.from('transactions').select('occurred_on, direction, amount, category').eq('household_id', hid).eq('direction', 'keluar').gte('occurred_on', range.from).lt('occurred_on', range.to),
    ctx.supabase.from('transactions').select('occurred_on, direction, amount, category').eq('household_id', hid).eq('direction', 'keluar').gte('occurred_on', avgFrom).lt('occurred_on', avgTo),
    ctx.supabase.from('monthly_expenses').select('category, monthly_amount').eq('household_id', hid),
    getCustomCategories(ctx),
  ]);
  const failed = [budgets, monthTx, pastTx, baseline].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const budgetRows = (budgets.data ?? []).map((b) => ({ category: b.category as string, monthly_limit: Number(b.monthly_limit) }));
  const tx = (monthTx.data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
  const lines = budgetLines(budgetRows, tx);
  const budgeted = lines.filter((l) => l.limit > 0);
  const unbudgeted = lines.filter((l) => l.limit === 0);
  const limitTotal = budgeted.reduce((t, l) => t + l.limit, 0);
  const spentTotal = budgeted.reduce((t, l) => t + l.spent, 0);
  const elapsed = monthElapsed(month, today);
  const writable = canWrite(ctx.role);

  const pastMonthsWithData = new Set((pastTx.data ?? []).map((r) => String(r.occurred_on).slice(0, 7))).size;
  const fromAverage = Object.fromEntries(
    pastMonthsWithData ? spendingByCategory((pastTx.data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })))
      .map((c) => [c.category, Math.round(c.amount / pastMonthsWithData / 10000) * 10000]) : [],
  );
  const fromBaseline = Object.fromEntries((baseline.data ?? []).filter((r) => Number(r.monthly_amount) > 0 && isSpending(r.category as string))
    .map((r) => [r.category as string, Number(r.monthly_amount)]));
  const editorCategories = [...new Set([...expenseCategories(custom), ...budgetRows.map((b) => b.category)])].filter(isSpending);
  const current = Object.fromEntries(budgetRows.map((b) => [b.category, b.monthly_limit]));
  const nav = (m: string) => (m === thisMonth ? '/anggaran' : `/anggaran?bulan=${m}`);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold tracking-tight sm:text-[26px]">Anggaran</h1>
        <p className="text-muted">Batas belanja per kategori setiap bulan, dibandingkan dengan transaksi yang tercatat.</p>
      </div>

      <section aria-label={`Anggaran ${monthLabel(month)}`} className="card flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <Link href={nav(shiftMonth(month, -1))} className="btn size-11 p-0" aria-label={`Bulan sebelumnya, ${monthLabel(shiftMonth(month, -1))}`}><IconBack /></Link>
          <h2 className="text-base font-semibold">{monthLabel(month)}</h2>
          <Link href={nav(shiftMonth(month, 1))} className="btn size-11 p-0" aria-label={`Bulan berikutnya, ${monthLabel(shiftMonth(month, 1))}`}><IconNext /></Link>
        </div>

        {budgeted.length === 0 ? (
          <p className="text-muted">
            Belum ada batas anggaran. {writable ? 'Isi batas di bawah, atau ambil dari pengeluaran rutin di kondisi awal dengan satu klik.' : 'Pemilik atau anggota keluarga bisa membuatnya.'}
          </p>
        ) : (
          <>
            <dl className="num grid grid-cols-3 gap-3 border-b border-line pb-5 text-center">
              <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Batas</dt><dd className="font-semibold">{formatRupiah(limitTotal)}</dd></div>
              <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Terpakai</dt><dd className={`font-semibold ${spentTotal > limitTotal ? 'text-down' : ''}`}>{formatRupiah(spentTotal)}</dd></div>
              <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Sisa</dt><dd className={`font-semibold ${limitTotal - spentTotal < 0 ? 'text-down' : 'text-up'}`}>{formatRupiah(limitTotal - spentTotal)}</dd></div>
            </dl>
            {elapsed > 0 && elapsed < 1 ? (
              <p className="text-[13px] text-muted">
                Bulan sudah berjalan {formatPercent(elapsed)}. Garis tipis di setiap batang menandai posisi hari ini; batang yang melewatinya berarti belanja lebih cepat dari jadwal.
              </p>
            ) : null}
            <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {budgeted.map((l) => <li key={l.category}><BudgetBar line={l} elapsed={elapsed} /></li>)}
            </ul>
          </>
        )}

        {unbudgeted.length ? (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <h3 className="text-[13px] font-semibold text-label">Belanja tanpa batas anggaran</h3>
            <ul className="flex flex-col">
              {unbudgeted.map((l) => (
                <li key={l.category} className="flex items-baseline justify-between gap-3 py-1.5 text-[14px]">
                  <span>{l.category}</span><span className="num text-muted">{formatRupiah(l.spent)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tx.length === 0 ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="text-[14px] text-muted">Belum ada pengeluaran tercatat di {monthLabel(month)}, jadi realisasi masih Rp 0.</p>
            {writable ? (
              <div className="flex flex-wrap gap-2">
                <Link href="/transaksi/baru" className="btn">Catat transaksi</Link>
                {aiConfigured ? <Link href="/transaksi/impor" className="btn">Impor e-statement</Link> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {writable ? (
        <BudgetEditor
          categories={editorCategories}
          current={current}
          fromBaseline={fromBaseline}
          fromAverage={fromAverage}
          averageMonths={pastMonthsWithData}
          startOpen={budgeted.length === 0}
        />
      ) : null}
    </div>
  );
}
