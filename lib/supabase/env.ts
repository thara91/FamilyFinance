// Older Supabase projects show an "anon" key; newer ones show a "publishable" key. Either works here.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const supabaseConfigured = supabaseUrl !== '' && supabaseKey !== '';

/** Accepts only same-site paths, so a crafted ?next= cannot send people to another site after login. */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

/** The address the visitor actually used. Behind a proxy (Vercel) the server's own origin can differ, and session cookies would not follow. */
export function publicOrigin(headers: Headers, fallback: string): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return fallback;
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
