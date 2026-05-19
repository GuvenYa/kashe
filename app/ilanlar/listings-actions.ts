'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import {
  validateListingInput,
  validateApplicationInput,
  canPublishListing,
  canCloseListing,
  canCancelListing,
  canEditListing,
  canApplyToListing,
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
      status: input.publish_immediately ? 'published' : 'draft',
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
  return { success: true };
}

/**
 * Draft → published geçişi.
 */
export async function publishListing(
  listingId: string
): Promise<ActionResult> {
  return updateListingStatus(listingId, 'published', canPublishListing);
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

  // Validation
  const validationError = validateApplicationInput({
    cover_message: input.cover_message,
    proposed_amount: input.proposed_amount,
  });
  if (validationError) return { success: false, error: validationError };

  // Rol kontrolü — sadece profesyonel başvurabilir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_published')
    .eq('id', user.id)
    .single();

  if (!profile) return { success: false, error: 'Profil bulunamadı' };
  if (profile.role !== 'professional') {
    return {
      success: false,
      error: 'Sadece profesyonel hesaplar başvurabilir',
    };
  }
  if (!profile.is_published) {
    return {
      success: false,
      error: 'Başvuru için profilini yayınlamalısın',
    };
  }

  // İlan published mı kontrol et
  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id, status')
    .eq('id', input.listing_id)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı' };
  if (!canApplyToListing(listing.status as ListingStatus)) {
    return { success: false, error: 'Bu ilana artık başvurulamıyor' };
  }
  if (listing.creator_id === user.id) {
    return { success: false, error: 'Kendi ilanına başvuramazsın' };
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
    })
    .select('id')
    .single();

  if (error || !newApp) {
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
  return updateApplicationStatus(
    applicationId,
    'accepted',
    canAcceptApplication,
    'owner'
  );
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