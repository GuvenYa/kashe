'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { isUserSuspended } from '@/app/lib/check-suspension';
import { getOwnedBusinessIds } from '@/app/lib/business-write';
import { eskiKurumRolu, uyeliklerim } from '@/app/lib/uyelik';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Yorum oluştur veya güncelle (upsert).
 *
 * SART (Duzeltme 03-A / A5): yorum yazanin (ya da kurum adina yaziyorsa
 * kurumunun) o saglayiciyla TAMAMLANMIS bir rezervasyonu olmali. Arayuz bu
 * sarti zaten uyguluyordu (`yorum-button`), sunucu ise yalniz "ortak sohbet"
 * ariyordu — yani eylem dogrudan cagrilsa sohbeti olan herkes yorum
 * yazabiliyordu.
 *
 * Konusma kaydi SART OLARAK DEGIL CAPA olarak kalir: `reviews.conversation_id`
 * zorunlu ve tekillik (conversation_id, customer_id) uzerinden kuruluyor.
 */
export async function createOrUpdateReview(params: {
  professionalId: string;
  rating: number;
  body: string | null;
}): Promise<ActionResult<{ reviewId: string }>> {
  const { professionalId, rating, body } = params;

  if (rating < 1 || rating > 5) {
    return { success: false, error: 'Puan 1-5 arasında olmalı.' };
  }

  if (professionalId === '') {
    return { success: false, error: 'Profesyonel bulunamadı.' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: info@kashe.net' };
  }

  // Yorum bağlamını çöz: önce kendi adına (customer_id = user.id); yoksa owner-ROL
  // olunan kurumların konuşması → kurum adına yorum (dilim 3b). Bulunan konuşmanın
  // customer_id'si (kişi VEYA kurum) yoruma yazılır; created_by daima user.id.
  let conversation: { id: string; customer_id: string } | null = null;

  const { data: selfConv } = await supabase
    .from('conversations')
    .select('id, customer_id')
    .eq('customer_id', user.id)
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selfConv) {
    conversation = selfConv;
  } else {
    const ownedIds = await getOwnedBusinessIds();
    if (ownedIds.length > 0) {
      const { data: bizConv } = await supabase
        .from('conversations')
        .select('id, customer_id')
        .in('customer_id', ownedIds)
        .eq('professional_id', professionalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bizConv) conversation = bizConv;
    }
  }

  if (!conversation) {
    return {
      success: false,
      error:
        'Yorum bırakabilmek için bu profesyonelle tamamlanmış bir rezervasyonun olmalı.',
    };
  }

  // A5 — TAMAMLANMIS REZERVASYON SARTI. Iki rezervasyon sekli ayri sorgulanir
  // (CLAUDE.md FAZ 7c): eski sekil `customer_id` + `professional_id`, teklif
  // sekli `buyer_organization_id` + `seller_provider_id`. Kullanici kendi
  // rezervasyonunu RLS ile okur; baska kimsenin satiri gorunmez.
  const sahipKurumIdleri = (await uyeliklerim(supabase, user.id))
    .filter(
      (u) =>
        u.accountType === 'business' &&
        eskiKurumRolu(u.role, u.legacySource) === 'owner'
    )
    .map((u) => u.organizationId);

  const aliciKimlikleri = [user.id, ...(await getOwnedBusinessIds())];

  const { data: eskiSekil } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'completed')
    .in('customer_id', aliciKimlikleri)
    .eq('professional_id', professionalId)
    .limit(1);

  let tamamlanmisVar = (eskiSekil ?? []).length > 0;

  if (!tamamlanmisVar && sahipKurumIdleri.length > 0) {
    const { data: teklifSekli } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'completed')
      .in('buyer_organization_id', sahipKurumIdleri)
      .eq('seller_provider_id', professionalId)
      .limit(1);
    tamamlanmisVar = (teklifSekli ?? []).length > 0;
  }

  if (!tamamlanmisVar) {
    return {
      success: false,
      error:
        'Yorum bırakabilmek için bu profesyonelle tamamlanmış bir rezervasyonun olmalı.',
    };
  }

  const customerId = conversation.customer_id;
  const trimmedBody = body?.trim() || null;

  // Mevcut yorumu kontrol et (upsert için) — UNIQUE (conversation_id, customer_id)
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('conversation_id', conversation.id)
    .eq('customer_id', customerId)
    .maybeSingle();

  let reviewId: string;

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('reviews')
      .update({ rating, body: trimmedBody, created_by: user.id })
      .eq('id', existing.id)
      .select('id')
      .single();

    if (updateError || !updated) {
      return { success: false, error: updateError?.message ?? 'Güncellenemedi.' };
    }
    reviewId = updated.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('reviews')
      .insert({
        conversation_id: conversation.id,
        customer_id: customerId,
        provider_id: professionalId,
        rating,
        body: trimmedBody,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message ?? 'Oluşturulamadı.' };
    }
    reviewId = inserted.id;
  }

  revalidatePath(`/p/${professionalId}`);
  revalidatePath(`/p/${professionalId}/yorumlar`);
  return { success: true, data: { reviewId } };
}

/**
 * Müşterinin kendi yorumunu sil.
 */
export async function deleteReview(reviewId: string): Promise<ActionResult> {
  if (!reviewId) {
    return { success: false, error: 'Yorum bulunamadı.' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: info@kashe.net' };
  }

  // Silmeden önce profesyonel id'yi al (revalidate için)
  const { data: review } = await supabase
    .from('reviews')
    .select('provider_id')
    .eq('id', reviewId)
    .eq('customer_id', user.id)
    .maybeSingle();

  if (!review) {
    return { success: false, error: 'Yorum bulunamadı veya silme yetkin yok.' };
  }

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('customer_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/p/${review.provider_id}`);
  revalidatePath(`/p/${review.provider_id}/yorumlar`);
  return { success: true };
}

/**
 * Profesyonelin bir yoruma yanıt vermesi (upsert).
 */
export async function createOrUpdateReply(params: {
  reviewId: string;
  body: string;
}): Promise<ActionResult> {
  const { reviewId, body } = params;

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { success: false, error: 'Yanıt boş olamaz.' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: info@kashe.net' };
  }

  // Yanıtladığı yorumun gerçekten kendisine ait olduğunu RLS zaten kontrol edecek,
  // ama revalidate için provider_id'yi alalım
  const { data: review } = await supabase
    .from('reviews')
    .select('provider_id')
    .eq('id', reviewId)
    .maybeSingle();

  if (!review) {
    return { success: false, error: 'Yorum bulunamadı.' };
  }

  // Mevcut yanıt var mı?
  const { data: existing } = await supabase
    .from('review_replies')
    .select('id')
    .eq('review_id', reviewId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('review_replies')
      .update({ body: trimmed })
      .eq('id', existing.id);

    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from('review_replies')
      .insert({ review_id: reviewId, body: trimmed });

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/p/${review.provider_id}`);
  revalidatePath(`/p/${review.provider_id}/yorumlar`);
  return { success: true };
}

/**
 * Profesyonelin kendi yanıtını sil.
 */
export async function deleteReply(reviewId: string): Promise<ActionResult> {
  if (!reviewId) {
    return { success: false, error: 'Yanıt bulunamadı.' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: info@kashe.net' };
  }

  const { data: review } = await supabase
    .from('reviews')
    .select('provider_id')
    .eq('id', reviewId)
    .maybeSingle();

  if (!review) {
    return { success: false, error: 'Yorum bulunamadı.' };
  }

  const { error } = await supabase
    .from('review_replies')
    .delete()
    .eq('review_id', reviewId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/p/${review.provider_id}`);
  revalidatePath(`/p/${review.provider_id}/yorumlar`);
  return { success: true };
}