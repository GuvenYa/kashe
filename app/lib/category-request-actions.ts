'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { isUserSuspended } from '@/app/lib/check-suspension';

export type CategoryRequestInput = {
  categoryName: string;
  description: string | null;
  eventContext: string | null;
};

/**
 * Türkçe başlıktan URL-uyumlu slug üretir (admin/actions.ts ile aynı mantık).
 */
function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return input
    .trim()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Kullanıcı yeni kategori önerisi gönderir.
 * - Giriş şart (RLS de doğrular ama burada erken yakalıyoruz).
 * - Aynı kullanıcının aynı kategoriyi tekrar göndermesi dedupe edilir
 *   (sessizce başarılı görünür — UX bozulmasın).
 */
export async function createCategoryRequest(
  input: CategoryRequestInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'Öneri göndermek için giriş yapmalısın.',
    };
  }

  // Suspension kontrolü
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  // Validation
  const name = input.categoryName.trim();
  if (name.length < 2) {
    return { success: false, error: 'Kategori adı çok kısa.' };
  }
  if (name.length > 60) {
    return { success: false, error: 'Kategori adı en fazla 60 karakter olabilir.' };
  }

  const description = input.description?.trim() || null;
  if (description && description.length > 280) {
    return {
      success: false,
      error: 'Açıklama en fazla 280 karakter olabilir.',
    };
  }

  const eventContext = input.eventContext?.trim() || null;
  if (eventContext && eventContext.length > 50) {
    return { success: false, error: 'Etkinlik bağlamı geçersiz.' };
  }

  // Bu kategori zaten var mı? Yazılan isimden slug üret, mevcut kategorilerle karşılaştır.
  const requestedSlug = slugifyTr(name);
  if (requestedSlug) {
    const { data: existingCategory } = await supabase
      .from('service_categories')
      .select('id, name_tr')
      .eq('slug', requestedSlug)
      .maybeSingle();

    if (existingCategory) {
      return {
        success: false,
        error: `"${existingCategory.name_tr}" kategorisi zaten mevcut. Keşfet sayfasından filtreleyerek bulabilirsin.`,
      };
    }
  }

  // Dedupe: aynı kullanıcı, aynı normalize edilmiş kategori adı varsa
  // tekrar insert etme — UX'te başarılı görünür ama yeni kayıt eklenmez.
  const { data: existing } = await supabase
    .from('category_requests')
    .select('id')
    .eq('user_id', user.id)
    .ilike('category_name', name) // case-insensitive eşleşme
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { success: true };
  }

  const { error } = await supabase.from('category_requests').insert({
    user_id: user.id,
    category_name: name,
    description,
    event_context: eventContext,
    status: 'pending',
  });

  if (error) {
    console.error('[category-request] insert error:', error);
    return {
      success: false,
      error: 'Öneri gönderilemedi: ' + error.message,
    };
  }

  // Revalidate — kullanıcı dönüp aynı sayfaya geldiğinde dedupe çalışsın
  revalidatePath('/kesfet');
  revalidatePath('/');
  return { success: true };
}