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

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      bio,
      phone,
      city_id: cityId,
      primary_category_id: primaryCategoryId,
      company_name: companyName,
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: 'Kaydedilemedi: ' + error.message };
  }

  revalidatePath('/profil');
  revalidatePath('/profil/duzenle');
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

    const missing = getMissingPublishFields(profile as Profile);
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