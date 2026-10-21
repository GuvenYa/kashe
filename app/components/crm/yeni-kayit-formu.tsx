'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { KisiFormu } from './kisi-formu';
import {
  FirsatFormu,
  type KisiSecenegi,
  type SecimSecenegi,
} from './firsat-formu';
import type { UyeSecenegi } from '@/app/lib/crm-data';

/**
 * FAZ 8b — "Yeni kisi" / "Yeni firsat" formunun kabi.
 *
 * `?yeni=kisi|firsat` parametresini okur; dugmeler (`YeniKayitDugmeleri`) ayni
 * parametreyi yazar. Iki bilesen de ISTEMCI ve ayni URL durumunu paylasiyor —
 * aralarinda prop (dolayisiyla sunucu sinirini gecen bir fonksiyon) yok.
 *
 * Kapanis parametreyi silerek olur: geri tusu da formu kapatir.
 */
export function YeniKayitFormu({
  organizationId,
  kisiler,
  uyeler,
  etkinlikler,
  teklifler,
  kullaniciId,
}: {
  organizationId: string;
  kisiler: KisiSecenegi[];
  uyeler: UyeSecenegi[];
  etkinlikler: SecimSecenegi[];
  teklifler: SecimSecenegi[];
  kullaniciId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const acik = params.get('yeni');

  if (acik !== 'kisi' && acik !== 'firsat') return null;

  function kapat() {
    const p = new URLSearchParams(params.toString());
    p.delete('yeni');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="bg-card border border-line rounded-xl p-5 mb-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
        {acik === 'kisi' ? 'Yeni kişi' : 'Yeni fırsat'}
      </p>
      {acik === 'kisi' ? (
        <KisiFormu
          organizationId={organizationId}
          onIptal={kapat}
          onBitti={kapat}
        />
      ) : (
        <FirsatFormu
          organizationId={organizationId}
          kisiler={kisiler}
          uyeler={uyeler}
          etkinlikler={etkinlikler}
          teklifler={teklifler}
          kullaniciId={kullaniciId}
          onIptal={kapat}
          onBitti={kapat}
        />
      )}
    </div>
  );
}
