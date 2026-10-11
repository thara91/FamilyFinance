import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canWrite, getAccounts, getCustomCategories, getHousehold } from '@/lib/household';
import { categoriesFor, jakartaToday } from '@/lib/transactions';
import { aiConfigured } from '@/lib/ai';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { IconBack } from '@/components/icons';

export const metadata: Metadata = { title: 'Catat transaksi' };
export const dynamic = 'force-dynamic';

export default async function NewTransactionPage() {
  const ctx = await getHousehold('/transaksi/baru');
  if (!ctx.household || !canWrite(ctx.role)) redirect('/transaksi');
  const [accounts, custom] = await Promise.all([getAccounts(ctx), getCustomCategories(ctx)]);
  const today = jakartaToday();
  const keluar = categoriesFor('keluar', custom);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/transaksi" className="link inline-flex min-h-11 items-center gap-1 self-start text-sm"><IconBack size={16} />Transaksi</Link>
        <h1 className="text-[24px] font-bold tracking-tight sm:text-[26px]">Catat transaksi</h1>
      </div>
      <TransactionForm
        aiReady={aiConfigured}
        today={today}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={{ masuk: categoriesFor('masuk'), keluar }}
        initial={{
          occurredOn: today,
          direction: 'keluar',
          amount: 0,
          category: keluar[0],
          description: '',
          accountId: accounts.length === 1 ? accounts[0].id : '',
          note: '',
        }}
      />
    </div>
  );
}
