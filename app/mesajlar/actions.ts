'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { isUserSuspended } from '@/app/lib/check-suspension';
import {
  EVENT_TYPE_KEYS,
  BUDGET_RANGE_KEYS,
  type EventTypeKey,
  type BudgetRangeKey,
} from './data';
import {
  validateMessageContent,
  formatViolationMessage,
  type ViolationType,
} from '@/app/lib/message-validation';
import {
  sendNotificationEmail,
  getUserEmail,
} from '@/app/lib/email/send-email';
import {
  newMessageEmail,
  newConversationEmail,
} from '@/app/lib/email/templates';
import { getEventTypeLabel } from './data';
import { sendPushToUser } from '@/app/lib/push-server';

export type MessagingActionResult = {
  success: boolean;
  error?: string;
  conversationId?: string;
  violation?: boolean;
};

export type StartConversationData = {
  professional_id: string;
  message: string;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  guest_count: number | null;
  budget_range: string | null;
  brief_data?: Record<string, string> | null;
  // 'quote' (varsayılan, Teklif Al) | 'booking_request' (Rezervasyon Talebi)
  request_type?: 'quote' | 'booking_request';
  start_time?: string | null;
  end_time?: string | null;
};

const SLIDING_WINDOW_MINUTES = 5;
const SLIDING_WINDOW_MAX_MESSAGES = 5;

async function checkContentSecurity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  conversationId: string | null,
  body: string
): Promise<string | null> {
  const singleResult = validateMessageContent(body);
  if (!singleResult.ok) {
    await logViolations(supabase, userId, conversationId, singleResult.violations);
    return formatViolationMessage(singleResult.violations);
  }

  if (!conversationId) return null;

  const sinceIso = new Date(
    Date.now() - SLIDING_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const { data: recentMessages } = await supabase
    .from('messages')
    .select('body')
    .eq('conversation_id', conversationId)
    .eq('sender_id', userId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(SLIDING_WINDOW_MAX_MESSAGES);

  if (!recentMessages || recentMessages.length === 0) return null;

  const combinedText =
    recentMessages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => m.body)
      .reverse()
      .join(' ') +
    ' ' +
    body;

  const combinedResult = validateMessageContent(combinedText);
  if (!combinedResult.ok) {
    await logViolations(
      supabase,
      userId,
      conversationId,
      combinedResult.violations
    );
    return formatSplitViolationMessage(combinedResult.violations);
  }

  return null;
}

async function logViolations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  conversationId: string | null,
  violations: ViolationType[]
): Promise<void> {
  if (!conversationId) return;
  for (const v of violations) {
    await supabase
      .from('message_violations')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        violation_type: v,
      })
      .then(() => {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((e: any) => {
        console.error('Violation log failed (non-blocking):', e);
      });
  }
}

const VIOLATION_LABELS: Record<ViolationType, string> = {
  phone: 'telefon numarası',
  iban: 'IBAN',
  email: 'e-posta adresi',
};

function formatSplitViolationMessage(violations: ViolationType[]): string {
  if (violations.length === 0) return '';
  const labels = violations.map((v) => VIOLATION_LABELS[v]);
  let joined: string;
  if (labels.length === 1) {
    joined = labels[0];
  } else if (labels.length === 2) {
    joined = `${labels[0]} ve ${labels[1]}`;
  } else {
    joined = `${labels.slice(0, -1).join(', ')} ve ${labels[labels.length - 1]}`;
  }
  return `Son mesajlarınla birlikte değerlendirildiğinde ${joined} paylaşıldığını gördük. İletişim Kashe içinde kalsın — bilgileri tek tek de yazmak güvenli değil.`;
}

/**
 * Karşı tarafa "yeni mesaj" e-postası tetikle — sessiz fail (kritik akışı bozma)
 */
async function notifyNewMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  senderId: string,
  messageBody: string
): Promise<void> {
  try {
    const { data: conv } = await supabase
      .from('conversations')
      .select('customer_id, professional_id')
      .eq('id', conversationId)
      .single();
    if (!conv) return;

    const recipientId =
      conv.customer_id === senderId ? conv.professional_id : conv.customer_id;
    if (!recipientId) return;

    const [{ data: senderProfile }, { data: recipientProfile }, toEmail] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, company_name, role')
          .eq('id', senderId)
          .single(),
        supabase
          .from('profiles')
          .select('full_name, company_name, role')
          .eq('id', recipientId)
          .single(),
        getUserEmail(supabase, recipientId),
      ]);

    if (!toEmail) return;

    const senderName =
      senderProfile?.role === 'business' && senderProfile?.company_name
        ? senderProfile.company_name
        : senderProfile?.full_name || 'Biri';

    const recipientName =
      recipientProfile?.role === 'business' && recipientProfile?.company_name
        ? recipientProfile.company_name
        : recipientProfile?.full_name || '';

    const template = newMessageEmail({
      recipientName,
      senderName,
      preview: messageBody,
      conversationId,
    });

    await sendNotificationEmail({
      supabase,
      toUserId: recipientId,
      toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      conversationId,
      eventType: 'new_message',
    });

    // Web push — karşı tarafa anlık tarayıcı bildirimi (sessiz fail)
    await sendPushToUser(recipientId, {
      title: `${senderName} sana mesaj gönderdi`,
      body: messageBody.length > 120 ? messageBody.slice(0, 120) + '…' : messageBody,
      url: `/mesajlar/${conversationId}`,
      tag: `message-${conversationId}`,
    });
  } catch (err) {
    console.error('[email] notifyNewMessage error:', err);
  }
}

async function notifyNewConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  customerId: string,
  professionalId: string,
  messageBody: string,
  eventType: string | null
): Promise<void> {
  try {
    const [{ data: senderProfile }, { data: recipientProfile }, toEmail] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, company_name, role')
          .eq('id', customerId)
          .single(),
        supabase
          .from('profiles')
          .select('full_name, company_name, role')
          .eq('id', professionalId)
          .single(),
        getUserEmail(supabase, professionalId),
      ]);

    if (!toEmail) return;

    const senderName =
      senderProfile?.role === 'business' && senderProfile?.company_name
        ? senderProfile.company_name
        : senderProfile?.full_name || 'Biri';

    const recipientName =
      recipientProfile?.role === 'business' && recipientProfile?.company_name
        ? recipientProfile.company_name
        : recipientProfile?.full_name || '';

    const eventLabel = eventType ? getEventTypeLabel(eventType) : null;

    const template = newConversationEmail({
      recipientName,
      senderName,
      preview: messageBody,
      conversationId,
      eventType: eventLabel,
    });

    await sendNotificationEmail({
      supabase,
      toUserId: professionalId,
      toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      conversationId,
      eventType: 'new_conversation',
    });
  } catch (err) {
    console.error('[email] notifyNewConversation error:', err);
  }
}

export async function startConversation(
  data: StartConversationData
): Promise<MessagingActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Mesaj göndermek için giriş yapmalısın.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  if (!data.message || data.message.trim().length === 0) {
    return { success: false, error: 'Mesaj boş olamaz.' };
  }
  if (data.message.length > 2000) {
    return { success: false, error: 'Mesaj 2000 karakterden uzun olamaz.' };
  }
  if (data.professional_id === user.id) {
    return { success: false, error: 'Kendine mesaj gönderemezsin.' };
  }

  if (data.location && data.location.length > 200) {
    return { success: false, error: 'Lokasyon 200 karakterden uzun olamaz.' };
  }
  if (
    data.guest_count !== null &&
    (data.guest_count < 0 || data.guest_count > 100000)
  ) {
    return {
      success: false,
      error: 'Kişi sayısı 0 ile 100.000 arasında olmalı.',
    };
  }

  if (data.event_date) {
    const eventDate = new Date(data.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      return { success: false, error: 'Etkinlik tarihi geçmişte olamaz.' };
    }
  }

  const securityCheck = await checkContentSecurity(
    supabase,
    user.id,
    null,
    data.message
  );
  if (securityCheck) {
    return { success: false, error: securityCheck, violation: true };
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, role, is_published')
    .eq('id', data.professional_id)
    .single();

  if (!targetProfile) {
    return { success: false, error: 'Profil bulunamadı.' };
  }
  if (
    targetProfile.role !== 'professional' &&
    targetProfile.role !== 'agency'
  ) {
    return { success: false, error: 'Bu kullanıcıya mesaj gönderilemez.' };
  }
  if (!targetProfile.is_published) {
    return { success: false, error: 'Bu profil yayında değil.' };
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', user.id)
    .eq('professional_id', data.professional_id)
    .maybeSingle();

  let conversationId: string;
  const isNewConversation = !existing;

  if (existing) {
    conversationId = existing.id;
    // Mevcut konuşmaya yeni talep geldi — çubuğu en güncel talebe göre güncelle.
    // Yalnızca gelen talepte dolu olan alanları yaz (boş alan eskisini ezmesin).
    const updateFields: Record<string, unknown> = {
      request_type: data.request_type ?? 'quote',
    };
    if (data.event_date !== null) updateFields.event_date = data.event_date;
    if (data.event_type !== null) updateFields.event_type = data.event_type;
    if (data.location !== null)
      updateFields.location = data.location?.trim() || null;
    if (data.guest_count !== null) updateFields.guest_count = data.guest_count;
    if (data.budget_range !== null) updateFields.budget_range = data.budget_range;
    if (data.brief_data) updateFields.brief_data = data.brief_data;
    if (data.start_time !== undefined && data.start_time !== null)
      updateFields.start_time = data.start_time;
    if (data.end_time !== undefined && data.end_time !== null)
      updateFields.end_time = data.end_time;

    await supabase
      .from('conversations')
      .update(updateFields)
      .eq('id', conversationId);
  } else {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        customer_id: user.id,
        professional_id: data.professional_id,
        event_date: data.event_date,
        event_type: data.event_type,
        location: data.location?.trim() || null,
        guest_count: data.guest_count,
        budget_range: data.budget_range,
        brief_data: data.brief_data ?? null,
        request_type: data.request_type ?? 'quote',
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
      })
      .select('id')
      .single();

    if (convError || !newConv) {
      return {
        success: false,
        error:
          'Konuşma başlatılamadı: ' +
          (convError?.message || 'bilinmeyen hata'),
      };
    }
    conversationId = newConv.id;
  }

  // Rezervasyon talebinde önce bir sistem notu, sonra kullanıcının mesajı
  if (data.request_type === 'booking_request') {
    const dateText = data.event_date
      ? new Date(data.event_date).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'belirtilmedi';
    const timeText =
      data.start_time
        ? ` · Saat: ${data.start_time.slice(0, 5)}${data.end_time ? `–${data.end_time.slice(0, 5)}` : ''}`
        : '';
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: `📅 Rezervasyon talebi — Tarih: ${dateText}${timeText}${data.location ? ` · Yer: ${data.location}` : ''}`,
      message_type: 'system',
    });
  }

  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: data.message.trim(),
  });

  if (msgError) {
    return { success: false, error: 'Mesaj gönderilemedi: ' + msgError.message };
  }

  // E-POSTA: yeni konuşma ise "new_conversation", değilse "new_message"
  if (isNewConversation) {
    notifyNewConversation(
      supabase,
      conversationId,
      user.id,
      data.professional_id,
      data.message.trim(),
      data.event_type
    ).catch(() => {});
  } else {
    notifyNewMessage(
      supabase,
      conversationId,
      user.id,
      data.message.trim()
    ).catch(() => {});
  }

  revalidatePath('/mesajlar');
  revalidatePath(`/mesajlar/${conversationId}`);
  return { success: true, conversationId };
}

export async function sendMessage(
  conversationId: string,
  body: string
): Promise<MessagingActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  if (!body || body.trim().length === 0) {
    return { success: false, error: 'Mesaj boş olamaz.' };
  }
  if (body.length > 2000) {
    return { success: false, error: 'Mesaj 2000 karakterden uzun olamaz.' };
  }

  const securityCheck = await checkContentSecurity(
    supabase,
    user.id,
    conversationId,
    body
  );
  if (securityCheck) {
    return { success: false, error: securityCheck, violation: true };
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('customer_id, professional_id')
    .eq('id', conversationId)
    .single();

  let hasAccess =
    !!conv &&
    (conv.customer_id === user.id || conv.professional_id === user.id);

  if (conv && !hasAccess) {
    const { data: assignee } = await supabase
      .from('conversation_assignees')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('professional_id', user.id)
      .maybeSingle();
    hasAccess = !!assignee;
  }

  if (!conv || !hasAccess) {
    return { success: false, error: 'Bu konuşmaya erişimin yok.' };
  }

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: body.trim(),
  });

  if (error) {
    return { success: false, error: 'Mesaj gönderilemedi: ' + error.message };
  }

  // E-POSTA: karşı tarafa yeni mesaj bildirimi
  notifyNewMessage(supabase, conversationId, user.id, body.trim()).catch(
    () => {}
  );

  revalidatePath('/mesajlar');
  revalidatePath(`/mesajlar/${conversationId}`);
  return { success: true, conversationId };
}

export async function markConversationRead(
  conversationId: string
): Promise<MessagingActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const nowIso = new Date().toISOString();

  const { error: msgError } = await supabase
    .from('messages')
    .update({ read_at: nowIso })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);

  if (msgError) {
    return { success: false, error: msgError.message };
  }

  const { error: notifError } = await supabase
    .from('notifications')
    .update({ read_at: nowIso })
    .eq('user_id', user.id)
    .eq('link', `/mesajlar/${conversationId}`)
    .is('read_at', null);

  if (notifError) {
    console.error('Notification mark-read failed:', notifError);
  }

  revalidatePath('/mesajlar');
  revalidatePath('/bildirimler');
  return { success: true };
}

export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', user.id)
    .is('read_at', null);

  if (error) {
    console.error('getUnreadMessageCount error:', error);
    return 0;
  }

  return count ?? 0;
}

export async function assignConversation(
  conversationId: string,
  professionalId: string
): Promise<MessagingActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('professional_id')
    .eq('id', conversationId)
    .single();

  if (!conv || conv.professional_id !== user.id) {
    return { success: false, error: 'Bu konuşmayı atama yetkin yok.' };
  }

  const { data: member } = await supabase
    .from('agency_members')
    .select('id')
    .eq('agency_id', user.id)
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (!member) {
    return { success: false, error: 'Bu profesyonel ekibinde değil.' };
  }

  const { error } = await supabase.from('conversation_assignees').insert({
    conversation_id: conversationId,
    professional_id: professionalId,
    assigned_by: user.id,
  });

  if (error) {
    if (error.code !== '23505') {
      return { success: false, error: 'Atama yapılamadı: ' + error.message };
    }
  }

  revalidatePath('/mesajlar');
  revalidatePath(`/mesajlar/${conversationId}`);
  return { success: true, conversationId };
}

export async function unassignConversation(
  conversationId: string,
  professionalId: string
): Promise<MessagingActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('professional_id')
    .eq('id', conversationId)
    .single();

  if (!conv || conv.professional_id !== user.id) {
    return { success: false, error: 'Bu konuşmayı yönetme yetkin yok.' };
  }

  const { error } = await supabase
    .from('conversation_assignees')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('professional_id', professionalId);

  if (error) {
    return { success: false, error: 'Atama kaldırılamadı: ' + error.message };
  }

  revalidatePath('/mesajlar');
  revalidatePath(`/mesajlar/${conversationId}`);
  return { success: true, conversationId };
}
// =============================================================================
// DOSYA EKİ — private mesaj ekleri
// =============================================================================

/**
 * Dosya ekli mesaj gönderir. Dosya client'ta 'message-attachments' (private)
 * bucket'ına yüklenmiş olmalı; buraya storage path'i gelir.
 * İsteğe bağlı body (açıklama) ile birlikte gönderilebilir.
 */
export async function sendMessageWithAttachment(
  conversationId: string,
  attachment: {
    path: string;
    type: 'image' | 'pdf' | 'doc';
    name: string;
  },
  body: string = ''
): Promise<MessagingActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  // Path güvenliği: dosya gerçekten bu kullanıcının klasöründe mi?
  if (!attachment.path.startsWith(`${user.id}/`)) {
    return { success: false, error: 'Geçersiz dosya yolu.' };
  }

  // Açıklama metni varsa güvenlik kontrolü (telefon/IBAN/email)
  const trimmedBody = body.trim();
  if (trimmedBody.length > 0) {
    if (trimmedBody.length > 2000) {
      return { success: false, error: 'Açıklama 2000 karakterden uzun olamaz.' };
    }
    const securityCheck = await checkContentSecurity(
      supabase,
      user.id,
      conversationId,
      trimmedBody
    );
    if (securityCheck) {
      return { success: false, error: securityCheck, violation: true };
    }
  }

  // Konuşma erişim kontrolü (sendMessage ile aynı mantık)
  const { data: conv } = await supabase
    .from('conversations')
    .select('customer_id, professional_id')
    .eq('id', conversationId)
    .single();

  let hasAccess =
    !!conv &&
    (conv.customer_id === user.id || conv.professional_id === user.id);

  if (conv && !hasAccess) {
    const { data: assignee } = await supabase
      .from('conversation_assignees')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('professional_id', user.id)
      .maybeSingle();
    hasAccess = !!assignee;
  }

  if (!conv || !hasAccess) {
    // Erişim yoksa yüklenen dosyayı temizle (best effort)
    await supabase.storage.from('message-attachments').remove([attachment.path]);
    return { success: false, error: 'Bu konuşmaya erişimin yok.' };
  }

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: trimmedBody || 'Dosya gönderildi',
    message_type: 'file',
    attachment_path: attachment.path,
    attachment_type: attachment.type,
    attachment_name: attachment.name,
  });

  if (error) {
    await supabase.storage.from('message-attachments').remove([attachment.path]);
    return { success: false, error: 'Dosya gönderilemedi: ' + error.message };
  }

  notifyNewMessage(
    supabase,
    conversationId,
    user.id,
    trimmedBody || '📎 Dosya'
  ).catch(() => {});

  revalidatePath('/mesajlar');
  revalidatePath(`/mesajlar/${conversationId}`);
  return { success: true, conversationId };
}

/**
 * Bir mesaj ekinin signed URL'ini üretir (kısa ömürlü, imzalı).
 * Sadece konuşmanın tarafı erişebilir — erişim doğrulanır.
 */
export async function getAttachmentUrl(
  conversationId: string,
  attachmentPath: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Oturum bulunamadı.' };

  // Konuşma erişim kontrolü
  const { data: conv } = await supabase
    .from('conversations')
    .select('customer_id, professional_id')
    .eq('id', conversationId)
    .single();

  let hasAccess =
    !!conv &&
    (conv.customer_id === user.id || conv.professional_id === user.id);

  if (conv && !hasAccess) {
    const { data: assignee } = await supabase
      .from('conversation_assignees')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('professional_id', user.id)
      .maybeSingle();
    hasAccess = !!assignee;
  }

  if (!conv || !hasAccess) {
    return { error: 'Bu eke erişimin yok.' };
  }

  // Ekin gerçekten bu konuşmaya ait olduğunu doğrula
  const { data: msg } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('attachment_path', attachmentPath)
    .maybeSingle();

  if (!msg) {
    return { error: 'Ek bulunamadı.' };
  }

  // Signed URL — 1 saat geçerli
  const { data, error } = await supabase.storage
    .from('message-attachments')
    .createSignedUrl(attachmentPath, 3600);

  if (error || !data) {
    return { error: 'Bağlantı oluşturulamadı.' };
  }

  return { url: data.signedUrl };
}