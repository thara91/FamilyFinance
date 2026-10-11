import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Role = 'owner' | 'member' | 'viewer';

export interface HouseholdContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  household: { id: string; name: string } | null;
  role: Role | null;
  displayName: string | null;
}

/** One lookup per request, shared by the app layout and the page it wraps. */
export const getHousehold = cache(async (next: string): Promise<HouseholdContext> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/masuk?next=${encodeURIComponent(next)}`);

  const { data: m, error } = await supabase
    .from('household_members')
    .select('household_id, role, display_name')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  let name = '';
  if (m) {
    const { data: h } = await supabase.from('households').select('name').eq('id', m.household_id).single();
    name = (h?.name as string | undefined) ?? '';
  }
  return {
    supabase,
    userId,
    email: (data?.claims?.email as string | undefined) ?? null,
    household: m ? { id: m.household_id as string, name } : null,
    role: (m?.role as Role | undefined) ?? null,
    displayName: (m?.display_name as string | null) ?? null,
  };
});

export function canWrite(role: Role | null): boolean {
  return role === 'owner' || role === 'member';
}

export interface AccountBalance {
  id: string;
  name: string;
  kind: string;
  is_emergency: boolean;
  opening_balance: number;
  balance_set_at: string;
  current_balance: number;
}

export async function getAccounts(ctx: HouseholdContext): Promise<AccountBalance[]> {
  if (!ctx.household) return [];
  const { data, error } = await ctx.supabase
    .from('account_balances')
    .select('id, name, kind, is_emergency, opening_balance, balance_set_at, current_balance')
    .eq('household_id', ctx.household.id)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({ ...a, opening_balance: Number(a.opening_balance), current_balance: Number(a.current_balance) })) as AccountBalance[];
}

export async function getCustomCategories(ctx: HouseholdContext): Promise<string[]> {
  if (!ctx.household) return [];
  const { data } = await ctx.supabase.from('monthly_expenses').select('category').eq('household_id', ctx.household.id);
  return (data ?? []).map((r) => r.category as string);
}
