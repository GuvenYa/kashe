'use server';

import 'server-only';
import { createClient } from '@/app/lib/supabase-server';
import { applyDiscoverBase } from '@/app/lib/discover-base';
import { gosterilecekAd } from '@/app/lib/kamu-adi';
import {
  PROVIDER_LISTING_COLUMNS,
  type ProviderListing,
} from '@/app/lib/types';

/**
 * KASHE AI ADAY LISTESI (Duzeltme 06-C3).
 *
 * Analiz TEK model cagrisi; gosterilen profesyoneller VERITABANINDAN gelir.
 * Ikinci bir model cagrisi YOKTUR (eski oneri eylemi Duzeltme 06 ile dustu):
 * model yalniz rolu cikarir, kimin gorunecegine Kesfet'in kurallari karar
 * verir — "yapay zeka rakam/kimlik uretmez" sinirinin gereği.
 *
 * GORUNURLUK KESFET ILE AYNI: `applyDiscoverBase` tek kaynak. Siralama
 * `trust_score` azalan + `created_at` azalan (Kesfet'in paylasilan bir siralama
 * yardimcisi yok; varsayilani `updated_at` ama burada "en guvenilir once"
 * daha dogru — organik siralama satin alinamaz, sponsorluk karismaz).
 *
 * SEHIR DUSUSU: sehir verildiyse once o sehirde aranir; o rolde sonuc yoksa
 * ayni rol Turkiye geneli tekrar sorulur ve `sehirGenel` ile isaretlenir
 * (arayuz "bu sehirde bulunamadi" notunu yazar). Sessiz sehir atlamasi yok.
 *
 * ETKINLIK TURU SUZGEC DEGIL, ONCELIK: tur beyani (`category_attributes.
 * etkinlik_turleri`) uretimde seyrek; suzgec olunca "dugun fotografcisi" 0
 * aday veriyordu. Havuz rol (+ sehir) ile cekilir, turu beyan edenler one
 * alinir, sonra guven sirasi korunur.
 *
 * AD GOSTERIMI (Duzeltme 05-E): bireysel profesyonelin tam adi TARAYICIYA
 * GITMEZ — `full_name` burada kisaltilir ("Ad S.").
 *
 * Giris gerektirmez, girissiz AI hakkini YEMEZ (model cagrisi degil).
 */

export type KasheAiAdayGrubu = {
  rolSlug: string;
  rolAdi: string;
  kategoriId: number;
  /** Sehir suzgeci sonuc vermedi, liste Turkiye genelinden geldi. */
  sehirGenel: boolean;
  adaylar: ProviderListing[];
};

export type KasheAiAdaylarSonucu = {
  gruplar: KasheAiAdayGrubu[];
};

/** Turu beyan etmis mi (Kesfet'in `etkinlik` suzgeciyle ayni alan). */
function turuBeyanEder(p: ProviderListing, tur: string): boolean {
  const ca = (p.category_attributes ?? {}) as Record<string, unknown>;
  const et = ca.etkinlik_turleri;
  return Array.isArray(et) && et.includes(tur);
}

/** Tek sorgu: rolun kategorisi + istege bagli sehir; tur siralamada one alir. */
async function rolAdaylari(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kategoriId: number,
  sehirId: number | null,
  etkinlikTuru: string | null,
  adet: number
): Promise<ProviderListing[]> {
  let q = supabase
    .from('v_providers_public')
    .select(
      `
      ${PROVIDER_LISTING_COLUMNS},
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
    `
    )
    .eq('primary_category_id', kategoriId)
    .order('trust_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    // Havuz gosterilecekten genis: tur beyan edenler one alinabilsin.
    .limit(Math.min(adet * 4, 24));
  q = applyDiscoverBase(q);
  if (sehirId != null) q = q.eq('city_id', sehirId);

  const { data, error } = await q;
  if (error) {
    console.error('[kashe-ai] aday sorgusu', error.code, error.message);
    return [];
  }
  const havuz = (data ?? []) as unknown as ProviderListing[];
  const sirali = etkinlikTuru
    ? [
        ...havuz.filter((p) => turuBeyanEder(p, etkinlikTuru)),
        ...havuz.filter((p) => !turuBeyanEder(p, etkinlikTuru)),
      ]
    : havuz;
  return sirali.slice(0, adet).map((p) => ({
    ...p,
    full_name: gosterilecekAd(p.role, p.full_name, false) || p.full_name,
  }));
}

export async function kasheAiAdaylar(input: {
  /** Modelin cikardigi rol slug'lari (en fazla 5 islenir). */
  rolSluglari: string[];
  sehirId: number | null;
  etkinlikTuru: string | null;
  /** Rol basina gosterilecek aday sayisi (tek rolde 6, cok rolde 3). */
  adet: number;
}): Promise<KasheAiAdaylarSonucu> {
  const sluglar = input.rolSluglari
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (sluglar.length === 0) return { gruplar: [] };

  const adet = Math.min(Math.max(Math.trunc(input.adet) || 3, 1), 12);
  const supabase = await createClient();

  // Slug -> kategori kimligi + adi (tek sorgu; listede olmayan slug atlanir).
  const { data: katData, error: katHata } = await supabase
    .from('service_categories')
    .select('id, slug, name_tr')
    .eq('is_active', true)
    .in('slug', sluglar);
  if (katHata) {
    console.error('[kashe-ai] kategori sorgusu', katHata.code, katHata.message);
    return { gruplar: [] };
  }
  const kategoriler = (katData ?? []) as {
    id: number;
    slug: string;
    name_tr: string;
  }[];

  const gruplar: KasheAiAdayGrubu[] = [];
  for (const slug of sluglar) {
    const kat = kategoriler.find((k) => k.slug === slug);
    if (!kat) continue;

    let adaylar = await rolAdaylari(
      supabase,
      kat.id,
      input.sehirId,
      input.etkinlikTuru,
      adet
    );
    let sehirGenel = false;
    if (adaylar.length === 0 && input.sehirId != null) {
      adaylar = await rolAdaylari(
        supabase,
        kat.id,
        null,
        input.etkinlikTuru,
        adet
      );
      sehirGenel = adaylar.length > 0;
    }

    gruplar.push({
      rolSlug: slug,
      rolAdi: kat.name_tr,
      kategoriId: kat.id,
      sehirGenel,
      adaylar,
    });
  }

  return { gruplar };
}
