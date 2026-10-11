import type { Metadata } from 'next';
import Link from 'next/link';
import { ACCOUNT_KINDS, ASSET_KINDS, DEBT_KINDS, fromRecord, summarize, type BaselineRecord } from '@/lib/baseline';
import { canWrite, getAccounts, getHousehold } from '@/lib/household';
import { formatRupiah } from '@/lib/money';
import { supabaseConfigured } from '@/lib/supabase/env';
import { budgetLines, jakartaToday, monthLabel, monthRange, totals } from '@/lib/transactions';
import { SummaryView } from '@/components/SummaryView';
import { EditBaselineButton } from '@/components/dashboard/EditBaselineButton';
import { BudgetBar } from '@/components/budget/BudgetBar';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

function List({ title, empty, rows, href }: { title: string; empty: string; href?: string; rows: { label: string; meta?: string; value: number; tag?: string }[] }) {
  const total = rows.reduce((t, r) => t + r.value, 0);
  return (
    <section aria-label={title} className="card flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {rows.length > 0 ? <span className="num shrink-0 whitespace-nowrap text-[13px] text-muted">{formatRupiah(total)}</span> : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-[14px] text-muted">{empty}</p>
      ) : (
        <ul>
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="flex items-baseline justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-words">{r.label}</span>
                  {r.tag ? <span className="rounded-full bg-up/15 px-2.5 py-0.5 text-xs font-semibold text-[#5ee3b0]">{r.tag}</span> : null}
                </span>
                {r.meta ? <span className="text-[13px] text-muted">{r.meta}</span> : null}
              </span>
              <span className="num shrink-0 whitespace-nowrap font-semibold">{formatRupiah(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {href ? <Link href={href} className="link mt-1 inline-flex min-h-11 items-center self-start text-sm">Lihat transaksi</Link> : null}
    </section>
  );
}

export default async function DashboardPage() {
  if (!supabaseConfigured) {
    return (
      <div role="alert" className="card flex flex-col gap-2">
        <h1 className="text-xl font-bold">Supabase belum terhubung</h1>
        <p className="text-muted">Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, lalu muat ulang halaman.</p>
      </div>
    );
  }

  const ctx = await getHousehold('/dashboard');
  if (!ctx.household) {
    return (
      <section className="card mx-auto mt-8 flex w-full max-w-[560px] flex-col gap-4 p-6 sm:p-8">
        <h1 className="text-[22px] font-bold">Kondisi keuangan awal belum diisi</h1>
        <p className="text-muted">
          Dashboard ini dihitung dari rekening, pemasukan, pengeluaran rutin, utang, dan aset keluarga. Isi sekali, lalu perbarui bila ada perubahan besar.
        </p>
        <Link href="/mulai" className="btn btn-primary self-start">Isi kondisi keuangan awal</Link>
      </section>
    );
  }

  const { supabase } = ctx;
  const hid = ctx.household.id;
  const today = jakartaToday();
  const month = today.slice(0, 7);
  const range = monthRange(month);

  const [household, accounts, incomes, expenses, debts, assets, monthTx, budgets] = await Promise.all([
    supabase.from('households').select('name, earning_status, emergency_target_months, emergency_allocation_pct, updated_at').eq('id', hid).single(),
    getAccounts(ctx),
    supabase.from('income_sources').select('name, earner, monthly_amount').eq('household_id', hid).order('monthly_amount', { ascending: false }),
    supabase.from('monthly_expenses').select('category, monthly_amount, is_routine').eq('household_id', hid).order('monthly_amount', { ascending: false }),
    supabase.from('debts').select('name, kind, principal_remaining, monthly_installment').eq('household_id', hid).order('principal_remaining', { ascending: false }),
    supabase.from('assets').select('name, kind, current_value').eq('household_id', hid).order('current_value', { ascending: false }),
    supabase.from('transactions').select('occurred_on, direction, amount, category').eq('household_id', hid).gte('occurred_on', range.from).lt('occurred_on', range.to),
    supabase.from('budgets').select('category, monthly_limit').eq('household_id', hid),
  ]);
  const failed = [household, incomes, expenses, debts, assets, monthTx, budgets].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  // Accounts show today's running balance, so editing the baseline starts from what the household really holds now.
  const record = {
    household: household.data!,
    ownerName: ctx.displayName,
    accounts: [...accounts].sort((a, b) => b.current_balance - a.current_balance)
      .map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: a.current_balance, is_emergency: a.is_emergency })),
    incomes: incomes.data ?? [],
    expenses: expenses.data ?? [],
    debts: debts.data ?? [],
    assets: assets.data ?? [],
  } as unknown as BaselineRecord;

  const summary = summarize(fromRecord(record));
  const updated = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(record.household.updated_at));
  const greetingName = ctx.displayName ? `, ${ctx.displayName}` : '';
  const tx = (monthTx.data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
  const t = totals(tx);
  const lines = budgetLines((budgets.data ?? []).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) })), tx).filter((l) => l.limit > 0);
  const over = lines.filter((l) => l.status === 'lewat').length;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold tracking-tight sm:text-[26px]">Kondisi keuangan keluarga{greetingName}</h1>
          <p className="text-muted">Saldo rekening per hari ini; pemasukan dan pengeluaran rutin dari kondisi awal yang diperbarui {updated}.</p>
        </div>
        {ctx.role === 'owner' ? <EditBaselineButton record={record} /> : null}
      </div>

      <SummaryView s={summary} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="bulan-h" className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="bulan-h" className="text-base font-semibold">Uang keluar-masuk {monthLabel(month)}</h2>
            <Link href="/transaksi" className="link inline-flex min-h-11 items-center text-sm">Semua transaksi</Link>
          </div>
          {tx.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted">Belum ada transaksi tercatat bulan ini.</p>
              {canWrite(ctx.role) ? <Link href="/transaksi/baru" className="btn btn-primary self-start">Catat transaksi</Link> : null}
            </div>
          ) : (
            <dl className="num grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5">
              <dt className="text-muted">Masuk</dt>
              <dd className="text-right font-semibold text-up">{formatRupiah(t.masuk)}</dd>
              <dt className="text-muted">Keluar</dt>
              <dd className="text-right font-semibold">{formatRupiah(-t.keluar)}</dd>
              <dt className="border-t border-line pt-2.5 text-muted">Selisih</dt>
              <dd className={`border-t border-line pt-2.5 text-right font-semibold ${t.net < 0 ? 'text-down' : 'text-up'}`}>{formatRupiah(t.net)}</dd>
            </dl>
          )}
        </section>

        <section aria-labelledby="anggaran-h" className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="anggaran-h" className="text-base font-semibold">Anggaran vs realisasi</h2>
            <Link href="/anggaran" className="link inline-flex min-h-11 items-center text-sm">{lines.length ? 'Atur anggaran' : 'Buat anggaran'}</Link>
          </div>
          {lines.length === 0 ? (
            <p className="text-muted">Belum ada batas pengeluaran. Buat dari pengeluaran rutin di kondisi awal dalam satu klik.</p>
          ) : (
            <>
              {over > 0 ? <p className="text-[14px] text-down">{over} kategori melewati batas bulan ini.</p> : null}
              <ul className="flex flex-col gap-3.5">
                {lines.slice(0, 4).map((l) => (
                  <li key={l.category}><BudgetBar line={l} compact /></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <List title="Rekening & kas" empty="Belum ada rekening." href="/transaksi"
          rows={record.accounts.map((r) => ({ label: r.name, meta: ACCOUNT_KINDS[r.kind], value: Number(r.balance), tag: r.is_emergency ? 'Dana darurat' : undefined }))} />
        <List title="Pemasukan per bulan" empty="Belum ada pemasukan."
          rows={record.incomes.map((r) => ({ label: r.name, meta: r.earner ?? undefined, value: Number(r.monthly_amount) }))} />
        <List title="Pengeluaran per bulan" empty="Belum ada pengeluaran."
          rows={record.expenses.map((r) => ({ label: r.category, meta: r.is_routine ? 'Rutin' : 'Tidak rutin', value: Number(r.monthly_amount) }))} />
        <List title="Utang" empty="Tidak ada utang yang dicatat."
          rows={record.debts.map((r) => ({ label: r.name, meta: `${DEBT_KINDS[r.kind]} · cicilan ${formatRupiah(Number(r.monthly_installment))}/bln`, value: Number(r.principal_remaining) }))} />
        <List title="Aset & investasi" empty="Tidak ada aset yang dicatat."
          rows={record.assets.map((r) => ({ label: r.name, meta: ASSET_KINDS[r.kind], value: Number(r.current_value) }))} />
      </div>
    </div>
  );
}
