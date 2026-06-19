'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type FavoriteActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Profesyoneli favorilere ekler.
 * - Sadece müşteri rolündeki kullanıcılar favori atabilir.
 * - Hedefin role='professional' olması zorunlu.
 * - Aynı profesyoneli iki kez favorileyemez (UNIQUE constraint).
 */
export async function addFavorite(
  professionalId: string
): Promise<FavoriteActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  // Kullanıcının rolünü kontrol et — sadece müşteri favori atabilir
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Profil bulunamadı.' };
  }

  if (profile.role !== 'client') {
    return {
      success: false,
      error: 'Sadece müşteri hesapları favori ekleyebilir.',
    };
  }

  // Hedefin profesyonel veya ajans olduğunu doğrula
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', professionalId)
    .single();

  if (targetError || !target) {
    return { success: false, error: 'Profil bulunamadı.' };
  }

  if (target.role !== 'professional' && target.role !== 'agency') {
    return {
      success: false,
      error: 'Sadece profesyoneller ve ajanslar favorilenebilir.',
    };
  }

  // Insert — UNIQUE constraint ile çift kayıt önleniyor
  const { error } = await supabase.from('favorites').insert({
    user_id: user.id,
    professional_id: professionalId,
  });

  if (error) {
    // Postgres unique violation kodu: 23505
    if (error.code === '23505') {
      return { success: false, error: 'Bu profesyonel zaten favorilerinizde.' };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/favoriler');

  return { success: true };
}

/**
 * Profesyoneli favorilerden çıkarır.
 */
export async function removeFavorite(
  professionalId: string
): Promise<FavoriteActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('professional_id', professionalId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/favoriler');
  revalidatePath('/kesfet');
  revalidatePath(`/p/${professionalId}`);

  return { success: true };
}

/**
 * Kullanıcının favorilediği profesyonellerin tam profil verisini döner.
 * /favoriler sayfası kullanır.
 */
export async function getUserFavorites() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { favorites: [], error: 'Oturum bulunamadı.' };
  }

  // JOIN ile favori + profil bilgisini tek sorguda al
  // FK adı yerine kolon adı (professional_id) ile referans → Supabase auto-resolve
  const { data, error } = await supabase
    .from('favorites')
    .select(
      `
      id,
      created_at,
      professional:professional_id (
        id,
        full_name,
        avatar_url,
        bio,
        company_name,
        city_id,
        primary_category_id,
        is_published,
        role
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { favorites: [], error: error.message };
  }

  // Yayında olmayan profesyonelleri filtrele (favoriliyken yayından çıkmış olabilir)
  const filtered = (data ?? []).filter(
    (fav) => fav.professional && (fav.professional as any).is_published
  );

  return { favorites: filtered, error: null };
}

/**
 * Belirli bir profesyonelin favorilenmiş olup olmadığını döner.
 * Profil detay sayfası ve keşfet kartlarındaki kalp ikonunun başlangıç durumu için.
 */
export async function isFavorited(professionalId: string): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Mevcut kullanıcının favorilediği TÜM profesyonel ID'lerini Set olarak döner.
 * Keşfet sayfasında her kartı tek tek isFavorited çağırmak yerine, sayfayı render etmeden
 * önce bu Set'i alıp prop olarak kartlara dağıtacağız. (N+1 sorgu önleme)
 */
export async function getFavoritedIds(): Promise<Set<string>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Set();

  const { data, error } = await supabase
    .from('favorites')
    .select('professional_id')
    .eq('user_id', user.id);

  if (error) return new Set();

  return new Set((data ?? []).map((f) => f.professional_id));
}