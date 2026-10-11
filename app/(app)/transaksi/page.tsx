import type { Metadata } from 'next';
import Link from 'next/link';
import { ACCOUNT_KINDS, type AccountKind } from '@/lib/baseline';
import { canWrite, getAccounts, getCustomCategories, getHousehold } from '@/lib/household';
import { formatRupiah } from '@/lib/money';
import {
  categoriesFor, dayLabel, jakartaToday, monthLabel, monthRange, parseMonth, shiftMonth, totals, type Direction,
} from '@/lib/transactions';
import { IconBack, IconCamera, IconFile, IconNext, IconPlus, IconReceipt, IconSearch } from '@/components/icons';

export const metadata: Metadata = { title: 'Transaksi' };
export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;

const NOTICE: Record<string, string> = {
  baru: 'Transaksi tersimpan.',
  ubah: 'Perubahan tersimpan.',
  hapus: 'Transaksi dihapus.',
};

function query(base: Params, patch: Params): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/transaksi?${s}` : '/transaksi';
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const ctx = await getHousehold('/transaksi');
  if (!ctx.household) {
    return (
      <section className="card mx-auto mt-8 flex max-w-[560px] flex-col gap-4 p-6">
        <h1 className="text-[22px] font-bold">Isi kondisi keuangan awal dulu</h1>
        <p className="text-muted">Transaksi dicatat ke rekening keluarga. Rekening dibuat saat Anda mengisi kondisi keuangan awal.</p>
        <Link href="/mulai" className="btn btn-primary self-start">Isi kondisi keuangan awal</Link>
      </section>
    );
  }

  const today = jakartaToday();
  const month = parseMonth(params.bulan, today);
  const range = monthRange(month);
  const jenis = params.jenis === 'masuk' || params.jenis === 'keluar' ? (params.jenis as Direction) : undefined;
  const kategori = params.kategori?.slice(0, 60) || undefined;
  const q = params.q?.trim().slice(0, 60) || undefined;
  const filtered = Boolean(jenis || kategori || q);
  const keep: Params = { bulan: month === today.slice(0, 7) ? undefined : month, jenis, kategori, q };

  let req = ctx.supabase
    .from('transactions')
    .select('id, occurred_on, direction, amount, category, description, account_id, source, receipt_path')
    .eq('household_id', ctx.household.id)
    .gte('occurred_on', range.from)
    .lt('occurred_on', range.to)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (jenis) req = req.eq('direction', jenis);
  if (kategori) req = req.eq('category', kategori);
  if (q) req = req.ilike('description', `%${q.replace(/[%_]/g, '')}%`);

  const [{ data, error }, accounts, custom] = await Promise.all([req, getAccounts(ctx), getCustomCategories(ctx)]);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
  const t = totals(rows);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) byDay.set(r.occurred_on, [...(byDay.get(r.occurred_on) ?? []), r]);
  const writable = canWrite(ctx.role);
  const allCategories = [...new Set([...categoriesFor('masuk'), ...categoriesFor('keluar', custom)])];
  const notice = params.tersimpan === 'impor' ? `${params.jumlah ?? 'Beberapa'} transaksi dari e-statement tersimpan.` : params.tersimpan ? NOTICE[params.tersimpan] : undefined;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold tracking-tight sm:text-[26px]">Transaksi</h1>
          <p className="text-muted">Setiap transaksi mengubah saldo rekeningnya dan dihitung ke anggaran bulan itu.</p>
        </div>
        {writable ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/transaksi/impor" className="btn"><IconFile />Impor e-statement</Link>
            <Link href="/transaksi/baru#struk" className="btn"><IconCamera />Pindai struk</Link>
            <Link href="/transaksi/baru" className="btn btn-primary"><IconPlus />Catat transaksi</Link>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="rounded-[10px] border border-up/40 bg-up/10 px-4 py-3 text-[14px]">{notice}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label={`Ringkasan ${monthLabel(month)}`} className="card flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <Link href={query(keep, { bulan: shiftMonth(month, -1) })} className="btn size-11 p-0" aria-label={`Bulan sebelumnya, ${monthLabel(shiftMonth(month, -1))}`}>
                <IconBack />
              </Link>
              <h2 className="text-base font-semibold">{monthLabel(month)}</h2>
              <Link href={query(keep, { bulan: shiftMonth(month, 1) })} className="btn size-11 p-0" aria-label={`Bulan berikutnya, ${monthLabel(shiftMonth(month, 1))}`}>
                <IconNext />
              </Link>
            </div>
            <dl className="num grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
              <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Masuk</dt><dd className="font-semibold text-up">{formatRupiah(t.masuk)}</dd></div>
              <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Keluar</dt><dd className="font-semibold">{formatRupiah(t.keluar)}</dd></div>
              <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">Selisih</dt><dd className={`font-semibold ${t.net < 0 ? 'text-down' : 'text-up'}`}>{formatRupiah(t.net)}</dd></div>
            </dl>
            {filtered ? <p className="text-center text-[13px] text-muted">Angka di atas hanya untuk transaksi yang cocok dengan filter.</p> : null}
          </section>

          <form method="get" action="/transaksi" className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" role="search" aria-label="Saring transaksi">
            {keep.bulan ? <input type="hidden" name="bulan" value={keep.bulan} /> : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-q" className="text-[13px] font-semibold text-label">Cari keterangan</label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input id="f-q" name="q" defaultValue={q} className="input pl-10" placeholder="Contoh: Indomaret" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-jenis" className="text-[13px] font-semibold text-label">Jenis</label>
              <select id="f-jenis" name="jenis" defaultValue={jenis ?? ''} className="input">
                <option value="">Semua</option>
                <option value="masuk">Uang masuk</option>
                <option value="keluar">Uang keluar</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-kat" className="text-[13px] font-semibold text-label">Kategori</label>
              <select id="f-kat" name="kategori" defaultValue={kategori ?? ''} className="input">
                <option value="">Semua kategori</option>
                {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn flex-1 sm:flex-none">Saring</button>
              {filtered ? <Link href={query({ bulan: keep.bulan }, {})} className="btn flex-1 sm:flex-none">Hapus filter</Link> : null}
            </div>
          </form>

          {rows.length === 0 ? (
            <div className="card flex flex-col items-start gap-3">
              {filtered ? (
                <>
                  <p className="font-semibold">Tidak ada transaksi yang cocok di {monthLabel(month)}.</p>
                  <p className="text-muted">Coba kata lain atau hapus filter.</p>
                  <Link href={query({ bulan: keep.bulan }, {})} className="btn">Hapus filter</Link>
                </>
              ) : (
                <>
                  <p className="font-semibold">Belum ada transaksi di {monthLabel(month)}.</p>
                  <p className="text-muted">Catat satu per satu, pindai foto struk, atau impor e-statement bank untuk mengisi sebulan sekaligus.</p>
                  {writable ? <Link href="/transaksi/baru" className="btn btn-primary"><IconPlus />Catat transaksi</Link> : null}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {[...byDay.entries()].map(([day, list]) => (
                <section key={day} aria-label={dayLabel(day)} className="card p-0">
                  <h3 className="border-b border-line px-5 py-3 text-[13px] font-semibold text-muted">{dayLabel(day)}</h3>
                  <ul>
                    {list.map((r) => (
                      <li key={r.id} className="border-t border-line first:border-t-0">
                        <Link
                          href={`/transaksi/${r.id}`}
                          className="flex min-h-14 items-center gap-3 px-5 py-3 text-ink no-underline hover:bg-hover"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="break-words font-medium">{r.description}</span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                              <span>{r.category}</span>
                              {r.account_id && accountName.get(r.account_id) ? <span>· {accountName.get(r.account_id)}</span> : null}
                              {r.source === 'struk' ? <span className="inline-flex items-center gap-1">· <IconReceipt size={14} />Struk</span> : null}
                              {r.source === 'mutasi' ? <span>· Dari e-statement</span> : null}
                            </span>
                          </span>
                          <span className={`num shrink-0 whitespace-nowrap font-semibold ${r.direction === 'masuk' ? 'text-up' : ''}`}>
                            {r.direction === 'masuk' ? '+' : '−'}{formatRupiah(r.amount)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside aria-labelledby="saldo-h" className="card flex h-fit flex-col gap-2">
          <h2 id="saldo-h" className="text-base font-semibold">Saldo rekening hari ini</h2>
          {accounts.length === 0 ? (
            <p className="text-[14px] text-muted">Belum ada rekening. Tambahkan lewat Perbarui kondisi awal di dashboard.</p>
          ) : (
            <ul>
              {accounts.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words">{a.name}</span>
                    <span className="text-[13px] text-muted">{ACCOUNT_KINDS[a.kind as AccountKind] ?? a.kind}</span>
                  </span>
                  <span className={`num shrink-0 whitespace-nowrap font-semibold ${a.current_balance < 0 ? 'text-down' : ''}`}>{formatRupiah(a.current_balance)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line pt-3 text-[13px] leading-snug text-muted">
            Saldo = saldo di kondisi awal + transaksi yang dicatat sesudahnya. Transaksi lama dari e-statement tidak menggandakan saldo.
          </p>
        </aside>
      </div>
    </div>
  );
}
