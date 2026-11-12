import type { createClient } from '@/app/lib/supabase-server';

/**
 * AJANS UZERINDEN TEKLIF (Duzeltme 15-E, bulgu 131, karar 1-A).
 *
 * Ajansa bagli profesyonel "bana gelen talepler ajansim uzerinden" tercihini
 * actiysa ona gelen talep ajansa gider, teklifi ajans verir; musteri ayni
 * kisi icin iki teklif almaz. Tercihi uye kendi yazar
 * (`org_member_set_offer_routing`); burada talep acan taraf icin OKUMA var.
 *
 * Kaynak `fn_duz15_teklif_yonlendirme`: yalniz acik ekipteki (ajans ve uye
 * yayinda + onayli) uyeler doner, giris gerekir. Hata halinde BOS doner:
 * yonlendirme yapilmaz, talep profesyonele gider (eski davranis).
 */
type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

export type TeklifYonlendirmesi = {
  /** Ajansin pazaryeri profil kimligi (sohbetin ve alicinin saglayicisi). */
  ajansId: string;
  ajansAdi: string;
};

const PARCA = 500;

export async function teklifYonlendirmeleri(
  supabase: SunucuIstemcisi,
  profesyonelIdleri: string[]
): Promise<Map<string, TeklifYonlendirmesi>> {
  const sonuc = new Map<string, TeklifYonlendirmesi>();
  const idler = [...new Set(profesyonelIdleri)];
  for (let i = 0; i < idler.length; i += PARCA) {
    const { data, error } = await supabase.rpc('fn_duz15_teklif_yonlendirme', {
      p_profesyoneller: idler.slice(i, i + PARCA),
    });
    if (error) {
      console.error('[teklif yonlendirme]', error.code, error.message);
      return new Map();
    }
    for (const s of (data ?? []) as {
      professional_id: string;
      agency_id: string;
      agency_name: string | null;
    }[]) {
      sonuc.set(s.professional_id, {
        ajansId: s.agency_id,
        ajansAdi: s.agency_name?.trim() || 'Ajans',
      });
    }
  }
  return sonuc;
}
