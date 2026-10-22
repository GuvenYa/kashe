import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
// FAZ 6 / P1 — aday listesi ortak tipler, etiketler ve bicimleyiciler.
//
// 'use client' YOKTUR: hem sunucu sayfasi hem istemci paneli buradan import eder.
// (CLAUDE.md: istemci modulunden sunucu bilesenine sabit/veri import edilmez.)
//
// Skor ve siralama DB'de uretilir (`run_event_match`, algorithm_version v0.1);
// burada YALNIZ gosterim bicimi var — yeniden siralama ya da puan hesabi YOK.

/** `match_runs` satiri (sayfa SELECT'inin sectigi alanlar). */
export type AdayKosu = {
  id: string;
  strategy: string;
  algorithm_version: string;
  candidate_count: number;
  /**
   * Kosunun surdugu sure (ms) — `run_event_match` yaziyor (hijyen 04).
   * Eski kosularda NULL olabilir; o zaman sayac GOSTERILMEZ.
   */
  latency_ms: number | null;
  created_at: string;
};

/** `match_candidates` satiri. `numeric` sutunlar PostgREST'ten METIN gelir. */
export type AdaySatiri = {
  id: string;
  provider_id: string;
  /** Profesyonel adayda dolu, ajans adayinda NULL (DB CHECK). */
  role_id: number | null;
  match_score: number | string;
  coverage_ratio: number | string | null;
  full_service_eligible: boolean | null;
  final_rank: number;
  reason_codes: string[] | null;
  was_shown: boolean;
  was_clicked: boolean;
};

/** `v_providers_public`'ten gelen gosterim bilgisi. */
export type AdaySaglayici = {
  id: string;
  display_name: string | null;
  provider_slug: string;
  city_id: number | null;
  avatar_url: string | null;
  provider_type: string;
  headline: string | null;
  /** D3: ajans kartindaki "Teklif Al" brief formu icin kategori slug'i. */
  primary_category_id: number | null;
};

/** Panelin gosterdigi kart — sunucuda kurulur (istemci birlestirme yapmaz). */
export type AdayKarti = {
  /** `match_candidates.id` — isaretleme RPC'leri bunu kullanir. */
  id: string;
  providerId: string;
  ad: string;
  sehir: string | null;
  headline: string | null;
  /** 0-100 tam sayi. */
  uyum: number;
  /** Yalniz ajans adayinda (0-100); profesyonelde null. */
  kapsam: number | null;
  /** Yalniz ajans adayinda. */
  tamHizmet: boolean | null;
  gerekceler: string[];
  wasShown: boolean;
  /**
   * D3 — yayindaki, talep-uzerine OLMAYAN hizmetlerin en dusuk `price_min`i.
   * Kart "... TL'den" yazar. Fiyat yoksa null ve alan BOS kalir: "fiyat
   * gorusulur" gibi bir dolgu metni konmaz (D2 kurali).
   */
  baslangicFiyati: number | null;
  /** Kompakt kartin 40 px gorseli; yoksa bas harfler cizilir. */
  avatarUrl: string | null;
  /** Ajans kartindaki "Teklif Al" brief formu icin (profesyonelde kullanilmaz). */
  kategoriSlug: string | null;
  /**
   * `date_available` gerekcesi varsa etkinlik gununun kisa etiketi
   * ("14 MAYIS"); yoksa null. SUNUCUDA bicimlenir — kart tarih hesaplamaz.
   */
  musaitlikEtiketi: string | null;
  /** `final_rank === 1` — rolun en yuksek puanli adayi ("ONERILEN"). */
  onerilen: boolean;
};

export type AdayRolGrubu = {
  roleId: number;
  rolAdi: string;
  /** Gereksinimin istedigi kisi sayisi (`event_requirements.quantity`). */
  ihtiyac: number;
  zorunlu: boolean;
  adaylar: AdayKarti[];
};

/**
 * Gerekce kodlari — 02 belgesindeki SABIT liste.
 * Bilinmeyen kod GOSTERILMEZ, yeni kod uretilmez (18 bolum 9).
 */
export const GEREKCE_ETIKETLERI: Record<string, string> = {
  same_city: 'Aynı şehir',
  date_available: 'Tarihte müsait',
  budget_fit: 'Bütçeye uygun',
  high_trust: 'Yüksek güven',
  new_talent: 'Yeni yetenek',
  coverage_full: 'Tam kapsam',
};

/** Kodlari Turkce etikete cevirir; listede olmayan kodu DUSURUR. */
export function gerekceEtiketleri(
  kodlar: string[] | null | undefined
): string[] {
  return (kodlar ?? [])
    .map((k) => GEREKCE_ETIKETLERI[k])
    .filter((v): v is string => !!v);
}

/** `match_score` (0-100 numeric) -> tam sayi yuzde. */
export function uyumYuzdesi(skor: number | string | null | undefined): number {
  const n = Number(skor);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** `coverage_ratio` (0-1 numeric) -> tam sayi yuzde; yoksa null. */
export function kapsamYuzdesi(
  oran: number | string | null | undefined
): number | null {
  if (oran === null || oran === undefined || oran === '') return null;
  const n = Number(oran);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

/** Kosu zamani — "1 Ekim 2026 14:05". */
export function kosuZamani(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', {
    timeZone: KASHE_SAAT_DILIMI,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Saglayicinin baslangic fiyati — kesfet kartiyla AYNI kural: yayindaki
 * (`is_active`), talep-uzerine OLMAYAN hizmetlerin en dusuk `price_min`i.
 * Hicbiri yoksa null (uydurma fiyat yok).
 *
 * `numeric` sutunlar PostgREST'ten METIN gelebilir; Number() ile cevrilir.
 */
export function baslangicFiyati(
  hizmetler: { price_min: number | string | null; price_on_request: boolean | null }[]
): number | null {
  const sayilar = hizmetler
    .filter((h) => !h.price_on_request && h.price_min !== null)
    .map((h) => Number(h.price_min))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (sayilar.length === 0) return null;
  return Math.min(...sayilar);
}

/** Etkinlik gunu -> "14 MAYIS" (musaitlik rozeti). Gecersiz tarihte null. */
export function kisaGunEtiketi(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      timeZone: KASHE_SAAT_DILIMI,
    })
    .toLocaleUpperCase('tr-TR');
}

/**
 * Kosu suresi — "0,8 sn" / "1,4 sn" (hijyen 04).
 *
 * UYDURMA DEGIL: deger `match_runs.latency_ms` sutunundan gelir. Sutun bos
 * ise null doner ve kutu cizilmez; sure tahmin EDILMEZ.
 */
export function sureMetni(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined) return null;
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return null;
  const saniye = n / 1000;
  return (
    saniye.toLocaleString('tr-TR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) +
    ' sn'
  );
}

/** KVKK itiraz notundaki adres — footer ile ayni. */
export const DESTEK_EPOSTA = 'info@kashe.net';
