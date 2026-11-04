import type { createClient } from '@/app/lib/supabase-server';

/**
 * SAGLAYICI YAZMA YARDIMCILARI (FAZ 10c-1).
 *
 * Saglayici hesaplarinin (rol `professional` ya da `agency`, `providers` satiri
 * olan) pazaryeri alanlari artik SAGLAYICI TARAFINA yazilir:
 *   `providers`              -> city_id, district, service_radius_km,
 *                               is_published, attributes, category_attributes,
 *                               onay / askiya alma alanlari
 *   `professional_profiles`  -> headline, bio, experience_years, languages, equipment
 *   `organization_profiles`  -> about, team_size_range, can_full_service, ...
 *
 * `profiles`'taki ayni alanlar TERS AYNA ile dolan KOPYA olarak kalir; okuyan
 * 83 dosya degismez. Hesap alanlari (`full_name`, `company_name`, `phone`,
 * `avatar_url`, premium, `is_admin`, `role`) `profiles`'ta KALIR.
 *
 * KURAL TEKRARI YOK: onay gecisleri, "sahip onay alanina yazamaz" korumasi ve
 * tek istisna (`revision` -> `pending`, notu temizler) DB tetikleyicisinde.
 * Burada yalniz yazimi yapan ve SONUCU DOGRULAYAN ince bir katman var.
 *
 * SESSIZ BASARI YOK: her yazim `.select('id')` ile dondurulen satiri sayar;
 * 0 satir = RLS engeli ya da kayip satir -> Turkce hata.
 */

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

/** Saglayici alt profil tablolari. */
export type AltProfilTablosu =
  | 'professional_profiles'
  | 'organization_profiles';

/**
 * Bu kullanicinin `providers` satiri var mi?
 *
 * Rol kontrolu DEGIL: olcut satirin VARLIGI (FAZ 2a'da saglayici defteri
 * `professional` ve `agency` hesaplari icin dogar). Musteri ve isletme
 * hesaplarinda satir yoktur ve her sey `profiles`'ta kalir.
 */
export async function saglayiciMi(
  supabase: SunucuIstemcisi,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('providers')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[saglayici] satir kontrolu', error.code, error.message);
    return false;
  }
  return !!data;
}

/**
 * `providers` satirini guncelle. Donus: hata METNI ya da `null` (basari).
 *
 * Cagiran yalniz GRANT'li sutunlari gondermeli; onay alanlarina sahip
 * tarafindan yazilan deger tetikleyicide sessizce geri alinir (istisna
 * `revision` -> `pending`).
 */
export async function saglayiciGuncelle(
  supabase: SunucuIstemcisi,
  providerId: string,
  alanlar: Record<string, unknown>
): Promise<string | null> {
  if (Object.keys(alanlar).length === 0) return null;

  const { data, error } = await supabase
    .from('providers')
    .update(alanlar)
    .eq('id', providerId)
    .select('id');

  if (error) {
    console.error('[saglayici] guncelleme', error.code, error.message);
    return 'Kaydedilemedi: ' + error.message;
  }
  if (!data || data.length === 0) {
    return 'Sağlayıcı kaydı güncellenemedi (kayıt bulunamadı veya izin engeli).';
  }
  return null;
}

/**
 * Alt profili guncelle (`professional_profiles` / `organization_profiles`).
 *
 * Satir FAZ 2a ile saglayiciyla birlikte dogar; yoksa (eski/eksik kayit)
 * guncelleme 0 satir doner ve cagiran Turkce hata gorur — sessiz kayip yok.
 */
export async function altProfilGuncelle(
  supabase: SunucuIstemcisi,
  tablo: AltProfilTablosu,
  providerId: string,
  alanlar: Record<string, unknown>
): Promise<string | null> {
  if (Object.keys(alanlar).length === 0) return null;

  const { data, error } = await supabase
    .from(tablo)
    .update(alanlar)
    .eq('provider_id', providerId)
    .select('provider_id');

  if (error) {
    console.error('[saglayici] alt profil', tablo, error.code, error.message);
    return 'Kaydedilemedi: ' + error.message;
  }
  if (!data || data.length === 0) {
    return 'Profil ayrıntısı güncellenemedi (kayıt bulunamadı veya izin engeli).';
  }
  return null;
}

/**
 * Rolun alt profil tablosu. `professional` -> profesyonel profili,
 * `agency` -> kurulus profili; digerlerinde saglayici alt profili YOK.
 */
export function altProfilTablosu(
  rol: string | null | undefined
): AltProfilTablosu | null {
  if (rol === 'professional') return 'professional_profiles';
  if (rol === 'agency') return 'organization_profiles';
  return null;
}

/**
 * Serbest metin tanitim alaninin alt profildeki ADI.
 *
 * Profesyonelde `bio`, ajansta `about` — ayni form alani iki tabloda farkli
 * adla duruyor; esleme TEK YERDE.
 */
export function tanitimAlani(tablo: AltProfilTablosu): 'bio' | 'about' {
  return tablo === 'professional_profiles' ? 'bio' : 'about';
}
/**
 * Yonetim (onay / askiya alma) yazimindan donen DOGRULAMA satiri.
 *
 * Iki tabloda da ayni iki sutun okunur: `approval_status` ve `is_published`.
 * (`approval_note` istemciye SELECT ile kapali; yazilir, okunmaz.)
 */
export type YonetimSatiri = {
  id: string;
  approval_status: string | null;
  is_published: boolean | null;
};

/**
 * `tamam` AYIRT EDICI alandir: TypeScript birligi yalniz sabit (literal) bir
 * alanla daraltabiliyor — `hata` metninin dolu olup olmamasina bakmak satiri
 * `null` olmaktan cikarmiyordu.
 */
export type YonetimYazimSonucu =
  | { tamam: true; satir: YonetimSatiri; hata: null }
  | { tamam: false; satir: null; hata: string };

/**
 * ADMIN yonetim alanlarini DOGRU TARAFA yazar (FAZ 10c-1).
 *
 * `saglayici` true -> `providers` (politika `providers_update_admin`),
 * false -> `profiles` (musteri / isletme hesabi: `providers` satiri YOK).
 * Iki dal da ACIK YAZILIR: hangi tablonun yazildigi `from('...')` aramasiyla
 * gorunur kalsin (dinamik tablo adi denetlenemez).
 *
 * ONAY KURALLARI BURADA DEGIL: hangi gecisin serbest oldugunu DB tetikleyicisi
 * soyler. Burasi yalniz yazar ve ETKILENEN SATIRI DOGRULAR — 0 satir donerse
 * (kayip satir ya da RLS) sessiz basari yerine Turkce hata doner.
 */
export async function yonetimAlanlariniYaz(
  supabase: SunucuIstemcisi,
  hedefId: string,
  saglayici: boolean,
  alanlar: Record<string, unknown>,
  hataOneki: string
): Promise<YonetimYazimSonucu> {
  const { data, error } = saglayici
    ? await supabase
        .from('providers')
        .update(alanlar)
        .eq('id', hedefId)
        .select('id, approval_status, is_published')
    : await supabase
        .from('profiles')
        .update(alanlar)
        .eq('id', hedefId)
        .select('id, approval_status, is_published');

  if (error) {
    console.error('[admin] yonetim yazimi', saglayici, error.code, error.message);
    return { tamam: false, satir: null, hata: hataOneki + ': ' + error.message };
  }
  if (!data || data.length === 0) {
    return {
      tamam: false,
      satir: null,
      hata: 'Profil güncellenemedi (kayıt bulunamadı veya izin engeli).',
    };
  }
  return { tamam: true, satir: data[0] as YonetimSatiri, hata: null };
}
