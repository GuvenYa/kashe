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

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://kashe.net';
