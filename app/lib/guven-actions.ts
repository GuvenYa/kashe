'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { ITIRAZ_MAX, ITIRAZ_MIN } from '@/app/lib/guven';

/**
 * GUVEN ITIRAZI — yazma (FAZ 9c).
 *
 * ILKE (8a deseni): yazma DOGRUDAN TABLOYA (`trust_appeals`), kurallar DB'de.
 * `created_by` ve `snapshot_id` tetikleyici dolduruyor — uygulama yazmaz.
 * UPDATE/DELETE hakki YOK: itiraz geri alinamaz, yalniz admin karar verir.
 *
 * Kullanicinin metni OLDUGU GIBI yazilir: kirpma disinda bir duzeltme,
 * kisaltma ya da bicimleme yapilmaz.
 *
 * Uzunluk siniri UI'da da kontrol edilir ama bu bir KOPYA KURAL DEGIL:
 * DB CHECK'i tek gercek, buradaki kontrol kullaniciyi bos bir sunucu turundan
 * kurtarmak icin. Sinir degerleri `guven.ts`'ten (tek kaynak) geliyor.
 */
export type ItirazSonucu = { ok: true } | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UZUNLUK_METNI = `İtiraz metni ${ITIRAZ_MIN}–${ITIRAZ_MAX} karakter olmalı.`;

export async function itirazAc(
  providerId: string,
  message: string
): Promise<ItirazSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: 'Oturum gerekiyor.' };
  if (!UUID.test(providerId)) {
    return { ok: false, error: 'Sağlayıcı kaydı geçersiz.' };
  }

  const metin = (message ?? '').trim();
  if (metin.length < ITIRAZ_MIN || metin.length > ITIRAZ_MAX) {
    return { ok: false, error: UZUNLUK_METNI };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('trust_appeals')
    .insert({ provider_id: providerId, message: metin });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Zaten açık bir itirazın var; sonucu bekle.' };
    }
    if (error.code === '23514') return { ok: false, error: UZUNLUK_METNI };
    if (error.code === '42501') {
      return { ok: false, error: 'Bu döküm için itiraz yetkin yok.' };
    }
    console.error('[guven] itiraz', error.code, error.message);
    return { ok: false, error: 'İtiraz gönderilemedi, tekrar dene.' };
  }

  // Dokum iki yuzeyde gorunuyor; ikisi de tazelenir.
  revalidatePath('/profil');
  revalidatePath('/ajans');
  return { ok: true };
}
