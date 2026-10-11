import { Logo } from '@/components/Logo';
import { NavLinks } from '@/components/app/NavLinks';
import { IconLogout } from '@/components/icons';
import { getHousehold } from '@/lib/household';
import { supabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <>{children}</>;
  const ctx = await getHousehold('/dashboard');
  const who = ctx.displayName ?? ctx.email ?? 'Akun Anda';
  const roleLabel = { owner: 'Pemilik', member: 'Anggota', viewer: 'Hanya lihat' }[ctx.role ?? 'owner'];

  return (
    <div className="min-h-dvh min-[820px]:grid min-[820px]:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-[#1c2140] bg-sidebar min-[820px]:border-r min-[820px]:border-b-0">
        <div className="flex flex-col gap-3 px-3 py-3 min-[820px]:sticky min-[820px]:top-0 min-[820px]:h-dvh min-[820px]:gap-5 min-[820px]:px-4 min-[820px]:py-5">
          <div className="flex items-center justify-between gap-3 px-1">
            <Logo subtitle={ctx.household?.name || undefined} />
            <form action="/auth/keluar" method="post" className="min-[820px]:hidden">
              <button type="submit" className="btn size-11 p-0" aria-label="Keluar">
                <IconLogout />
              </button>
            </form>
          </div>
          <nav aria-label="Menu utama">
            <NavLinks />
          </nav>
          <div className="mt-auto hidden items-center gap-3 border-t border-[#1c2140] px-1 pt-4 min-[820px]:flex">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#2e2766] text-sm font-bold text-[#dcd5ff]">
              {who.slice(0, 1).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{who}</span>
              <span className="text-xs text-muted">{roleLabel}</span>
            </span>
            <form action="/auth/keluar" method="post">
              <button type="submit" className="btn size-11 p-0" aria-label="Keluar">
                <IconLogout />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 px-4 pb-16 pt-5 sm:px-8 sm:pt-7">{children}</div>
    </div>
  );
}
