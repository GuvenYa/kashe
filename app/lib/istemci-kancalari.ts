'use client';

import { useSyncExternalStore } from 'react';

/**
 * ISTEMCI KANCALARI (FAZ 10d).
 *
 * Iki yaygin kalip efekt + setState ile yaziliyordu ve her ikisi de
 * `react-hooks/set-state-in-effect` kuralini kiriyordu:
 *   1. "mount oldu mu" bayragi (portal / `document.body` kullanan bilesenler),
 *   2. medya sorgusu takibi (`prefers-reduced-motion`, genislik esigi).
 *
 * Ikisi de DIS SISTEM okumasi; React'in dogru araci `useSyncExternalStore`.
 * Sunucu anlik goruntusu sabit verilir, hidrasyondan sonra gercek deger gelir —
 * kademeli render yok, davranis ayni.
 */

/** Abonelik gerektirmeyen durumlar icin bos abone (deger yalniz mount'ta degisir). */
function aboneOlmaz(): () => void {
  return () => {};
}

/**
 * Bilesen istemcide mount oldu mu?
 *
 * Sunucuda ve ilk hidrasyonda `false`, sonra `true`. Portal cizimi
 * (`createPortal(..., document.body)`) bu bayragi bekler.
 */
export function useMountDurumu(): boolean {
  return useSyncExternalStore(
    aboneOlmaz,
    () => true,
    () => false
  );
}

/**
 * Medya sorgusu takibi.
 *
 * `sorgu` sabit bir metin olmali (her render yeni dize uretilmemeli).
 * Sunucu anlik goruntusu `sunucuDegeri` (varsayilan `false`).
 */
export function useMedyaSorgusu(
  sorgu: string,
  sunucuDegeri = false
): boolean {
  return useSyncExternalStore(
    (yenile) => {
      const mq = window.matchMedia(sorgu);
      mq.addEventListener('change', yenile);
      return () => mq.removeEventListener('change', yenile);
    },
    () => window.matchMedia(sorgu).matches,
    () => sunucuDegeri
  );
}
