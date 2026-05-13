'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      bio,
      phone,
      city_id: cityId,
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: 'Kaydedilemedi: ' + error.message };
  }

  revalidatePath('/profil');
  revalidatePath('/profil/duzenle');
  return { success: true };
}