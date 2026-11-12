'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { canWriteForBusiness } from '@/app/lib/business-write';
import { istanbulGunu } from '@/app/lib/tarih';
import {
  QUOTE_EXPIRY_OPTIONS,
  formatQuoteAmount,
  type QuoteExpiryKey,
} from './quotes-data';
import {
  sendNotificationEmail,
  getUserEmail,
} from '@/app/lib/email/send-email';
import {
  newQuoteEmail,
  quoteAcceptedEmail,
  quoteAcceptedCustomerEmail,
} from '@/app/lib/email/templates';
import { sendPushToUser } from '@/app/lib/push-server';
import { formatQuoteAmount as fmtPush } from './quotes-data';

type CreateQuoteInput = {
  conversationId: string;
  totalAmount: number;
  servicesDescription: string;
  cancellationPolicy: string | null;
  expiryKey: QuoteExpiryKey;
  /**
   * Duzeltme 12-A (bulgu 115): teklifin tarihi / saati / yeri. Form sohbetteki
   * musteri secimiyle dolu gelir; bos birakilirsa rezervasyon sohbetinkini alir.
   */
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
};

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Profesyonel yeni teklif gönderir + messages tablosuna 'quote' tipinde
 * referans mesaj ekler. Müşteriye e-posta gönderilir.
 */
export async function createQuote(
  input: CreateQuoteInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın' };
  }

  if (input.totalAmount < 0) {
    return { success: false, error: 'Fiyat negatif olamaz' };
  }
  if (input.totalAmount > 10_000_000) {
    return { success: false, error: 'Fiyat çok yüksek' };
  }
  if (input.servicesDescription.trim().length < 10) {
    return {
      success: false,
      error: 'Hizmet açıklaması en az 10 karakter olmalı',
    };
  }
  if (input.servicesDescription.length > 2000) {
    return {
      success: false,
      error: 'Hizmet açıklaması en fazla 2000 karakter',
    };
  }
  if (input.cancellationPolicy && input.cancellationPolicy.length > 1000) {
    return {
      success: false,
      error: 'İptal politikası en fazla 1000 karakter',
    };
  }

  const expiryOption = QUOTE_EXPIRY_OPTIONS.find(
    (o) => o.key === input.expiryKey
  );
  if (!expiryOption) {
    return { success: false, error: 'Geçersiz süre seçimi' };
  }

  // Duzeltme 12-A: tarih / saat / yer (veritabani da gecmis tarihi reddeder)
  const eventDate = input.eventDate?.trim() || null;
  if (eventDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return { success: false, error: 'Geçersiz tarih' };
    }
    if (eventDate < istanbulGunu()) {
      return { success: false, error: 'Teklif tarihi geçmişte olamaz' };
    }
  }
  const saatGecerli = (v: string | null) => !v || /^\d{2}:\d{2}(:\d{2})?$/.test(v);
  const startTime = input.startTime?.trim() || null;
  const endTime = input.endTime?.trim() || null;
  if (!saatGecerli(startTime) || !saatGecerli(endTime)) {
    return { success: false, error: 'Geçersiz saat' };
  }
  if (endTime && !startTime) {
    return { success: false, error: 'Bitiş saati için başlangıç saati de gir' };
  }
  const location = input.location?.trim() || null;
  if (location && location.length > 200) {
    return { success: false, error: 'Yer en fazla 200 karakter' };
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('professional_id, customer_id')
    .eq('id', input.conversationId)
    .single();

  if (!conv) {
    return { success: false, error: 'Konuşma bulunamadı' };
  }

  const isOwner = conv.professional_id === user.id;

  let isAssignedPro = false;
  if (!isOwner) {
    const { data: assignee } = await supabase
      .from('conversation_assignees')
      .select('id')
      .eq('conversation_id', input.conversationId)
      .eq('professional_id', user.id)
      .maybeSingle();
    isAssignedPro = !!assignee;
  }

  if (!isOwner && !isAssignedPro) {
    return {
      success: false,
      error: 'Sadece profesyonel teklif gönderebilir',
    };
  }

  const quoteSenderId = conv.professional_id;

  const expiresAt = new Date(
    Date.now() + expiryOption.hours * 60 * 60 * 1000
  ).toISOString();

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      conversation_id: input.conversationId,
      sender_id: quoteSenderId,
      total_amount: input.totalAmount,
      services_description: input.servicesDescription.trim(),
      cancellation_policy: input.cancellationPolicy?.trim() || null,
      expires_at: expiresAt,
      status: 'pending',
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      location,
    })
    .select('id, total_amount, currency')
    .single();

  if (quoteError || !quote) {
    console.log('QUOTE INSERT ERROR FULL:', JSON.stringify(quoteError, null, 2));
    return {
      success: false,
      error: 'Teklif oluşturulamadı: ' + (quoteError?.message ?? 'bilinmeyen'),
    };
  }

  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: input.conversationId,
    sender_id: user.id,
    body: 'Teklif gönderildi',
    message_type: 'quote',
    quote_id: quote.id,
  });

  if (msgError) {
    console.error('Quote message insert failed:', msgError);
  }

  // E-POSTA: müşteriye yeni teklif bildirimi
  try {
    await notifyNewQuote(
      supabase,
      input.conversationId,
      conv.customer_id,
      conv.professional_id,
      quote.total_amount,
      quote.currency ?? 'TRY'
    );
  } catch (e) {
    console.error('[mail:new-quote]', e);
  }

  revalidatePath(`/mesajlar/${input.conversationId}`);
  return { success: true };
}

/**
 * Müşteri teklifi onaylar — trigger booking oluşturur + sistem mesajı atılır.
 * Profesyonele e-posta gönderilir.
 */
export async function acceptQuote(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, conversation_id, sender_id, status, expires_at, total_amount, currency, request_no')
    .eq('id', quoteId)
    .single();

  if (!quote) return { success: false, error: 'Teklif bulunamadı' };
  if (quote.status !== 'pending') {
    return { success: false, error: 'Bu teklif artık onaylanamaz' };
  }
  if (new Date(quote.expires_at) < new Date()) {
    return { success: false, error: 'Teklif süresi dolmuş' };
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('customer_id, professional_id')
    .eq('id', quote.conversation_id)
    .single();

  if (!conv) {
    return { success: false, error: 'Bu teklifi onaylama yetkisi yok' };
  }
  // Müşteri (kurum) kendisi VEYA kurum adına manager+ üye kabul edebilir.
  // NOT: iyzico gercek odeme baglaninca bu esik owner'a cekilecek mi? Fahri ile karar.
  if (
    conv.customer_id !== user.id &&
    !(await canWriteForBusiness(conv.customer_id))
  ) {
    return { success: false, error: 'Bu teklifi onaylama yetkisi yok' };
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', quoteId);

  if (error) {
    return { success: false, error: 'Onaylama başarısız: ' + error.message };
  }

  // Ayni TALEBIN diger bekleyen tekliflerini reddet (cift rezervasyonu onle).
  // Duzeltme 12-B (bulgu 114): ayni profesyonelle ikinci isin teklifi
  // (baska talep numarasi) bu kabulden etkilenmez.
  await supabase
    .from('quotes')
    .update({ status: 'declined' })
    .eq('conversation_id', quote.conversation_id)
    .eq('request_no', quote.request_no ?? 1)
    .neq('id', quoteId)
    .eq('status', 'pending');

  // E-POSTA: profesyonele "teklifin onaylandı" bildirimi
  try {
    await notifyQuoteAccepted(
      supabase,
      quote.conversation_id,
      conv.customer_id,
      conv.professional_id,
      quote.total_amount,
      quote.currency ?? 'TRY'
    );
  } catch (e) {
    console.error('[mail:quote-accepted]', e);
  }

  // Duzeltme 12-E (bulgu 119): musteriye de rezervasyon ozeti. Uygulama ici
  // bildirimi veritabani yazar (fn_duz12_kabul_bildirimi); e-posta onaylayan
  // kisinin kendi adresine gider.
  try {
    await notifyQuoteAcceptedCustomer(
      supabase,
      quote.id,
      quote.conversation_id,
      user.id,
      user.email ?? null,
      conv.professional_id,
      quote.total_amount,
      quote.currency ?? 'TRY'
    );
  } catch (e) {
    console.error('[mail:quote-accepted-customer]', e);
  }

  revalidatePath(`/mesajlar/${quote.conversation_id}`);
  revalidatePath('/rezervasyonlarim');
  revalidatePath('/tekliflerim');
  revalidatePath('/teklif-taleplerim');
  revalidatePath('/etkinliklerim');
  revalidatePath('/islerim');
  return { success: true };
}

export async function declineQuote(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, conversation_id, status')
    .eq('id', quoteId)
    .single();

  if (!quote) return { success: false, error: 'Teklif bulunamadı' };
  if (quote.status !== 'pending') {
    return { success: false, error: 'Bu teklif artık reddedilemez' };
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('customer_id')
    .eq('id', quote.conversation_id)
    .single();

  if (!conv) {
    return { success: false, error: 'Bu teklifi reddetme yetkisi yok' };
  }
  // Müşteri (kurum) kendisi VEYA kurum adına manager+ üye reddedebilir.
  if (
    conv.customer_id !== user.id &&
    !(await canWriteForBusiness(conv.customer_id))
  ) {
    return { success: false, error: 'Bu teklifi reddetme yetkisi yok' };
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'declined' })
    .eq('id', quoteId);

  if (error) {
    return { success: false, error: 'Reddetme başarısız: ' + error.message };
  }

  revalidatePath(`/mesajlar/${quote.conversation_id}`);
  return { success: true };
}

export async function withdrawQuote(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, conversation_id, sender_id, status')
    .eq('id', quoteId)
    .single();

  if (!quote) return { success: false, error: 'Teklif bulunamadı' };
  if (quote.sender_id !== user.id) {
    return { success: false, error: 'Bu teklif senin değil' };
  }
  if (quote.status !== 'pending') {
    return {
      success: false,
      error: 'Sadece bekleyen teklif geri çekilebilir',
    };
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'withdrawn' })
    .eq('id', quoteId);

  if (error) {
    return {
      success: false,
      error: 'Geri çekme başarısız: ' + error.message,
    };
  }

  revalidatePath(`/mesajlar/${quote.conversation_id}`);
  return { success: true };
}

// ----- E-POSTA HELPER'LARI -----

async function notifyNewQuote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  customerId: string,
  professionalId: string,
  totalAmount: number,
  currency: string
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

    const senderName =
      proProfile?.role === 'business' && proProfile?.company_name
        ? proProfile.company_name
        : proProfile?.full_name || 'Bir profesyonel';

    const recipientName =
      customerProfile?.role === 'business' && customerProfile?.company_name
        ? customerProfile.company_name
        : customerProfile?.full_name || '';

    const formattedAmount = formatQuoteAmount(totalAmount, currency);

    const template = newQuoteEmail({
      recipientName,
      senderName,
      amount: formattedAmount,
      conversationId,
    });

    await sendNotificationEmail({
      supabase,
      toUserId: customerId,
      toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      conversationId,
      eventType: 'new_quote',
    });

    // Web push — müşteriye anlık teklif bildirimi
    await sendPushToUser(customerId, {
      title: `${senderName} sana teklif gönderdi`,
      body: `${formattedAmount} tutarında yeni bir teklif aldın.`,
      url: `/mesajlar/${conversationId}`,
      tag: `quote-${conversationId}`,
    });
  } catch (err) {
    console.error('[email] notifyNewQuote error:', err);
  }
}

async function notifyQuoteAccepted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  customerId: string,
  professionalId: string,
  totalAmount: number,
  currency: string
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
        getUserEmail(supabase, professionalId),
      ]);

    if (!toEmail) return;

    const customerName =
      customerProfile?.role === 'business' && customerProfile?.company_name
        ? customerProfile.company_name
        : customerProfile?.full_name || 'Müşteri';

    const recipientName =
      proProfile?.role === 'business' && proProfile?.company_name
        ? proProfile.company_name
        : proProfile?.full_name || '';

    const formattedAmount = formatQuoteAmount(totalAmount, currency);

    const template = quoteAcceptedEmail({
      recipientName,
      customerName,
      amount: formattedAmount,
      conversationId,
    });

    await sendNotificationEmail({
      supabase,
      toUserId: professionalId,
      toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      conversationId,
      eventType: 'quote_accepted',
    });

    // Web push — profesyonele anlık "teklifin kabul edildi" bildirimi
    await sendPushToUser(professionalId, {
      title: `${customerName} teklifini kabul etti! 🎉`,
      body: `${formattedAmount} tutarındaki teklifin onaylandı.`,
      url: `/mesajlar/${conversationId}`,
      tag: `quote-accepted-${conversationId}`,
    });
  } catch (err) {
    console.error('[email] notifyQuoteAccepted error:', err);
  }
}

async function notifyQuoteAcceptedCustomer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  quoteId: string,
  conversationId: string,
  accepterId: string,
  accepterEmail: string | null,
  professionalId: string,
  totalAmount: number,
  currency: string
): Promise<void> {
  if (!accepterEmail) return;
  try {
    const [{ data: accepterProfile }, { data: proProfile }, { data: booking }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', accepterId)
          .single(),
        supabase
          .from('profiles')
          .select('full_name, company_name, role')
          .eq('id', professionalId)
          .single(),
        supabase
          .from('bookings')
          .select('id, event_date')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    // Kabulden sonra rezervasyon onayli: tam ad (kamu ad kurali, Duzeltme 05-E)
    const proName =
      (proProfile?.role === 'agency' || proProfile?.role === 'business') &&
      proProfile?.company_name
        ? proProfile.company_name
        : proProfile?.full_name || 'Profesyonel';

    const template = quoteAcceptedCustomerEmail({
      recipientName: accepterProfile?.full_name || '',
      proName,
      amount: formatQuoteAmount(totalAmount, currency),
      bookingId: booking?.id ?? null,
      conversationId,
      eventDate: booking?.event_date ?? null,
    });

    await sendNotificationEmail({
      supabase,
      toUserId: accepterId,
      toEmail: accepterEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      conversationId,
      eventType: 'booking_confirmed',
      islemOnayi: true,
    });
  } catch (err) {
    console.error('[email] notifyQuoteAcceptedCustomer error:', err);
  }
}
