'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import {
  EVENT_TYPE_KEYS,
  BUDGET_RANGE_KEYS,
  type EventTypeKey,
  type BudgetRangeKey,
} from './data';

export type MessagingActionResult = {
  success: boolean;
  error?: string;
  conversationId?: string;
};

export type StartConversationData = {
  professional_id: string;
  message: string;
  event_date: string | null;
  event_type: EventTypeKey | null;
  location: string | null;
  guest_count: number | null;
  budget_range: BudgetRangeKey | null;
};

/**
 * Bir profesyonelle yeni konuşma başlat veya mevcut konuşmaya devam et.
 * İlk mesajı da gönderir.
 */
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

  // Validation
  if (!data.message || data.message.trim().length === 0) {
    return { success: false, error: 'Mesaj boş olamaz.' };
  }
  if (data.message.length > 2000) {
    return { success: false, error: 'Mesaj 2000 karakterden uzun olamaz.' };
  }
  if (data.professional_id === user.id) {
    return { success: false, error: 'Kendine mesaj gönderemezsin.' };
  }

  // Brief alanları validation
  if (data.event_type && !EVENT_TYPE_KEYS.includes(data.event_type)) {
    return { success: false, error: 'Geçersiz etkinlik türü.' };
  }
  if (data.budget_range && !BUDGET_RANGE_KEYS.includes(data.budget_range)) {
    return { success: false, error: 'Geçersiz bütçe aralığı.' };
  }
  if (data.location && data.location.length > 200) {
    return { success: false, error: 'Lokasyon 200 karakterden uzun olamaz.' };
  }
  if (data.guest_count !== null && (data.guest_count < 0 || data.guest_count > 100000)) {
    return { success: false, error: 'Kişi sayısı 0 ile 100.000 arasında olmalı.' };
  }

  // Etkinlik tarihi geçmişte olamaz (opsiyonel ama mantıklı guard)
  if (data.event_date) {
    const eventDate = new Date(data.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      return { success: false, error: 'Etkinlik tarihi geçmişte olamaz.' };
    }
  }

  // Profesyonel gerçekten var ve published mı?
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, role, is_published')
    .eq('id', data.professional_id)
    .single();

  if (!targetProfile) {
    return { success: false, error: 'Profil bulunamadı.' };
  }
  if (targetProfile.role !== 'professional') {
    return { success: false, error: 'Bu kullanıcıya mesaj gönderilemez.' };
  }
  if (!targetProfile.is_published) {
    return { success: false, error: 'Bu profil yayında değil.' };
  }

  // Mevcut konuşma var mı?
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', user.id)
    .eq('professional_id', data.professional_id)
    .maybeSingle();

  let conversationId: string;

  if (existing) {
    conversationId = existing.id;
    // Event bilgileri güncellenebilir mi? Şimdilik dokunmuyoruz, ilk konuşmadakiler kalsın
  } else {
    // Yeni konuşma oluştur
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
      })
      .select('id')
      .single();

    if (convError || !newConv) {
      return {
        success: false,
        error: 'Konuşma başlatılamadı: ' + (convError?.message || 'bilinmeyen hata'),
      };
    }
    conversationId = newConv.id;
  }

  // Mesajı ekle
  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: data.message.trim(),
  });

  if (msgError) {
    return { success: false, error: 'Mesaj gönderilemedi: ' + msgError.message };
  }

  revalidatePath('/mesajlar');
  revalidatePath(`/mesajlar/${conversationId}`);
  return { success: true, conversationId };
}

/**
 * Mevcut bir konuşmaya yanıt yaz.
 */
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

  if (!body || body.trim().length === 0) {
    return { success: false, error: 'Mesaj boş olamaz.' };
  }
  if (body.length > 2000) {
    return { success: false, error: 'Mesaj 2000 karakterden uzun olamaz.' };
  }

  // Kullanıcı bu konuşmaya katılımcı mı? (defensive — RLS de kontrol ediyor)
  const { data: conv } = await supabase
    .from('conversations')
    .select('customer_id, professional_id')
    .eq('id', conversationId)
    .single();

  if (!conv || (conv.customer_id !== user.id && conv.professional_id !== user.id)) {
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

  revalidatePath('/mesajlar');
  revalidatePath(`/mesajlar/${conversationId}`);
  return { success: true, conversationId };
}

/**
 * Konuşmadaki okunmamış mesajları "okundu" olarak işaretle.
 */
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

  // Karşı tarafın gönderdiği okunmamış mesajları işaretle
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/mesajlar');
  return { success: true };
}
export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  // Bana gelen + henüz okumadığım mesajlar
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