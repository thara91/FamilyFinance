import { NextResponse, type NextRequest } from 'next/server';
import { aiConfigured, explainAiError, readStatement } from '@/lib/ai';
import { canWrite, getCustomCategories, getHousehold } from '@/lib/household';
import { UUID, categoriesFor, importRefs } from '@/lib/transactions';

export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024;
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Reads an e-statement PDF and returns rows for review. The PDF is never stored. */
export async function POST(request: NextRequest) {
  const ctx = await getHousehold('/transaksi/impor').catch(() => null);
  if (!ctx) return fail(401, 'Sesi Anda berakhir. Masuk lagi, lalu ulangi.');
  if (!ctx.household || !canWrite(ctx.role)) return fail(403, 'Akun Anda tidak bisa mengimpor transaksi.');
  if (!aiConfigured) return fail(503, 'Pembacaan e-statement belum aktif: ANTHROPIC_API_KEY belum diisi di pengaturan Vercel.');

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const accountId = String(form?.get('accountId') ?? '');
  if (!UUID.test(accountId)) return fail(400, 'Pilih rekening pemilik e-statement ini.');
  if (!(file instanceof Blob) || file.size === 0) return fail(400, 'File PDF tidak ikut terkirim. Pilih filenya lagi.');
  if (file.size > MAX_BYTES) return fail(413, 'PDF lebih dari 4 MB. Unduh e-statement per bulan, lalu impor satu per satu.');

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return fail(415, 'File ini bukan PDF. Unduh e-statement dalam format PDF dari aplikasi atau email bank.');
  // Bank e-statements are often locked with a date-of-birth password; Claude cannot open encrypted PDFs.
  if (/\/Encrypt\s/.test(bytes.toString('latin1'))) {
    return fail(422, 'PDF ini dikunci kata sandi. Buka di aplikasi PDF dengan kata sandinya, pilih Cetak > Simpan sebagai PDF, lalu impor file hasilnya.');
  }

  const { data: account } = await ctx.supabase.from('accounts').select('id').eq('id', accountId).eq('household_id', ctx.household.id).maybeSingle();
  if (!account) return fail(400, 'Rekening tidak ditemukan. Muat ulang halaman.');

  try {
    const custom = await getCustomCategories(ctx);
    const result = await readStatement(bytes, { masuk: categoriesFor('masuk'), keluar: categoriesFor('keluar', custom) });
    const refs = importRefs(accountId, result.rows);
    const { data: existing } = refs.length
      ? await ctx.supabase.from('transactions').select('import_ref').eq('household_id', ctx.household.id).in('import_ref', refs)
      : { data: [] };
    const seen = new Set((existing ?? []).map((r) => r.import_ref as string));
    return NextResponse.json({ ...result, rows: result.rows.map((r, i) => ({ ...r, duplicate: seen.has(refs[i]) })) });
  } catch (err) {
    return fail(502, explainAiError(err));
  }
}
