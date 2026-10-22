import { gunAyMetni, kisaAyliTarih } from '@/app/lib/tarih';
import { TEKLIF_DURUM_ETIKETLERI } from '@/app/ajans/teklifler/teklif-data';
import { etkinlikTuruEtiketi } from '@/app/lib/etkinlik-turu';

/**
 * SECIM KUTUSU ETIKETLERI — tek kaynak (hijyen 04).
 *
 * 'use client' YOKTUR ve DB erisimi de YOKTUR: etiketler sunucu sayfalarinda
 * uretilir, istemci formlari hazir metni gosterir.
 *
 * NEDEN: etkinlik ve teklif secicileri yalniz BASLIK yaziyordu. Ayni baslikli
 * iki teklif ("Ankara'da 250 kisilik bayi toplantisi") listede birbirinin
 * aynisi gorunuyor ve kullanici hangisini sectigini bilemiyordu. Tarih ve
 * durum eklenince satirlar ayirt edilir.
 *
 * Tarih bicimi `tarih.ts`'den gelir (tek kaynak); durum etiketi mevcut teklif
 * sozlugunden. Burada yeni bir sozluk ya da formatlayici YAZILMAZ.
 */

/**
 * Etkinlik secimi: "Bayi lansmani · 20 Kas 2026".
 *
 * Baslik yoksa etkinlik TURU kullanilir (sihirbazdan baslik girilmeden gelen
 * etkinlikler boyle); ikisi de yoksa "Etkinlik".
 */
export function etkinlikEtiketi(e: {
  title?: string | null;
  event_type?: string | null;
  start_date?: string | null;
}): string {
  const ad =
    e.title?.trim() ||
    (e.event_type ? etkinlikTuruEtiketi(e.event_type) : null) ||
    'Etkinlik';
  const tarih = kisaAyliTarih(e.start_date);
  return tarih ? `${ad} · ${tarih}` : ad;
}

/**
 * Teklif secimi: "Bayi lansmani · Taslak · 3 Eki".
 *
 * Durum teklif sozlugunden gelir; bilinmeyen durum oldugu gibi yazilir (DB
 * CHECK listesi uygulamadan once genisleyebilir). Tarih `created_at` cunku
 * teklifin ayirt edici bilgisi ACILDIGI gundur.
 */
export function teklifEtiketi(t: {
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
}): string {
  const ad = t.title?.trim() || 'Teklif';
  const durum = t.status
    ? (TEKLIF_DURUM_ETIKETLERI[t.status] ?? t.status)
    : null;
  const tarih = gunAyMetni(t.created_at);
  return [ad, durum, tarih].filter(Boolean).join(' · ');
}
