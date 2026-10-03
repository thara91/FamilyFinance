import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { publicOrigin, safeNext, supabaseConfigured } from '@/lib/supabase/env';

// Handles both link styles: the default PKCE link (?code=) and a custom email template (?token_hash=&type=).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request.headers, request.nextUrl.origin);
  const next = safeNext(searchParams.get('next'));
  const fail = (reason: string) => NextResponse.redirect(`${origin}/masuk?galat=${reason}&next=${encodeURIComponent(next)}`);

  if (!supabaseConfigured) return fail('konfigurasi');

  const supabase = await createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return fail('tautan');
}
