import { SITE_URL } from './resend-client';

// Kashe paleti — inline kullanım için
const COLORS = {
  paper: '#FBF8F4',
  paper2: '#FBEEE8',
  card: '#FFFFFF',
  ink: '#1A120E',
  ink72: 'rgba(26, 18, 14, 0.72)',
  ink50: 'rgba(26, 18, 14, 0.5)',
  terracotta: '#1F5C4A',
  ember: '#143D31',
  moss: '#3F6B47',
  line: 'rgba(26, 18, 14, 0.12)',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + '…';
}

function formatEventDate(iso: string | null): string {
  if (!iso) return 'Tarih belirlenmemiş';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function baseLayout(opts: {
  preheader: string;
  eyebrow: string;
  eyebrowColor?: string;
  title: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  ctaColor?: string;
}): string {
  const eyebrowColor = opts.eyebrowColor || COLORS.terracotta;
  const ctaColor = opts.ctaColor || COLORS.terracotta;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(opts.title)}</title>
<style>:root{color-scheme:light only;supported-color-schemes:light;}</style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.paper};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.ink};">
<div style="display:none;max-height:0;overflow:hidden;color:${COLORS.paper};">${escapeHtml(opts.preheader)}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.paper};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background-color:${COLORS.card};border-radius:16px;border:1px solid ${COLORS.line};">
        <!-- Header / Brand -->
        <tr>
          <td style="padding:28px 32px 0 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${SITE_URL}/icon-192.png?v=2" width="28" height="28" alt="Kashe" style="display:block;border-radius:6px;" />
                </td>
                <td style="padding-left:10px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:${COLORS.ink};">Kashe</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Eyebrow -->
        <tr>
          <td style="padding:28px 32px 0 32px;">
            <p style="margin:0;font-size:11px;font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:0.18em;text-transform:uppercase;color:${eyebrowColor};">${escapeHtml(opts.eyebrow)}</p>
          </td>
        </tr>
        <!-- Title -->
        <tr>
          <td style="padding:8px 32px 0 32px;">
            <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:500;color:${COLORS.ink};letter-spacing:-0.02em;">${opts.title}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:20px 32px 0 32px;font-size:15px;line-height:1.6;color:${COLORS.ink72};">
            ${opts.bodyHtml}
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="background-color:${ctaColor};border-radius:10px;">
                  <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;">${escapeHtml(opts.ctaText)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:32px 32px 28px 32px;">
            <hr style="border:none;border-top:1px solid ${COLORS.line};margin:0 0 18px 0;" />
            <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.ink50};">
              Bu e-postayı Kashe'deki etkinliklerin için aldın. Bildirim ayarlarını <a href="${SITE_URL}/profil" style="color:${COLORS.terracotta};text-decoration:none;">profil sayfandan</a> yönetebilirsin.
            </p>
            <p style="margin:10px 0 0 0;font-size:12px;color:${COLORS.ink50};">
              <a href="${SITE_URL}" style="color:${COLORS.ink50};text-decoration:none;">Kashe</a> · Türkiye'nin etkinlik pazaryeri
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------- Yeni mesaj ----------
export function newMessageEmail(opts: {
  recipientName: string;
  senderName: string;
  preview: string;
  conversationId: string;
}) {
  const previewShort = truncate(opts.preview, 140);
  const url = `${SITE_URL}/mesajlar/${opts.conversationId}`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Selam ${escapeHtml(opts.recipientName)},</p>
    <p style="margin:0 0 18px 0;"><strong style="color:${COLORS.ink};">${escapeHtml(opts.senderName)}</strong> sana yeni bir mesaj gönderdi:</p>
    <div style="background-color:${COLORS.paper2};border-radius:10px;padding:16px 18px;margin:0 0 6px 0;">
      <p style="margin:0;font-size:15px;line-height:1.55;color:${COLORS.ink};">${escapeHtml(previewShort)}</p>
    </div>
  `;
  return {
    subject: `${opts.senderName} sana mesaj gönderdi`,
    html: baseLayout({
      preheader: `Yeni mesaj: ${previewShort}`,
      eyebrow: 'Yeni mesaj',
      title: 'Sana bir mesaj var.',
      bodyHtml,
      ctaText: 'Konuşmayı aç →',
      ctaUrl: url,
    }),
    text: `Selam ${opts.recipientName},\n\n${opts.senderName} sana yeni bir mesaj gönderdi:\n\n"${previewShort}"\n\nKonuşmayı aç: ${url}\n\n— Kashe`,
  };
}

// ---------- Yeni konuşma ----------
export function newConversationEmail(opts: {
  recipientName: string;
  senderName: string;
  preview: string;
  conversationId: string;
  eventType: string | null;
}) {
  const previewShort = truncate(opts.preview, 160);
  const url = `${SITE_URL}/mesajlar/${opts.conversationId}`;
  const eventLine = opts.eventType
    ? `<p style="margin:0 0 18px 0;font-size:13px;color:${COLORS.ink50};text-transform:uppercase;letter-spacing:0.12em;font-family:'SFMono-Regular',Consolas,monospace;">Etkinlik · ${escapeHtml(opts.eventType)}</p>`
    : '';
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Selam ${escapeHtml(opts.recipientName)},</p>
    <p style="margin:0 0 18px 0;"><strong style="color:${COLORS.ink};">${escapeHtml(opts.senderName)}</strong> seninle ilgileniyor — yeni bir konuşma başlattı.</p>
    ${eventLine}
    <div style="background-color:${COLORS.paper2};border-radius:10px;padding:16px 18px;margin:0 0 6px 0;">
      <p style="margin:0;font-size:15px;line-height:1.55;color:${COLORS.ink};">${escapeHtml(previewShort)}</p>
    </div>
  `;
  return {
    subject: `${opts.senderName} seninle iletişime geçti`,
    html: baseLayout({
      preheader: `Yeni konuşma: ${previewShort}`,
      eyebrow: 'Yeni iletişim',
      title: 'Yeni bir konuşma var.',
      bodyHtml,
      ctaText: 'Konuşmayı aç →',
      ctaUrl: url,
    }),
    text: `Selam ${opts.recipientName},\n\n${opts.senderName} seninle ilgileniyor.\n\n"${previewShort}"\n\nKonuşmayı aç: ${url}\n\n— Kashe`,
  };
}

// ---------- Yeni teklif ----------
export function newQuoteEmail(opts: {
  recipientName: string;
  senderName: string;
  amount: string;
  conversationId: string;
}) {
  const url = `${SITE_URL}/mesajlar/${opts.conversationId}`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Selam ${escapeHtml(opts.recipientName)},</p>
    <p style="margin:0 0 18px 0;"><strong style="color:${COLORS.ink};">${escapeHtml(opts.senderName)}</strong> sana bir teklif gönderdi.</p>
    <div style="background-color:${COLORS.paper2};border-radius:10px;padding:18px 22px;margin:0 0 6px 0;">
      <p style="margin:0 0 4px 0;font-size:11px;font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.ink50};">Toplam</p>
      <p style="margin:0;font-size:24px;font-weight:500;color:${COLORS.ink};">${escapeHtml(opts.amount)}</p>
    </div>
  `;
  return {
    subject: `${opts.senderName} sana teklif gönderdi`,
    html: baseLayout({
      preheader: `Yeni teklif · ${opts.amount}`,
      eyebrow: 'Yeni teklif',
      title: 'Sana bir teklif var.',
      bodyHtml,
      ctaText: 'Teklifi gör →',
      ctaUrl: url,
    }),
    text: `Selam ${opts.recipientName},\n\n${opts.senderName} sana bir teklif gönderdi.\n\nToplam: ${opts.amount}\n\nTeklifi gör: ${url}\n\n— Kashe`,
  };
}

// ---------- Teklif onaylandı ----------
export function quoteAcceptedEmail(opts: {
  recipientName: string;
  customerName: string;
  amount: string;
  conversationId: string;
}) {
  const url = `${SITE_URL}/mesajlar/${opts.conversationId}`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Selam ${escapeHtml(opts.recipientName)},</p>
    <p style="margin:0 0 18px 0;">Güzel haber — <strong style="color:${COLORS.ink};">${escapeHtml(opts.customerName)}</strong> teklifini onayladı. İş senin.</p>
    <div style="background-color:${COLORS.paper2};border-radius:10px;padding:18px 22px;margin:0 0 6px 0;">
      <p style="margin:0 0 4px 0;font-size:11px;font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.ink50};">Onaylanan tutar</p>
      <p style="margin:0;font-size:24px;font-weight:500;color:${COLORS.ink};">${escapeHtml(opts.amount)}</p>
    </div>
  `;
  return {
    subject: `Teklifin onaylandı — ${opts.customerName}`,
    html: baseLayout({
      preheader: `Teklifin onaylandı · ${opts.amount}`,
      eyebrow: 'Teklif onayı',
      title: 'Teklifin onaylandı.',
      bodyHtml,
      ctaText: 'Konuşmayı aç →',
      ctaUrl: url,
    }),
    text: `Selam ${opts.recipientName},\n\n${opts.customerName} teklifini onayladı.\n\nTutar: ${opts.amount}\n\nKonuşmayı aç: ${url}\n\n— Kashe`,
  };
}

// ---------- Rezervasyon iptal: müşteriden geliyor ----------
// (profesyonele e-posta — "müşteri iptal etti")
export function bookingCancelledByCustomerEmail(opts: {
  recipientName: string;
  cancellerName: string;
  bookingId: string;
  eventDate: string | null;
  reason: string | null;
}) {
  const url = `${SITE_URL}/rezervasyon/${opts.bookingId}`;
  const eventLine = opts.eventDate
    ? `<p style="margin:0 0 18px 0;font-size:13px;color:${COLORS.ink50};text-transform:uppercase;letter-spacing:0.12em;font-family:'SFMono-Regular',Consolas,monospace;">Etkinlik · ${escapeHtml(formatEventDate(opts.eventDate))}</p>`
    : '';
  const reasonBlock = opts.reason
    ? `
    <div style="background-color:${COLORS.paper2};border-radius:10px;padding:14px 18px;margin:0 0 6px 0;">
      <p style="margin:0 0 4px 0;font-size:11px;font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.ink50};">Belirtilen sebep</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.ink};">${escapeHtml(opts.reason)}</p>
    </div>
  `
    : '';
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Selam ${escapeHtml(opts.recipientName)},</p>
    <p style="margin:0 0 18px 0;"><strong style="color:${COLORS.ink};">${escapeHtml(opts.cancellerName)}</strong> rezervasyonunu iptal etti.</p>
    ${eventLine}
    ${reasonBlock}
  `;
  return {
    subject: `${opts.cancellerName} rezervasyonu iptal etti`,
    html: baseLayout({
      preheader: `Rezervasyon iptal · ${opts.cancellerName}`,
      eyebrow: 'Rezervasyon iptal',
      title: 'Müşteri iptal etti.',
      bodyHtml,
      ctaText: 'Detayları gör →',
      ctaUrl: url,
    }),
    text: `Selam ${opts.recipientName},\n\n${opts.cancellerName} rezervasyonu iptal etti.${opts.reason ? `\n\nSebep: ${opts.reason}` : ''}\n\nDetayları gör: ${url}\n\n— Kashe`,
  };
}

// ---------- Rezervasyon iptal: profesyonelden geliyor ----------
// (müşteriye e-posta — "profesyonel iptal etti", biraz daha özürlü/açıklayıcı ton)
export function bookingCancelledByProfessionalEmail(opts: {
  recipientName: string;
  cancellerName: string;
  bookingId: string;
  eventDate: string | null;
  reason: string | null;
}) {
  const url = `${SITE_URL}/rezervasyon/${opts.bookingId}`;
  const eventLine = opts.eventDate
    ? `<p style="margin:0 0 18px 0;font-size:13px;color:${COLORS.ink50};text-transform:uppercase;letter-spacing:0.12em;font-family:'SFMono-Regular',Consolas,monospace;">Etkinlik · ${escapeHtml(formatEventDate(opts.eventDate))}</p>`
    : '';
  const reasonBlock = opts.reason
    ? `
    <div style="background-color:${COLORS.paper2};border-radius:10px;padding:14px 18px;margin:0 0 6px 0;">
      <p style="margin:0 0 4px 0;font-size:11px;font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.ink50};">Belirtilen sebep</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.ink};">${escapeHtml(opts.reason)}</p>
    </div>
  `
    : '';
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Selam ${escapeHtml(opts.recipientName)},</p>
    <p style="margin:0 0 14px 0;">Üzgünüz — <strong style="color:${COLORS.ink};">${escapeHtml(opts.cancellerName)}</strong> rezervasyonunu iptal etmek zorunda kaldı.</p>
    <p style="margin:0 0 18px 0;">Etkinliğin için yeni bir profesyonel arıyorsan Kashe'de keşfetmeye devam edebilirsin.</p>
    ${eventLine}
    ${reasonBlock}
  `;
  return {
    subject: `Rezervasyonun iptal edildi — ${opts.cancellerName}`,
    html: baseLayout({
      preheader: `Rezervasyon iptal · ${opts.cancellerName}`,
      eyebrow: 'Rezervasyon iptal',
      title: 'Rezervasyonun iptal edildi.',
      bodyHtml,
      ctaText: 'Detayları gör →',
      ctaUrl: url,
    }),
    text: `Selam ${opts.recipientName},\n\nÜzgünüz — ${opts.cancellerName} rezervasyonu iptal etmek zorunda kaldı.${opts.reason ? `\n\nSebep: ${opts.reason}` : ''}\n\nDetayları gör: ${url}\n\n— Kashe`,
  };
}

// ---------- Rezervasyon tamamlandı ----------
// (müşteriye e-posta — yorum bırakma CTA'lı)
export function bookingCompletedEmail(opts: {
  recipientName: string;
  proName: string;
  professionalId: string;
}) {
  const url = `${SITE_URL}/p/${opts.professionalId}`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Selam ${escapeHtml(opts.recipientName)},</p>
    <p style="margin:0 0 18px 0;"><strong style="color:${COLORS.ink};">${escapeHtml(opts.proName)}</strong> işinizi tamamlandı olarak işaretledi. Umarız her şey istediğin gibi gitmiştir.</p>
    <p style="margin:0 0 18px 0;">Deneyimini paylaşırsan hem ${escapeHtml(opts.proName)} hem de gelecekteki müşteriler için değerli olur.</p>
  `;
  return {
    subject: `${opts.proName} ile çalışmanı değerlendir`,
    html: baseLayout({
      preheader: 'Yorum bırakma zamanı',
      eyebrow: 'Tamamlandı',
      eyebrowColor: COLORS.moss,
      title: 'İş tamamlandı.',
      bodyHtml,
      ctaText: 'Yorum bırak →',
      ctaUrl: url,
    }),
    text: `Selam ${opts.recipientName},\n\n${opts.proName} işinizi tamamlandı olarak işaretledi.\n\nDeneyimini paylaşmak için: ${url}\n\n— Kashe`,
  };
}
