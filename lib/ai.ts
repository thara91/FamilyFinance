import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { ReceiptFields, StatementResult } from './ai-shared';
import { isIsoDate } from './transactions';

export const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2 });
  return client;
}

export class AiError extends Error {}

function toolInput(msg: Anthropic.Message, name: string): Record<string, unknown> {
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === name);
  if (!block) throw new AiError('Dokumen tidak berhasil dibaca. Coba foto atau file yang lebih jelas.');
  return block.input as Record<string, unknown>;
}

const wholeRupiah = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1e15 ? Math.round(n) : null;
};
const isoOrNull = (v: unknown): string | null => (typeof v === 'string' && isIsoDate(v) ? v : null);
const textOrNull = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const pick = (v: unknown, allowed: string[], fallback: string): string => (typeof v === 'string' && allowed.includes(v) ? v : fallback);

export async function readReceipt(image: Buffer, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', categories: string[], today: string): Promise<ReceiptFields> {
  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2000,
    tools: [{
      name: 'catat_struk',
      description: 'Record what a shop receipt says.',
      input_schema: {
        type: 'object',
        properties: {
          merchant: { type: ['string', 'null'], description: 'Shop or payee name as printed, short.' },
          date: { type: ['string', 'null'], description: 'Purchase date as YYYY-MM-DD, or null if not printed.' },
          total: { type: ['integer', 'null'], description: 'Final amount paid in whole rupiah, after discounts and tax.' },
          category: { type: 'string', enum: categories },
          items: {
            type: 'array',
            maxItems: 30,
            items: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'integer' } }, required: ['name', 'amount'] },
          },
        },
        required: ['merchant', 'date', 'total', 'category', 'items'],
      },
    }],
    tool_choice: { type: 'tool', name: 'catat_struk' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image.toString('base64') } },
        {
          type: 'text',
          text: `This is a receipt or bill from Indonesia. Today is ${today}. Read it and call catat_struk.
Amounts use "." as thousands separator (12.500 = 12500). Use the grand total the customer paid ("Total", "Grand Total", "Total Bayar"), not cash tendered or change.
Dates are usually DD/MM/YY or DD-MM-YYYY. Pick the closest category. If the image is not a receipt, return nulls and an empty item list.`,
        },
      ],
    }],
  });
  const raw = toolInput(msg, 'catat_struk');
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    merchant: textOrNull(raw.merchant, 140),
    date: isoOrNull(raw.date),
    total: wholeRupiah(raw.total),
    category: pick(raw.category, categories, 'Lainnya'),
    items: items
      .map((i) => ({ name: textOrNull((i as { name?: unknown }).name, 60) ?? '', amount: wholeRupiah((i as { amount?: unknown }).amount) ?? 0 }))
      .filter((i) => i.name && i.amount > 0)
      .slice(0, 30),
  };
}

const STATEMENT_MAX_TOKENS = 16000;

export async function readStatement(pdf: Buffer, categories: { masuk: string[]; keluar: string[] }): Promise<StatementResult> {
  const all = [...new Set([...categories.masuk, ...categories.keluar])];
  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: STATEMENT_MAX_TOKENS,
    tools: [{
      name: 'catat_mutasi',
      description: 'Record every transaction line of a bank account statement.',
      input_schema: {
        type: 'object',
        properties: {
          bank: { type: ['string', 'null'] },
          period_start: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          period_end: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'YYYY-MM-DD' },
                description: { type: 'string', description: 'The statement text, condensed to the payee or purpose, max 100 characters.' },
                direction: { type: 'string', enum: ['masuk', 'keluar'], description: 'masuk = credit (CR / kredit), keluar = debit (DB / debet).' },
                amount: { type: 'integer', description: 'Whole rupiah, positive.' },
                balance_after: { type: ['integer', 'null'] },
                category: { type: 'string', enum: all },
              },
              required: ['date', 'description', 'direction', 'amount', 'balance_after', 'category'],
            },
          },
        },
        required: ['bank', 'period_start', 'period_end', 'rows'],
      },
    }],
    tool_choice: { type: 'tool', name: 'catat_mutasi' },
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
        {
          type: 'text',
          text: `This is an Indonesian bank e-statement (rekening koran / mutasi). Call catat_mutasi with every transaction row, in order.
Skip opening/closing balance lines ("Saldo Awal", "Saldo Akhir") and page subtotals. Amounts use "." for thousands and "," for decimals; drop the sen.
Income categories: ${categories.masuk.join(', ')}. Spending categories: ${categories.keluar.join(', ')}.
Use "Transfer & tarik tunai" for ATM withdrawals and transfers to own accounts, "Cicilan utang" for loan or credit card payments, "Tabungan & investasi" for moves into savings or investment products.
Salary credits are "Gaji". Bank fees and taxes go to "Lainnya".`,
        },
      ],
    }],
  });
  const raw = toolInput(msg, 'catat_mutasi');
  const rows = (Array.isArray(raw.rows) ? raw.rows : []).flatMap((r) => {
    const x = r as Record<string, unknown>;
    const date = isoOrNull(x.date);
    const amount = wholeRupiah(x.amount);
    const direction: 'masuk' | 'keluar' | null = x.direction === 'masuk' || x.direction === 'keluar' ? x.direction : null;
    if (!date || !amount || !direction) return [];
    const allowed = categories[direction];
    return [{
      date,
      description: textOrNull(x.description, 140) ?? '(tanpa keterangan)',
      direction,
      amount,
      balanceAfter: wholeRupiah(x.balance_after),
      category: pick(x.category, allowed, 'Lainnya'),
    }];
  });
  return {
    bank: textOrNull(raw.bank, 60),
    periodStart: isoOrNull(raw.period_start),
    periodEnd: isoOrNull(raw.period_end),
    rows: rows.slice(0, 500),
    truncated: msg.stop_reason === 'max_tokens' || rows.length > 500,
  };
}

/** Error text a person can act on; the raw API message goes to the server log only. */
export function explainAiError(err: unknown): string {
  if (err instanceof AiError) return err.message;
  if (err instanceof Anthropic.APIError) {
    console.error('anthropic', err.status, err.message);
    if (err.status === 401) return 'Kunci Claude API tidak valid. Periksa ANTHROPIC_API_KEY di pengaturan Vercel.';
    if (err.status === 429) return 'Terlalu banyak permintaan ke Claude dalam waktu singkat. Coba lagi dalam satu menit.';
    if (err.status === 400 && /pdf|document|password|encrypt/i.test(err.message)) return 'PDF ini tidak bisa dibaca. Bila dikunci kata sandi, buka dulu lalu simpan ulang tanpa kata sandi.';
    if (err.status === 413 || /too large|exceed/i.test(err.message)) return 'File terlalu besar untuk dibaca sekaligus. Pecah per bulan.';
    if ((err.status ?? 0) >= 500) return 'Layanan Claude sedang gangguan. Coba lagi beberapa saat lagi.';
  }
  console.error('ai', err);
  return 'Dokumen gagal dibaca. Coba lagi, atau isi manual.';
}
