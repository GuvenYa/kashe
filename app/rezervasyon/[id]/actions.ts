'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { isUserSuspended } from '@/app/lib/check-suspension';
import {
  sendNotificationEmail,
  getUserEmail,
} from '@/app/lib/email/send-email';
import {
  bookingCancelledByCustomerEmail,
  bookingCancelledByProfessionalEmail,
  bookingCompletedEmail,
} from '@/app/lib/email/templates';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Bir tarafın rezervasyonu iptal etmesi.
 * - Status -> 'cancelled'
 * - cancelled_at, cancelled_by, cancellation_reason kaydedilir
 * - Sistem mesajı atılır (mesajlaşma akışına düşer)
 * - Karşı tarafa e-posta gider
 */
export async function cancelBooking(
  bookingId: string,
  reason: string | null
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  // Rezervasyonu çek + yetki kontrol
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      `
      id, conversation_id, customer_id, professional_id,
      status, total_amount, currency, event_date, event_type
    `
    )
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return { success: false, error: 'Rezervasyon bulunamadı' };
  }

  const isCustomer = booking.customer_id === user.id;
  const isProfessional = booking.professional_id === user.id;

  if (!isCustomer && !isProfessional) {
    return { success: false, error: 'Bu rezervasyonu iptal etme yetkin yok' };
  }

  if (booking.status !== 'confirmed') {
    return {
      success: false,
      error: 'Sadece onaylanmış rezervasyon iptal edilebilir',
    };
  }

  if (reason && reason.length > 500) {
    return {
      success: false,
      error: 'İptal sebebi en fazla 500 karakter olabilir',
    };
  }

  // Update
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancellation_reason: reason?.trim() || null,
    })
    .eq('id', bookingId);

  if (updateError) {
    return {
      success: false,
      error: 'İptal başarısız: ' + updateError.message,
    };
  }

  // Sistem mesajı
  const systemBody = isCustomer
    ? 'Müşteri rezervasyonu iptal etti'
    : 'Profesyonel rezervasyonu iptal etti';

  await supabase
    .from('messages')
    .insert({
      conversation_id: booking.conversation_id,
      sender_id: user.id,
      body: systemBody,
      message_type: 'system',
    });

  // E-posta — karşı tarafa
  const recipientId = isCustomer
    ? booking.professional_id
    : booking.customer_id;

  console.log('[email] notifyBookingCancelled tetikleniyor — recipientId:', recipientId, 'isCustomer:', isCustomer);
  notifyBookingCancelled(
    supabase,
    booking.conversation_id,
    bookingId,
    user.id,
    recipientId,
    isCustomer,
    booking.event_date,
    reason
  ).catch((err) => {
    console.error('[email] notifyBookingCancelled .catch:', err);
  });

  revalidatePath('/rezervasyonlarim');
  revalidatePath('/takvimim');
  revalidatePath(`/rezervasyon/${bookingId}`);
  revalidatePath(`/mesajlar/${booking.conversation_id}`);
  return { success: true };
}

/**
 * Profesyonel rezervasyonu tamamlandı olarak işaretler.
 * - Status -> 'completed'
 * - completed_at kaydedilir
 * - Sistem mesajı atılır
 * - Müşteriye "yorum bırak" e-postası gider
 */
export async function completeBooking(
  bookingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      `
      id, conversation_id, customer_id, professional_id,
      status, total_amount, currency, event_date
    `
    )
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return { success: false, error: 'Rezervasyon bulunamadı' };
  }

  // Sadece profesyonel tamamlayabilir
  if (booking.professional_id !== user.id) {
    return {
      success: false,
      error: 'Sadece profesyonel rezervasyonu tamamlayabilir',
    };
  }

  if (booking.status !== 'confirmed') {
    return {
      success: false,
      error: 'Sadece onaylanmış rezervasyon tamamlanabilir',
    };
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (updateError) {
    return {
      success: false,
      error: 'Tamamlama başarısız: ' + updateError.message,
    };
  }

  // Sistem mesajı
  await supabase
    .from('messages')
    .insert({
      conversation_id: booking.conversation_id,
      sender_id: user.id,
      body: 'Profesyonel işi tamamlandı olarak işaretledi',
      message_type: 'system',
    });

  // E-posta — müşteriye "yorum bırak"
  notifyBookingCompleted(
    supabase,
    booking.conversation_id,
    bookingId,
    booking.customer_id,
    booking.professional_id
  ).catch(() => {});

  revalidatePath('/rezervasyonlarim');
  revalidatePath('/takvimim');
  revalidatePath(`/rezervasyon/${bookingId}`);
  revalidatePath(`/mesajlar/${booking.conversation_id}`);
  return { success: true };
}

// ----- E-POSTA HELPERS -----

async function notifyBookingCancelled(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  bookingId: string,
  cancellerId: string,
  recipientId: string,
  cancelledByCustomer: boolean,
  eventDate: string | null,
  reason: string | null
): Promise<void> {
  try {
    console.log('[email] notifyBookingCancelled içine girildi');
    const [{ data: recipientProfile }, { data: cancellerProfile }, toEmail] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, company_name, role')
          .eq('id', recipientId)
          .single(),
        supabase
          .from('profiles')
          .select('full_name, company_name, role')
          .eq('id', cancellerId)
          .single(),
        getUserEmail(supabase, recipientId),
      ]);

    console.log('[email] toEmail:', toEmail, 'recipientName:', recipientProfile?.full_name);

    if (!toEmail) {
      console.log('[email] toEmail yok, çıkılıyor (recipientId:', recipientId, ')');
      return;
    }

    const cancellerName =
      cancellerProfile?.role === 'business' && cancellerProfile?.company_name
        ? cancellerProfile.company_name
        : cancellerProfile?.full_name || (cancelledByCustomer ? 'Müşteri' : 'Profesyonel');

    const recipientName =
      recipientProfile?.role === 'business' && recipientProfile?.company_name
        ? recipientProfile.company_name
        : recipientProfile?.full_name || '';

    const template = cancelledByCustomer
      ? bookingCancelledByCustomerEmail({
          recipientName,
          cancellerName,
          bookingId,
          eventDate,
          reason,
        })
      : bookingCancelledByProfessionalEmail({
          recipientName,
          cancellerName,
          bookingId,
          eventDate,
          reason,
        });

    const result = await sendNotificationEmail({
      supabase,
      toUserId: recipientId,
      toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      conversationId,
      eventType: 'new_message',
    });
    console.log('[email] sendNotificationEmail result:', result);
  } catch (err) {
    console.error('[email] notifyBookingCancelled error:', err);
  }
}

async function notifyBookingCompleted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  bookingId: string,
  customerId: string,
  professionalId: string
): Promise<void> {
  try {
    const [{ data: customerProfile }, { data: proProfile }, toEmail] =
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
        getUserEmail(supabase, customerId),
      ]);

    if (!toEmail) return;

    const proName =
      proProfile?.role === 'business' && proProfile?.company_name
        ? proProfile.company_name
        : proProfile?.full_name || 'Profesyonel';

    const recipientName =
      customerProfile?.role === 'business' && customerProfile?.company_name
        ? customerProfile.company_name
        : customerProfile?.full_name || '';

    const template = bookingCompletedEmail({
      recipientName,
      proName,
      professionalId,
    });

    await sendNotificationEmail({
      supabase,
      toUserId: customerId,
      toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      conversationId,
      eventType: 'new_message',
    });
  } catch (err) {
    console.error('[email] notifyBookingCompleted error:', err);
  }
}