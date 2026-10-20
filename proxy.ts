import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/app/lib/supabase-middleware';

const CEREZ_ADI = 'kashe_onizleme';

function bakimKontrolu(request: NextRequest): NextResponse | null {
  if (process.env.NEXT_PUBLIC_BAKIM_MODU !== 'true') {
    // Bakim kapaliyken vitrin sayfasinin gosterecegi bir sey yok: eski
    // baglanti ya da arama sonucu buraya gelirse KALICI olarak (308) ana
    // sayfaya gider. Yonlendirme burada; sayfanin kendi icinde DEGIL:
    // /yakinda bir loading (Suspense) sinirinin altinda render ediliyor,
    // akis basladigi icin sayfa icindeki redirect() 308 basligi yerine
    // meta refresh uretiyordu (kalici yonlendirme sayilmaz). next.config
    // yerine burada: bakim ACIKKEN asagidaki rewrite ayni yola gidiyor,
    // config seviyesindeki bir redirect o rewrite ile donguye girerdi; bu
    // dal yalniz bakim kapaliyken calistigi icin dongu olusamaz.
    if (request.nextUrl.pathname.startsWith('/yakinda')) {
      return NextResponse.redirect(new URL('/', request.url), 308);
    }
    return null;
  }

  const { pathname, searchParams } = request.nextUrl;

  const muaf =
    pathname.startsWith('/yakinda') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/icons') ||
    // FAZ 7a: musteri portali ayri yuzey (oturumsuz, noindex, jetonla korunur);
    // ajansin gonderdigi teklif baglantisi bakim modunda da acilir.
    pathname.startsWith('/portal');

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