import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';
import { sanitizeReturnPath } from '@/app/lib/safe-redirect';
import { hosgeldinEmail, sendAccountEmail } from '@/app/lib/email/account-emails';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // Open redirect sertleştirmesi: 'next' yalnız aynı origin'e göreli yol olabilir.
  // Fallback '/giris': 'next' bozuk/eksikse KAYIT ONAYI kullanıcısı şifre sıfırlama
  // sayfasına düşmesin. Recovery zaten next=/sifre-sifirla ile açıkça gelir.
  const next = sanitizeReturnPath(requestUrl.searchParams.get('next'), '/giris');
  // Recovery (şifre sıfırlama) akışı next=/sifre-sifirla ile gelir → hoşgeldin TETİKLENMEZ.
  const isRecovery = next.startsWith('/sifre-sifirla');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Code exchange error:', error.message);
      // isRecovery (satır 15) hata dalında da kullanılır: kayıt onayı başarısız olunca
      // kullanıcıya ŞİFRE SIFIRLAMA metni gösterilmesin. Supabase 'type'ı redirect_to'ya
      // iletmediği için akımı ayıran tek sinyal 'next' → isRecovery.
      const errorPath = isRecovery ? '/sifre-sifirla' : '/giris';
      return NextResponse.redirect(
        `${requestUrl.origin}${errorPath}?error=invalid_or_expired`
      );
    }

    // Hoşgeldin — YALNIZ signup onayı (recovery hariç). Fire-and-forget (after):
    // redirect'i geciktirmez, auth akışını bloklamaz. Idempotent: welcome_email_sent_at
    // null ise gönder + damgala.
    // NOT: E-posta doğrulaması KAPALIYKEN signup bu callback'e uğramaz → pratikte PASİF
    // (doğrulama açıldığında + signup emailRedirectTo /auth/callback iken aktifleşir).
    if (!isRecovery) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Inline await (after() DEĞİL): Vercel serverless'te response sonrası deferred
        // iş donuyor → mail hiç gitmiyordu. Redirect öncesi await ile gönderim garanti.
        // Pozitif koşul kullanılır (çıplak return GET'i erken bitirir → redirect atlanır).
        // Damga YALNIZ res.sent (2xx) ise — idempotent kural korunur.
        try {
          const { data: p } = await supabase
            .from('profiles')
            .select('role, email, full_name, welcome_email_sent_at')
            .eq('id', user.id)
            .single();
          if (p && !p.welcome_email_sent_at && p.email) {
            const mail = hosgeldinEmail({ role: p.role, name: p.full_name });
            const res = await sendAccountEmail({ to: p.email, ...mail });
            if (res.sent) {
              await supabase
                .from('profiles')
                .update({ welcome_email_sent_at: new Date().toISOString() })
                .eq('id', user.id);
            }
          }
        } catch (e) {
          console.error('[mail:welcome]', e);
        }
      }
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}