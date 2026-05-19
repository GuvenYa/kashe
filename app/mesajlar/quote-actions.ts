'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { QUOTE_EXPIRY_OPTIONS, type QuoteExpiryKey } from './quotes-data';

type CreateQuoteInput = {
  conversationId: string;
  totalAmount: number;
  servicesDescription: string;
  cancellationPolicy: string | null;
  expiryKey: QuoteExpiryKey;
};

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Profesyonel yeni teklif gönderir + messages tablosuna 'quote' tipinde
 * referans mesaj ekler.
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

  // Validation
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

  // Konuşmadaki profesyonel mi kontrol et
  const { data: conv } = await supabase
    .from('conversations')
    .select('professional_id, customer_id')
    .eq('id', input.conversationId)
    .single();

  if (!conv) {
    return { success: false, error: 'Konuşma bulunamadı' };
  }

  if (conv.professional_id !== user.id) {
    return {
      success: false,
      error: 'Sadece profesyonel teklif gönderebilir',
    };
  }

  // expires_at hesapla
  const expiresAt = new Date(
    Date.now() + expiryOption.hours * 60 * 60 * 1000
  ).toISOString();

  // 1. Quote oluştur
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      conversation_id: input.conversationId,
      sender_id: user.id,
      total_amount: input.totalAmount,
      services_description: input.servicesDescription.trim(),
      cancellation_policy: input.cancellationPolicy?.trim() || null,
      expires_at: expiresAt,
      status: 'pending',
    })
    .select('id')
    .single();

  if (quoteError || !quote) {
    return {
      success: false,
      error: 'Teklif oluşturulamadı: ' + (quoteError?.message ?? 'bilinmeyen'),
    };
  }

  // 2. messages tablosuna 'quote' tipinde mesaj kaydı ekle
  // (UI'da timeline'a düşmesi için)
  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: input.conversationId,
    sender_id: user.id,
    body: 'Teklif gönderildi',
    message_type: 'quote',
    quote_id: quote.id,
  });

  if (msgError) {
    // Quote oluştu ama mesaj atılamadı — kritik değil, sessiz log
    console.error('Quote message insert failed:', msgError);
  }

  revalidatePath(`/mesajlar/${input.conversationId}`);
  return { success: true };
}

/**
 * Müşteri teklifi onaylar — trigger booking oluşturur + sistem mesajı atılır
 */
export async function acceptQuote(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Quote'u getir + yetki ve durum kontrolü
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, conversation_id, sender_id, status, expires_at')
    .eq('id', quoteId)
    .single();

  if (!quote) return { success: false, error: 'Teklif bulunamadı' };
  if (quote.status !== 'pending') {
    return { success: false, error: 'Bu teklif artık onaylanamaz' };
  }
  if (new Date(quote.expires_at) < new Date()) {
    return { success: false, error: 'Teklif süresi dolmuş' };
  }

  // Müşteri mi kontrol et (conversation'dan)
  const { data: conv } = await supabase
    .from('conversations')
    .select('customer_id')
    .eq('id', quote.conversation_id)
    .single();

  if (!conv || conv.customer_id !== user.id) {
    return { success: false, error: 'Bu teklifi onaylama yetkisi yok' };
  }

  // Status güncelle → trigger booking oluşturur + sistem mesajı atılır
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', quoteId);

  if (error) {
    return { success: false, error: 'Onaylama başarısız: ' + error.message };
  }

  revalidatePath(`/mesajlar/${quote.conversation_id}`);
  return { success: true };
}

/**
 * Müşteri teklifi reddeder
 */
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

  if (!conv || conv.customer_id !== user.id) {
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

/**
 * Profesyonel kendi teklifini geri çeker (pending durumdayken)
 */
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