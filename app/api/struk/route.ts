import { NextResponse, type NextRequest } from 'next/server';
import { aiConfigured, explainAiError, readReceipt } from '@/lib/ai';
import { canWrite, getCustomCategories, getHousehold } from '@/lib/household';
import { categoriesFor, jakartaToday } from '@/lib/transactions';

export const maxDuration = 60;

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
const MAX_BYTES = 4 * 1024 * 1024;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Stores the photo in the household's receipt folder, then asks Claude to read it. The photo is kept even if reading fails. */
export async function POST(request: NextRequest) {
  const ctx = await getHousehold('/transaksi/baru').catch(() => null);
  if (!ctx) return fail(401, 'Sesi Anda berakhir. Masuk lagi, lalu ulangi.');
  if (!ctx.household || !canWrite(ctx.role)) return fail(403, 'Akun Anda tidak bisa mencatat transaksi.');

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob) || file.size === 0) return fail(400, 'Foto struk tidak ikut terkirim. Pilih fotonya lagi.');
  const ext = TYPES[file.type as keyof typeof TYPES];
  if (!ext) return fail(415, 'Pakai foto JPG, PNG, atau WebP.');
  if (file.size > MAX_BYTES) return fail(413, 'Foto lebih dari 4 MB. Ambil ulang dengan resolusi lebih kecil.');

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.household.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await ctx.supabase.storage.from('receipts').upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error('receipt upload', upErr.message);
    return fail(500, /bucket/i.test(upErr.message)
      ? 'Tempat penyimpanan struk belum disiapkan di Supabase. Jalankan migrasi terbaru.'
      : 'Foto gagal disimpan. Coba lagi.');
  }

  if (!aiConfigured) {
    return NextResponse.json({ path, fields: null, notice: 'Foto tersimpan sebagai lampiran. Isi transaksinya di bawah.' });
  }

  try {
    const custom = await getCustomCategories(ctx);
    const fields = await readReceipt(bytes, file.type as keyof typeof TYPES, categoriesFor('keluar', custom), jakartaToday());
    return NextResponse.json({ path, fields });
  } catch (err) {
    return NextResponse.json({ path, fields: null, notice: `Foto tersimpan sebagai lampiran, tapi isinya belum terbaca: ${explainAiError(err)}` });
  }
}
