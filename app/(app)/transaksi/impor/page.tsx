import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { aiConfigured } from '@/lib/ai';
import { canWrite, getAccounts, getCustomCategories, getHousehold } from '@/lib/household';
import { categoriesFor, jakartaToday } from '@/lib/transactions';
import { StatementImport } from '@/components/transactions/StatementImport';
import { IconBack } from '@/components/icons';

export const metadata: Metadata = { title: 'Impor e-statement' };
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const ctx = await getHousehold('/transaksi/impor');
  if (!ctx.household || !canWrite(ctx.role)) redirect('/transaksi');
  const [accounts, custom] = await Promise.all([getAccounts(ctx), getCustomCategories(ctx)]);

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/transaksi" className="link inline-flex min-h-11 items-center gap-1 self-start text-sm"><IconBack size={16} />Transaksi</Link>
        <h1 className="text-[24px] font-bold tracking-tight sm:text-[26px]">Impor e-statement</h1>
        <p className="max-w-[64ch] text-muted">
          Unggah PDF mutasi rekening dari aplikasi atau email bank. Setiap baris dibaca dan diberi kategori, lalu Anda periksa sebelum disimpan.
          PDF hanya dibaca, tidak disimpan.
        </p>
      </div>
      {accounts.length === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <p className="font-semibold">Belum ada rekening untuk menampung transaksi.</p>
          <p className="text-muted">Tambahkan rekening lewat Perbarui kondisi awal di dashboard.</p>
          <Link href="/dashboard" className="btn">Ke dashboard</Link>
        </div>
      ) : (
        <StatementImport
          aiReady={aiConfigured}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, balanceDate: jakartaToday(new Date(a.balance_set_at)) }))}
          categories={{ masuk: categoriesFor('masuk'), keluar: categoriesFor('keluar', custom) }}
        />
      )}
    </div>
  );
}
