/**
 * Gosterge panellerinin ortak tarih yardimcilari.
 *
 * 'use client' YOKTUR ve sunucu modulu de import ETMEZ — hem `/ajans` hem
 * `/kurumsal` hem `/profil` buradan okur (CLAUDE.md: ortak veri `*-data.ts`).
 *
 * `events.start_date` ve `bookings.event_date` TARIH-YALNIZ sutunlar: Istanbul
 * dilimine cevrilmezler, UTC gun basiyla bicimlenirler (gun kaymasin).
 * Bkz. `app/lib/tarih.ts` basindaki not.
 */
import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';

/** Bugunun Istanbul gunu: "YYYY-MM-DD" (tarih-yalniz sutunlarla karsilastirma). */
export function panelGunBugun(simdi: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KASHE_SAAT_DILIMI,
  }).format(simdi);
}

/** Bu ayin ilk ve son gunu ("YYYY-MM-DD", Istanbul ayi). */
export function ayAraligi(simdi: Date = new Date()): {
  ilk: string;
  son: string;
} {
  const bugun = panelGunBugun(simdi);
  const [yil, ay] = bugun.split('-').map(Number);
  const sonGun = new Date(Date.UTC(yil, ay, 0)).getUTCDate();
  const iki = (n: number) => String(n).padStart(2, '0');
  return {
    ilk: `${yil}-${iki(ay)}-01`,
    son: `${yil}-${iki(ay)}-${iki(sonGun)}`,
  };
}

/** Tarih-yalniz gun: "3 Ekim 2026". */
export function gunBicimi(gun: string): string {
  return new Date(gun + 'T00:00:00Z').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Etkinlik tarih metni. Ayni gune denk gelen aralik TEK tarih gosterilir
 * (hijyen tarama 1 / madde 4 ile ayni kural).
 */
export function gunMetni(
  baslangic: string | null,
  bitis?: string | null
): string {
  if (!baslangic) return 'Tarih yok';
  const bas = gunBicimi(baslangic);
  if (!bitis || bitis === baslangic) return bas;
  return `${bas} → ${gunBicimi(bitis)}`;
}
