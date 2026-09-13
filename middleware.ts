import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_BAKIM_MODU !== 'true') {
    return NextResponse.next()
  }

  const { pathname, searchParams } = request.nextUrl

  // Yakinda sayfasinin kendisi ve teknik yollar disarida
  if (
    pathname.startsWith('/yakinda') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next()
  }

  // Gizli anahtarla giris: cerez birak ve devam et
  const anahtar = searchParams.get('onizleme')
  if (anahtar && anahtar === process.env.BAKIM_ANAHTARI) {
    const yanit = NextResponse.next()
    yanit.cookies.set('kashe_onizleme', anahtar, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return yanit
  }

  // Cerezi olan gecer
  if (request.cookies.get('kashe_onizleme')?.value === process.env.BAKIM_ANAHTARI) {
    return NextResponse.next()
  }

  return NextResponse.rewrite(new URL('/yakinda', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}