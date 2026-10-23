/**
 * ZEKA KATMANI SOZLUGU (FAZ 9a) — olay adlari, gruplar, huni ve oran bicimleri.
 *
 * 'use client' YOKTUR ve DB erisimi de YOKTUR: sayfa istemci bileseni, bu modul
 * yalniz sabit ve saf fonksiyon tasir.
 *
 * ILKE: olay adlari DB'nin `analytics_events_name_check` listesiyle BIREBIR
 * aynidir (23 ad). Yeni olay = once migration, sonra buraya etiket. Burada
 * olmayan bir ad arayuzde ham haliyle gorunur (sessizce dusmez).
 */

/** `analytics_events.event_name` CHECK listesiyle AYNI sira. */
export const OLAY_ADLARI = [
  'brief_created',
  'event_confirmed',
  'event_cancelled',
  'event_completed',
  'match_run',
  'match_shown',
  'match_clicked',
  'crew_selected',
  'crew_confirmed',
  'crew_declined',
  'proposal_sent',
  'proposal_approved',
  'proposal_declined',
  'proposal_revision',
  'quote_created',
  'quote_accepted',
  'quote_declined',
  'rfp_sent',
  'rfp_awarded',
  'rfp_cancelled',
  'booking_created',
  'booking_cancelled',
  'booking_completed',
] as const;

export type OlayAdi = (typeof OLAY_ADLARI)[number];

export const OLAY_ETIKETLERI: Record<string, string> = {
  brief_created: 'Brief oluşturuldu',
  event_confirmed: 'Etkinlik onaylandı',
  event_cancelled: 'Etkinlik iptal',
  event_completed: 'Etkinlik tamamlandı',
  match_run: 'Eşleştirme koşusu',
  match_shown: 'Aday gösterildi',
  match_clicked: 'Aday tıklandı',
  crew_selected: 'Ekibe seçildi',
  crew_confirmed: 'Ekip onayladı',
  crew_declined: 'Ekip reddetti',
  proposal_sent: 'Teklif gönderildi',
  proposal_approved: 'Teklif onaylandı',
  proposal_declined: 'Teklif reddedildi',
  proposal_revision: 'Teklifte revizyon istendi',
  quote_created: 'Fiyat teklifi verildi',
  quote_accepted: 'Fiyat teklifi kabul',
  quote_declined: 'Fiyat teklifi red',
  rfp_sent: 'RFP gönderildi',
  rfp_awarded: 'RFP sonuçlandı',
  rfp_cancelled: 'RFP iptal',
  booking_created: 'Rezervasyon oluştu',
  booking_cancelled: 'Rezervasyon iptal',
  booking_completed: 'Rezervasyon tamamlandı',
};

/** Bilinmeyen ad HAM haliyle gosterilir — sessizce dusurulmez. */
export function olayEtiketi(ad: string): string {
  return OLAY_ETIKETLERI[ad] ?? ad;
}

// -----------------------------------------------------------------------------
// Gruplar — tablo sirasi ve "Grup" sutunu
// -----------------------------------------------------------------------------

export const OLAY_GRUPLARI = [
  {
    anahtar: 'talep',
    etiket: 'Talep',
    olaylar: [
      'brief_created',
      'event_confirmed',
      'event_cancelled',
      'event_completed',
    ],
  },
  {
    anahtar: 'eslesme',
    etiket: 'Eşleşme',
    olaylar: [
      'match_run',
      'match_shown',
      'match_clicked',
      'crew_selected',
      'crew_confirmed',
      'crew_declined',
    ],
  },
  {
    anahtar: 'ticari',
    etiket: 'Ticari',
    olaylar: [
      'proposal_sent',
      'proposal_approved',
      'proposal_declined',
      'proposal_revision',
      'quote_created',
      'quote_accepted',
      'quote_declined',
      'rfp_sent',
      'rfp_awarded',
      'rfp_cancelled',
    ],
  },
  {
    anahtar: 'rezervasyon',
    etiket: 'Rezervasyon',
    olaylar: ['booking_created', 'booking_completed', 'booking_cancelled'],
  },
] as const;

/** Olay -> grup etiketi (tablonun "Grup" sutunu). */
export const OLAY_GRUP_ETIKETI: Record<string, string> = Object.fromEntries(
  OLAY_GRUPLARI.flatMap((g) => g.olaylar.map((o) => [o, g.etiket]))
);

/**
 * Tablo satir sirasi: grup sirasina gore, grup icinde OLAY SOZLUGU sirasi
 * (34-faz9 bolum 2 = CHECK listesi: yasam dongusu — kosu -> gosterim -> tik ->
 * secim; gonderim -> onay -> red). Alfabetik DEGIL: okuyan akisi izlesin.
 */
export const OLAY_SIRASI: string[] = OLAY_GRUPLARI.flatMap((g) => [
  ...g.olaylar,
]);

// -----------------------------------------------------------------------------
// Huni
// -----------------------------------------------------------------------------

/**
 * Huni adimlari — SIRA SABIT (RPC `funnel` anahtarlariyla ayni).
 * `booking_cancelled` huni DISINDA bilgi satiridir, burada yok.
 */
export const HUNI_ADIMLARI = [
  { anahtar: 'brief_created', etiket: 'Brief' },
  { anahtar: 'event_confirmed', etiket: 'Etkinlik onayı' },
  { anahtar: 'match_run', etiket: 'Eşleştirme' },
  { anahtar: 'match_shown', etiket: 'Gösterim' },
  { anahtar: 'match_clicked', etiket: 'Tıklama' },
  { anahtar: 'selection', etiket: 'Seçim / teklif' },
  { anahtar: 'approval', etiket: 'Onay' },
  { anahtar: 'booking_created', etiket: 'Rezervasyon' },
  { anahtar: 'booking_completed', etiket: 'Tamamlanan' },
] as const;

// -----------------------------------------------------------------------------
// Bicimleyiciler
// -----------------------------------------------------------------------------

/**
 * 0..1 arasi orani yuzdeye cevirir: 0.273 -> "%27,3".
 *
 * `null` = VERI YOK (RPC paydasi sifirken null doner) ve "—" yazilir; sifir
 * yuzde ile karistirilmaz: "%0,0" olculmus bir deger, "—" olculememis.
 */
export function yuzde(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `%${(x * 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
}

/** Iki sayinin orani ("%42,9"); payda 0 ise "—" (bolme YAPILMAZ). */
export function oran(a: number, b: number): string {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return '—';
  return yuzde(a / b);
}

/** Tam sayi — binlik ayraci Turkce. */
export function sayi(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('tr-TR');
}

/** Gini gibi 0..1 gostergeler — uc ondalik; `null` -> "—". */
export function ondalik3(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return x.toLocaleString('tr-TR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
