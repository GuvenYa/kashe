'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { isUserSuspended } from '@/app/lib/check-suspension';
import { sendPushToUser } from '@/app/lib/push-server';
import { canWriteForBusiness } from '@/app/lib/business-write';
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
  // Kimler başvurabilir override. null = ilan sahibinin profil varsayılanı kullanılır.
  allowed_applicant_roles: string[] | null;
  // Eğer true, status = 'published'; false, status = 'draft'
  publish_immediately: boolean;
  /** Kurum adına oluşturma — manager+ üye seçtiyse kurumun id'si (yoksa kendi adına) */
  on_behalf_business_id?: string | null;
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

  // Sahiplik = kurum adına ise kurumun id'si, değilse kullanıcının kendisi
  const ownerId = input.on_behalf_business_id ?? user.id;

  if (input.on_behalf_business_id) {
    // Kurum adına: profil rolü kontrolü ATLANIR; yetki üyelikten gelir (owner/manager)
    if (!(await canWriteForBusiness(input.on_behalf_business_id))) {
      return {
        success: false,
        error: 'Bu kurum adına ilan oluşturma yetkin yok.',
      };
    }
  } else {
    // Kendi adına: mevcut rol kuralı aynen (client/business)
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
      creator_id: ownerId,
      // Oluşturan üye izi: her zaman auth.uid() (kendi adına da, kurum adına da).
      // Kurum adına oluşturmada creator_id=kurum, created_by=üye → ayrışır.
      created_by: user.id,
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
      allowed_applicant_roles: input.allowed_applicant_roles,
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

  // Admin mi? (admin başkasının ilanını düzenleyebilir, tekrar onaya sokmadan)
  const { data: editorProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  const isAdmin = editorProfile?.is_admin ?? false;

  // Mevcut ilanı çek (yetki + status kontrolü)
  const { data: existing } = await supabase
    .from('listings')
    .select('id, creator_id, status')
    .eq('id', input.id)
    .single();

  if (!existing) return { success: false, error: 'İlan bulunamadı' };
  // Kurum ilanı ise manager+ üye de düzenleyebilir (kaynak üzerinde yetki)
  const canEditThis =
    existing.creator_id === user.id ||
    isAdmin ||
    (await canWriteForBusiness(existing.creator_id));
  if (!canEditThis) {
    return { success: false, error: 'Bu ilan senin değil' };
  }
  // Sahip için düzenlenebilirlik kontrolü; admin her durumda düzenleyebilir
  if (!isAdmin && !canEditListing(existing.status as ListingStatus)) {
    return { success: false, error: 'Bu ilan artık düzenlenemez' };
  }

  // Model 3: revision veya rejected ilan düzenlenince tekrar onaya gider.
  // AMA admin düzenlemesi direkt geçerli — tekrar onaya sokmaz (admin zaten onaylayıcı).
  const currentStatus = existing.status as ListingStatus;
  const shouldResubmit =
    !isAdmin &&
    (currentStatus === 'revision' || currentStatus === 'rejected');

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
  if (input.allowed_applicant_roles !== undefined)
    updateData.allowed_applicant_roles = input.allowed_applicant_roles;
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
    // Kurum ilanı: manager+ üye SADECE publish (→pending_approval, admin onayına)
    // ve restore (→draft) yapabilir. close/cancel = kurum sahibine özel (dilim 3).
    // NOT: publishListing 'published' DEĞİL 'pending_approval' üretir — gate buna göre.
    const isBusinessManager = await canWriteForBusiness(listing.creator_id);
    if (!isBusinessManager) {
      return { success: false, error: 'Bu ilan senin değil' };
    }
    if (newStatus !== 'pending_approval' && newStatus !== 'draft') {
      return {
        success: false,
        error: 'Bu işlem yalnızca kurum sahibine açıktır.',
      };
    }
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
 * ADMIN: Herhangi bir ilanı yayından kaldırır (→ cancelled).
 * Sadece admin çağırabilir. RLS "Admins can update any listing" izin verir.
 */
export async function adminCancelListing(
  listingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Admin kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) {
    return { success: false, error: 'Bu işlem için yetkin yok' };
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, status')
    .eq('id', listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı' };
  // Sadece yayında veya dolu ilan yayından kaldırılır
  if (listing.status !== 'published' && listing.status !== 'filled') {
    return {
      success: false,
      error: 'Sadece yayında veya dolu ilan yayından kaldırılabilir',
    };
  }

  const { error } = await supabase
    .from('listings')
    .update({ status: 'cancelled' })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'Yayından kaldırılamadı: ' + error.message };
  }

  revalidatePath('/ilanlar');
  revalidatePath('/ilanlarim');
  revalidatePath(`/ilanlar/${listingId}`);
  revalidatePath('/admin/ilanlar');
  revalidatePath('/admin');
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
    .select(
      'id, creator_id, status, application_deadline, allowed_applicant_roles'
    )
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

  // Başvuran rolü kısıtı — ilan override'ı varsa onu, yoksa ilan sahibinin
  // profil varsayılanını kullan. Başvuran bu role kümesinde değilse engelle.
  let effectiveRoles = listing.allowed_applicant_roles as string[] | null;
  if (!effectiveRoles || effectiveRoles.length === 0) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('default_allowed_applicant_roles')
      .eq('id', listing.creator_id)
      .single();
    effectiveRoles =
      (ownerProfile?.default_allowed_applicant_roles as string[] | null) ??
      ['professional', 'agency'];
  }

  if (!effectiveRoles.includes(profile.role)) {
    const onlyAgency =
      effectiveRoles.length === 1 && effectiveRoles[0] === 'agency';
    const onlyPro =
      effectiveRoles.length === 1 && effectiveRoles[0] === 'professional';
    const msg = onlyAgency
      ? 'Bu ilana yalnızca ajanslar başvurabilir.'
      : onlyPro
        ? 'Bu ilana yalnızca bireysel profesyoneller başvurabilir.'
        : 'Bu ilana başvuru için uygun hesap türüne sahip değilsin.';
    return { success: false, error: msg };
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

  // Web push — ilan sahibine yeni başvuru bildirimi (sessiz fail)
    try {
      const { data: applicantProfile } = await supabase
        .from('profiles')
        .select('full_name, company_name, role')
        .eq('id', user.id)
        .single();
      const applicantName =
        (applicantProfile?.role === 'business' ||
          applicantProfile?.role === 'agency') &&
        applicantProfile?.company_name
          ? applicantProfile.company_name
          : applicantProfile?.full_name || 'Biri';
      await sendPushToUser(listing.creator_id, {
        title: `${applicantName} ilanına başvurdu`,
        body: 'Yeni bir başvuru aldın. İncelemek için tıkla.',
        url: '/ilanlarim',
        tag: `application-${input.listing_id}`,
      });
    } catch (e) {
      console.error('[push] applyToListing error:', e);
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

  // Başvuru + ilan bilgisi (konuşma açmak için applicant_id + ilan detayları da gerekli)
  const { data: app } = await supabase
    .from('applications')
    .select(
      'id, listing_id, applicant_id, status, listings(creator_id, event_date, event_type, location, guest_count)'
    )
    .eq('id', applicationId)
    .single();

  if (!app) return { success: false, error: 'Başvuru bulunamadı' };

  const listingRel = app.listings as unknown as {
    creator_id: string;
    event_date: string | null;
    event_type: string | null;
    location: string | null;
    guest_count: number | null;
  };
  const listingCreator = listingRel?.creator_id;
  // Sahibi VEYA kurum adına manager+ üye kabul edebilir (kaynak üzerinde yetki).
  if (
    listingCreator !== user.id &&
    !(await canWriteForBusiness(listingCreator))
  ) {
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

  // 4) Müşteri ile kabul edilen profesyonel arasında konuşma aç (yoksa) +
  //    sistem mesajı düş. Böylece kabul sonrası iletişim kanalı hazır olur.
  // Konuşma müşterisi = ilan SAHİBİ (creator_id). Kurum ilanında bu KURUMUN id'si
  // (üyenin user.id'si DEĞİL) → attribution: pro her kanalda kurumu görür.
  // Sahip kabul ederse listingCreator === user.id, davranış birebir aynı.
  const customerId = listingCreator;
  const professionalId = app.applicant_id;

  // Var olan konuşmayı bul
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', customerId)
    .eq('professional_id', professionalId)
    .maybeSingle();

  let conversationId: string | null = existingConv?.id ?? null;

  // Etkinlik bilgisi — kabul edilen ilandan (çıta bunu gösterir)
  const eventInfo = {
    event_date: listingRel.event_date,
    event_type: listingRel.event_type,
    location: listingRel.location,
    guest_count: listingRel.guest_count,
  };

  if (!conversationId) {
    // Yeni konuşma — ilan bilgisiyle aç
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        customer_id: customerId,
        professional_id: professionalId,
        ...eventInfo,
      })
      .select('id')
      .single();
    conversationId = newConv?.id ?? null;
  } else {
    // Mevcut konuşma — çıtayı en son kabul edilen işin bilgisiyle güncelle (Yol A)
    await supabase
      .from('conversations')
      .update(eventInfo)
      .eq('id', conversationId);
  }

  // Sistem mesajı ekle. sender_id = aksiyonu alanın KENDİ uuid'si (attribution
  // kuralı, dilim 1): kurum adına kabul eden üye kendi id'siyle yazar; pro
  // tarafında ad kurum olarak görünür (konuşma customer_id = kurum). messages
  // RLS'i manager+ üyeye kendi sender_id'siyle insert izni verir (dilim 1).
  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: 'Başvurun kabul edildi. Detayları buradan konuşabilirsiniz.',
      message_type: 'system',
    });
    revalidatePath(`/mesajlar/${conversationId}`);
  }

  // Web push — başvurana "kabul edildin" bildirimi (sessiz fail).
  // ownerName = KURUM/sahip profilinden (listingCreator) — kurum adına kabul eden
  // üyenin adı DEĞİL; pro her kanalda kurumu görür (attribution kuralı).
    try {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name, company_name, role')
        .eq('id', listingCreator)
        .single();
      const ownerName =
        (ownerProfile?.role === 'business' ||
          ownerProfile?.role === 'agency') &&
        ownerProfile?.company_name
          ? ownerProfile.company_name
          : ownerProfile?.full_name || 'İlan sahibi';
      await sendPushToUser(professionalId, {
        title: 'Başvurun kabul edildi! 🎉',
        body: `${ownerName} başvurunu kabul etti. Detaylar için tıkla.`,
        url: conversationId ? `/mesajlar/${conversationId}` : '/basvurularim',
        tag: `application-accepted-${applicationId}`,
      });
    } catch (e) {
      console.error('[push] acceptApplication error:', e);
    }

    revalidatePath(`/ilanlar/${app.listing_id}`);
    revalidatePath('/basvurularim');
    revalidatePath('/ilanlarim');
    revalidatePath('/mesajlar');
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
    // Sahibi VEYA kurum adına manager+ üye (shortlist/reject) — kaynak üzerinde yetki.
    if (
      listingCreator !== user.id &&
      !(await canWriteForBusiness(listingCreator))
    ) {
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
/**
 * Admin: ilanı acil yap (öne çıkarma — acil etiketi). is_urgent=true +
 * urgent_until = now + days. Premium grant kalıbı, ilana özel + gün bazlı.
 * Doküman 12.3 ilan öne çıkarma. iyzico gelince satın almaya bağlanır;
 * şimdilik admin verir / kullanıcı simülasyonla dener.
 */
export async function adminGrantUrgent(
  listingId: string,
  days: number
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) {
    return { success: false, error: 'Bu işlem için yetkin yok' };
  }

  const validDays = [3, 7, 14].includes(days) ? days : 7;
  const until = new Date(
    Date.now() + validDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase
    .from('listings')
    .update({ is_urgent: true, urgent_until: until })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'Acil yapılamadı: ' + error.message };
  }

  // Audit log (best effort)
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'grant_urgent',
      target_type: 'listing',
      target_id: listingId,
      notes: `${validDays} gün acil etiketi`,
    });
  } catch (e) {
    console.error('[admin-audit] grant_urgent log error:', e);
  }

  revalidatePath('/admin/ilanlar');
  revalidatePath('/ilanlar');
  revalidatePath(`/ilanlar/${listingId}`);
  return { success: true };
}

/**
 * Admin: ilanın acil etiketini kaldır.
 */
export async function adminRevokeUrgent(
  listingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) {
    return { success: false, error: 'Bu işlem için yetkin yok' };
  }

  const { error } = await supabase
    .from('listings')
    .update({ is_urgent: false, urgent_until: null })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'Acil kaldırılamadı: ' + error.message };
  }

  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'revoke_urgent',
      target_type: 'listing',
      target_id: listingId,
    });
  } catch (e) {
    console.error('[admin-audit] revoke_urgent log error:', e);
  }

  revalidatePath('/admin/ilanlar');
  revalidatePath('/ilanlar');
  revalidatePath(`/ilanlar/${listingId}`);
  return { success: true };
}
/**
 * SİMÜLASYON: İlan sahibi kendi ilanını acil yapar (iyzico öncesi).
 * Gerçek ödeme YOK. Yalnızca KENDİ ilanına, yayında/dolu durumdaysa.
 * iyzico gelince gerçek ödemeye bağlanır. Doküman 12.3 ilan öne çıkarma.
 */
export async function activateUrgentSimulation(
  listingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return {
      success: false,
      error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com',
    };
  }

  // İlan sahibi mi + durum uygun mu?
  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id, status')
    .eq('id', listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı.' };
  if (listing.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil.' };
  }
  if (listing.status !== 'published' && listing.status !== 'filled') {
    return {
      success: false,
      error: 'Sadece yayında olan ilanlar öne çıkarılabilir.',
    };
  }

  const until = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase
    .from('listings')
    .update({ is_urgent: true, urgent_until: until })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'Öne çıkarılamadı: ' + error.message };
  }

  revalidatePath('/ilanlarim');
  revalidatePath('/ilanlar');
  revalidatePath(`/ilanlar/${listingId}`);
  return { success: true };
}

/** SİMÜLASYON: İlan sahibi kendi ilanının acil etiketini kaldırır. */
export async function cancelUrgentSimulation(
  listingId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id')
    .eq('id', listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı.' };
  if (listing.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil.' };
  }

  const { error } = await supabase
    .from('listings')
    .update({ is_urgent: false, urgent_until: null })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'Kaldırılamadı: ' + error.message };
  }

  revalidatePath('/ilanlarim');
  revalidatePath('/ilanlar');
  revalidatePath(`/ilanlar/${listingId}`);
  return { success: true };
}
// ---- ÖNE ÇIKARMA: Kategori üstü + Vitrin (admin + kullanıcı simülasyon) ----
// Acil'den farkı: tek bool yok, sadece "...until" tarihi. featured_category_until
// (kategori/ilan listesi üst sıra) veya featured_home_until (ana sayfa vitrini).

type FeaturedField = 'featured_category_until' | 'featured_home_until';

async function setFeatured(
  listingId: string,
  field: FeaturedField,
  until: string | null,
  requireOwner: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

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

  if (!listing) return { success: false, error: 'İlan bulunamadı.' };

  // Yetki: admin VEYA (kullanıcı simülasyonunda) ilan sahibi
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  const isAdmin = profile?.is_admin === true;

  if (requireOwner && !isAdmin && listing.creator_id !== user.id) {
    return { success: false, error: 'Bu ilan senin değil.' };
  }
  if (!requireOwner && !isAdmin) {
    return { success: false, error: 'Bu işlem için yetkin yok.' };
  }

  // Etkinleştirme (until dolu) sadece yayında/dolu ilan için
  if (until && listing.status !== 'published' && listing.status !== 'filled') {
    return {
      success: false,
      error: 'Sadece yayında olan ilanlar öne çıkarılabilir.',
    };
  }

  const { error } = await supabase
    .from('listings')
    .update({ [field]: until })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: 'İşlem başarısız: ' + error.message };
  }

  revalidatePath('/ilanlarim');
  revalidatePath('/ilanlar');
  revalidatePath('/admin/ilanlar');
  revalidatePath(`/ilanlar/${listingId}`);
  return { success: true };
}

function daysFromNow(days: number): string {
  const valid = [3, 7, 14].includes(days) ? days : 7;
  return new Date(Date.now() + valid * 24 * 60 * 60 * 1000).toISOString();
}

// --- Kategori üstü ---
export async function activateFeaturedCategorySimulation(
  listingId: string
): Promise<ActionResult> {
  return setFeatured(listingId, 'featured_category_until', daysFromNow(7), true);
}
export async function cancelFeaturedCategory(
  listingId: string
): Promise<ActionResult> {
  return setFeatured(listingId, 'featured_category_until', null, true);
}

// --- Vitrin (ana sayfa) ---
export async function activateFeaturedHomeSimulation(
  listingId: string
): Promise<ActionResult> {
  return setFeatured(listingId, 'featured_home_until', daysFromNow(7), true);
}
export async function cancelFeaturedHome(
  listingId: string
): Promise<ActionResult> {
  return setFeatured(listingId, 'featured_home_until', null, true);
}