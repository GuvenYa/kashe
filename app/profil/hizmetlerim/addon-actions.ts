'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type AddonFormData = {
  service_id: string;
  title: string;
  description: string | null;
  price: number;
};

export type AddonActionResult = {
  success: boolean;
  error?: string;
  addonId?: string;
};

function validateAddon(data: AddonFormData): string | null {
  if (!data.service_id) return 'Hizmet bulunamadı.';
  if (!data.title || data.title.trim().length === 0) {
    return 'Ekstra adı boş olamaz.';
  }
  if (data.title.length > 100) {
    return 'Ekstra adı 100 karakterden uzun olamaz.';
  }
  if (data.description && data.description.length > 500) {
    return 'Açıklama 500 karakterden uzun olamaz.';
  }
  if (data.price < 0) return 'Fiyat negatif olamaz.';
  if (data.price > 10000000) return 'Fiyat çok yüksek görünüyor.';
  return null;
}

export async function createAddon(
  data: AddonFormData
): Promise<AddonActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const validationError = validateAddon(data);
  if (validationError) return { success: false, error: validationError };

  // Hizmet gerçekten bu kullanıcıya mı ait? (güvenlik)
  const { data: service } = await supabase
    .from('services')
    .select('id, profile_id')
    .eq('id', data.service_id)
    .single();
  if (!service || service.profile_id !== user.id) {
    return { success: false, error: 'Bu hizmet sana ait değil.' };
  }

  const { data: inserted, error } = await supabase
    .from('service_addons')
    .insert({
      service_id: data.service_id,
      profile_id: user.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price: data.price,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: 'Eklenemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true, addonId: inserted.id };
}

export async function updateAddon(
  addonId: string,
  data: AddonFormData
): Promise<AddonActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const validationError = validateAddon(data);
  if (validationError) return { success: false, error: validationError };

  const { error } = await supabase
    .from('service_addons')
    .update({
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price: data.price,
    })
    .eq('id', addonId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true };
}

export async function deleteAddon(
  addonId: string
): Promise<AddonActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const { error } = await supabase
    .from('service_addons')
    .delete()
    .eq('id', addonId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Silinemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true };
}

export async function toggleAddonActive(
  addonId: string,
  isActive: boolean
): Promise<AddonActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const { error } = await supabase
    .from('service_addons')
    .update({ is_active: isActive })
    .eq('id', addonId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true };
}