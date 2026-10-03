import Link from 'next/link';

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2.5 text-white no-underline">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-[#8b6cff] to-[#4f46e5] text-sm font-extrabold tracking-tight"
      >
        KK
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-bold">Kas Keluarga</span>
        {subtitle ? <span className="text-xs text-muted">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
