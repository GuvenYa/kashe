'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  TedarikciFormu,
  type SaglayiciSecenegi,
  type SehirSecenegi,
} from './tedarikci-formu';

/**
 * FAZ 8c — "Yeni tedarikci" formunun kabi (8b `yeni-kayit-formu.tsx` kalibi).
 *
 * `?yeni=tedarikci` parametresini okur; dugme (`YeniTedarikciDugmesi`) ayni
 * parametreyi yazar. Iki bilesen de ISTEMCI ve ayni URL durumunu paylasiyor —
 * aralarinda prop (dolayisiyla sunucu sinirini gecen bir fonksiyon) yok.
 * Sunucudan istemciye fonksiyon prop'u gecirmek D2'de uretimi dusurdu.
 *
 * Etkinlik sekmesindeki "Defterde yok -> Yeni tedarikci" baglantisi da bu
 * parametreyi kullanir, yani ayni form oradan da acilir.
 */
export function TedarikciFormKabi({
  organizationId,
  sehirler,
  saglayicilar,
}: {
  organizationId: string;
  sehirler: SehirSecenegi[];
  saglayicilar: SaglayiciSecenegi[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (params.get('yeni') !== 'tedarikci') return null;

  function kapat() {
    const p = new URLSearchParams(params.toString());
    p.delete('yeni');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="bg-card border border-line rounded-xl p-5 mb-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
        Yeni tedarikçi
      </p>
      <TedarikciFormu
        organizationId={organizationId}
        sehirler={sehirler}
        saglayicilar={saglayicilar}
        onIptal={kapat}
        onBitti={kapat}
      />
    </div>
  );
}

/** `PanelBaslik` sag alanindaki dugme — yalniz URL parametresini yazar. */
export function YeniTedarikciDugmesi() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const acik = params.get('yeni') === 'tedarikci';

  function ac() {
    const p = new URLSearchParams(params.toString());
    if (acik) p.delete('yeni');
    else p.set('yeni', 'tedarikci');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={ac}
      aria-pressed={acik}
      className="kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
    >
      Yeni tedarikçi
    </button>
  );
}
