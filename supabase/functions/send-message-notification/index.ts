/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
// @ts-ignore Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://kashe.net';
const FROM_EMAIL = Deno.env.get('EMAIL_FROM') ?? 'Kashe <onboarding@resend.dev>';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface PendingMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface ConversationRow {
  id: string;
  customer_id: string;
  professional_id: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  company_name: string | null;
  role: string;
}

/**
 * Hijyen 01 — uygulama ici bildirimler (FAZ 7b: 'rfp' / 'proposal').
 * Ayni cron bu tablodaki satirlari da e-postalar; yeni fonksiyon/anahtar yok.
 */
interface PendingNotification {
  id: string;
  user_id: string;
  type: string;
  link: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

function buildEmailHtml(params: {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationUrl: string;
}): string {
  const { recipientName, senderName, messagePreview, conversationUrl } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; supported-color-schemes: light; }
    .kashe-btn:hover { background: #0D1F4E !important; }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F7F9FC; color: #040D26; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <div style="text-align: center; margin: 0 0 20px 0;">
    <img src="${APP_URL}/icon-192.png?v=2" width="44" height="44" alt="Kashe" style="display: inline-block; vertical-align: middle; border-radius: 10px;">
    <span style="display: inline-block; vertical-align: middle; font-size: 22px; font-weight: 600; color: #040D26; margin-left: 8px; letter-spacing: -0.5px;">Kashe</span>
  </div>
  <div style="background: white; border-radius: 12px; padding: 32px;">
    <h1 style="font-size: 20px; margin: 0 0 16px 0; color: #040D26;">
      Merhaba ${recipientName},
    </h1>
    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      Kashe'de <strong>${senderName}</strong> sana yeni bir mesaj gönderdi:
    </p>
    <div style="background: #EDF2FA; color: #040D26; border-left: 3px solid #040D26; padding: 16px; margin: 0 0 24px 0; border-radius: 4px;">
      <p style="font-size: 15px; line-height: 1.5; margin: 0; color: #040D26;">
        ${messagePreview}
      </p>
    </div>
    <a href="${conversationUrl}" class="kashe-btn" style="display: inline-block; background: #040D26; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Mesajı görüntüle
    </a>
    <p style="font-size: 13px; color: #4A5163; margin: 32px 0 0 0;">
      — <a href="${APP_URL}" style="color: #040D26; text-decoration: none; font-weight: 600;">Kashe</a>
    </p>
  </div>
</body>
</html>`;
}

/**
 * Bildirim e-postasi (rfp / proposal) — mesaj sablonuyla AYNI kabuk
 * (logo, renkler, kart). Govde tek paragraf: `notifications.body`.
 */
function buildNotificationHtml(params: {
  recipientName: string;
  body: string;
  targetUrl: string;
}): string {
  const { recipientName, body, targetUrl } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; supported-color-schemes: light; }
    .kashe-btn:hover { background: #0D1F4E !important; }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F7F9FC; color: #040D26; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <div style="text-align: center; margin: 0 0 20px 0;">
    <img src="${APP_URL}/icon-192.png?v=2" width="44" height="44" alt="Kashe" style="display: inline-block; vertical-align: middle; border-radius: 10px;">
    <span style="display: inline-block; vertical-align: middle; font-size: 22px; font-weight: 600; color: #040D26; margin-left: 8px; letter-spacing: -0.5px;">Kashe</span>
  </div>
  <div style="background: white; border-radius: 12px; padding: 32px;">
    <h1 style="font-size: 20px; margin: 0 0 16px 0; color: #040D26;">
      Merhaba ${recipientName},
    </h1>
    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      ${body}
    </p>
    <a href="${targetUrl}" class="kashe-btn" style="display: inline-block; background: #040D26; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Kashe'de aç
    </a>
    <p style="font-size: 13px; color: #4A5163; margin: 32px 0 0 0;">
      Bu e-posta Kashe bildirimi. Ayarlar: <a href="${APP_URL}/bildirimler" style="color: #040D26; text-decoration: none; font-weight: 600;">${APP_URL}/bildirimler</a>
    </p>
  </div>
</body>
</html>`;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Resend ${response.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function getName(profile: ProfileRow | undefined): string {
  if (!profile) return 'Bir kullanıcı';
  if (profile.role === 'business' && profile.company_name) return profile.company_name;
  return profile.full_name ?? 'Bir kullanıcı';
}

type BlokSonucu = { processed: number; sent: number; errors: string[] };

/**
 * MESAJLAR — davranis DEGISMEDI; yalniz kendi fonksiyonuna tasindi ki
 * bildirim blogu mesaj yokken de calissin (eskiden erken donus vardi).
 */
async function processMessages(): Promise<BlokSonucu> {
  const errors: string[] = [];
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: pending, error: pendingError } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .is('read_at', null)
    .is('email_notified_at', null)
    .lt('created_at', fiveMinAgo)
    .order('created_at', { ascending: true })
    .limit(50);

  if (pendingError) {
    errors.push(`Messages query: ${pendingError.message}`);
    return { processed: 0, sent: 0, errors };
  }

  const messages = (pending ?? []) as PendingMessage[];
  if (messages.length === 0) return { processed: 0, sent: 0, errors };

  const conversationIds = Array.from(new Set(messages.map((m) => m.conversation_id)));
  const senderIds = Array.from(new Set(messages.map((m) => m.sender_id)));

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, customer_id, professional_id')
    .in('id', conversationIds);

  const convMap = new Map<string, ConversationRow>();
  const convList = (conversations ?? []) as ConversationRow[];
  for (const c of convList) {
    convMap.set(c.id, c);
  }

  const recipientIds = new Set<string>();
  for (const conv of convMap.values()) {
    recipientIds.add(conv.customer_id);
    recipientIds.add(conv.professional_id);
  }
  for (const sid of senderIds) {
    recipientIds.add(sid);
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, role')
    .in('id', Array.from(recipientIds));

  const profileMap = new Map<string, ProfileRow>();
  const profileList = (profiles ?? []) as ProfileRow[];
  for (const p of profileList) {
    profileMap.set(p.id, p);
  }

  const emailMap = new Map<string, string>();
  for (const userId of recipientIds) {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    if (userData?.user?.email) {
      emailMap.set(userId, userData.user.email);
    }
  }

  let sentCount = 0;

  for (const msg of messages) {
    const conv = convMap.get(msg.conversation_id);
    if (!conv) continue;

    // Pro OLMAYAN herkes (kurum sahibi + ekip üyeleri) müşteri tarafıdır.
    const senderIsProfessional = msg.sender_id === conv.professional_id;
    const recipientId = senderIsProfessional
      ? conv.customer_id
      : conv.professional_id;

    const recipientEmail = emailMap.get(recipientId);
    if (!recipientEmail) {
      errors.push(`No email for user ${recipientId}`);
      continue;
    }

    // Attribution: müşteri tarafı → karşı tarafa DAİMA kurum/müşteri adı (üye adı sızmaz).
    const senderAttributionId = senderIsProfessional
      ? msg.sender_id
      : conv.customer_id;

    const recipientProfile = profileMap.get(recipientId);
    const senderProfile = profileMap.get(senderAttributionId);
    const recipientName = getName(recipientProfile);
    const senderName = getName(senderProfile);

    const preview = msg.body.length > 200
      ? msg.body.substring(0, 200) + '...'
      : msg.body;

    const conversationUrl = `${APP_URL}/mesajlar/${msg.conversation_id}`;

    const result = await sendEmail({
      to: recipientEmail,
      subject: `${senderName} sana mesaj gönderdi`,
      html: buildEmailHtml({
        recipientName,
        senderName,
        messagePreview: preview,
        conversationUrl,
      }),
    });

    if (result.ok) {
      await supabase
        .from('messages')
        .update({ email_notified_at: new Date().toISOString() })
        .eq('id', msg.id);
      sentCount++;
    } else {
      errors.push(`Message ${msg.id}: ${result.error}`);
    }
  }

  return { processed: messages.length, sent: sentCount, errors };
}

/**
 * BILDIRIMLER (Hijyen 01) — `notifications` tablosundaki 'rfp' / 'proposal'
 * satirlari. Mesajdan farklar:
 *   - Cevrimici/okundu beklemesi YOK (seyrek ve onemli bildirimler).
 *   - 2 dakika gecikme: ayni islemden dogan birden cok bildirim tek taramada gelsin.
 *   - `read_at` dolu olsa da gonderilir; TEK istisna bayat kayit: okunmus VE
 *     24 saatten eski ise gonderilmez, yalniz isaretlenir (bir daha denenmesin).
 * Alici e-postasi service_role ile `auth.admin`'den okunur; uygulama kodu
 * baska kullanicinin e-postasini HIC okumaz (PII kurali).
 */
async function processNotifications(): Promise<BlokSonucu> {
  const errors: string[] = [];
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: pending, error: pendingError } = await supabase
    .from('notifications')
    .select('id, user_id, type, link, body, read_at, created_at')
    .in('type', ['rfp', 'proposal'])
    .is('email_notified_at', null)
    .lt('created_at', twoMinAgo)
    .order('created_at', { ascending: true })
    .limit(50);

  if (pendingError) {
    errors.push(`Notifications query: ${pendingError.message}`);
    return { processed: 0, sent: 0, errors };
  }

  const notifications = (pending ?? []) as PendingNotification[];
  if (notifications.length === 0) return { processed: 0, sent: 0, errors };

  const userIds = Array.from(new Set(notifications.map((n) => n.user_id)));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, role')
    .in('id', userIds);

  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(p.id, p);
  }

  const emailMap = new Map<string, string>();
  for (const userId of userIds) {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    if (userData?.user?.email) {
      emailMap.set(userId, userData.user.email);
    }
  }

  const bugunMs = Date.now();
  let sentCount = 0;

  for (const notif of notifications) {
    // Bayat kayit: okunmus ve 24 saatten eski -> yalniz isaretle.
    const yasMs = bugunMs - new Date(notif.created_at).getTime();
    if (notif.read_at && yasMs > 24 * 60 * 60 * 1000) {
      await supabase
        .from('notifications')
        .update({ email_notified_at: new Date().toISOString() })
        .eq('id', notif.id);
      continue;
    }

    const recipientEmail = emailMap.get(notif.user_id);
    if (!recipientEmail) {
      errors.push(`No email for user ${notif.user_id}`);
      continue;
    }

    const recipientName = getName(profileMap.get(notif.user_id));
    const ozet = notif.body.length > 80
      ? notif.body.substring(0, 80) + '...'
      : notif.body;
    const subject = notif.type === 'rfp'
      ? `Teklif talebi · ${ozet}`
      : `Teklif · ${ozet}`;
    const targetUrl = `${APP_URL}${notif.link}`;

    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html: buildNotificationHtml({
        recipientName,
        body: notif.body,
        targetUrl,
      }),
    });

    if (result.ok) {
      await supabase
        .from('notifications')
        .update({ email_notified_at: new Date().toISOString() })
        .eq('id', notif.id);
      sentCount++;
    } else {
      // Isaretlenmez: bir sonraki taramada tekrar denenir.
      errors.push(`Notification ${notif.id}: ${result.error}`);
    }
  }

  return { processed: notifications.length, sent: sentCount, errors };
}

Deno.serve(async (_req: Request) => {
  try {
    const mesajlar = await processMessages();
    const bildirimler = await processNotifications();
    const errors = [...mesajlar.errors, ...bildirimler.errors];

    return new Response(
      JSON.stringify({
        processed: mesajlar.processed,
        sent: mesajlar.sent,
        notificationsProcessed: bildirimler.processed,
        notificationsSent: bildirimler.sent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
