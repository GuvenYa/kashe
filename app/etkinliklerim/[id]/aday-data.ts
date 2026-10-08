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

/** KVKK itiraz notundaki adres — footer ile ayni. */
export const DESTEK_EPOSTA = 'info@kashe.net';
