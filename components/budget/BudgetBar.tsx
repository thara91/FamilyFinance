import type { BudgetLine } from '@/lib/transactions';
import { formatPercent, formatRupiah } from '@/lib/money';

const fill = { aman: 'bg-accent', hampir: 'bg-warn', lewat: 'bg-down' } as const;

/** One category against its monthly limit; `elapsed` draws where the month is, so pace is visible. */
export function BudgetBar({ line, compact, elapsed }: { line: BudgetLine; compact?: boolean; elapsed?: number }) {
  const width = Math.min(1, line.ratio) * 100;
  const left = line.limit - line.spent;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className={compact ? 'text-[14px]' : 'font-semibold'}>{line.category}</span>
        <span className={`num text-[13px] ${line.status === 'lewat' ? 'text-down' : 'text-muted'}`}>
          {formatRupiah(line.spent)} / {formatRupiah(line.limit)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${line.category}: terpakai ${formatPercent(line.ratio)} dari batas`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(1, line.ratio) * 100)}
        className="relative h-2 rounded-full bg-line"
      >
        <div className={`h-full rounded-full ${fill[line.status]}`} style={{ width: `${width}%` }} />
        {elapsed !== undefined && elapsed > 0 && elapsed < 1 ? (
          <span aria-hidden="true" className="absolute -top-1 h-4 w-0.5 rounded bg-label" style={{ left: `${elapsed * 100}%` }} />
        ) : null}
      </div>
      {!compact ? (
        <span className={`num text-[13px] ${line.status === 'lewat' ? 'text-down' : line.status === 'hampir' ? 'text-warn' : 'text-muted'}`}>
          {line.status === 'lewat' ? `Lewat ${formatRupiah(-left)}` : `Sisa ${formatRupiah(left)}`} · terpakai {formatPercent(line.ratio)}
        </span>
      ) : null}
    </div>
  );
}
