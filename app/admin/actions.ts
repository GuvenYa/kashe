'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Admin yetkisi doğrulama yardımcısı.
 * Bütün admin aksiyonlarının başında çağrılır.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, adminId: null, error: 'Giriş yapmalısın.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return { supabase, adminId: null, error: 'Bu işlem için yetkin yok.' };
  }

  return { supabase, adminId: user.id, error: null };
}

/**
 * Audit log'a kayıt — her admin aksiyonu izlenir.
 */
async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  notes?: string
) {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      notes: notes ?? null,
    });
  } catch (err) {
    console.error('[admin-audit] log error:', err);
  }
}

// ============================================================
// SUSPENSION (askıya alma) — A planı: login engellenir
// ============================================================

export async function banUser(
  userId: string,
  reason: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  if (userId === adminId) {
    return { success: false, error: 'Kendi hesabını askıya alamazsın.' };
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (target?.is_admin) {
    return {
      success: false,
      error: 'Admin kullanıcıları askıya alamazsın. Önce admin yetkisini kaldır.',
    };
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5) {
    return { success: false, error: 'Askıya alma sebebi en az 5 karakter olmalı.' };
  }
  if (trimmedReason.length > 500) {
    return { success: false, error: 'Askıya alma sebebi en fazla 500 karakter olabilir.' };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      suspended_at: new Date().toISOString(),
      suspension_reason: trimmedReason,
      suspended_by: adminId,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[admin] ban error:', updateError);
    return { success: false, error: 'Askıya alınamadı: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'ban_user', 'user', userId, trimmedReason);

  revalidatePath('/admin');
  revalidatePath('/admin/kullanicilar');
  return { success: true };
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      suspended_at: null,
      suspension_reason: null,
      suspended_by: null,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[admin] unban error:', updateError);
    return { success: false, error: 'Askı kaldırılamadı: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'unban_user', 'user', userId);

  revalidatePath('/admin');
  revalidatePath('/admin/kullanicilar');
  return { success: true };
}

// ============================================================
// ADMIN YETKİSİ
// ============================================================

export async function makeAdmin(userId: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  if (userId === adminId) {
    return { success: false, error: 'Zaten adminsin.' };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', userId);

  if (updateError) {
    console.error('[admin] make admin error:', updateError);
    return { success: false, error: 'Admin yapılamadı: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'make_admin', 'user', userId);

  revalidatePath('/admin/kullanicilar');
  return { success: true };
}

export async function removeAdmin(userId: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  if (userId === adminId) {
    return { success: false, error: 'Kendi admin yetkini kaldıramazsın.' };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_admin: false })
    .eq('id', userId);

  if (updateError) {
    console.error('[admin] remove admin error:', updateError);
    return { success: false, error: 'Admin yetkisi kaldırılamadı: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'remove_admin', 'user', userId);

  revalidatePath('/admin/kullanicilar');
  return { success: true };
}

// ============================================================
// İLAN ONAY (listing approval)
// ============================================================

export async function approveListing(listingId: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updateError } = await supabase
    .from('listings')
    .update({
      status: 'published',
      approval_note: null,
      published_at: new Date().toISOString(),
    })
    .eq('id', listingId);

  if (updateError) {
    console.error('[admin] approve listing error:', updateError);
    return { success: false, error: 'İlan onaylanamadı: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'approve_listing', 'listing', listingId);

  revalidatePath('/admin');
  revalidatePath('/admin/ilanlar');
  revalidatePath('/ilanlar');
  return { success: true };
}

export async function rejectListing(
  listingId: string,
  note: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const trimmedNote = note.trim();
  if (trimmedNote.length < 5) {
    return { success: false, error: 'Red sebebi en az 5 karakter olmalı.' };
  }
  if (trimmedNote.length > 1000) {
    return { success: false, error: 'Red sebebi en fazla 1000 karakter olabilir.' };
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update({ status: 'rejected', approval_note: trimmedNote })
    .eq('id', listingId);

  if (updateError) {
    console.error('[admin] reject listing error:', updateError);
    return { success: false, error: 'İlan reddedilemedi: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'reject_listing', 'listing', listingId, trimmedNote);

  revalidatePath('/admin');
  revalidatePath('/admin/ilanlar');
  return { success: true };
}

export async function requestListingRevision(
  listingId: string,
  note: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const trimmedNote = note.trim();
  if (trimmedNote.length < 5) {
    return { success: false, error: 'Revizyon notu en az 5 karakter olmalı.' };
  }
  if (trimmedNote.length > 1000) {
    return { success: false, error: 'Revizyon notu en fazla 1000 karakter olabilir.' };
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update({ status: 'revision', approval_note: trimmedNote })
    .eq('id', listingId);

  if (updateError) {
    console.error('[admin] request listing revision error:', updateError);
    return { success: false, error: 'Revizyon istenemedi: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'request_listing_revision', 'listing', listingId, trimmedNote);

  revalidatePath('/admin');
  revalidatePath('/admin/ilanlar');
  return { success: true };
}

// ============================================================
// PROFİL ONAY (profile approval)
// ============================================================

export async function approveProfile(profileId: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  // NOT: kaynak durum guard'ı YOK — pending/revision/rejected'in HEPSİNDEN onaylanır.
  // .select() ile etkilenen satırı doğrula: 0 satır → SESSİZ BAŞARI YOK, kullanıcıya hata.
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ approval_status: 'approved', approval_note: null }) // onayda not TEMİZLENİR
    .eq('id', profileId)
    .select('id, approval_status');

  if (updateError) {
    console.error('[admin] approve profile error:', updateError);
    return { success: false, error: 'Profil onaylanamadı: ' + updateError.message };
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Profil güncellenemedi (kayıt bulunamadı veya izin engeli).' };
  }
  // Değer gerçekten değişti mi? (bir koruma trigger'ı OLD'a geri sarmış olabilir → sessiz başarı YOK)
  if (updated[0].approval_status !== 'approved') {
    return { success: false, error: 'Durum güncellenemedi — bir koruma kuralı engellemiş olabilir.' };
  }

  await logAction(supabase, adminId, 'approve_profile', 'user', profileId);

  revalidatePath('/admin');
  revalidatePath('/admin/profiller');
  revalidatePath('/profil'); // kullanıcı kendi görünümü
  revalidatePath(`/p/${profileId}`); // public profil (artık onaylı → görünür)
  return { success: true };
}

export async function rejectProfile(
  profileId: string,
  note: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const trimmedNote = note.trim();
  if (trimmedNote.length < 5) {
    return { success: false, error: 'Red sebebi en az 5 karakter olmalı.' };
  }
  if (trimmedNote.length > 1000) {
    return { success: false, error: 'Red sebebi en fazla 1000 karakter olabilir.' };
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ approval_status: 'rejected', approval_note: trimmedNote })
    .eq('id', profileId)
    .select('id, approval_status');

  if (updateError) {
    console.error('[admin] reject profile error:', updateError);
    return { success: false, error: 'Profil reddedilemedi: ' + updateError.message };
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Profil güncellenemedi (kayıt bulunamadı veya izin engeli).' };
  }
  if (updated[0].approval_status !== 'rejected') {
    return { success: false, error: 'Durum güncellenemedi — bir koruma kuralı engellemiş olabilir.' };
  }

  await logAction(supabase, adminId, 'reject_profile', 'user', profileId, trimmedNote);

  revalidatePath('/admin');
  revalidatePath('/admin/profiller');
  revalidatePath('/profil');
  revalidatePath(`/p/${profileId}`);
  return { success: true };
}

export async function requestProfileRevision(
  profileId: string,
  note: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const trimmedNote = note.trim();
  if (trimmedNote.length < 5) {
    return { success: false, error: 'Revizyon notu en az 5 karakter olmalı.' };
  }
  if (trimmedNote.length > 1000) {
    return { success: false, error: 'Revizyon notu en fazla 1000 karakter olabilir.' };
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ approval_status: 'revision', approval_note: trimmedNote })
    .eq('id', profileId)
    .select('id, approval_status');

  if (updateError) {
    console.error('[admin] request profile revision error:', updateError);
    return { success: false, error: 'Revizyon istenemedi: ' + updateError.message };
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Profil güncellenemedi (kayıt bulunamadı veya izin engeli).' };
  }
  if (updated[0].approval_status !== 'revision') {
    return { success: false, error: 'Durum güncellenemedi — bir koruma kuralı engellemiş olabilir.' };
  }

  await logAction(supabase, adminId, 'request_profile_revision', 'user', profileId, trimmedNote);

  revalidatePath('/admin');
  revalidatePath('/admin/profiller');
  revalidatePath('/profil');
  revalidatePath(`/p/${profileId}`);
  return { success: true };
}
// ============================================================
// KATEGORİ TALEP ONAY (category request approval)
// ============================================================

export async function markCategoryRequestReviewing(
  requestId: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updateError } = await supabase
    .from('category_requests')
    .update({
      status: 'reviewing',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[admin] mark category reviewing error:', updateError);
    return {
      success: false,
      error: 'Talep güncellenemedi: ' + updateError.message,
    };
  }

  await logAction(
    supabase,
    adminId,
    'review_category_request',
    'category_request',
    requestId
  );

  revalidatePath('/admin');
  revalidatePath('/admin/kategori-talepleri');
  return { success: true };
}

export async function approveCategoryRequest(
  requestId: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updateError } = await supabase
    .from('category_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[admin] approve category error:', updateError);
    return {
      success: false,
      error: 'Talep onaylanamadı: ' + updateError.message,
    };
  }

  await logAction(
    supabase,
    adminId,
    'approve_category_request',
    'category_request',
    requestId
  );

  revalidatePath('/admin');
  revalidatePath('/admin/kategori-talepleri');
  return { success: true };
}

export async function declineCategoryRequest(
  requestId: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updateError } = await supabase
    .from('category_requests')
    .update({
      status: 'declined',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[admin] decline category error:', updateError);
    return {
      success: false,
      error: 'Talep reddedilemedi: ' + updateError.message,
    };
  }

  await logAction(
    supabase,
    adminId,
    'decline_category_request',
    'category_request',
    requestId
  );

  revalidatePath('/admin');
  revalidatePath('/admin/kategori-talepleri');
  return { success: true };
}
// ============================================================
// YORUM MODERASYON (review moderation) — sert silme
// ============================================================

export async function removeReview(
  reviewId: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  // Silmeden önce yorumun professional_id'sini al (revalidate için)
  const { data: review } = await supabase
    .from('reviews')
    .select('professional_id')
    .eq('id', reviewId)
    .single();

  if (!review) {
    return { success: false, error: 'Yorum bulunamadı.' };
  }

  // Yanıtları da silinsin (foreign key cascade yoksa manuel)
  await supabase.from('review_replies').delete().eq('review_id', reviewId);

  const { error: deleteError } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (deleteError) {
    console.error('[admin] remove review error:', deleteError);
    return {
      success: false,
      error: 'Yorum silinemedi: ' + deleteError.message,
    };
  }

  await logAction(
    supabase,
    adminId,
    'remove_review',
    'review',
    reviewId
  );

  revalidatePath('/admin/yorumlar');
  revalidatePath(`/p/${review.professional_id}`);
  revalidatePath(`/p/${review.professional_id}/yorumlar`);
  return { success: true };
}

export async function removeReviewReply(
  reviewId: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  // Yanıtı bul (var mı + professional_id için)
  const { data: review } = await supabase
    .from('reviews')
    .select('professional_id')
    .eq('id', reviewId)
    .single();

  if (!review) {
    return { success: false, error: 'Yorum bulunamadı.' };
  }

  const { error: deleteError } = await supabase
    .from('review_replies')
    .delete()
    .eq('review_id', reviewId);

  if (deleteError) {
    console.error('[admin] remove review reply error:', deleteError);
    return {
      success: false,
      error: 'Yanıt silinemedi: ' + deleteError.message,
    };
  }

  await logAction(
    supabase,
    adminId,
    'remove_review_reply',
    'review',
    reviewId
  );

  revalidatePath('/admin/yorumlar');
  revalidatePath(`/p/${review.professional_id}`);
  revalidatePath(`/p/${review.professional_id}/yorumlar`);
  return { success: true };
}
// =============================================================================
// Kategori — direkt ekleme (admin)
// =============================================================================

/**
 * Türkçe başlıktan URL-uyumlu slug üretir.
 * "Düğün Fotoğrafçısı" → "dugun-fotografcisi"
 */
function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return input
    .trim()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

type AddCategoryInput = {
  name_tr: string;
  slug: string;
  emoji: string | null;
  description: string | null;
  // Bu talepten oluşturuluyorsa, onaylama için id (opsiyonel)
  from_request_id?: string | null;
};

/**
 * ADMIN: service_categories'e yeni kategori ekler.
 * slug çakışması ve admin yetkisi kontrol edilir.
 */
export async function addCategory(
  input: AddCategoryInput
): Promise<{ success: boolean; error?: string; categoryId?: number }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  // Admin kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) {
    return { success: false, error: 'Bu işlem için yetkin yok.' };
  }

  const name = input.name_tr.trim();
  if (name.length < 2) {
    return { success: false, error: 'Kategori adı en az 2 karakter olmalı.' };
  }

  // Slug — boş gelirse addan üret, doluysa onu temizle
  let slug = input.slug.trim() ? slugifyTr(input.slug) : slugifyTr(name);
  if (!slug) {
    return { success: false, error: 'Geçerli bir slug üretilemedi.' };
  }

  // Slug çakışması kontrolü
  const { data: existing } = await supabase
    .from('service_categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: `"${slug}" slug'ı zaten kullanılıyor. Farklı bir slug gir.`,
    };
  }

  // sort_order — en sona ekle (mevcut max + 1)
  const { data: maxRow } = await supabase
    .from('service_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: newCat, error } = await supabase
    .from('service_categories')
    .insert({
      name_tr: name,
      slug,
      emoji: input.emoji?.trim() || null,
      description: input.description?.trim() || null,
      sort_order: nextSortOrder,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !newCat) {
    return {
      success: false,
      error: 'Kategori eklenemedi: ' + (error?.message ?? 'bilinmeyen'),
    };
  }

  // Bu bir talepten oluşturulduysa, talebi de approved yap (henüz değilse)
  if (input.from_request_id) {
    await supabase
      .from('category_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', input.from_request_id);
  }

  revalidatePath('/admin/kategori-talepleri');
  revalidatePath('/admin');
  revalidatePath('/kesfet');
  revalidatePath('/'); // anasayfa kategori listesi
  return { success: true, categoryId: newCat.id };
}
// ============================================================
// PREMIUM (manuel atama — iyzico öncesi)
// ============================================================

export async function grantPremium(
  userId: string,
  tier: 'premium' | 'plus' | 'agency',
  months: number
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  if (!['premium', 'plus', 'agency'].includes(tier)) {
    return { success: false, error: 'Geçersiz plan.' };
  }
  if (![1, 3, 6, 12].includes(months)) {
    return { success: false, error: 'Geçersiz süre.' };
  }

  const until = new Date();
  until.setMonth(until.getMonth() + months);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ premium_tier: tier, premium_until: until.toISOString() })
    .eq('id', userId);

  if (updateError) {
    console.error('[admin] grant premium error:', updateError);
    return { success: false, error: 'Premium verilemedi: ' + updateError.message };
  }

  await logAction(
    supabase,
    adminId,
    'grant_premium',
    'user',
    userId,
    `${tier} / ${months} ay`
  );

  revalidatePath('/admin/kullanicilar');
  revalidatePath('/admin');
  return { success: true };
}

export async function revokePremium(userId: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ premium_tier: 'none', premium_until: null })
    .eq('id', userId);

  if (updateError) {
    console.error('[admin] revoke premium error:', updateError);
    return { success: false, error: 'Premium kaldırılamadı: ' + updateError.message };
  }

  await logAction(supabase, adminId, 'revoke_premium', 'user', userId);

  revalidatePath('/admin/kullanicilar');
  revalidatePath('/admin');
  return { success: true };
}