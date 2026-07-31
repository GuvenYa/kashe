import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';
import { sanitizeReturnPath } from '@/app/lib/safe-redirect';
import { hosgeldinEmail, sendAccountEmail } from '@/app/lib/email/account-emails';

/**
 * token_hash doğrulama rotası — TARAYICI BAĞIMSIZ.
 *
 * /auth/callback (PKCE) `code_verifier` çerezine muhtaç: kayıt hangi tarayıcıda
 * yapıldıysa link o tarayıcıda açılmak zorunda. Gmail/Instagram/LinkedIn gibi uygulama
 * içi tarayıcılar AYRI çerez kavanozu kullandığı için mobil kayıtların büyük kısmı
 * burada patlıyordu. verifyOtp({token_hash, type}) çerez istemez → sorun tamamen biter.
 *
 * Link doğrudan bu domaine gelir (Supabase /auth/v1/verify uğrağı YOK), bu yüzden
 * Supabase "Redirect URLs" allowlist'i de bu akışı kapıda tutmaz.
 *
 * /auth/callback KALDIRILMADI: uçuşta olan eski maillerin linkleri hâlâ oraya gider.
 */

/** Şablonlardan gelebilecek TEK tip kümesi. Listede olmayan değer verifyOtp'a GEÇİRİLMEZ. */
const ALLOWED_TYPES = ['signup', 'recovery'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string | null): value is AllowedType {
  return value !== null && (ALLOWED_TYPES as readonly string[]).includes(value);
}

type ErrorReason = 'expired' | 'used' | 'invalid';

function errorRedirect(origin: string, type: string, reason: ErrorReason) {
  return NextResponse.redirect(
    `${origin}/auth/hata?type=${encodeURIComponent(type)}&reason=${reason}`
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const typeParam = requestUrl.searchParams.get('type');
  // Open redirect sertleştirmesi: 'next' yalnız aynı origin'e göreli yol olabilir.
  const next = sanitizeReturnPath(requestUrl.searchParams.get('next'), '/giris');

  // ALLOWLIST — bilinmeyen tip verifyOtp'a hiç ulaşmaz.
  if (!isAllowedType(typeParam)) {
    return errorRedirect(requestUrl.origin, 'unknown', 'invalid');
  }
  if (!tokenHash) {
    return errorRedirect(requestUrl.origin, typeParam, 'invalid');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: typeParam,
    token_hash: tokenHash,
  });

  if (error) {
    console.error('[auth:confirm]', typeParam, error.message);
    // Supabase "kullanılmış" ile "süresi dolmuş" token'ı AYNI hatayla döndürür ve elde
    // e-posta olmadığı için sunucuda ayrım yapılamaz → tek kova 'expired'. Hata sayfası
    // metni bu yüzden kesinlik iddia etmez ("kullanılmış OLABİLİR").
    return errorRedirect(requestUrl.origin, typeParam, 'expired');
  }

  // Hoşgeldin — YALNIZ signup onayı (recovery hariç). /auth/callback:33-62'den taşındı.
  // Inline await (after() DEĞİL): Vercel serverless'te response sonrası deferred iş
  // donuyor → mail hiç gitmiyordu. Idempotent: welcome_email_sent_at null ise gönder +
  // damgala; damga YALNIZ res.sent (2xx) ise. Aynı damga /auth/callback'te de okunduğu
  // için geçiş penceresinde iki rota birlikte çalışsa da ÇİFT GÖNDERİM olmaz.
  if (typeParam === 'signup') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
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

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
