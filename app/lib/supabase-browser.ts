'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Vercel production'da realtime auth context cookie'lerden otomatik
  // yüklenmiyor. Session'ı manuel okuyup realtime client'a access_token'ı
  // iletiyoruz. Localhost'ta zaten çalışıyor ama bu iki ortamda da güvenli.
  if (typeof window !== 'undefined') {
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        client.realtime.setAuth(session.access_token);
      }
    });

    // Auth state değişiklikleri (token refresh, login, logout)
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        client.realtime.setAuth(session.access_token);
      }
    });
  }

  return client;
}