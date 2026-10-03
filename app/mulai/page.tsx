import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { Wizard } from '@/components/onboarding/Wizard';

export const metadata: Metadata = { title: 'Isi kondisi keuangan awal' };

export default function StartPage() {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pb-16 sm:px-8">
      <header className="flex items-center justify-between py-4 sm:py-6">
        <Logo subtitle="Kondisi keuangan awal" />
      </header>
      <Wizard />
    </div>
  );
}
