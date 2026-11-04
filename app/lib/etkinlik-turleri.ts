import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

/**
 * ETKINLIK TURLERI — TEK KAYNAK `event_types` tablosu (FAZ 10b).
 *
 * Once liste `app/mesajlar/data.ts` icinde bir SABITTI ve CLAUDE.md
 * geregi tablodaki satirlarla ELLE ayni tutuluyordu; iki yerden biri kaysa
 * kullanici gecerli bir turu secip 23503 yiyordu. 10b-DB ile `conversations`,
 * `listings`, `bookings`, `quote_requests` sutunlari `event_types(key)`
 * tablosuna FK ile bagli — artik liste de oradan okunur.
 *
 * 'use client' YOKTUR: sunucu modulu. Istemci bilesenleri listeyi
 * `app/components/etkinlik-turleri-provider.tsx` uzerinden alir (kok duzende
 * bir kez okunur).
 *
 * CACHE: `unstable_cache` ile bir saat (`tags: ['event-types']`). Taksonomi
 * degisirse etiket icin `revalidateTag('event-types')` yeterli.
 *
 * ISTEMCI NEDEN ANON: `unstable_cache` govdesinde `cookies()` okunamaz
 * (oturuma bagli cikti onbellege alinamaz). Tablo anon'a SELECT verdigi icin
 * cerezsiz, oturumsuz bir istemci kullanilir — kullaniciya gore degisen bir
 * veri yok.
 *
 * HATA: bos dizi + `console.error`. Sayfa kirilmaz; secim kutulari bos kalir
 * ve etiketler ham degere duser (uydurma etiket URETILMEZ). Hata ONBELLEGE
 * GIRMEZ: onbellekli govde hatada FIRLATIR (`unstable_cache` firlatilan sonucu
 * saklamaz), dis sarmalayici o istek icin bos dizi doner; sonraki istek yeniden
 * dener. (Bos dizi onbellege girseydi tek bir anlik hata bir saat boyunca tum
 * secim kutularini bosaltir ve sunucu kontrolleri her turu NULL'a cevirirdi.)
 */

export type EtkinlikTuru = {
  /** `event_types.key` — DB'de tutulan deger (`wedding`, `launch`). */
  key: string;
  /** `event_types.name_tr` — kullaniciya gorunen Turkce etiket. */
  label: string;
  /** `event_types.group_key` — `sosyal` | `kurumsal` | `diger`. */
  group: string;
  /** `event_types.sort_order` — liste sirasi. */
  sortOrder: number;
  /**
   * `event_types.is_active`.
   *
   * PASIF TUR LISTELERDE YOK ama ESKI KAYITLARDA ETIKETI GORUNUR: bir tur
   * kapatildiginda o turle kaydedilmis rezervasyon/ilan hala duruyor.
   */
  aktif: boolean;
};

type EventTypeSatiri = {
  key: string;
  name_tr: string;
  group_key: string;
  sort_order: number | null;
  is_active: boolean;
};

/**
 * Tablonun TAMAMI (aktif + pasif), tek cagri, bir saat onbellekli.
 *
 * Iki goruntu (yalniz aktif / hepsi) ayni okumadan turetilir: ikinci bir
 * sorgu gitmez.
 */
const tumunuOkuOnbellekli = unstable_cache(
  async (): Promise<EtkinlikTuru[]> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      throw new Error('Supabase ortam degiskeni yok');
    }

    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('event_types')
      .select('key, name_tr, group_key, sort_order, is_active')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`okuma ${error.code ?? ''} ${error.message}`);
    }
    if (!data || data.length === 0) {
      // Tablo bos olamaz (FK'ler ona bagli): bos cevap hata sayilir, saklanmaz.
      throw new Error('bos cevap');
    }

    return (data as EventTypeSatiri[]).map((r) => ({
      key: r.key,
      label: r.name_tr,
      group: r.group_key,
      sortOrder: Number(r.sort_order ?? 0),
      aktif: r.is_active,
    }));
  },
  ['event-types'],
  { revalidate: 3600, tags: ['event-types'] }
);

async function tumunuOku(): Promise<EtkinlikTuru[]> {
  try {
    return await tumunuOkuOnbellekli();
  } catch (e) {
    console.error('[etkinlik turleri]', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Etkinlik turleri — varsayilan YALNIZ AKTIF olanlar (secim kutulari, suzgecler).
 *
 * `{ hepsi: true }`: pasifler de gelir — ETIKETLEME ve DEGER DOGRULAMA bunu
 * kullanir (pasif bir tur mevcut kayitta durabilir, etiketi kaybolmamali).
 */
export async function etkinlikTurleri(secenek?: {
  hepsi?: boolean;
}): Promise<EtkinlikTuru[]> {
  const tumu = await tumunuOku();
  return secenek?.hepsi ? tumu : tumu.filter((t) => t.aktif);
}

/**
 * Gecerli anahtar kumesi — form/action dogrulamasi icin (aktif + pasif).
 *
 * 10b-DB ile sutunlar FK tasiyor: liste disi bir deger 23503 ile KAYDI KIRAR.
 * Bu yuzden sunucu kontrolleri kalkmaz, yalniz kaynagi tablodur.
 */
export async function etkinlikTuruAnahtarlari(): Promise<Set<string>> {
  const tumu = await etkinlikTurleri({ hepsi: true });
  return new Set(tumu.map((t) => t.key));
}
