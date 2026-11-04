import type { createClient } from '@/app/lib/supabase-server';

/**
 * AD GOSTERIMI "Ad S." (Duzeltme 05-E, urun karari — bulgu 66 d).
 *
 * BIREYSEL profesyonelin (rol `professional`) tam adi, iliskisi olmayan
 * herkese kisaltilmis gosterilir: soyadin ilk harfi + nokta. Sebep: kartta tam
 * ad soyad gorunurken kullanici platform disinda aranabiliyor.
 *
 * Tam ad YALNIZ su uc durumda gorunur:
 *   1. kisinin kendisi,
 *   2. platform yoneticisi (`is_admin`),
 *   3. bu profesyonelle ONAYLI ya da TAMAMLANMIS rezervasyonu olan karsi taraf.
 *
 * Ajans / kurulus adlari (`company_name`) DEGISMEZ — ticari unvan zaten
 * kamuya aciktir.
 *
 * SINIR (bilincli): bu UI duzeyinde bir gizlemedir. `v_providers_public.full_name`
 * anon role hala acik; API duzeyinde gizleme 10c-2 sonrasi ayri karardir.
 *
 * Bu modul ISTEMCIDEN de import edilebilir: Supabase istemcisi yalniz TIP
 * olarak alinir (`import type`), derlemede silinir — `next/headers` istemci
 * paketine girmez.
 */

/**
 * "Ayse Nur Kaya" -> "Ayse K." · "Kerem" -> "Kerem" · "" -> ""
 *
 * Ilk kelime oldugu gibi kalir, SON kelimenin ilk harfi (Turkce buyuk harf
 * kuraliyla) nokta ile eklenir. Tek kelimelik ad kisaltilmaz.
 */
export function kamuAdi(fullName: string | null | undefined): string {
  const ad = (fullName ?? '').trim().replace(/\s+/g, ' ');
  if (!ad) return '';
  const parcalar = ad.split(' ');
  if (parcalar.length === 1) return ad;
  const ilk = parcalar[0];
  const son = parcalar[parcalar.length - 1];
  const harf = son.slice(0, 1).toLocaleUpperCase('tr');
  return harf ? `${ilk} ${harf}.` : ilk;
}

/**
 * Gosterilecek ad: bireysel profesyonelde kisaltilir, digerlerinde oldugu gibi.
 *
 * `tamAd` true ise (kendisi / admin / rezervasyonlu karsi taraf) kisaltma YOK.
 * Kurulus hesaplarinda (`agency`, `business`) ticari unvan kullanildigi icin
 * rol kontrolu burada yapilir — cagiran her yuzeyde tekrar yazilmaz.
 */
export function gosterilecekAd(
  rol: string | null | undefined,
  fullName: string | null | undefined,
  tamAd: boolean
): string {
  const ad = (fullName ?? '').trim();
  if (tamAd || rol !== 'professional') return ad;
  return kamuAdi(ad);
}

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

/**
 * Bu ziyaretci bu saglayicinin TAM adini gorebilir mi? (sunucu)
 *
 * Olcut iletisim bilgisi kapisiyla AYNI: onayli ya da tamamlanmis rezervasyon
 * (`app/mesajlar/[id]/page.tsx` `contactUnlocked` ve DB'deki `get_contact_info`
 * ayni kurali uyguluyor) — yeni bir DB nesnesi EKLENMEDI.
 *
 * Rezervasyon okumasi ziyaretcinin KENDI satirlari uzerinden yapilir
 * (`customer_id = ziyaretci`); ucuncu kisi adina sayim yapilmaz (bulgu 29).
 * Iki rezervasyon sekli de kapsanir (FAZ 7c): eski sekilde `professional_id`,
 * teklif seklinde `seller_provider_id`.
 */
export async function tamAdGorebilirMi(
  supabase: SunucuIstemcisi,
  opts: {
    providerId: string;
    viewerId: string | null;
    viewerIsAdmin?: boolean;
  }
): Promise<boolean> {
  const { providerId, viewerId, viewerIsAdmin = false } = opts;
  if (!viewerId) return false;
  if (viewerId === providerId) return true;
  if (viewerIsAdmin) return true;

  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('customer_id', viewerId)
    .or(`professional_id.eq.${providerId},seller_provider_id.eq.${providerId}`)
    .in('status', ['confirmed', 'completed'])
    .limit(1);

  if (error) {
    // Hata halinde KISALTILMIS ad gosterilir (guvenli taraf).
    console.error('[kamu adi] rezervasyon kontrolu', error.code, error.message);
    return false;
  }
  return (data ?? []).length > 0;
}
