// Hesap/işlemsel e-posta ailesi — hoşgeldin, profil onaylandı, profil revizyon.
// Stil: recovery.html kalıbı (Arial, zümrüt #1F5C4A başlık, mercan #E2674A buton, kısa TR).
// Kampanya/tanıtım YASAK — işlemsel sınır. Tasarım referansı: docs/email-templates/*.html
//
// Bu şablonlar APP tarafında render edilir (Edge Function'a dokunmadan kopya değişir);
// gönderim Resend üzerinden sendAccountEmail ile yapılır (bildirim throttle/online-check YOK).

import { getResend, EMAIL_FROM, SITE_URL } from './resend-client';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const C = {
  bg: '#FBF8F4',
  card: '#FFFFFF',
  emerald: '#1F5C4A', // zümrüt — başlık + marka
  coral: '#E2674A', // mercan — buton
  body: '#1D2723',
  muted: '#5C665F',
  line: 'rgba(26,18,14,0.10)',
  box: '#FBEEE8',
};

function accountLayout(opts: {
  title: string;
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border-radius:14px;border:1px solid ${C.line};">
        <tr>
          <td style="padding:32px 32px 0 32px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${C.emerald};">Kashe</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0 32px;">
            <h2 style="font-family:Arial,Helvetica,sans-serif;color:${C.emerald};font-size:22px;margin:0 0 16px;">${esc(opts.heading)}</h2>
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 0 32px;">
            <p style="margin:0 0 24px;"><a href="${opts.ctaUrl}" style="background:${C.coral};color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:8px;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:15px;">${esc(opts.ctaText)}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px 32px;">
            <hr style="border:none;border-top:1px solid ${C.line};margin:0 0 14px;" />
            <p style="font-family:Arial,Helvetica,sans-serif;color:${C.muted};font-size:13px;line-height:1.6;margin:0 0 4px;">Bu e-posta hesabınla ilgili bilgilendirmedir.</p>
            <p style="font-family:Arial,Helvetica,sans-serif;color:${C.muted};font-size:13px;margin:8px 0 0;">— Kashe ekibi</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function para(text: string): string {
  return `<p style="font-family:Arial,Helvetica,sans-serif;color:${C.body};font-size:15px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
}

function greeting(name?: string | null): string {
  const n = name?.trim();
  return n ? `Merhaba ${esc(n)},` : 'Merhaba,';
}

export type EmailContent = { subject: string; html: string; text: string };

// ---------- Hoşgeldin (rol-bazlı) ----------
export function hosgeldinEmail(opts: {
  role: string | null;
  name?: string | null;
}): EmailContent {
  // Rol → gövde satırı + CTA. Bilinmeyen rol → genel sürüm.
  let line: string;
  let ctaText: string;
  let path: string;
  switch (opts.role) {
    case 'professional':
    case 'agency':
      line = 'Profilini tamamlayıp yayına aldığında etkinlik sahipleri seni keşfetmeye başlar.';
      ctaText = 'Profilini tamamla';
      path = '/profil';
      break;
    case 'client':
      line = 'Etkinliğin için doğru profesyoneli bulmak artık çok kolay — keşfetmeye başlayabilirsin.';
      ctaText = 'Profesyonelleri keşfet';
      path = '/kesfet';
      break;
    case 'business':
      line = 'İhtiyacın için ilan oluşturabilir, gelen başvurular arasından doğru profesyoneli seçebilirsin.';
      ctaText = 'İlan oluştur';
      path = '/ilanlar/yeni';
      break;
    default:
      line = 'Etkinlikler ve yetenekler bir arada — Kashe\'yi keşfetmeye başlayabilirsin.';
      ctaText = 'Kashe\'yi keşfet';
      path = '/kesfet';
  }
  const url = `${SITE_URL}${path}`;
  const bodyHtml = `${para(greeting(opts.name))}${para('Kashe ailesine hoş geldin.')}${para(line)}`;
  return {
    subject: 'Kashe\'ye hoş geldin',
    html: accountLayout({
      title: 'Kashe\'ye hoş geldin',
      heading: 'Kashe\'ye hoş geldin',
      bodyHtml,
      ctaText,
      ctaUrl: url,
    }),
    text: `${greeting(opts.name).replace(/&#039;/g, "'")}\n\nKashe ailesine hoş geldin.\n\n${line}\n\n${ctaText}: ${url}\n\n— Kashe ekibi\nBu e-posta hesabınla ilgili bilgilendirmedir.`,
  };
}

// ---------- Profil onaylandı ----------
export function profilOnaylandiEmail(opts: {
  name?: string | null;
  profileId: string;
}): EmailContent {
  const url = `${SITE_URL}/p/${opts.profileId}`;
  const bodyHtml = `${para(greeting(opts.name))}${para('Profilin admin onayından geçti ve artık Kashe\'de yayında.')}${para('Etkinlik sahipleri seni keşfet\'te görebilir ve seninle iletişime geçebilir.')}`;
  return {
    subject: 'Profilin onaylandı ve yayında',
    html: accountLayout({
      title: 'Profilin onaylandı',
      heading: 'Profilin onaylandı ve yayında',
      bodyHtml,
      ctaText: 'Profilini gör',
      ctaUrl: url,
    }),
    text: `${greeting(opts.name).replace(/&#039;/g, "'")}\n\nProfilin admin onayından geçti ve artık Kashe'de yayında.\n\nProfilini gör: ${url}\n\n— Kashe ekibi\nBu e-posta hesabınla ilgili bilgilendirmedir.`,
  };
}

// ---------- Profil revizyon (admin notu gövdede) ----------
export function profilRevizyonEmail(opts: {
  name?: string | null;
  note: string;
}): EmailContent {
  const url = `${SITE_URL}/profil`;
  const noteBox = `<div style="background:${C.box};border-radius:10px;padding:14px 18px;margin:0 0 16px;"><p style="font-family:Arial,Helvetica,sans-serif;color:${C.body};font-size:14px;line-height:1.55;margin:0;">${esc(opts.note)}</p></div>`;
  const bodyHtml = `${para(greeting(opts.name))}${para('Profilinin yayına alınabilmesi için bazı düzenlemeler gerekiyor:')}${noteBox}${para('Gerekli değişiklikleri yaptıktan sonra profilin yeniden incelenecek.')}`;
  return {
    subject: 'Profilinde revizyon gerekiyor',
    html: accountLayout({
      title: 'Profilinde revizyon gerekiyor',
      heading: 'Profilinde revizyon gerekiyor',
      bodyHtml,
      ctaText: 'Profilini düzenle',
      ctaUrl: url,
    }),
    text: `${greeting(opts.name).replace(/&#039;/g, "'")}\n\nProfilinin yayına alınabilmesi için bazı düzenlemeler gerekiyor:\n\n"${opts.note}"\n\nProfilini düzenle: ${url}\n\n— Kashe ekibi\nBu e-posta hesabınla ilgili bilgilendirmedir.`,
  };
}

// ---------- Gönderim (işlemsel; throttle/online-check YOK) ----------
export async function sendAccountEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!opts.to) return { sent: false, reason: 'no_email' };
  const resend = getResend();
  if (!resend) return { sent: false, reason: 'no_api_key' };
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (result.error) {
      console.error('[account-email] Resend hata:', result.error);
      return { sent: false, reason: 'resend_error' };
    }
    return { sent: true };
  } catch (err) {
    console.error('[account-email] Beklenmedik hata:', err);
    return { sent: false, reason: 'exception' };
  }
}
