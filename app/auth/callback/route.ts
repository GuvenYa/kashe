import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';
import { sanitizeReturnPath } from '@/app/lib/safe-redirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // Open redirect sertleştirmesi: 'next' yalnız aynı origin'e göreli yol olabilir.
  const next = sanitizeReturnPath(
    requestUrl.searchParams.get('next'),
    '/sifre-sifirla'
  );

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