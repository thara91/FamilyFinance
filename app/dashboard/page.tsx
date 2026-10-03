import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { ACCOUNT_KINDS, ASSET_KINDS, DEBT_KINDS, fromRecord, summarize, type BaselineRecord } from '@/lib/baseline';
import { formatRupiah } from '@/lib/money';
import { Logo } from '@/components/Logo';
import { SummaryView } from '@/components/SummaryView';
import { EditBaselineButton } from '@/components/dashboard/EditBaselineButton';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

function Shell({ subtitle, actions, children }: { subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pb-16 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
        <Logo subtitle={subtitle} />
        <div className="flex items-center gap-2">
          {actions}
          <form action="/auth/keluar" method="post">
            <button type="submit" className="btn">Keluar</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

function List({ title, empty, rows }: { title: string; empty: string; rows: { label: string; meta?: string; value: number }[] }) {
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
                <span className="break-words">{r.label}</span>
                {r.meta ? <span className="text-[13px] text-muted">{r.meta}</span> : null}
              </span>
              <span className="num shrink-0 whitespace-nowrap font-semibold">{formatRupiah(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  if (!supabaseConfigured) {
    return (
      <Shell>
        <div role="alert" className="card flex flex-col gap-2">
          <h1 className="text-xl font-bold">Supabase belum terhubung</h1>
          <p className="text-muted">Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, lalu muat ulang halaman.</p>
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect('/masuk?next=/dashboard');

  const { data: membership, error: memberError } = await supabase
    .from('household_members')
    .select('household_id, role, display_name')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);

  if (!membership) {
    return (
      <Shell>
        <section className="card mx-auto mt-8 flex w-full max-w-[560px] flex-col gap-4 p-6 sm:p-8">
          <h1 className="text-[22px] font-bold">Kondisi keuangan awal belum diisi</h1>
          <p className="text-muted">
            Dashboard ini dihitung dari rekening, pemasukan, pengeluaran rutin, utang, dan aset keluarga. Isi sekali, lalu perbarui bila ada perubahan
            besar.
          </p>
          <Link href="/mulai" className="btn btn-primary self-start">Isi kondisi keuangan awal</Link>
        </section>
      </Shell>
    );
  }

  const hid = membership.household_id;
  const [household, accounts, incomes, expenses, debts, assets] = await Promise.all([
    supabase.from('households').select('name, dependents, emergency_target_months, updated_at').eq('id', hid).single(),
    supabase.from('accounts').select('name, kind, balance').eq('household_id', hid).order('balance', { ascending: false }),
    supabase.from('income_sources').select('name, earner, monthly_amount').eq('household_id', hid).order('monthly_amount', { ascending: false }),
    supabase.from('monthly_expenses').select('category, monthly_amount').eq('household_id', hid).order('monthly_amount', { ascending: false }),
    supabase.from('debts').select('name, kind, principal_remaining, monthly_installment').eq('household_id', hid).order('principal_remaining', { ascending: false }),
    supabase.from('assets').select('name, kind, current_value').eq('household_id', hid).order('current_value', { ascending: false }),
  ]);
  const failed = [household, accounts, incomes, expenses, debts, assets].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const record: BaselineRecord = {
    household: household.data!,
    ownerName: membership.display_name,
    accounts: accounts.data ?? [],
    incomes: incomes.data ?? [],
    expenses: expenses.data ?? [],
    debts: debts.data ?? [],
    assets: assets.data ?? [],
  } as BaselineRecord;

  const summary = summarize(fromRecord(record));
  const updated = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(record.household.updated_at));
  const greetingName = membership.display_name ? `, ${membership.display_name}` : '';

  return (
    <Shell subtitle={record.household.name} actions={membership.role === 'owner' ? <EditBaselineButton record={record} /> : null}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold tracking-tight sm:text-[26px]">Kondisi keuangan keluarga{greetingName}</h1>
        <p className="text-muted">Berdasarkan kondisi awal yang diperbarui {updated}.</p>
      </div>

      <SummaryView s={summary} />

      <div className="grid gap-5 md:grid-cols-2">
        <List title="Rekening & kas" empty="Belum ada rekening."
          rows={record.accounts.map((r) => ({ label: r.name, meta: ACCOUNT_KINDS[r.kind], value: Number(r.balance) }))} />
        <List title="Pemasukan per bulan" empty="Belum ada pemasukan."
          rows={record.incomes.map((r) => ({ label: r.name, meta: r.earner ?? undefined, value: Number(r.monthly_amount) }))} />
        <List title="Pengeluaran rutin per bulan" empty="Belum ada pengeluaran rutin."
          rows={record.expenses.map((r) => ({ label: r.category, value: Number(r.monthly_amount) }))} />
        <List title="Utang" empty="Tidak ada utang yang dicatat."
          rows={record.debts.map((r) => ({ label: r.name, meta: `${DEBT_KINDS[r.kind]} · cicilan ${formatRupiah(Number(r.monthly_installment))}/bln`, value: Number(r.principal_remaining) }))} />
        <List title="Aset & investasi" empty="Tidak ada aset yang dicatat."
          rows={record.assets.map((r) => ({ label: r.name, meta: ASSET_KINDS[r.kind], value: Number(r.current_value) }))} />
      </div>
    </Shell>
  );
}
