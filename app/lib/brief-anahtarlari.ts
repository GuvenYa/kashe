import type { BriefField } from '@/app/lib/brief-config';
import type { createClient } from '@/app/lib/supabase-server';
import { gosterilecekAd } from '@/app/lib/kamu-adi';

/**
 * BRIEF EK ANAHTARLARI — TEK KAYNAK (Duzeltme 10-D/E).
 *
 * Form iki yeni tur deger yaziyor; ikisi de ANA ALANIN anahtarindan turetilir,
 * boylece ozet / dogrulama / cizim ayni kurali okur:
 *
 *   `<key>_esnek`    (mantiksal) tarih henuz belli degil  -> E2
 *   `<key>_aciklama` (metin, 120) "Diger" secildiginde    -> E3
 *
 * Sonekler BURADA tanimlidir: cizici, brief ozeti ve kaydeden eylem ayni
 * sabitleri kullanir — anahtar adi uc yerde elle yazilmaz.
 */

export const BRIEF_ESNEK_SONEKI = '_esnek';
export const BRIEF_ACIKLAMA_SONEKI = '_aciklama';

/**
 * EKIP TERCIHI (Duzeltme 11-B2): ajans uzerinden teklif isterken musteri
 * hangi ekip uyesini tercih ettigini secebilir. Kimlik ve ad AYRI anahtarda:
 * kimlik sunucuda dogrulanir, ad sunucuda kamu ad kuraliyla YENIDEN uretilir.
 */
const UUID_DESENI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const BRIEF_TERCIH_UYE = 'tercih_uye';
export const BRIEF_TERCIH_UYE_ADI = 'tercih_uye_adi';

/**
 * Alan tanimi OLMAYAN ama anlami bilinen anahtarlarin etiketleri — TEK KAYNAK.
 * Brief ozetini cizen uc yuzey (sohbet seridi + iki teklif talebi sayfasi)
 * bu haritayi okur; etiket metni uc yerde elle yazilmaz.
 */
export const BRIEF_OZEL_ETIKETLER: Record<string, string> = {
  hizmet: 'Seçilen hizmet',
  [BRIEF_TERCIH_UYE_ADI]: 'Tercih edilen ekip üyesi',
};

/** Arayuzde HIC gosterilmeyen ic anahtarlar (ham kimlik). */
export const BRIEF_GIZLI_ANAHTARLAR: ReadonlySet<string> = new Set([
  BRIEF_TERCIH_UYE,
]);

/** `<key>_aciklama` ise ana alanin anahtari, degilse `null`. */
export function aciklamaAnaAnahtari(key: string): string | null {
  return key.endsWith(BRIEF_ACIKLAMA_SONEKI)
    ? key.slice(0, -BRIEF_ACIKLAMA_SONEKI.length)
    : null;
}

/** `<key>_esnek` ise ana alanin anahtari, degilse `null`. */
export function esnekAnaAnahtari(key: string): string | null {
  return key.endsWith(BRIEF_ESNEK_SONEKI)
    ? key.slice(0, -BRIEF_ESNEK_SONEKI.length)
    : null;
}

/** Metin uzunluk siniri (`<key>_aciklama`). */
export const BRIEF_ACIKLAMA_SINIRI = 120;

/** `hizmet` (secilen hizmet / paket basligi) uzunluk siniri. */
const BRIEF_HIZMET_SINIRI = 200;

/**
 * Bu alan IL alani mi? (Duzeltme 10-D)
 *
 * Olcut ANAHTAR: `location` / `city` (ve `_city` ile bitenler). Tur `text`
 * kaliyor — legacy sutun ve `brief_data` anahtari degismesin diye; yalniz
 * GIRIS bicimi secici oluyor.
 */
export function briefIlAlani(field: Pick<BriefField, 'key' | 'type'>): boolean {
  if (field.type !== 'text') return false;
  return (
    field.key === 'location' ||
    field.key === 'city' ||
    field.key.endsWith('_city')
  );
}

/**
 * SUNUCU TARAFI TEMIZLIK (Duzeltme 10-E5).
 *
 * Yeni iki anahtar istemciden METIN olarak geliyor; kaydeden eylem tipi ve
 * uzunlugu burada sabitler:
 *   `<key>_aciklama` -> en fazla 120 karakter, bos ise ANAHTAR DUSER,
 *   `<key>_esnek`    -> MANTIKSAL (`true`); kapali / gecersiz ise anahtar duser.
 *
 * Diger anahtarlar DEGISMEZ (mevcut davranis korunur).
 */
export function briefVeriTemizle(
  ham: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!ham || typeof ham !== 'object') return null;
  const cikti: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ham)) {
    if (k.endsWith(BRIEF_ACIKLAMA_SONEKI)) {
      const metin = typeof v === 'string' ? v.trim().slice(0, BRIEF_ACIKLAMA_SINIRI) : '';
      if (metin) cikti[k] = metin;
      continue;
    }
    if (k.endsWith(BRIEF_ESNEK_SONEKI)) {
      const acik = v === true || v === '1' || v === 'true';
      if (acik) cikti[k] = true;
      continue;
    }
    if (k === BRIEF_TERCIH_UYE) {
      // Kimlik SEKIL olarak suzulur; iliski kontrolu `briefTercihUygula`da.
      const ham = typeof v === 'string' ? v.trim() : '';
      if (UUID_DESENI.test(ham)) cikti[k] = ham;
      continue;
    }
    if (k === BRIEF_TERCIH_UYE_ADI) {
      // Istemci metnine GUVENILMEZ: ad sunucuda yeniden uretilir.
      continue;
    }
    if (k === 'hizmet') {
      const metin = typeof v === 'string' ? v.trim().slice(0, BRIEF_HIZMET_SINIRI) : '';
      if (metin) cikti[k] = metin;
      continue;
    }
    cikti[k] = v;
  }
  return Object.keys(cikti).length > 0 ? cikti : null;
}

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

/**
 * EKIP TERCIHI DOGRULAMASI (Duzeltme 11-B3) — SUNUCU.
 *
 * Istemci `tercih_uye` olarak herhangi bir kimlik gonderebilir. Burada o
 * kimlik sohbetin saglayicisinin (ajansin) ACIK ekip listesinde aranir
 * (`organization_team_public`: yayinda + onayli + askida olmayan uyelikler);
 * listede yoksa IKI anahtar da duser. Gecerliyse ad `profiles`ten okunup
 * kamu ad kuraliyla ("Ad S.") YENIDEN uretilir — istemcinin yazdigi metin
 * hicbir kosulda kaydedilmez.
 *
 * Supabase istemcisi PARAMETRE olarak gelir ve yalniz TIP olarak import
 * edilir (`kamu-adi.ts` ile ayni kalip): bu modul istemci bilesenlerinden de
 * import ediliyor, `next/headers` istemci paketine girmez.
 */
export async function briefTercihUygula(
  supabase: SunucuIstemcisi,
  saglayiciId: string,
  brief: Record<string, unknown> | null
): Promise<Record<string, unknown> | null> {
  if (!brief) return null;

  const ham = brief[BRIEF_TERCIH_UYE];
  const uyeId = typeof ham === 'string' && UUID_DESENI.test(ham) ? ham : null;

  const cikti = { ...brief };
  delete cikti[BRIEF_TERCIH_UYE];
  delete cikti[BRIEF_TERCIH_UYE_ADI];
  const bosDonus = () =>
    Object.keys(cikti).length > 0 ? cikti : null;

  if (!uyeId) return bosDonus();

  const { data: uyelik, error: uyelikHatasi } = await supabase
    .from('organization_team_public')
    .select('user_id')
    .eq('agency_id', saglayiciId)
    .eq('user_id', uyeId)
    .maybeSingle();
  if (uyelikHatasi) {
    console.error('[brief tercih] ekip kontrolu', uyelikHatasi.code, uyelikHatasi.message);
    return bosDonus();
  }
  if (!uyelik) return bosDonus();

  const { data: uyeProfili } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', uyeId)
    .maybeSingle();
  const ad = gosterilecekAd(
    uyeProfili?.role ?? null,
    uyeProfili?.full_name ?? null,
    false
  );
  if (!ad) return bosDonus();

  cikti[BRIEF_TERCIH_UYE] = uyeId;
  cikti[BRIEF_TERCIH_UYE_ADI] = ad;
  return cikti;
}
