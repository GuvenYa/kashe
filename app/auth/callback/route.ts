import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/sifre-sifirla';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Code exchange error:', error.message);
      return NextResponse.redirect(
        `${requestUrl.origin}/sifre-sifirla?error=invalid_or_expired`
      );
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}