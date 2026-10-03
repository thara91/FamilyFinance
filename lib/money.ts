const formatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** Reads what a person typed ("1.500.000", "Rp 2 500 000") as whole rupiah. Empty input is 0. */
export function parseRupiah(input: string): number {
  const digits = input.replace(/\D/g, '');
  if (digits === '') return 0;
  // Capped below Number.MAX_SAFE_INTEGER so sums stay exact.
  return Math.min(Number(digits.slice(0, 15)), 999_999_999_999_999);
}

export function formatNumber(value: number): string {
  return formatter.format(Math.round(value));
}

export function formatRupiah(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}Rp ${formatter.format(Math.abs(Math.round(value)))}`;
}

/** Short form for tight spaces: Rp 1,2 M, Rp 21,4 jt, Rp 850 rb. */
export function formatRupiahShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const short = (n: number, unit: string) =>
    `${sign}Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(n)} ${unit}`;
  if (abs >= 1e12) return short(abs / 1e12, 'T');
  if (abs >= 1e9) return short(abs / 1e9, 'M');
  if (abs >= 1e6) return short(abs / 1e6, 'jt');
  if (abs >= 1e3) return short(abs / 1e3, 'rb');
  return formatRupiah(value);
}

export function formatPercent(ratio: number): string {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(ratio * 100)}%`;
}
