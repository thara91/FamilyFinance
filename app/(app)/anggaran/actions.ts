'use server';

import { revalidatePath } from 'next/cache';
import { canWrite, getHousehold } from '@/lib/household';
import { parseRupiah } from '@/lib/money';

export interface BudgetState {
  error?: string;
  saved?: boolean;
}

/** Form fields come in pairs: cat-N (category name) and limit-N (rupiah). A blank or zero limit removes that budget. */
export async function saveBudgets(_prev: BudgetState, form: FormData): Promise<BudgetState> {
  const ctx = await getHousehold('/anggaran');
  if (!ctx.household || !canWrite(ctx.role)) return { error: 'Akun Anda hanya bisa melihat anggaran.' };

  const keep: { household_id: string; category: string; monthly_limit: number; updated_at: string }[] = [];
  const drop: string[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('cat-')) continue;
    const category = String(value).trim().slice(0, 60);
    if (!category) continue;
    const limit = parseRupiah(String(form.get(`limit-${key.slice(4)}`) ?? ''));
    if (limit > 0) keep.push({ household_id: ctx.household.id, category, monthly_limit: limit, updated_at: new Date().toISOString() });
    else drop.push(category);
  }
  if (keep.length > 60) return { error: 'Maksimal 60 kategori anggaran.' };

  if (keep.length) {
    const { error } = await ctx.supabase.from('budgets').upsert(keep, { onConflict: 'household_id,category' });
    if (error) return { error: `Anggaran belum tersimpan: ${error.message}` };
  }
  if (drop.length) {
    const { error } = await ctx.supabase.from('budgets').delete().eq('household_id', ctx.household.id).in('category', drop);
    if (error) return { error: `Sebagian batas belum terhapus: ${error.message}` };
  }

  revalidatePath('/anggaran');
  revalidatePath('/dashboard');
  return { saved: true };
}
