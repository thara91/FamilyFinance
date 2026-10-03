import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publicOrigin, supabaseConfigured } from '@/lib/supabase/env';

export async function POST(request: NextRequest) {
  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${publicOrigin(request.headers, request.nextUrl.origin)}/`, { status: 303 });
}
