'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconList, IconTarget } from '@/components/icons';

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconHome },
  { href: '/transaksi', label: 'Transaksi', Icon: IconList },
  { href: '/anggaran', label: 'Anggaran', Icon: IconTarget },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <ul className="flex gap-1 min-[820px]:flex-col">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <li key={href} className="min-w-0 flex-1 min-[820px]:flex-none">
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-2 text-sm no-underline min-[820px]:justify-start min-[820px]:gap-2.5 min-[820px]:px-3 ${
                active
                  ? 'bg-accent font-semibold text-white shadow-[0_8px_20px_rgba(109,74,255,0.32)]'
                  : 'font-medium text-[#a3a9c6] hover:bg-hover hover:text-white'
              }`}
            >
              <Icon />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
