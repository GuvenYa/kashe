'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { isUserSuspended } from '@/app/lib/check-suspension';
import {
  validateListingInput,
  validateApplicationInput,
  canPublishListing,
  canCloseListing,
  canCancelListing,
  canRestoreListing,
  canEditListing,
  canApplyToListing,
  isDeadlinePassed,
  canWithdrawApplication,
  canShortlistApplication,
  canAcceptApplication,
  canRejectApplication,
  type ListingStatus,
  type ApplicationStatus,
} from './listings-data';

// =============================================================================
// Action result type
// =============================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// =============================================================================
// Listing CRUD
// =============================================================================

type CreateListingInput = {
  category_id: number;
  title: string;
  description: string;
  requirements: string | null;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  city_id: number | null;
  guest_count: number | null;
  budget_min: number | null;
  budget_max: number | null;
  application_deadline: string | null;
  // Eğer true, status = 'published'; false, status = 'draft'
  publish_immediately: boolean;
};

/**
 * Yeni ilan oluşturur. publish_immediately=true ise direkt yayına alır.
 */
export async function createListing(
  input: CreateListingInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  // Validation
  const validationError = validateListingInput({
    title: input.title,
    description: input.description,
    category_id: input.category_id,
  });
  if (validationError) return { success: false, error: validationError };

  // Rol kontrolü - sadece client veya business
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return { success: false, error: 'Profil bulunamadı' };
  if (profile.role !== 'client' && profile.role !== 'business') {
    return {
      success: false,
      error: 'Sadece müşteri veya kurumsal hesaplar ilan açabilir',
    };
  }

  // Bütçe tutarlılığı (DB de kontrol ediyor ama erken hata daha iyi UX)
  if (
    input.budget_min !== null &&
    input.budget_max !== null &&
    input.budget_min > input.budget_max
  ) {
    return { success: false, error: 'Minimum bütçe maksimumdan büyük olamaz' };
  }

  const { data: newListing, error } = await supabase
    .from('listings')
    .insert({
      creator_id: user.id,
      category_id: input.category_id,
      title: input.title.trim(),
      description: input.description.trim(),
      requirements: input.requirements?.trim() || null,
      event_date: input.event_date || null,
      event_type: input.event_type || null,
      location: input.location?.trim() || null,
      city_id: input.city_id,
      guest_count: input.guest_count,
      budget_min: input.budget_min,
      budget_max: input.budget_max,
      application_deadline: input.application_deadline,
      // Yayınla = admin onayına gönder (pending_approval). Aksi halde taslak.
      status: input.publish_immediately ? 'pending_approval' : 'draft',
    })
    .select('id')
    .single();

  if (error || !newListing) {
    return {
      success: false,
      error: 'İlan oluşturulamadı: ' + (error?.message ?? 'bilinmeyen'),
    };
  }

  revalidatePath('/ilanlar');
  revalidatePath('/ilanlarim');
  return { success: true, data: { id: newListing.id } };
}

type UpdateListingInput = Partial<Omit<CreateListingInput, 'publish_immediately'>> & {
  id: string;
};

/**
 * Mevcut ilanı günceller. Sadece sahibi yapabilir, sadece draft/published statusde.
 */
export async function updateListing(
  input: UpdateListingInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Mevcut ilanı çek (yetki + status kontrolü)
  const { data: existing } = await supabase
    .from('listings')
    .select('id, creator_id, status')
    .eq('id', input.id)
    .single();

  if (!existing) return { success: false, error: 'İlan bulunamadı' };
  if (existing.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil' };
  }
  if (!canEditListing(existing.status as ListingStatus)) {
    return { success: false, error: 'Bu ilan artık düzenlenemez' };
  }

  // Model 3: revision veya rejected ilan düzenlenince tekrar onaya gider (pending_approval).
  // published düzenlenince published kalır (karar a). draft draft kalır.
  const currentStatus = existing.status as ListingStatus;
  const shouldResubmit =
    currentStatus === 'revision' || currentStatus === 'rejected';

  // Yalnızca verilen alanları güncelle
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.description !== undefined)
    updateData.description = input.description.trim();
  if (input.requirements !== undefined)
    updateData.requirements = input.requirements?.trim() || null;
  if (input.event_date !== undefined) updateData.event_date = input.event_date;
  if (input.event_type !== undefined) updateData.event_type = input.event_type;
  if (input.location !== undefined)
    updateData.location = input.location?.trim() || null;
  if (input.city_id !== undefined) updateData.city_id = input.city_id;
  if (input.guest_count !== undefined)
    updateData.guest_count = input.guest_count;
  if (input.budget_min !== undefined) updateData.budget_min = input.budget_min;
  if (input.budget_max !== undefined) updateData.budget_max = input.budget_max;
  if (input.application_deadline !== undefined)
    updateData.application_deadline = input.application_deadline;
  if (input.category_id !== undefined)
    updateData.category_id = input.category_id;

  // Validation — title ve description varsa
  if (updateData.title || updateData.description) {
    const validationError = validateListingInput({
      title: (updateData.title as string) ?? 'placeholder12345', // bypass for non-update
      description:
        (updateData.description as string) ??
        'placeholder12345678901234567890123',
      category_id: 1, // bypass — kontrol etmiyoruz update'te
    });
    if (
      validationError &&
      (updateData.title || updateData.description) &&
      !validationError.includes('Kategori')
    ) {
      return { success: false, error: validationError };
    }
  }

  // Revision/rejected ilan düzenlenince tekrar onaya gönder + eski notu temizle
  if (shouldResubmit) {
    updateData.status = 'pending_approval';
    updateData.approval_note = null;
  }

  const { error } = await supabase
    .from('listings')
    .update(updateData)
    .eq('id', input.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/ilanlar');
  revalidatePath('/ilanlarim');
  revalidatePath(`/ilanlar/${input.id}`);
  revalidatePath('/admin/ilanlar');
  revalidatePath('/admin');
  return { success: true };
}

/**
 * Yayınla → admin onayına gönder (draft/revision/rejected → pending_approval).
 * Admin onaylayınca published olur.
 */
export async function publishListing(
  listingId: string
): Promise<ActionResult> {
  return updateListingStatus(listingId, 'pending_approval', canPublishListing);
}

/**
 * Published → closed geçişi (artık başvuru kabul etmiyor).
 */
export async function closeListing(
  listingId: string
): Promise<ActionResult> {
  return updateListingStatus(listingId, 'closed', canCloseListing);
}

/**
 * Draft veya published → cancelled (sahibi iptal ediyor).
 */
export async function cancelListing(
  listingId: string
): Promise<ActionResult> {
  return updateListingStatus(listingId, 'cancelled', canCancelListing);
}

/**
 * Cancelled → draft (iptal edilen ilanı geri al, tekrar düzenlenebilir/yayınlanabilir).
 */
export async function restoreListing(
  listingId: string
): Promise<ActionResult> {
  return updateListingStatus(listingId, 'draft', canRestoreListing);
}

/**
 * Status değişimi için iç yardımcı.
 */
async function updateListingStatus(
  listingId: string,
  newStatus: ListingStatus,
  validator: (current: ListingStatus) => boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id, status')
    .eq('id', listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı' };
  if (listing.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil' };
  }
  if (!validator(listing.status as ListingStatus)) {
    return {
      success: false,
      error: 'Bu işlem mevcut durumda yapılamaz',
    };
  }

  const { error } = await supabase
    .from('listings')
    .update({ status: newStatus })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/ilanlar');
  revalidatePath('/ilanlarim');
  revalidatePath(`/ilanlar/${listingId}`);
  return { success: true };
}

/**
 * Draft ilanı tamamen sil (sadece draft veya cancelled).
 */
export async function deleteListing(
  listingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id, status')
    .eq('id', listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı' };
  if (listing.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil' };
  }
  if (listing.status !== 'draft' && listing.status !== 'cancelled') {
    return {
      success: false,
      error: 'Sadece taslak veya iptal edilmiş ilan silinebilir',
    };
  }

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'Silinemedi: ' + error.message };
  }

  revalidatePath('/ilanlar');
  revalidatePath('/ilanlarim');
  return { success: true };
}

// =============================================================================
// Application — Profesyonel başvuru akışı
// =============================================================================

type ApplyToListingInput = {
  listing_id: string;
  cover_message: string;
  proposed_amount: number | null;
  attachment?: {
    path: string;
    type: 'image' | 'pdf' | 'doc';
    name: string;
  } | null;
};

/**
 * Profesyonel published ilana başvurur.
 */
export async function applyToListing(
  input: ApplyToListingInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  // Validation
  const validationError = validateApplicationInput({
    cover_message: input.cover_message,
    proposed_amount: input.proposed_amount,
  });
  if (validationError) return { success: false, error: validationError };

  // Rol kontrolü — profesyonel veya ajans başvurabilir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_published')
    .eq('id', user.id)
    .single();

  if (!profile) return { success: false, error: 'Profil bulunamadı' };
  if (profile.role !== 'professional' && profile.role !== 'agency') {
    return {
      success: false,
      error: 'Sadece profesyonel ve ajans hesapları başvurabilir',
    };
  }
  if (!profile.is_published) {
    return {
      success: false,
      error: 'Başvuru için profilini yayınlamalısın',
    };
  }

  // İlan published mı + başvuru süresi geçmemiş mi kontrol et
  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id, status, application_deadline')
    .eq('id', input.listing_id)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı' };
  if (!canApplyToListing(listing.status as ListingStatus)) {
    return { success: false, error: 'Bu ilana artık başvurulamıyor' };
  }
  if (isDeadlinePassed(listing.application_deadline)) {
    return { success: false, error: 'Bu ilanın başvuru süresi doldu' };
  }
  if (listing.creator_id === user.id) {
    return { success: false, error: 'Kendi ilanına başvuramazsın' };
  }

  // Ek dosya varsa path güvenliği — dosya bu kullanıcının klasöründe mi?
  const attachment = input.attachment ?? null;
  if (attachment && !attachment.path.startsWith(`${user.id}/`)) {
    return { success: false, error: 'Geçersiz dosya yolu.' };
  }

  // INSERT — UNIQUE constraint mevcut başvuruyu yakalayacak
  const { data: newApp, error } = await supabase
    .from('applications')
    .insert({
      listing_id: input.listing_id,
      applicant_id: user.id,
      cover_message: input.cover_message.trim(),
      proposed_amount: input.proposed_amount,
      status: 'pending',
      attachment_path: attachment?.path ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
    })
    .select('id')
    .single();

  if (error || !newApp) {
    // Başvuru başarısızsa yüklenen dosyayı temizle (best effort)
    if (attachment) {
      await supabase.storage
        .from('application-attachments')
        .remove([attachment.path]);
    }
    // UNIQUE constraint hatası — özel mesaj
    if (error?.code === '23505') {
      return {
        success: false,
        error: 'Bu ilana zaten başvurdun',
      };
    }
    return {
      success: false,
      error: 'Başvuru gönderilemedi: ' + (error?.message ?? 'bilinmeyen'),
    };
  }

  revalidatePath(`/ilanlar/${input.listing_id}`);
  revalidatePath('/basvurularim');
  return { success: true, data: { id: newApp.id } };
}

/**
 * Profesyonel kendi başvurusunu geri çeker.
 */
export async function withdrawApplication(
  applicationId: string
): Promise<ActionResult> {
  return updateApplicationStatus(
    applicationId,
    'withdrawn',
    canWithdrawApplication,
    'applicant'
  );
}

/**
 * İlan sahibi başvuruyu kısa listeye alır.
 */
export async function shortlistApplication(
  applicationId: string
): Promise<ActionResult> {
  return updateApplicationStatus(
    applicationId,
    'shortlisted',
    canShortlistApplication,
    'owner'
  );
}

/**
 * İlan sahibi başvuruyu kabul eder.
 *
 * NOT: Bu sadece status 'accepted' yapar. Faz 9 Parça 3'te buraya ek olarak:
 *   - İlanın status'u 'filled' yapılacak
 *   - Otomatik conversation oluşturulabilir
 * şimdilik basit tutuyoruz.
 */
export async function acceptApplication(
  applicationId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  // Başvuru + ilan bilgisi
  const { data: app } = await supabase
    .from('applications')
    .select('id, listing_id, status, listings(creator_id)')
    .eq('id', applicationId)
    .single();

  if (!app) return { success: false, error: 'Başvuru bulunamadı' };

  const listingCreator = (app.listings as unknown as { creator_id: string })
    ?.creator_id;
  if (listingCreator !== user.id) {
    return { success: false, error: 'Bu ilan senin değil' };
  }
  if (!canAcceptApplication(app.status as ApplicationStatus)) {
    return { success: false, error: 'Bu işlem mevcut durumda yapılamaz' };
  }

  // 1) Bu başvuruyu kabul et
  const { error: acceptErr } = await supabase
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId);
  if (acceptErr) {
    return { success: false, error: 'Kabul edilemedi: ' + acceptErr.message };
  }

  // 2) İlanı filled yap
  const { error: listingErr } = await supabase
    .from('listings')
    .update({ status: 'filled' })
    .eq('id', app.listing_id);
  if (listingErr) {
    return { success: false, error: 'İlan güncellenemedi: ' + listingErr.message };
  }

  // 3) Aynı ilandaki diğer açık başvuruları (pending/shortlisted) reddet
  await supabase
    .from('applications')
    .update({ status: 'rejected' })
    .eq('listing_id', app.listing_id)
    .neq('id', applicationId)
    .in('status', ['pending', 'shortlisted']);

  revalidatePath(`/ilanlar/${app.listing_id}`);
  revalidatePath('/basvurularim');
  revalidatePath('/ilanlarim');
  return { success: true };
}

/**
 * Dolmuş ilanı tekrar aç (filled → published).
 * Kabul edilen başvuru tekrar pending olur (yeniden değerlendirme).
 * Otomatik reddedilenler rejected kalır — sahip isterse tek tek geri alır.
 */
export async function reopenListing(
  listingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id, status')
    .eq('id', listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı' };
  if (listing.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil' };
  }
  if (listing.status !== 'filled') {
    return { success: false, error: 'Sadece dolmuş ilan tekrar açılabilir' };
  }

  // İlanı published yap
  const { error: listingErr } = await supabase
    .from('listings')
    .update({ status: 'published' })
    .eq('id', listingId);
  if (listingErr) {
    return { success: false, error: 'İlan açılamadı: ' + listingErr.message };
  }

  // Kabul edilen başvuruyu pending'e geri al
  await supabase
    .from('applications')
    .update({ status: 'pending' })
    .eq('listing_id', listingId)
    .eq('status', 'accepted');

  revalidatePath(`/ilanlar/${listingId}`);
  revalidatePath('/basvurularim');
  revalidatePath('/ilanlarim');
  return { success: true };
}

/**
 * Reddedilen başvuruyu geri al (rejected → pending).
 * Sadece ilan hâlâ published iken (dolmuş ilanda anlamsız).
 */
export async function unrejectApplication(
  applicationId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  const { data: app } = await supabase
    .from('applications')
    .select('id, listing_id, status, listings(creator_id, status)')
    .eq('id', applicationId)
    .single();

  if (!app) return { success: false, error: 'Başvuru bulunamadı' };

  const listingRel = app.listings as unknown as {
    creator_id: string;
    status: string;
  };
  if (listingRel?.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil' };
  }
  if (app.status !== 'rejected') {
    return { success: false, error: 'Sadece reddedilmiş başvuru geri alınabilir' };
  }
  if (listingRel.status !== 'published') {
    return {
      success: false,
      error: 'Başvuru geri almak için ilan açık olmalı',
    };
  }

  const { error } = await supabase
    .from('applications')
    .update({ status: 'pending' })
    .eq('id', applicationId);
  if (error) {
    return { success: false, error: 'Geri alınamadı: ' + error.message };
  }

  revalidatePath(`/ilanlar/${app.listing_id}`);
  revalidatePath('/basvurularim');
  revalidatePath('/ilanlarim');
  return { success: true };
}

/**
 * İlan sahibi başvuruyu reddeder.
 */
export async function rejectApplication(
  applicationId: string
): Promise<ActionResult> {
  return updateApplicationStatus(
    applicationId,
    'rejected',
    canRejectApplication,
    'owner'
  );
}

/**
 * Application status değişimi için iç yardımcı.
 * actor: 'applicant' (başvurucu kendi withdraw eder) ya da 'owner' (ilan sahibi yönetir)
 */
async function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus,
  validator: (current: ApplicationStatus) => boolean,
  actor: 'applicant' | 'owner'
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  // Application + listing creator'ı join'le çek
  const { data: app } = await supabase
    .from('applications')
    .select('id, listing_id, applicant_id, status, listings(creator_id)')
    .eq('id', applicationId)
    .single();

  if (!app) return { success: false, error: 'Başvuru bulunamadı' };

  // Yetki kontrolü
  const listingCreator = (app.listings as unknown as { creator_id: string })
    ?.creator_id;

  if (actor === 'applicant') {
    if (app.applicant_id !== user.id) {
      return { success: false, error: 'Bu başvuru senin değil' };
    }
  } else {
    if (listingCreator !== user.id) {
      return { success: false, error: 'Bu ilan senin değil' };
    }
  }

  if (!validator(app.status as ApplicationStatus)) {
    return {
      success: false,
      error: 'Bu işlem mevcut durumda yapılamaz',
    };
  }

  const { error } = await supabase
    .from('applications')
    .update({ status: newStatus })
    .eq('id', applicationId);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath(`/ilanlar/${app.listing_id}`);
  revalidatePath('/basvurularim');
  revalidatePath('/ilanlarim');
  return { success: true };
}

/**
 * İlan görüntülenme sayacını artır.
 * Sahibinin kendi sayfasını ziyaret etmesi sayılmaz.
 */
export async function incrementListingViews(
  listingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Listing'i çek
  const { data: listing } = await supabase
    .from('listings')
    .select('creator_id, views_count')
    .eq('id', listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı' };

  // Sahibi kendi sayfasını görüntülüyorsa sayma
  if (user && listing.creator_id === user.id) {
    return { success: true };
  }

  const { error } = await supabase
    .from('listings')
    .update({ views_count: (listing.views_count ?? 0) + 1 })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
// =============================================================================
// Başvuru eki — signed URL (private bucket)
// =============================================================================

/**
 * Bir başvuru ekinin signed URL'ini üretir.
 * Sadece başvuran ya da ilan sahibi erişebilir.
 */
export async function getApplicationAttachmentUrl(
  applicationId: string,
  attachmentPath: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Oturum bulunamadı.' };

  // Başvuru + ilan sahibini çek, erişimi doğrula
  const { data: app } = await supabase
    .from('applications')
    .select('id, applicant_id, attachment_path, listings(creator_id)')
    .eq('id', applicationId)
    .single();

  if (!app || !app.attachment_path) {
    return { error: 'Ek bulunamadı.' };
  }

  const listingCreator = (app.listings as unknown as { creator_id: string })
    ?.creator_id;

  const hasAccess =
    app.applicant_id === user.id || listingCreator === user.id;

  if (!hasAccess) {
    return { error: 'Bu eke erişimin yok.' };
  }

  // İstenen path gerçekten bu başvurunun eki mi?
  if (app.attachment_path !== attachmentPath) {
    return { error: 'Ek eşleşmedi.' };
  }

  const { data, error } = await supabase.storage
    .from('application-attachments')
    .createSignedUrl(attachmentPath, 3600);

  if (error || !data) {
    return { error: 'Bağlantı oluşturulamadı.' };
  }

  return { url: data.signedUrl };
}