import { ACCOUNT_KINDS, DEBT_RATIO_LIMIT, EARNING_STATUSES, signals, type Summary, type Tone } from '@/lib/baseline';
import { formatPercent, formatRupiah } from '@/lib/money';
import { IconAlert, IconCheck, IconDown } from './icons';

const toneText: Record<Tone, string> = { up: 'text-up', down: 'text-down', warn: 'text-warn' };
const toneIcon: Record<Tone, typeof IconCheck> = { up: IconCheck, down: IconDown, warn: IconAlert };

function Row({ label, value, tone }: { label: string; value: number; tone?: 'up' | 'down' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className={`num font-semibold ${tone === 'down' ? 'text-down' : tone === 'up' ? 'text-up' : ''}`}>{formatRupiah(value)}</span>
    </div>
  );
}

/** How each rupiah of income is used: routine spending, installments, what is left. */
function IncomeSplit({ s }: { s: Summary }) {
  if (s.income <= 0) return null;
  const share = (n: number) => Math.max(0, Math.min(1, n / s.income));
  const parts = [
    { label: 'Pengeluaran', ratio: share(s.expenses), color: 'bg-down' },
    { label: 'Cicilan', ratio: share(s.installments), color: 'bg-warn' },
    { label: 'Sisa', ratio: share(Math.max(0, s.freeCashflow)), color: 'bg-up' },
  ];
  const label = parts.map((p) => `${p.label} ${formatPercent(p.ratio)}`).join(', ');
  return (
    <div className="flex flex-col gap-2.5">
      <div role="img" aria-label={`Pembagian pemasukan: ${label}`} className="flex h-3 overflow-hidden rounded-full bg-line">
        {parts.map((p) => (
          <div key={p.label} className={`${p.color} h-full`} style={{ width: `${p.ratio * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-label">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`${p.color} inline-block size-2.5 rounded-[3px]`} />
            {p.label} <span className="num text-muted">{formatPercent(p.ratio)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SummaryView({ s }: { s: Summary }) {
  const e = s.emergency;
  const progress = e.target > 0 ? Math.min(1, e.saved / e.target) : 0;
  const readings = signals(s);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section aria-labelledby="nw-h" className="card flex flex-col gap-4 lg:row-span-2">
        <div className="flex flex-col gap-1">
          <h2 id="nw-h" className="text-[13px] font-semibold text-muted">Kekayaan bersih</h2>
          <p className={`num text-[32px] font-bold leading-tight tracking-tight sm:text-[40px] ${s.netWorth < 0 ? 'text-down' : ''}`}>
            {formatRupiah(s.netWorth)}
          </p>
          <p className="text-[13px] text-muted">Semua yang dimiliki dikurangi semua utang.</p>
        </div>
        <div>
          <Row label="Kas & rekening" value={s.cash} />
          <Row label="Aset & investasi" value={s.otherAssets} />
          <Row label="Sisa pokok utang" value={-s.totalDebt} tone={s.totalDebt > 0 ? 'down' : undefined} />
        </div>
        <ul className="flex flex-col gap-2.5 border-t border-line pt-4" aria-label="Catatan dari angka Anda">
          {readings.map((r) => {
            const Icon = toneIcon[r.tone];
            return (
              <li key={r.text} className="flex gap-2.5 text-[14px] leading-snug">
                <Icon className={`mt-0.5 shrink-0 ${toneText[r.tone]}`} />
                <span>{r.text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="cf-h" className="card flex flex-col gap-4">
        <h2 id="cf-h" className="text-base font-semibold">Arus kas per bulan</h2>
        <div>
          <Row label="Pemasukan" value={s.income} tone="up" />
          <Row label="Pengeluaran" value={-s.expenses} />
          <Row label="Cicilan utang" value={-s.installments} />
          <Row label="Sisa per bulan" value={s.freeCashflow} tone={s.freeCashflow < 0 ? 'down' : 'up'} />
        </div>
        <IncomeSplit s={s} />
      </section>

      <section aria-labelledby="ef-h" className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ef-h" className="text-base font-semibold">Dana darurat</h2>
          {e.status ? <span className="num text-[13px] text-muted">{EARNING_STATUSES[e.status].label} · {e.months}× pengeluaran rutin</span> : null}
        </div>
        {!e.status ? (
          <p className="text-muted">Pilih status di langkah Dana darurat untuk menghitung target.</p>
        ) : e.target === 0 ? (
          <p className="text-muted">Tandai pengeluaran rutin di langkah Pengeluaran untuk menghitung target.</p>
        ) : (
          <>
            <p className="num text-2xl font-bold">
              {formatRupiah(e.saved)} <span className="text-base font-medium text-muted">dari {formatRupiah(e.target)}</span>
            </p>
            <div
              role="progressbar"
              aria-label="Dana darurat terkumpul terhadap target"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="h-2 overflow-hidden rounded-full bg-line"
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
            </div>
            <dl className="num grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-muted">Pengeluaran rutin</dt>
              <dd className="text-right">{formatRupiah(e.routineSpending)}/bln</dd>
              <dt className="text-muted">Alokasi {formatPercent(e.allocationPct / 100)} pemasukan</dt>
              <dd className="text-right">{formatRupiah(e.monthlyAllocation)}/bln</dd>
              <dt className="text-muted">Perkiraan tercapai</dt>
              <dd className="text-right">{e.shortfall === 0 ? 'Sudah tercapai' : e.monthsToTarget === null ? 'Isi pemasukan' : `${e.monthsToTarget} bulan lagi`}</dd>
            </dl>
            {e.instruments.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Instrumen penampung dana darurat">
                {e.instruments.map((x, i) => (
                  <span key={`${x.name}-${i}`} className="rounded-full bg-up/15 px-2.5 py-1 text-xs font-semibold text-[#5ee3b0]">
                    {x.name} · {ACCOUNT_KINDS[x.kind]}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}
        {s.debtRatio !== null ? (
          <p className="num border-t border-line pt-3 text-[13px] text-muted">
            Rasio cicilan: <span className={`font-semibold ${s.debtRatio > DEBT_RATIO_LIMIT ? 'text-down' : 'text-ink'}`}>{formatPercent(s.debtRatio)}</span> dari pemasukan (batas {formatPercent(DEBT_RATIO_LIMIT)})
          </p>
        ) : null}
      </section>
    </div>
  );
}
