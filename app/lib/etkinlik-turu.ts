/**
 * Etkinlik turu etiketi — ham anahtari (`launch`, `engagement`) kullaniciya
 * gorunen Turkce etikete cevirir.
 *
 * 'use client' YOKTUR: hem sunucu sayfalari hem istemci bilesenleri okur.
 *
 * NEDEN: `bookings.event_type`, `quote_requests.event_type` ve RPC'lerin
 * donderdigi `event.event_type` ham ingilizce anahtar tasiyor; bazi ekranlarda
 * oldugu gibi gosteriliyordu.
 *
 * YEREL SOZLUK YOK — etiketler mevcut TEK KAYNAKLARDAN turetilir, sirayla:
 *   1. `EVENT_TYPES` (app/mesajlar/data.ts) — `event_type` kolonunun kendi
 *      taksonomisi; CLAUDE.md'ye gore eski CHECK listesiyle elle ayni tutulur.
 *   2. `CATEGORY_FILTERS` (app/lib/filter-config.ts) icindeki `event_types`
 *      alanlarinin secenekleri — kategoriye ozel brief alanlarindan gelen
 *      degerler (ornek `club`, `festival`, `opening`) burada karsilanir.
 *   3. Hicbiri tutmazsa deger OLDUGU GIBI dondurulur (yalniz ilk harf buyur) —
 *      uydurma etiket uretilmez.
 *
 * Yeni bir deger eklenirse 1. ya da 2. kaynaga eklenir; bu dosya degismez.
 */
import { getEventTypeLabel } from '@/app/mesajlar/data';
import { CATEGORY_FILTERS } from '@/app/lib/filter-config';

/**
 * filter-config'teki tum `event_types` seceneklerinin deger -> etiket haritasi.
 * Ayni deger birden fazla kategoride farkli yazilabiliyor (ornek: engagement
 * icin "Nisan / Kina" ya da "Nisan"); ILK gorulen kazanir, sonrakiler ezilmez
 * — boylece cikti kararlidir.
 */
/**
 * Kaynaklarda bulunmayan ya da kategoriye gore farkli yazilan degerlerin
 * KANONIK karsiligi. `fashion` filter-config icinde "Moda / Model" ve
 * "Moda / Kampanya" olarak iki kez geciyor; ikisi de cekim turu, arayuzde
 * tek bir ad gorunmesi gerekiyor.
 */
const YEREL_EK: Record<string, string> = {
  fashion: 'Moda / defile',
};

let kategoriHaritasi: Map<string, string> | null = null;

function kategoriEtiketleri(): Map<string, string> {
  if (kategoriHaritasi) return kategoriHaritasi;
  const harita = new Map<string, string>();
  for (const kategori of CATEGORY_FILTERS) {
    for (const alan of kategori.fields) {
      if (alan.key !== 'event_types') continue;
      for (const secenek of alan.options) {
        if (!harita.has(secenek.value)) harita.set(secenek.value, secenek.label);
      }
    }
  }
  kategoriHaritasi = harita;
  return harita;
}

/** Ilk harf buyuk — Turkce kurali (locale 'tr'; nokta ustu korunur). */
function ilkHarfBuyuk(v: string): string {
  if (!v) return v;
  return v.charAt(0).toLocaleUpperCase('tr') + v.slice(1);
}

/** Ham degeri Turkce etikete cevirir; bos deger icin `null`. */
export function etkinlikTuruEtiketi(
  value: string | null | undefined
): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  return (
    getEventTypeLabel(v) ??
    YEREL_EK[v] ??
    kategoriEtiketleri().get(v) ??
    ilkHarfBuyuk(v)
  );
}
