'use client';

import { createContext, useContext, useMemo } from 'react';
import { etkinlikTuruEtiketi } from '@/app/lib/etkinlik-turu';
import type { EtkinlikTuru } from '@/app/lib/etkinlik-turleri';

/**
 * ETKINLIK TURLERI SAGLAYICISI (FAZ 10b) — istemci tarafinin tek kaynagi.
 *
 * Liste `event_types` tablosundan geliyor ve SUNUCU modulu okuyor
 * (`app/lib/etkinlik-turleri.ts`); istemci bileseni o modulu import EDEMEZ.
 * Kok duzen (`app/layout.tsx`) listeyi bir kez okur (bir saat onbellekli) ve
 * bu saglayiciyla agaca verir — her form kendi sorgusunu atmaz.
 *
 * LISTE TAM GELIR (aktif + pasif): secim kutulari `useEtkinlikTurleri()` ile
 * yalniz AKTIF olanlari alir, etiketleme pasifleri de cozer (kapatilmis bir
 * turle kaydedilmis eski kayit "gala" diye gorunmesin).
 *
 * Saglayici yoksa (bir alt agac layout'suz render edilirse) hook'lar bos liste
 * dondurur ve etiket `etkinlikTuruEtiketi` zincirine duser; cizim kirilmaz.
 */

const EtkinlikTurleriBaglami = createContext<EtkinlikTuru[]>([]);

export function EtkinlikTurleriProvider({
  turler,
  children,
}: {
  /** Kok duzenin okudugu TAM liste (aktif + pasif). */
  turler: EtkinlikTuru[];
  children: React.ReactNode;
}) {
  return (
    <EtkinlikTurleriBaglami.Provider value={turler}>
      {children}
    </EtkinlikTurleriBaglami.Provider>
  );
}

/** Secim kutulari ve suzgecler icin: YALNIZ AKTIF turler, sira korunur. */
export function useEtkinlikTurleri(): EtkinlikTuru[] {
  const turler = useContext(EtkinlikTurleriBaglami);
  return useMemo(() => turler.filter((t) => t.aktif), [turler]);
}

/** Etiketleme icin: pasif turler DAHIL tam liste. */
export function useTumEtkinlikTurleri(): EtkinlikTuru[] {
  return useContext(EtkinlikTurleriBaglami);
}

/**
 * Anahtar -> etiket cevirici.
 *
 * Donen fonksiyon liste degismedikce KARARLI (useMemo): bagimlilik dizisine
 * konabilir.
 */
export function useEtkinlikTuruEtiketi(): (
  key: string | null | undefined
) => string | null {
  const turler = useContext(EtkinlikTurleriBaglami);
  return useMemo(() => {
    const harita = new Map(turler.map((t) => [t.key, t.label]));
    return (key: string | null | undefined) => {
      const v = (key ?? '').trim();
      if (!v) return null;
      return harita.get(v) ?? etkinlikTuruEtiketi(v);
    };
  }, [turler]);
}
