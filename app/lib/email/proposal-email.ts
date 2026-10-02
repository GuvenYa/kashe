// Teklif gonderim e-postasi (FAZ 7a / P1).
//
// Kalip: talent-invite-email.ts (Arial, lacivert baslik, pembe buton, kisa TR,
// islemsel sinir). Gonderim `sendAccountEmail` ile; ham jetonu `proposal_send`
// RPC'si uretir, sablon YALNIZ baglantiyi kurar — jeton hicbir yere kaydedilmez.
// Kampanya/tanitim YASAK: bu e-posta kurulusun gonderdigi teklifin bildirimidir.

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
 * Teklif e-postasi. `baglanti` tam URL'dir (`/portal/teklif/<jeton>`);
 * cagiran `proposal_send` donusunden kurar ve LOGLAMAZ.
 */
export function teklifEmail(opts: {
  aliciAdi?: string | null;
  saticiAdi: string;
  baslik: string;
  /** Bicimli toplam metni (ornek "54.000 TL"); hesap sunucuda yapildi. */
  toplam: string | null;
  /** Bicimli gecerlilik tarihi metni. */
  gecerlilik: string | null;
  baglanti: string;
}): EmailContent {
  const konu = `${opts.saticiAdi} sana bir teklif gönderdi: ${opts.baslik}`;
  const selam = opts.aliciAdi?.trim()
    ? `Merhaba ${opts.aliciAdi.trim()},`
    : 'Merhaba,';

  const toplamSatiri = opts.toplam
    ? `Teklif toplamı (KDV dahil): ${opts.toplam}.`
    : 'Teklif ayrıntıları bağlantıda.';
  const gecerlilikSatiri = opts.gecerlilik
    ? `Teklif ${opts.gecerlilik} tarihine kadar geçerli.`
    : 'Teklifin geçerlilik süresi bağlantıda yazıyor.';

  const bodyHtml =
    para(selam) +
    para(`${opts.saticiAdi}, "${opts.baslik}" için sana bir teklif hazırladı.`) +
    para(toplamSatiri) +
    para(gecerlilikSatiri) +
    para(
      'Teklifi görmek, onaylamak ya da revizyon istemek için aşağıdaki bağlantıyı kullan. Bağlantı kişiseldir, paylaşma.'
    );

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
            <h2 style="font-family:Arial,Helvetica,sans-serif;color:${C.brandInk};font-size:22px;margin:0 0 16px;">Yeni teklif</h2>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 32px 32px 32px;">
            <a href="${opts.baglanti}" style="display:inline-block;background:${C.brandAccent};color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:10px;">Teklifi gör</a>
            <p style="font-family:Arial,Helvetica,sans-serif;color:${C.muted};font-size:12px;line-height:1.5;margin:18px 0 0;">
              Bağlantı çalışmazsa: ${esc(opts.baglanti)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px 32px;border-top:1px solid ${C.line};">
            <p style="font-family:Arial,Helvetica,sans-serif;color:${C.muted};font-size:12px;line-height:1.5;margin:16px 0 0;">
              — Kashe ekibi<br />Bu e-posta ${esc(opts.saticiAdi)} adına gönderilen teklif bildirimidir.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
    text: `${selam}

${opts.saticiAdi}, "${opts.baslik}" için sana bir teklif hazırladı.

${toplamSatiri}

${gecerlilikSatiri}

Teklifi gör: ${opts.baglanti}

Bağlantı kişiseldir, paylaşma.

— Kashe ekibi
Bu e-posta ${opts.saticiAdi} adına gönderilen teklif bildirimidir.`,
  };
}
