import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canWrite, getAccounts, getCustomCategories, getHousehold } from '@/lib/household';
import { formatRupiah } from '@/lib/money';
import { UUID, categoriesFor, dayLabel, jakartaToday, type Direction } from '@/lib/transactions';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { IconBack } from '@/components/icons';

export const metadata: Metadata = { title: 'Ubah transaksi' };
export const dynamic = 'force-dynamic';

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getHousehold(`/transaksi/${id}`);
  if (!ctx.household) notFound();

  const { data: tx } = await ctx.supabase
    .from('transactions')
    .select('id, occurred_on, direction, amount, category, description, account_id, note, source, receipt_path')
    .eq('id', id)
    .eq('household_id', ctx.household.id)
    .maybeSingle();
  if (!tx) notFound();

  const [accounts, custom, signed] = await Promise.all([
    getAccounts(ctx),
    getCustomCategories(ctx),
    tx.receipt_path ? ctx.supabase.storage.from('receipts').createSignedUrl(tx.receipt_path as string, 600) : Promise.resolve(null),
  ]);
  const receiptUrl = signed && 'data' in signed ? signed.data?.signedUrl ?? null : null;
  const amount = Number(tx.amount);
  const direction = tx.direction as Direction;

  const back = <Link href={`/transaksi?bulan=${String(tx.occurred_on).slice(0, 7)}`} className="link inline-flex min-h-11 items-center gap-1 self-start text-sm"><IconBack size={16} />Transaksi</Link>;

  if (!canWrite(ctx.role)) {
    return (
      <div className="mx-auto flex max-w-[760px] flex-col gap-5">
        {back}
        <section className="card flex flex-col gap-3">
          <h1 className="text-[22px] font-bold">{tx.description as string}</h1>
          <p className={`num text-2xl font-bold ${direction === 'masuk' ? 'text-up' : ''}`}>{direction === 'masuk' ? '+' : '−'}{formatRupiah(amount)}</p>
          <p className="text-muted">{dayLabel(tx.occurred_on as string)} · {tx.category as string}</p>
          {receiptUrl ? <img src={receiptUrl} alt="Foto struk transaksi ini" className="h-48 w-auto self-start rounded-[8px] border border-line object-contain" /> : null}
          <p className="text-[13px] text-muted">Akun Anda hanya bisa melihat transaksi.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        {back}
        <h1 className="text-[24px] font-bold tracking-tight sm:text-[26px]">Ubah transaksi</h1>
      </div>
      <TransactionForm
        today={jakartaToday()}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={{ masuk: categoriesFor('masuk'), keluar: categoriesFor('keluar', custom) }}
        receiptUrl={receiptUrl}
        source={tx.source as string}
        initial={{
          id: tx.id as string,
          occurredOn: tx.occurred_on as string,
          direction,
          amount,
          category: tx.category as string,
          description: tx.description as string,
          accountId: (tx.account_id as string | null) ?? '',
          note: (tx.note as string | null) ?? '',
        }}
      />
    </div>
  );
}
