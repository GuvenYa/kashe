'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getMissingPublishFields } from '@/app/lib/profile-helpers';
import type { Profile } from '@/app/lib/types';

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
};

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  // Mevcut onay durumunu al (revision ise kaydetme sonrası tekrar pending'e çekeceğiz)
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('approval_status')
    .eq('id', user.id)
    .single();
  const currentApproval = (currentProfile as { approval_status?: string } | null)
    ?.approval_status;

  const fullName = formData.get('full_name')?.toString().trim() || '';
  const bio = formData.get('bio')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;
  const cityIdRaw = formData.get('city_id')?.toString();
  const cityId = cityIdRaw && cityIdRaw !== '' ? parseInt(cityIdRaw, 10) : null;

  const primaryCategoryIdRaw = formData.get('primary_category_id')?.toString();
  const primaryCategoryId =
    primaryCategoryIdRaw && primaryCategoryIdRaw !== ''
      ? parseInt(primaryCategoryIdRaw, 10)
      : null;

  const companyName = formData.get('company_name')?.toString().trim() || null;

  // İlan başvuru varsayılanı: 'both' → iki rol, tek rol → o rol.
  // Sadece client/business gönderir; gelmezse mevcut değere dokunma.
  const defaultRolesRaw = formData.get('default_applicant_roles')?.toString();
  let defaultApplicantRoles: string[] | null = null;
  if (defaultRolesRaw === 'both') {
    defaultApplicantRoles = ['professional', 'agency'];
  } else if (
    defaultRolesRaw === 'professional' ||
    defaultRolesRaw === 'agency'
  ) {
    defaultApplicantRoles = [defaultRolesRaw];
  }

  // Kategoriye özel özellikler (attributes jsonb)
  let attributes: Record<string, unknown> = {};
  const attributesRaw = formData.get('attributes')?.toString();
  if (attributesRaw) {
    try {
      const parsed = JSON.parse(attributesRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        attributes = parsed;
      }
    } catch {
      // bozuk json — boş bırak
    }
  }

  // Validation
  if (!fullName) {
    return { success: false, error: 'Ad Soyad boş olamaz.' };
  }
  if (fullName.length > 100) {
    return { success: false, error: 'Ad Soyad 100 karakterden uzun olamaz.' };
  }
  if (bio && bio.length > 500) {
    return { success: false, error: 'Bio 500 karakterden uzun olamaz.' };
  }
  if (phone && !/^[0-9+\s()-]{7,20}$/.test(phone)) {
    return { success: false, error: 'Geçerli bir telefon numarası gir.' };
  }
  if (companyName && companyName.length > 200) {
    return { success: false, error: 'Şirket adı 200 karakterden uzun olamaz.' };
  }

  // Model 3: Sadece revision durumundaki profil, düzenlenince tekrar pending'e döner
  // (otomatik "tekrar incele"). approved/rejected/pending'e dokunulmaz.
  const updatePayload: Record<string, unknown> = {
    full_name: fullName,
    bio,
    phone,
    city_id: cityId,
    primary_category_id: primaryCategoryId,
    company_name: companyName,
    attributes,
  };

  // İlan başvuru varsayılanını yalnızca form gönderdiyse güncelle
  // (professional/agency formu bu alanı göndermez → değer korunur)
  if (defaultApplicantRoles !== null) {
    updatePayload.default_allowed_applicant_roles = defaultApplicantRoles;
  }

  if (currentApproval === 'revision') {
    updatePayload.approval_status = 'pending';
    updatePayload.approval_note = null; // eski revizyon notunu temizle
  }

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);

  if (error) {
    return { success: false, error: 'Kaydedilemedi: ' + error.message };
  }

  revalidatePath('/profil');
  revalidatePath('/profil/duzenle');
  revalidatePath('/admin/profiller');
  revalidatePath('/admin');
  return { success: true };
}

/**
 * Profili yayınla / yayından kaldır
 */
export async function togglePublish(publish: boolean): Promise<UpdateProfileResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  // Yayınlamadan önce alanları kontrol et
  if (publish) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'Profil bulunamadı.' };
    }

    // Model B: Sadece admin onayı (approved) almış profiller yayınlanabilir.
    // client onaysız çalışır (zaten yayınlanmıyor ama güvenlik için kontrol dışı).
    if (
      (profile as Profile).role !== 'client' &&
      (profile as { approval_status?: string }).approval_status !== 'approved'
    ) {
      return {
        success: false,
        error:
          'Profilin yayınlanabilmesi için önce admin onayı gerekiyor. Onay durumunu profil sayfanda görebilirsin.',
      };
    }

    // Profesyonel için aktif hizmetleri de çek (yayın şartı)
    let services: { is_active: boolean }[] = [];
    if ((profile as Profile).role === 'professional') {
      const { data: servicesData } = await supabase
        .from('services')
        .select('is_active')
        .eq('profile_id', user.id);
      services = servicesData || [];
    }

    const missing = getMissingPublishFields(
      profile as Profile,
      services as never
    );
    if (missing.length > 0) {
      return {
        success: false,
        error: 'Yayınlamak için şu alanları doldur: ' + missing.join(', '),
      };
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_published: publish })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: 'İşlem başarısız: ' + error.message };
  }

  revalidatePath('/profil');
  return { success: true };
}