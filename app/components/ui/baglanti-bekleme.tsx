'use client';

import { useLinkStatus } from 'next/link';

/**
 * BAGLANTI BEKLEME ISARETI (Duzeltme 21-A).
 *
 * `next/link` icine COCUK olarak konur; o baglantiya tiklanip yeni sayfa
 * sunucudan gelene kadar kucuk bir donen halka gosterir. Etkinlik sayfasinda
 * sekme degisimi Sahne adresinde 5 - 6 saniye suruyordu ve bu sirada ekranda
 * hicbir sey degismiyordu (olcum 13 Kas; `docs/sahne/duzeltme-21-plan.md`).
 * Isaret bekleyisi KISALTMAZ; yalnizca tiklamanin alindigini gosterir.
 *
 * `useLinkStatus` yalniz bir `Link`'in altinda calisir; disinda `pending` hep
 * false doner (isaret gorunmez). Halka metnin rengini alir (`border-current`),
 * bu yuzden koyu ve acik zeminde ayni bilesen kullanilir.
 */
export function BaglantiBekleme() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      role="status"
      aria-label="Yükleniyor"
      className="ml-1.5 inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-1px]"
    />
  );
}
