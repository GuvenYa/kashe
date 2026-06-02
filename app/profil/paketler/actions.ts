'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type PackageFormData = {
  title: string;
  description: string | null;
  includes: string[];
  price_on_request: boolean;
  price_min: number | null;
  price_max: number | null;
};

export type PackageActionResult = {
  success: boolean;
  error?: string;
  packageId?: string;
};

function validatePackageData(data: PackageFormData): string | null {
  if (!data.title || data.title.trim().length === 0) {
    return 'Başlık boş olamaz.';
  }
  if (data.title.length > 100) {
    return 'Başlık 100 karakterden uzun olamaz.';
  }
  if (data.description && data.description.length > 1000) {
    return 'Açıklama 1000 karakterden uzun olamaz.';
  }

  const cleanIncludes = data.includes
    .map((i) => i.trim())
    .filter((i) => i.length > 0);
  if (cleanIncludes.length === 0) {
    return 'Pakete en az 1 madde eklemelisin (neler dahil?).';
  }
  if (cleanIncludes.length > 20) {
    return 'En fazla 20 madde ekleyebilirsin.';
  }
  if (cleanIncludes.some((i) => i.length > 200)) {
    return 'Her madde en fazla 200 karakter olabilir.';
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

  return null;
}

function cleanIncludes(includes: string[]): string[] {
  return includes.map((i) => i.trim()).filter((i) => i.length > 0).slice(0, 20);
}

export async function createPackage(
  data: PackageFormData
): Promise<PackageActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const validationError = validatePackageData(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { data: inserted, error } = await supabase
    .from('service_packages')
    .insert({
      profile_id: user.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      includes: cleanIncludes(data.includes),
      price_on_request: data.price_on_request,
      price_min: data.price_on_request ? null : data.price_min,
      price_max: data.price_on_request ? null : data.price_max,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: 'Eklenemedi: ' + error.message };
  }

  revalidatePath('/profil/paketler');
  revalidatePath('/profil');
  return { success: true, packageId: inserted.id };
}

export async function updatePackage(
  packageId: string,
  data: PackageFormData
): Promise<PackageActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const validationError = validatePackageData(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { error } = await supabase
    .from('service_packages')
    .update({
      title: data.title.trim(),
      description: data.description?.trim() || null,
      includes: cleanIncludes(data.includes),
      price_on_request: data.price_on_request,
      price_min: data.price_on_request ? null : data.price_min,
      price_max: data.price_on_request ? null : data.price_max,
    })
    .eq('id', packageId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/paketler');
  revalidatePath('/profil');
  return { success: true };
}

export async function deletePackage(
  packageId: string
): Promise<PackageActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('service_packages')
    .delete()
    .eq('id', packageId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Silinemedi: ' + error.message };
  }

  revalidatePath('/profil/paketler');
  revalidatePath('/profil');
  return { success: true };
}

export async function togglePackageActive(
  packageId: string,
  isActive: boolean
): Promise<PackageActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('service_packages')
    .update({ is_active: isActive })
    .eq('id', packageId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/paketler');
  revalidatePath('/profil');
  return { success: true };
}
