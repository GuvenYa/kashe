'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import {
  QUOTE_EXPIRY_OPTIONS,
  type QuoteExpiryKey,
} from '@/app/mesajlar/quotes-data';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// =============================================================================
// MÜŞTERİ TARAFI — Teklif talebi oluşturma + eşleştirme
// =============================================================================

type CreateQuoteRequestInput = {
  category_id: number;
  city_id: number | null;
  brief_data: Record<string, string> | null;
  event_date: string | null;
  event_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  share_budget: boolean;
  response_deadline_days: number | null;
  recipient_count: number;
  target_roles: ('professional' | 'agency')[];
};

export async function createQuoteRequest(
  input: CreateQuoteRequestInput
): Promise<ActionResult<{ id: string; matched: number }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Rol kontrolü — sadece client/business teklif toplayabilir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile) return { success: false, error: 'Profil bulunamadı' };
  if (profile.role !== 'client' && profile.role !== 'business') {
    return {
      success: false,
      error: 'Sadece hizmet alan hesaplar teklif toplayabilir',
    };
  }

  if (!input.category_id) {
    return { success: false, error: 'Kategori seçmelisin' };
  }

  // 1) Eşleştirme: kategori + (varsa şehir) + approved + published + hedef rol(ler)
  // Premium tier + premium_until de çekilir → premium profesyoneller öne sıralanır
  const roles =
    input.target_roles && input.target_roles.length > 0
      ? input.target_roles
      : ['professional', 'agency'];

  let matchQuery = supabase
    .from('profiles')
    .select('id, premium_tier, premium_until')
    .in('role', roles)
    .eq('approval_status', 'approved')
    .eq('is_published', true)
    .eq('primary_category_id', input.category_id);

  if (input.city_id) {
    matchQuery = matchQuery.eq('city_id', input.city_id);
  }

  const { data: matched, error: matchError } = await matchQuery;
  if (matchError) {
    return { success: false, error: 'Eşleştirme hatası: ' + matchError.message };
  }

  // Premium öncelikli sıralama (keşfet/kategori ile aynı tierWeight mantığı)
  const tierWeight = (tier: string | null, until: string | null): number => {
    if (!tier || tier === 'none') return 0;
    if (until && new Date(until).getTime() <= Date.now()) return 0;
    if (tier === 'agency') return 3;
    if (tier === 'plus') return 2;
    if (tier === 'premium') return 1;
    return 0;
  };

  const sortedMatched = (matched || []).slice().sort(
    (a, b) =>
      tierWeight(b.premium_tier, b.premium_until) -
      tierWeight(a.premium_tier, a.premium_until)
  );

  const matchedIds = sortedMatched.map((m) => m.id);

  if (matchedIds.length === 0) {
    return {
      success: false,
      error:
        'Bu kriterlere uygun profesyonel bulunamadı. Şehir filtresini kaldırmayı, rol hedefini genişletmeyi veya kategoriyi değiştirmeyi dene.',
    };
  }

  // Premium'lar başta — ilk N seçilir (öncelik premium'da)
  const selectedIds = matchedIds.slice(0, input.recipient_count);

  // 2) response_deadline hesapla
  let deadline: string | null = null;
  if (input.response_deadline_days) {
    const d = new Date();
    d.setDate(d.getDate() + input.response_deadline_days);
    deadline = d.toISOString();
  }

  // 3) Talebi oluştur
  const { data: newRequest, error: reqError } = await supabase
    .from('quote_requests')
    .insert({
      customer_id: user.id,
      category_id: input.category_id,
      city_id: input.city_id,
      brief_data: input.brief_data,
      event_date: input.event_date,
      event_type: input.event_type,
      budget_min: input.budget_min,
      budget_max: input.budget_max,
      share_budget: input.share_budget,
      response_deadline: deadline,
      recipient_count: selectedIds.length,
      status: 'active',
    })
    .select('id')
    .single();

  if (reqError || !newRequest) {
    return {
      success: false,
      error: 'Talep oluşturulamadı: ' + (reqError?.message ?? 'bilinmeyen'),
    };
  }

  // 4) Recipient'ları ekle
  const recipientRows = selectedIds.map((pid) => ({
    request_id: newRequest.id,
    professional_id: pid,
    status: 'sent' as const,
  }));

  const { error: recError } = await supabase
    .from('quote_request_recipients')
    .insert(recipientRows);

  if (recError) {
    return {
      success: false,
      error: 'Profesyonellere gönderilemedi: ' + recError.message,
    };
  }

  // Her recipient profesyonele bildirim — SECURITY DEFINER fonksiyon (RLS bypass)
  const { error: notifError } = await supabase.rpc(
    'notify_quote_request_recipients',
    {
      recipient_ids: selectedIds,
      notif_link: '/teklif-talepleri',
    }
  );

  if (notifError) {
    // Bildirim atılamazsa talep yine de oluştu — kritik değil, log
    console.error('Quote request notification failed:', notifError);
  }

  revalidatePath('/teklif-taleplerim');
  return {
    success: true,
    data: { id: newRequest.id, matched: selectedIds.length },
  };
}

// =============================================================================
// PROFESYONEL TARAFI — Teklif verme / reddetme
// =============================================================================

type SubmitOfferInput = {
  recipient_id: string;
  message: string;
  total_amount: number;
  services_description: string;
  cancellation_policy: string | null;
  expiry_key: QuoteExpiryKey;
};

export async function submitOffer(
  input: SubmitOfferInput
): Promise<ActionResult<{ conversationId: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Validation
  if (input.total_amount < 0) {
    return { success: false, error: 'Fiyat negatif olamaz' };
  }
  if (input.total_amount > 10_000_000) {
    return { success: false, error: 'Fiyat çok yüksek' };
  }
  if (input.services_description.trim().length < 10) {
    return { success: false, error: 'Hizmet açıklaması en az 10 karakter olmalı' };
  }
  if (input.services_description.length > 2000) {
    return { success: false, error: 'Hizmet açıklaması en fazla 2000 karakter' };
  }
  if (!input.message.trim()) {
    return { success: false, error: 'Mesaj boş olamaz' };
  }
  if (input.message.length > 2000) {
    return { success: false, error: 'Mesaj 2000 karakterden uzun olamaz' };
  }

  const expiryOption = QUOTE_EXPIRY_OPTIONS.find((o) => o.key === input.expiry_key);
  if (!expiryOption) {
    return { success: false, error: 'Geçersiz süre seçimi' };
  }

  // 1) Recipient doğrula
  const { data: recipient } = await supabase
    .from('quote_request_recipients')
    .select('id, request_id, professional_id, status, conversation_id')
    .eq('id', input.recipient_id)
    .single();

  if (!recipient) return { success: false, error: 'Talep bulunamadı' };
  if (recipient.professional_id !== user.id) {
    return { success: false, error: 'Bu talep sana ait değil' };
  }
  if (recipient.status === 'quoted') {
    return { success: false, error: 'Bu talebe zaten teklif verdin' };
  }
  if (recipient.status === 'declined') {
    return { success: false, error: 'Bu talebi reddetmiştin' };
  }

  // 2) Talebin bilgilerini al
  const { data: request } = await supabase
    .from('quote_requests')
    .select(
      'id, customer_id, status, brief_data, event_date, event_type, city_id, budget_min, budget_max, share_budget'
    )
    .eq('id', recipient.request_id)
    .single();

  if (!request) return { success: false, error: 'Talep bulunamadı' };
  if (request.status !== 'active') {
    return { success: false, error: 'Bu talep artık aktif değil' };
  }
  if (request.customer_id === user.id) {
    return { success: false, error: 'Kendi talebine teklif veremezsin' };
  }

 // 3) Conversation: bu customer ↔ professional çifti için zaten var mı?
  // (conversations_unique_pair constraint — çift başına tek conversation)
  const budgetRange =
    request.share_budget && (request.budget_min || request.budget_max)
      ? `${request.budget_min ?? '?'} - ${request.budget_max ?? '?'} TL`
      : null;

  let conversationId: string;

  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', request.customer_id)
    .eq('professional_id', user.id)
    .maybeSingle();

  if (existingConv) {
    // Zaten konuşma var — onu kullan, brief/etkinlik bilgilerini güncelle
    conversationId = existingConv.id;
    await supabase
      .from('conversations')
      .update({
        event_date: request.event_date,
        event_type: request.event_type,
        budget_range: budgetRange,
        brief_data: request.brief_data ?? null,
      })
      .eq('id', conversationId);
  } else {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        customer_id: request.customer_id,
        professional_id: user.id,
        event_date: request.event_date,
        event_type: request.event_type,
        location: null,
        guest_count: null,
        budget_range: budgetRange,
        brief_data: request.brief_data ?? null,
      })
      .select('id')
      .single();

    if (convError || !newConv) {
      return {
        success: false,
        error: 'Konuşma açılamadı: ' + (convError?.message ?? 'bilinmeyen'),
      };
    }
    conversationId = newConv.id;
  }

  // 4) Quote oluştur
  const expiresAt = new Date(
    Date.now() + expiryOption.hours * 60 * 60 * 1000
  ).toISOString();

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      total_amount: input.total_amount,
      services_description: input.services_description.trim(),
      cancellation_policy: input.cancellation_policy?.trim() || null,
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

  // 5) Mesajlar: not + quote referansı
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: input.message.trim(),
  });

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: 'Teklif gönderildi',
    message_type: 'quote',
    quote_id: quote.id,
  });

  // 6) Recipient güncelle
  const { error: recError } = await supabase
    .from('quote_request_recipients')
    .update({
      status: 'quoted',
      conversation_id: conversationId,
      responded_at: new Date().toISOString(),
    })
    .eq('id', recipient.id);

  if (recError) {
    console.error('Recipient update failed:', recError);
  }

  revalidatePath('/teklif-talepleri');
  revalidatePath('/mesajlar');
  return { success: true, data: { conversationId } };
}

export async function declineQuoteRequest(
  recipientId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: recipient } = await supabase
    .from('quote_request_recipients')
    .select('id, professional_id, status')
    .eq('id', recipientId)
    .single();

  if (!recipient) return { success: false, error: 'Talep bulunamadı' };
  if (recipient.professional_id !== user.id) {
    return { success: false, error: 'Bu talep sana ait değil' };
  }
  if (recipient.status === 'quoted') {
    return { success: false, error: 'Zaten teklif verdin, reddedemezsin' };
  }

  const { error } = await supabase
    .from('quote_request_recipients')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', recipientId);

  if (error) return { success: false, error: 'İşlem başarısız: ' + error.message };

  revalidatePath('/teklif-talepleri');
  return { success: true };
}

export async function markRequestViewed(
  recipientId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { error } = await supabase
    .from('quote_request_recipients')
    .update({ status: 'viewed' })
    .eq('id', recipientId)
    .eq('professional_id', user.id)
    .eq('status', 'sent');

  if (error) return { success: false, error: error.message };
  return { success: true };
}