import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// last_seen_at güncelleme aralığı: 5 dakika
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const LAST_SEEN_COOKIE = 'kashe_lsu'; // last seen update timestamp

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Her request'te session'ı tazele
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // last_seen_at: 5 dakikada bir güncelle (cookie-based throttle, serverless-friendly)
  if (user) {
    const lastUpdateStr = request.cookies.get(LAST_SEEN_COOKIE)?.value;
    const lastUpdate = lastUpdateStr ? parseInt(lastUpdateStr, 10) : 0;
    const now = Date.now();

    if (!lastUpdate || now - lastUpdate > LAST_SEEN_THROTTLE_MS) {
      // Fire-and-forget — request'i bloklamasın
      // Sonuç gelmesini beklemiyoruz, sessizce başarısız olabilir (ör. yarış durumu)
      supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {
          /* sessiz başarı */
        });

      // Cookie'yi şimdi set et — gerçek update DB'ye giderken cookie zaten yolda
      supabaseResponse.cookies.set(LAST_SEEN_COOKIE, String(now), {
        maxAge: 60 * 60 * 24 * 30, // 30 gün
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  const pathname = request.nextUrl.pathname;

  // Korumalı sayfalar — giriş gerekli
  const protectedPaths = ['/profil'];
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  // Auth sayfaları — giriş yapmışsan profil'e gönder
  const authPaths = ['/giris', '/uye-ol'];
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  // Login değilse ve korumalı sayfaya gitmeye çalışıyorsa → /giris
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/giris';
    return NextResponse.redirect(url);
  }

  // Login ise ve auth sayfasına gitmeye çalışıyorsa → /profil
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/profil';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}