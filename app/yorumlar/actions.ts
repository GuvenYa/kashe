'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { isUserSuspended } from '@/app/lib/check-suspension';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Yorum oluştur veya güncelle (upsert).
 * Şart: müşteri ile profesyonel arasında mesajlaşma (conversation) açık olmalı.
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
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  // Müşteri ile profesyonel arasındaki konuşmayı bul (en sonuncu)
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', user.id)
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convError) {
    return { success: false, error: convError.message };
  }

  if (!conversation) {
    return {
      success: false,
      error: 'Yorum yazmak için önce profesyonelle mesajlaşmalısın.',
    };
  }

  const trimmedBody = body?.trim() || null;

  // Mevcut yorumu kontrol et (upsert için)
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('conversation_id', conversation.id)
    .eq('customer_id', user.id)
    .maybeSingle();

  let reviewId: string;

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('reviews')
      .update({ rating, body: trimmedBody })
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
        customer_id: user.id,
        professional_id: professionalId,
        rating,
        body: trimmedBody,
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
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  // Silmeden önce profesyonel id'yi al (revalidate için)
  const { data: review } = await supabase
    .from('reviews')
    .select('professional_id')
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

  revalidatePath(`/p/${review.professional_id}`);
  revalidatePath(`/p/${review.professional_id}/yorumlar`);
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
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  // Yanıtladığı yorumun gerçekten kendisine ait olduğunu RLS zaten kontrol edecek,
  // ama revalidate için professional_id'yi alalım
  const { data: review } = await supabase
    .from('reviews')
    .select('professional_id')
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

  revalidatePath(`/p/${review.professional_id}`);
  revalidatePath(`/p/${review.professional_id}/yorumlar`);
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
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  const { data: review } = await supabase
    .from('reviews')
    .select('professional_id')
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

  revalidatePath(`/p/${review.professional_id}`);
  revalidatePath(`/p/${review.professional_id}/yorumlar`);
  return { success: true };
}