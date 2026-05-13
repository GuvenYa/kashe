import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

  const pathname = request.nextUrl.pathname;

  // Korumalı sayfalar — giriş gerekli
  const protectedPaths = ['/profil', '/kesfet'];
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