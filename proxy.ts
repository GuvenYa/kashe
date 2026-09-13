import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/app/lib/supabase-middleware';

const CEREZ_ADI = 'kashe_onizleme';

function bakimKontrolu(request: NextRequest): NextResponse | null {
  if (process.env.NEXT_PUBLIC_BAKIM_MODU !== 'true') return null;

  const { pathname, searchParams } = request.nextUrl;

  const muaf =
    pathname.startsWith('/yakinda') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/icons');

  if (muaf) return null;

  const anahtar = searchParams.get('onizleme');
  if (anahtar && anahtar === process.env.BAKIM_ANAHTARI) {
    const yanit = NextResponse.next();
    yanit.cookies.set(CEREZ_ADI, anahtar, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return yanit;
  }

  if (request.cookies.get(CEREZ_ADI)?.value === process.env.BAKIM_ANAHTARI) {
    return null;
  }

  return NextResponse.rewrite(new URL('/yakinda', request.url));
}

export async function proxy(request: NextRequest) {
  const bakim = bakimKontrolu(request);
  if (bakim) return bakim;

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};