'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  KATEGORI_ETIKETLERI,
  TEDARIKCI_KATEGORILERI,
} from '@/app/lib/tedarikci';

/**
 * FAZ 8c — defter filtreleri (8a/8b filtre deseni: durum URL'de).
 *
 * Arama, kategori ve arsiv anahtari URL'ye yazilir; bellekte tutulmaz:
 * kullanici sonucu paylasabilir, geri tusu calisir, sayfa yenilense filtre
 * kaybolmaz.
 *
 * GECIKMELI YAZMA (350 ms) yalniz ARAMA icin: her tus vurusunda sunucuya
 * gitmek listeyi titretiyordu. Kategori ve arsiv aninda yazilir (tek tiklama).
 *
 * Girdi bir kez kurulduktan sonra URL'i IZLEMEZ: yazarken kendi yazdigi degeri
 * geri okuyup imleci kaybetmesin.
 */
const ALAN =
  'w-full bg-card border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink';

export function TedarikciFiltreleri({
  baslangicQ,
  kategori,
  arsiv,
}: {
  baslangicQ: string;
  kategori: string;
  arsiv: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(baslangicQ);

  function yaz(yamalar: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(yamalar)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (q === baslangicQ) return;
    const zamanlayici = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      if (q.trim()) p.set('q', q.trim());
      else p.delete('q');
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 350);
    return () => clearTimeout(zamanlayici);
  }, [q, baslangicQ, pathname, router]);

  return (
    <div className="mb-4 flex flex-col md:flex-row md:items-end gap-3">
      <div className="min-w-0 md:max-w-sm flex-1">
        <label className="sr-only" htmlFor="ted-arama">
          Tedarikçi ara
        </label>
        <input
          id="ted-arama"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad, yetkili ya da e-posta ile ara"
          className={ALAN}
        />
      </div>

      <div className="min-w-0 md:w-56">
        <label className="sr-only" htmlFor="ted-kategori-filtre">
          Kategori
        </label>
        <select
          id="ted-kategori-filtre"
          value={kategori}
          onChange={(e) => yaz({ kategori: e.target.value || null })}
          className={ALAN}
        >
          <option value="">Tüm kategoriler</option>
          {TEDARIKCI_KATEGORILERI.map((k) => (
            <option key={k} value={k}>
              {KATEGORI_ETIKETLERI[k]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-72 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={arsiv}
          onChange={(e) => yaz({ arsiv: e.target.checked ? '1' : null })}
          className="w-4 h-4 accent-brand-ink"
        />
        Arşivdekileri göster
      </label>
    </div>
  );
}
