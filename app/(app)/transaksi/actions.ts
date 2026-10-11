'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canWrite, getHousehold } from '@/lib/household';
import { parseRupiah } from '@/lib/money';
import {
  UUID, importRefs, isIsoDate, jakartaToday, validateTransaction,
  type Direction, type StatementRow, type TransactionInput, type TxErrors,
} from '@/lib/transactions';

export interface FormState {
  errors: TxErrors & { form?: string };
  values?: Record<string, string>;
}

function readForm(form: FormData): TransactionInput {
  const accountId = String(form.get('accountId') ?? '');
  return {
    occurredOn: String(form.get('occurredOn') ?? ''),
    direction: String(form.get('direction') ?? '') as Direction,
    amount: parseRupiah(String(form.get('amount') ?? '')),
    category: String(form.get('category') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    accountId: accountId === '' ? null : accountId,
    note: String(form.get('note') ?? '').trim(),
  };
}

function echo(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]));
}

/** Only accept receipt paths inside this household's folder; anything else is dropped, never trusted. */
function receiptPath(form: FormData, householdId: string): string | null {
  const p = String(form.get('receiptPath') ?? '');
  return p.startsWith(`${householdId}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(p) ? p : null;
}

function explain(message: string): string {
  if (/foreign key|violates/i.test(message)) return 'Rekening yang dipilih tidak ditemukan. Muat ulang halaman, lalu pilih lagi.';
  if (/row-level security|permission/i.test(message)) return 'Akun Anda hanya bisa melihat, tidak bisa mengubah transaksi.';
  return `Belum tersimpan: ${message}`;
}

export async function saveTransaction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await getHousehold('/transaksi');
  if (!ctx.household || !canWrite(ctx.role)) return { errors: { form: 'Akun Anda tidak bisa mencatat transaksi.' }, values: echo(form) };

  const id = String(form.get('id') ?? '');
  const input = readForm(form);
  const errors = validateTransaction(input, jakartaToday());
  if (Object.keys(errors).length > 0) return { errors, values: echo(form) };

  const source = String(form.get('source') ?? 'manual');
  const row = {
    household_id: ctx.household.id,
    account_id: input.accountId,
    occurred_on: input.occurredOn,
    direction: input.direction,
    amount: input.amount,
    category: input.category,
    description: input.description,
    note: input.note || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    if (!UUID.test(id)) return { errors: { form: 'Transaksi tidak ditemukan.' } };
    const { data, error } = await ctx.supabase.from('transactions').update(row).eq('id', id).eq('household_id', ctx.household.id).select('id');
    if (error) return { errors: { form: explain(error.message) }, values: echo(form) };
    if (!data?.length) return { errors: { form: 'Transaksi ini sudah dihapus atau tidak bisa Anda ubah.' }, values: echo(form) };
  } else {
    const receipt = receiptPath(form, ctx.household.id);
    const { error } = await ctx.supabase.from('transactions').insert({
      ...row,
      source: receipt && source === 'struk' ? 'struk' : 'manual',
      receipt_path: receipt,
    });
    if (error) return { errors: { form: explain(error.message) }, values: echo(form) };
  }

  revalidatePath('/transaksi');
  revalidatePath('/dashboard');
  revalidatePath('/anggaran');
  redirect(`/transaksi?bulan=${input.occurredOn.slice(0, 7)}&tersimpan=${id ? 'ubah' : 'baru'}`);
}

export async function deleteTransaction(form: FormData): Promise<void> {
  const ctx = await getHousehold('/transaksi');
  const id = String(form.get('id') ?? '');
  if (!ctx.household || !canWrite(ctx.role) || !UUID.test(id)) redirect('/transaksi');

  const { data } = await ctx.supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('household_id', ctx.household.id)
    .select('occurred_on, receipt_path');
  const removed = data?.[0];
  if (removed?.receipt_path) await ctx.supabase.storage.from('receipts').remove([removed.receipt_path as string]);

  revalidatePath('/transaksi');
  revalidatePath('/dashboard');
  revalidatePath('/anggaran');
  redirect(`/transaksi?bulan=${String(removed?.occurred_on ?? jakartaToday()).slice(0, 7)}&tersimpan=hapus`);
}

export interface ImportState {
  error?: string;
}

export async function importStatement(accountId: string, rows: StatementRow[]): Promise<ImportState> {
  const ctx = await getHousehold('/transaksi/impor');
  if (!ctx.household || !canWrite(ctx.role)) return { error: 'Akun Anda tidak bisa mengimpor transaksi.' };
  if (!UUID.test(accountId)) return { error: 'Pilih rekening tujuan impor.' };
  if (rows.length === 0) return { error: 'Pilih minimal satu baris untuk disimpan.' };
  if (rows.length > 500) return { error: 'Maksimal 500 baris sekali simpan. Pecah e-statement per bulan.' };

  const today = jakartaToday();
  const bad = rows.findIndex((r) => validateTransaction({
    occurredOn: r.date, direction: r.direction, amount: r.amount, category: r.category,
    description: r.description, accountId, note: '',
  }, today).occurredOn !== undefined || !isIsoDate(r.date) || !Number.isSafeInteger(r.amount) || r.amount <= 0);
  if (bad >= 0) return { error: `Baris ${bad + 1} tidak lengkap (tanggal atau jumlah). Hapus centangnya atau perbaiki e-statement.` };

  const refs = importRefs(accountId, rows);
  const { error } = await ctx.supabase.from('transactions').insert(rows.map((r, i) => ({
    household_id: ctx.household!.id,
    account_id: accountId,
    occurred_on: r.date,
    direction: r.direction,
    amount: r.amount,
    category: r.category.slice(0, 60) || 'Lainnya',
    description: r.description.trim().slice(0, 140) || '(tanpa keterangan)',
    source: 'mutasi',
    import_ref: refs[i],
  })));
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { error: 'Sebagian baris sudah pernah diimpor. Muat ulang e-statement agar baris yang sudah ada ditandai, lalu simpan lagi.' };
    return { error: explain(error.message) };
  }

  revalidatePath('/transaksi');
  revalidatePath('/dashboard');
  revalidatePath('/anggaran');
  const latest = rows.map((r) => r.date).sort().at(-1)!;
  redirect(`/transaksi?bulan=${latest.slice(0, 7)}&tersimpan=impor&jumlah=${rows.length}`);
}
