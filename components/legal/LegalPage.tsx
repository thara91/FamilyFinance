import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { SITE } from '@/lib/site';

export function LegalPage({ title, other, children }: { title: string; other: { href: string; label: string }; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col px-4 pb-16 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-4 sm:py-6">
        <Logo />
        <Link href={other.href} className="link inline-flex min-h-11 items-center text-sm">{other.label}</Link>
      </header>
      <main className="flex flex-col gap-2 pt-4">
        <h1 className="text-[28px] font-bold tracking-tight sm:text-[32px]">{title}</h1>
        <p className="text-[13px] text-muted">Berlaku sejak {SITE.legalEffectiveDate}</p>
        <div className="legal mt-6 flex flex-col gap-8 text-[15px] leading-relaxed text-label">{children}</div>
      </main>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted">{children}</ul>;
}

export function Contact() {
  return (
    <p>
      {SITE.operatorName}, email <span className="font-semibold text-ink">{SITE.contactEmail}</span>.
    </p>
  );
}
