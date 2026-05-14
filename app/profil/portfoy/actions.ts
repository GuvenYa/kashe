'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type PortfolioActionResult = {
  success: boolean;
  error?: string;
};

export async function deletePortfolioItem(
  itemId: string
): Promise<PortfolioActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  // Önce öğeyi bul (URL'sini öğrenmek için)
  const { data: item } = await supabase
    .from('portfolio_items')
    .select('media_url')
    .eq('id', itemId)
    .eq('profile_id', user.id)
    .single();

  if (!item) {
    return { success: false, error: 'Öğe bulunamadı.' };
  }

  // Storage'tan sil (URL'den path'i çıkar)
  // URL formatı: https://...supabase.co/storage/v1/object/public/portfolio/{userId}/{filename}
  const urlParts = item.media_url.split('/portfolio/');
  if (urlParts.length === 2) {
    const storagePath = urlParts[1].split('?')[0]; // cache-bust query'sini at
    await supabase.storage.from('portfolio').remove([storagePath]);
  }

  // DB'den sil
  const { error } = await supabase
    .from('portfolio_items')
    .delete()
    .eq('id', itemId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Silinemedi: ' + error.message };
  }

  revalidatePath('/profil/portfoy');
  revalidatePath('/profil');
  return { success: true };
}

export async function updatePortfolioCaption(
  itemId: string,
  caption: string
): Promise<PortfolioActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  if (caption.length > 200) {
    return { success: false, error: 'Açıklama 200 karakterden uzun olamaz.' };
  }

  const { error } = await supabase
    .from('portfolio_items')
    .update({ caption: caption.trim() || null })
    .eq('id', itemId)
    .eq('profile_id', user.id);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/portfoy');
  revalidatePath('/profil');
  return { success: true };
}