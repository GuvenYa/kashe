import { getResend, EMAIL_FROM, SITE_URL } from './resend-client';

const THROTTLE_MINUTES = 15;
const ONLINE_THRESHOLD_MINUTES = 2;

export type EmailEventType =
  | 'new_message'
  | 'new_quote'
  | 'quote_accepted'
  | 'new_conversation';

type SendEmailParams = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  toUserId: string;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
  conversationId: string | null;
  eventType: EmailEventType;
};

export async function sendNotificationEmail(
  params: SendEmailParams
): Promise<{ sent: boolean; reason?: string }> {
  const {
    supabase,
    toUserId,
    toEmail,
    subject,
    html,
    text,
    conversationId,
  } = params;

  if (!toEmail) return { sent: false, reason: 'no_email' };

  // 1. Online kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_seen_at')
    .eq('id', toUserId)
    .single();

  if (profile?.last_seen_at) {
    const lastSeen = new Date(profile.last_seen_at).getTime();
    const cutoff = Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000;
    if (lastSeen >= cutoff) {
      return { sent: false, reason: 'user_online' };
    }
  }

  // 2. Throttle — son 15 dakikada aynı konuşmadan email atıldı mı?
  if (conversationId) {
    const throttleCutoff = new Date(
      Date.now() - THROTTLE_MINUTES * 60 * 1000
    ).toISOString();

    const { data: recentEmail } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', toUserId)
      .eq('link', `/mesajlar/${conversationId}`)
      .gte('email_sent_at', throttleCutoff)
      .limit(1)
      .maybeSingle();

    if (recentEmail) return { sent: false, reason: 'throttled' };
  }

  // 3. Resend
  const resend = getResend();
  if (!resend) return { sent: false, reason: 'no_api_key' };

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: [toEmail],
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('[email] Resend hata:', result.error);
      return { sent: false, reason: 'resend_error' };
    }

    // 4. İşaretle
    if (conversationId) {
      const { data: latestNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', toUserId)
        .eq('link', `/mesajlar/${conversationId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestNotif) {
        await supabase
          .from('notifications')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', latestNotif.id);
      }
    }

    return { sent: true };
  } catch (err) {
    console.error('[email] Beklenmedik hata:', err);
    return { sent: false, reason: 'exception' };
  }
}

export async function getUserEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();
  return data?.email ?? null;
}

export { SITE_URL };
