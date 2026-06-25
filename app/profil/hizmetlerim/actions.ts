'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { PriceUnit } from '@/app/lib/types';

const VALID_UNITS: PriceUnit[] = ['total', 'hourly', 'half_day', 'full_day'];

export type ServiceFormData = {
  category_id: number;
  title: string;
  description: string | null;
  price_on_request: boolean;
  price_min: number | null;
  price_max: number | null;
  duration_hours: number | null;
  price_unit?: PriceUnit;
  price_starting?: boolean;
};

/**
 * §11 — Form verisinden DB fiyat alanlarını normalize eder (kararlar a/b/c/d):
 *  (c) görüşülür → birim/başlangıç yok sayılır (total/false)
 *  (b)(d) tek-fiyat modu (unit≠total VEYA starting) → (a) max = min
 *  total + not-starting → bugünkü aralık
 */
function normalizeServicePricing(data: ServiceFormData) {
  if (data.price_on_request) {
    return {
      price_on_request: true,
      price_min: null,
      price_max: null,
      price_unit: 'total' as PriceUnit,
      price_starting: false,
    };
  }
  const unit: PriceUnit = VALID_UNITS.includes(data.price_unit as PriceUnit)
    ? (data.price_unit as PriceUnit)
    : 'total';
  const starting = !!data.price_starting;
  if (unit !== 'total' || starting) {
    // tek-fiyat modu → max = min (CHECK price_range_valid için)
    return {
      price_on_request: false,
      price_min: data.price_min,
      price_max: data.price_min,
      price_unit: unit,
      price_starting: starting,
    };
  }
  return {
    price_on_request: false,
    price_min: data.price_min,
    price_max: data.price_max,
    price_unit: 'total' as PriceUnit,
    price_starting: false,
  };
}

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
    const unit = VALID_UNITS.includes(data.price_unit as PriceUnit)
      ? data.price_unit
      : 'total';
    const singleMode = unit !== 'total' || !!data.price_starting;

    if (singleMode) {
      // tek-fiyat modu → yalnız min zorunlu (max action'da min'e eşitlenir)
      if (data.price_min === null) {
        return 'Fiyat girmelisin (veya "Fiyat görüşülür" seç).';
      }
      if (data.price_min < 0) {
        return 'Fiyat negatif olamaz.';
      }
      if (data.price_min > 10000000) {
        return 'Fiyat çok yüksek görünüyor.';
      }
    } else {
      // total + not-starting → aralık (bugünkü)
      if (data.price_min === null || data.price_max === null) {
        return 'Fiyat aralığı girmelisin (veya "Fiyat görüşülür" seç).';
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

  const pricing = normalizeServicePricing(data);
  const { data: inserted, error } = await supabase
    .from('services')
    .insert({
      profile_id: user.id,
      category_id: data.category_id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price_on_request: pricing.price_on_request,
      price_min: pricing.price_min,
      price_max: pricing.price_max,
      price_unit: pricing.price_unit,
      price_starting: pricing.price_starting,
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

  const pricing = normalizeServicePricing(data);
  const { error } = await supabase
    .from('services')
    .update({
      category_id: data.category_id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price_on_request: pricing.price_on_request,
      price_min: pricing.price_min,
      price_max: pricing.price_max,
      price_unit: pricing.price_unit,
      price_starting: pricing.price_starting,
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