// Yetenek havuzu davet e-postasi (FAZ 5 / P1).
//
// Kalip: account-emails.ts (Arial, lacivert baslik, pembe buton, kisa TR, islemsel sinir).
// Gonderim `sendAccountEmail` ile yapilir; token'i RPC uretir, sablon yalniz baglantiyi kurar.
// Kampanya/tanitim YASAK — bu e-posta kurulusun kisiyi havuzuna eklediginin bildirimidir.

import { SITE_URL } from './resend-client';
import { type EmailContent } from './account-emails';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const C = {
  bg: '#F7F9FC',
  card: '#FFFFFF',
  brandInk: '#040D26',
  brandAccent: '#FA0B96',
  body: '#040D26',
  muted: '#4A5163',
  line: '#E1E2E5',
};

function para(text: string): string {
  return `<p style="font-family:Arial,Helvetica,sans-serif;color:${C.body};font-size:15px;line-height:1.6;margin:0 0 14px;">${esc(text)}</p>`;
}

/**
 * Davet e-postasi. `token` RPC'den gelir (`send_talent_record_invitation`);
 * baglanti `/davet/havuz/<token>` — SAYFA P2'de gelir (P1'de baglanti uretilir).
 */
export function havuzDavetEmail(opts: {
  organizationName: string;
  recipientName?: string | null;
  roleLabels: string[];
  token: string;
}): EmailContent {
  const url = `${SITE_URL}/davet/havuz/${opts.token}`;
  const konu = `${opts.organizationName} seni Kashe yetenek havuzuna ekledi`;
  const selam = opts.recipientName?.trim()
    ? `Merhaba ${opts.recipientName.trim()},`
    : 'Merhaba,';
  const rolSatiri =
    opts.roleLabels.length > 0
      ? `Eklendiğin roller: ${opts.roleLabels.join(', ')}.`
      : 'Rol bilgisi kuruluş tarafından daha sonra girilecek.';

  const bodyHtml =
    para(selam) +
    para(`${opts.organizationName}, seni Kashe'deki yetenek havuzuna ekledi.`) +
    para(rolSatiri) +
    para(
      "Kashe'de hesabın varsa giriş yap, yoksa profesyonel olarak kaydol; kaydın sana bağlanır."
    ) +
    para('Bu bağlantı 14 gün geçerlidir.');

  return {
    subject: konu,
    html: `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${esc(konu)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border-radius:14px;border:1px solid ${C.line};">
        <tr>
          <td style="padding:32px 32px 0 32px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${C.brandInk};">Kashe</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0 32px;">
            <h2 style="font-family:Arial,Helvetica,sans-serif;color:${C.brandInk};font-size:22px;margin:0 0 16px;">Yetenek havuzu daveti</h2>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 32px 32px 32px;">
            <a href="${url}" style="display:inline-block;background:${C.brandAccent};color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:10px;">Kaydı gör</a>
            <p style="font-family:Arial,Helvetica,sans-serif;color:${C.muted};font-size:12px;line-height:1.5;margin:18px 0 0;">
              Bağlantı çalışmazsa: ${esc(url)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px 32px;border-top:1px solid ${C.line};">
            <p style="font-family:Arial,Helvetica,sans-serif;color:${C.muted};font-size:12px;line-height:1.5;margin:16px 0 0;">
              — Kashe ekibi<br />Bu e-posta hesabınla ilgili bilgilendirmedir.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
    text: `${selam.replace(/&#039;/g, "'")}

${opts.organizationName}, seni Kashe'deki yetenek havuzuna ekledi.

${rolSatiri}

Kashe'de hesabın varsa giriş yap, yoksa profesyonel olarak kaydol; kaydın sana bağlanır.

Kaydı gör: ${url}

Bu bağlantı 14 gün geçerlidir.

— Kashe ekibi
Bu e-posta hesabınla ilgili bilgilendirmedir.`,
  };
}
