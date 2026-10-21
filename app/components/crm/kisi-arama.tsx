'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * FAZ 8b — kisi tablosu aramasi (8a filtre deseni: durum URL'de).
 *
 * Arama URL'ye yazilir (`?q=`), bellekte tutulmaz: kullanici sonucu
 * paylasabilir, geri tusu calisir, sayfa yenilense filtre kaybolmaz.
 *
 * GECIKMELI YAZMA (350 ms): her tus vurusunda sunucuya gitmek listeyi
 * titretiyordu. Girdi yerel durumda aninda guncellenir, URL gecikmeyle.
 *
 * Girdi bir kez kurulduktan sonra URL'i IZLEMEZ: yazarken kendi yazdigi
 * degeri geri okuyup imleci kaybetmesin. Baslangic degeri ilk render'da
 * URL'den gelir; sayfa degisiminde bilesen yeniden kurulur.
 */
export function KisiArama({ baslangic }: { baslangic: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [deger, setDeger] = useState(baslangic);


  useEffect(() => {
    if (deger === baslangic) return;
    const zamanlayici = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (deger.trim()) p.set('q', deger.trim());
      else p.delete('q');
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 350);
    return () => clearTimeout(zamanlayici);
    // `params` her renderda yeni nesne; bagimliliga girerse zamanlayici
    // surekli sifirlanirdi. Kaynak deger `deger` ve `baslangic`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deger, baslangic, pathname, router]);

  return (
    <div className="mb-4">
      <label className="sr-only" htmlFor="kisi-arama">
        Kişi ara
      </label>
      <input
        id="kisi-arama"
        value={deger}
        onChange={(e) => setDeger(e.target.value)}
        placeholder="Ad, firma ya da e-posta ile ara"
        className="w-full md:max-w-sm bg-card border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink"
      />
    </div>
  );
}
