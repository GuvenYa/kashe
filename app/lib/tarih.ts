// Kashe tarih/saat bicimlemesi — TEK KAYNAK (hijyen H6, 8 Ekim 2026).
//
// 'use client' YOKTUR: hem sunucu hem istemci bilesenleri buradan import eder.
//
// NEDEN: sunucuda render edilen bilesenler Vercel'de UTC ile bicimliyordu
// (uc saat geri, bazen bir gun geri: "19:33" yerine 22:33 olmaliydi); istemci
// bilesenleri ise tarayici saatiyle. Kashe tek dilimli bir urun — her yerde
// Istanbul saati gosterilir, dilim ACIKCA verilir.
//
// Tarih-YALNIZ sutunlar (`date`; ornek `events.start_date`) icin bu modul
// kullanilmaz: o degerler `new Date(g + 'T00:00:00Z')` + `timeZone: 'UTC'`
// ile gosterilir (gun kaymasin). Bkz. `app/etkinliklerim/page.tsx`.

export const KASHE_SAAT_DILIMI = 'Europe/Istanbul';

function gecerliTarih(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** "3 Ekim 2026" */
export function tarihMetni(iso: string | null | undefined): string | null {
  const d = gecerliTarih(iso);
  if (!d) return null;
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: KASHE_SAAT_DILIMI,
  });
}

/** "3 Ekim 2026 14:05" */
export function zamanMetni(iso: string | null | undefined): string | null {
  const d = gecerliTarih(iso);
  if (!d) return null;
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KASHE_SAAT_DILIMI,
  });
}

/** "14:05" */
export function saatMetni(iso: string | null | undefined): string | null {
  const d = gecerliTarih(iso);
  if (!d) return null;
  return d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KASHE_SAAT_DILIMI,
  });
}

/** "03.10.2026" */
export function kisaTarihMetni(iso: string | null | undefined): string | null {
  const d = gecerliTarih(iso);
  if (!d) return null;
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: KASHE_SAAT_DILIMI,
  });
}

/** `<input type="date">` degeri: "YYYY-MM-DD" (Istanbul gunu). */
export function tarihAlani(iso: string | null | undefined): string {
  const d = gecerliTarih(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KASHE_SAAT_DILIMI,
  }).format(d);
}
