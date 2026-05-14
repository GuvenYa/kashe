'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type ServiceFormData = {
  category_id: number;
  title: string;
  description: string | null;
  price_on_request: boolean;
  price_min: number | null;
  price_max: number | null;
  duration_hours: number | null;
};

export type ServiceActionResult = {
  success: boolean;
  error?: string;
  serviceId?: string;
};

function validateServiceData(data: ServiceFormData): string | null {
  if (!data.category_id || data.category_id <= 0) {
    return 'Kategori seçmen gerekiyor.';
  }
  if (!data.title || data.title.trim().length === 0) {
    return 'Başlık boş olamaz.';
  }
  if (data.title.length > 100) {
    return 'Başlık 100 karakterden uzun olamaz.';
  }
  if (data.description && data.description.length > 1000) {
    return 'Açıklama 1000 karakterden uzun olamaz.';
  }

  if (!data.price_on_request) {
    if (data.price_min === null || data.price_max === null) {
      return 'Fiyat aralığı girmelisin (veya "Talep üzerine" seç).';
    }
    if (data.price_min < 0 || data.price_max < 0) {
      return 'Fiyat negatif olamaz.';
    }
    if (data.price_min > data.price_max) {
      return 'Minimum fiyat maksimum fiyattan büyük olamaz.';
    }
    if (data.price_max > 10000000) {
      return 'Fiyat çok yüksek görünüyor.';
    }
  }

  if (data.duration_hours !== null) {
    if (data.duration_hours <= 0 || data.duration_hours > 999) {
      return 'Süre 0 ile 999 saat arasında olmalı.';
    }
  }

  return null;
}

export async function createService(data: ServiceFormData): Promise<ServiceActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const validationError = validateServiceData(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { data: inserted, error } = await supabase
    .from('services')
    .insert({
      profile_id: user.id,
      category_id: data.category_id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price_on_request: data.price_on_request,
      price_min: data.price_on_request ? null : data.price_min,
      price_max: data.price_on_request ? null : data.price_max,
      duration_hours: data.duration_hours,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: 'Eklenemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true, serviceId: inserted.id };
}

export async function updateService(
  serviceId: string,
  data: ServiceFormData
): Promise<ServiceActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const validationError = validateServiceData(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { error } = await supabase
    .from('services')
    .update({
      category_id: data.category_id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price_on_request: data.price_on_request,
      price_min: data.price_on_request ? null : data.price_min,
      price_max: data.price_on_request ? null : data.price_max,
      duration_hours: data.duration_hours,
    })
    .eq('id', serviceId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true };
}

export async function deleteService(serviceId: string): Promise<ServiceActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Silinemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true };
}

export async function toggleServiceActive(
  serviceId: string,
  isActive: boolean
): Promise<ServiceActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('services')
    .update({ is_active: isActive })
    .eq('id', serviceId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/hizmetlerim');
  revalidatePath('/profil');
  return { success: true };
}