/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
// @ts-ignore Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://kashe-rho.vercel.app';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Kashe <onboarding@resend.dev>';

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

function buildEmailHtml(params: {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationUrl: string;
}): string {
  const { recipientName, senderName, messagePreview, conversationUrl } = params;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF8FC; color: #1A120E; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <div style="background: white; border-radius: 12px; padding: 32px;">
    <h1 style="font-size: 20px; margin: 0 0 16px 0; color: #1A120E;">
      Merhaba ${recipientName},
    </h1>
    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      Kashe'de <strong>${senderName}</strong> sana yeni bir mesaj gönderdi:
    </p>
    <div style="background: #F5EEFB; border-left: 3px solid #9333EA; padding: 16px; margin: 0 0 24px 0; border-radius: 4px;">
      <p style="font-size: 15px; line-height: 1.5; margin: 0; color: #1A120E;">
        ${messagePreview}
      </p>
    </div>
    <a href="${conversationUrl}" style="display: inline-block; background: #9333EA; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Mesajı görüntüle
    </a>
    <p style="font-size: 13px; color: #6B5F58; margin: 32px 0 0 0;">
      — Kashe
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

Deno.serve(async (_req: Request) => {
  try {
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
      return new Response(
        JSON.stringify({ error: pendingError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const messages = (pending ?? []) as PendingMessage[];
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending notifications' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
    const errors: string[] = [];

    for (const msg of messages) {
      const conv = convMap.get(msg.conversation_id);
      if (!conv) continue;

      const recipientId = conv.customer_id === msg.sender_id
        ? conv.professional_id
        : conv.customer_id;

      const recipientEmail = emailMap.get(recipientId);
      if (!recipientEmail) {
        errors.push(`No email for user ${recipientId}`);
        continue;
      }

      const recipientProfile = profileMap.get(recipientId);
      const senderProfile = profileMap.get(msg.sender_id);
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

    return new Response(
      JSON.stringify({
        processed: messages.length,
        sent: sentCount,
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
