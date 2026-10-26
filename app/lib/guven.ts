/**
 * GUVEN DOKUMU SOZLUGU (FAZ 9c) — bilesen etiketleri, ham deger cumleleri,
 * itiraz durumlari ve esikler. TEK KAYNAK.
 *
 * 'use client' YOKTUR ve DB erisimi de YOKTUR: hem sunucu karti hem istemci
 * itiraz formu buradan okur.
 *
 * ILKE — SKOR UYDURULMAZ: puanlar ve bilesen degerleri `my_trust_breakdown`
 * RPC'sinden gelir; bu modul yalniz etiketler ve okunur cumleler uretir. Puan
 * yeniden hesaplanmaz, yuvarlanmaz (gosterimde en fazla bir ondalik).
 *
 * `nasilArtar` metinleri migration'daki `fn_faz9c_hesapla` esiklerinin Turkce
 * karsiligidir. Esik degisirse ONCE migration, sonra buradaki cumle guncellenir.
 */

export type BilesenAnahtari =
  | 'verification'
  | 'profile'
  | 'completed'
  | 'cancel'
  | 'reviews'
  | 'response';

export type Bilesen = {
  anahtar: BilesenAnahtari;
  etiket: string;
  /** Ust sinir; `cancel` icin 0 (puan negatif yonde isler). */
  maks: number;
  /** Yalniz `cancel`: alt sinir (-15). */
  min?: number;
  nasilArtar: string;
};

/** SIRA SABIT — kart ve admin tablosu bu sirayi izler. */
export const BILESENLER: Bilesen[] = [
  {
    anahtar: 'verification',
    etiket: 'Doğrulama',
    maks: 25,
    nasilArtar:
      'Kimlik ve belge doğrulamasını tamamla (e-posta 10, belge 20, tam 25).',
  },
  {
    anahtar: 'profile',
    etiket: 'Profil onayı ve tamlığı',
    maks: 15,
    nasilArtar:
      'Onaylı profil 5; en az 120 karakterlik tanıtım 3; profil fotoğrafı 2; en az bir aktif rol 2; en az üç portföy öğesi 3.',
  },
  {
    anahtar: 'completed',
    etiket: 'Tamamlanan iş',
    maks: 25,
    nasilArtar:
      'Kashe üzerinden tamamlanan iş: 1–2 → 10, 3–9 → 18, 10 ve üzeri → 25.',
  },
  {
    anahtar: 'cancel',
    etiket: 'İptal',
    maks: 0,
    min: -15,
    nasilArtar:
      'Son 12 ayda senin iptal ettiğin rezervasyon oranı düşük kalsın (hiç yok 0, %10 altı −5, %25 altı −10, üzeri −15).',
  },
  {
    anahtar: 'reviews',
    etiket: 'Değerlendirme',
    maks: 20,
    nasilArtar:
      'Üçten az değerlendirme nötr 8; 3 ve üzeri: ortalama 4,7+ → 20, 4,3+ → 15, 3,8+ → 10.',
  },
  {
    anahtar: 'response',
    etiket: 'Yanıt süresi',
    maks: 15,
    nasilArtar:
      'Müşterinin ilk mesajına yanıt medyanı: 2 saat içinde 15, 24 saat 10, 72 saat 5; veri yoksa nötr 7.',
  },
];

/** Dogrulama duzeyi — DB `v_ver` degerleri. */
const DOGRULAMA_DUZEYI: Record<string, string> = {
  none: 'yok',
  email: 'e-posta',
  document: 'belge',
  full: 'tam',
};

/** Bilesenlerin RPC'den gelen ham sekli (yalniz okunan alanlar). */
export type BilesenVerisi = {
  verification?: { points: number; level?: string | null };
  profile?: {
    points: number;
    approved?: boolean | null;
    bio_ok?: boolean | null;
    avatar?: boolean | null;
    active_role?: boolean | null;
    portfolio_count?: number | null;
  };
  completed?: { points: number; count?: number | null };
  cancel?: {
    points: number;
    rate?: number | string | null;
    seller_cancelled?: number | null;
    total_12m?: number | null;
  };
  reviews?: {
    points: number;
    avg?: number | string | null;
    cnt?: number | null;
  };
  response?: { points: number; median_h?: number | string | null };
};

function sayiMi(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 1 ondalik (gerekiyorsa) — "4,7" / "62" gibi. */
function ondalik(n: number, en = 1): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: en });
}

/** Bilesenin puanini dondurur; eksik veri 0 degil NULL anlamina gelmez — DB her zaman yazar. */
export function bilesenPuani(
  anahtar: BilesenAnahtari,
  c: BilesenVerisi
): number {
  const n = sayiMi(c[anahtar]?.points);
  return n ?? 0;
}

/**
 * Bilesenin HAM degeri — tek satir Turkce. Puan degil, puani ureten olcum.
 *
 * Kullanici "neden bu puan" sorusunu burada goruyor: puan sutunu sonucu,
 * bu sutun sebebi yazar.
 */
export function hamDeger(anahtar: BilesenAnahtari, c: BilesenVerisi): string {
  switch (anahtar) {
    case 'verification': {
      const d = c.verification?.level ?? 'none';
      return `Düzey: ${DOGRULAMA_DUZEYI[d] ?? d}`;
    }
    case 'profile': {
      const p = c.profile;
      const parcalar = [
        p?.bio_ok ? 'tanıtım ✓' : 'tanıtım —',
        p?.avatar ? 'fotoğraf ✓' : 'fotoğraf —',
        p?.active_role ? 'rol ✓' : 'rol —',
        `portföy ${sayiMi(p?.portfolio_count) ?? 0}`,
      ];
      return parcalar.join(' · ');
    }
    case 'completed': {
      const n = sayiMi(c.completed?.count) ?? 0;
      return `${n.toLocaleString('tr-TR')} tamamlanan iş`;
    }
    case 'cancel': {
      const iptal = sayiMi(c.cancel?.seller_cancelled) ?? 0;
      const toplam = sayiMi(c.cancel?.total_12m) ?? 0;
      const oran = sayiMi(c.cancel?.rate);
      const yuzde = oran === null ? null : `%${ondalik(oran * 100)}`;
      return yuzde
        ? `${iptal}/${toplam} iptal (${yuzde})`
        : `${iptal}/${toplam} iptal`;
    }
    case 'reviews': {
      const cnt = sayiMi(c.reviews?.cnt) ?? 0;
      const avg = sayiMi(c.reviews?.avg);
      if (cnt < 3) return `${cnt} değerlendirme (nötr)`;
      return avg === null
        ? `${cnt} değerlendirme`
        : `${cnt} değerlendirme · ort. ${ondalik(avg)}`;
    }
    case 'response': {
      const m = sayiMi(c.response?.median_h);
      // Veri yoksa notr puan verilir; "0 saat" demek YANLIS olurdu.
      return m === null ? 'Veri yok (nötr)' : `Medyan ${ondalik(m)} sa`;
    }
  }
}

// -----------------------------------------------------------------------------
// Itiraz
// -----------------------------------------------------------------------------

export type ItirazDurumu = 'open' | 'reviewed' | 'closed';

export const ITIRAZ_DURUMU: Record<
  ItirazDurumu,
  { etiket: string; sinif: string }
> = {
  open: { etiket: 'Açık', sinif: 'text-brand-accent' },
  reviewed: { etiket: 'İncelendi', sinif: 'text-moss' },
  closed: { etiket: 'Kapatıldı', sinif: 'text-ink-50' },
};

/** DB CHECK ile AYNI sinir — UI da ayni yerde keser (kural tek kaynak). */
export const ITIRAZ_MIN = 20;
export const ITIRAZ_MAX = 2000;

/** Eslestirmede "yuksek guven" isareti bu esikten baslar (`run_event_match`). */
export const GUVEN_ESIGI = 70;

/** Skor rengi — esige gore; ara deger notr. */
export function skorSinifi(score: number): string {
  if (score >= GUVEN_ESIGI) return 'text-moss';
  if (score >= 40) return 'text-ink';
  return 'text-brand-accent';
}

/** Ilerleme cubugunun dolu kismi — metin sinifinin zemin esdegeri. */
export function skorZemini(score: number): string {
  if (score >= GUVEN_ESIGI) return 'bg-moss';
  if (score >= 40) return 'bg-brand-ink';
  return 'bg-brand-accent';
}

/** Skoru gosterim bicimine cevirir: 62 -> "62", 62.5 -> "62,5". */
export function skorMetni(score: number): string {
  return score.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

/** Saglayici turu — admin itiraz kuyrugunda alt satir. */
export const SAGLAYICI_TURU: Record<string, string> = {
  professional: 'profesyonel',
  organization: 'kuruluş',
};
