import { Resend } from 'resend';

let resendInstance: Resend | null = null;

export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY yok — e-posta gönderimi devre dışı');
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export const EMAIL_FROM =
  process.env.EMAIL_FROM || 'Kashe <onboarding@resend.dev>';

// Taban adres TEK KAYNAK: app/lib/site.ts. (Buradaki eski fallback 'kashe.net'
// idi, sitemap'inkiyle çelişiyordu — cutover öncesi iki farklı adres üretiyordu.)
export { SITE_URL } from '../site';
