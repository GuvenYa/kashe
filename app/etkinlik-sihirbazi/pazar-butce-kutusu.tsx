'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/app/lib/supabase-browser';
import { formatTL } from '@/app/lib/para';
import {
  GRANULARITY_ETIKETI,
  enKabaKapsam,
  kiyasSatirindan,
  ornekMetni,
  type PazarKiyasi,
} from '@/app/lib/fiyat-kiyas';

/**
 * PAZAR BUTCE KUTUSU (FAZ 9b) — sihirbazda secili rollerin pazar medyani.
 *
 * KUTU YALNIZ HER SECILI ROL ICIN SATIR DONDUGUNDE CIZILIR. Bir rol bile
 * yayinli degilse toplam eksik kalir ve kullaniciyi yanlis bir butceye
 * yonlendirir — o yuzden kismi veriyle HICBIR SEY gosterilmez. Yukleme ve hata
 * durumunda da kutu yok (yayinli hucre yoksa yuzeyde hicbir sey cizilmez
 * karari; "veri yok" yazisi bile konmaz).
 *
 * FIYAT UYDURULMAZ: toplam yalniz RPC medyanlarinin `adet` ile carpimidir ve
 * "~" ile yazilir. Yuvarlama yok; `formatTL` ne verirse o. Kutu hicbir alani
 * DEGISTIRMEZ — butce girdisi kullanicinin kendi karari.
 *
 * `price_benchmarks` tablosu okunmaz; tek yol `price_benchmark_lookup_many`.
 */
export type ButceRolu = { slug: string; ad: string; adet: number };

export function PazarButceKutusu({
  roller,
  rolIdler,
  sehirId,
  tur,
}: {
  roller: ButceRolu[];
  /** Kategori/rol slug -> `service_roles.id` (FAZ 3a: slug birebir ayni). */
  rolIdler: Record<string, number>;
  sehirId: number | null;
  tur: string | null;
}) {
  const [kiyaslar, setKiyaslar] = useState<Map<number, PazarKiyasi> | null>(
    null
  );

  // Rol kimliklerini kararli bir anahtara cevir: dizi her renderda yeni nesne
  // olurdu ve effect surekli kosardi.
  const idler = roller
    .map((r) => rolIdler[r.slug])
    .filter((n): n is number => Number.isInteger(n) && n > 0);
  const anahtar = `${idler.slice().sort((a, b) => a - b).join(',')}|${sehirId ?? ''}|${tur ?? ''}`;

  useEffect(() => {
    // Rol yoksa istek atilmaz ve STATE DE YAZILMAZ: render asagida
    // `roller.length === 0` ile zaten null donuyor (effect icinde senkron
    // setState React kuralina takiliyor ve gereksiz bir render turu acardi).
    if (idler.length === 0) return;
    let iptal = false;
    // 400 ms: kullanici kategori secerken her tiklamada RPC atilmasin.
    const zamanlayici = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        'price_benchmark_lookup_many',
        {
          p_role_ids: idler,
          p_city_id: sehirId,
          p_event_type: tur,
        }
      );
      if (iptal) return;
      if (error || !data) {
        setKiyaslar(null);
        return;
      }
      const harita = new Map<number, PazarKiyasi>();
      for (const row of data as Parameters<typeof kiyasSatirindan>[0][]) {
        const k = kiyasSatirindan(row);
        if (k) harita.set(k.roleId, k);
      }
      setKiyaslar(harita);
    }, 400);

    return () => {
      iptal = true;
      clearTimeout(zamanlayici);
    };
    // `anahtar` idler + sehir + turu tek dizgede tasiyor; `idler` dizisi
    // bagimliliga girerse effect her renderda yeniden kurulurdu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar]);

  if (!kiyaslar || roller.length === 0 || idler.length === 0) return null;

  // TAM KAPSAMA SARTI: her secili rolun yayinli satiri olmali.
  const satirlar: { rol: ButceRolu; kiyas: PazarKiyasi }[] = [];
  for (const r of roller) {
    const id = rolIdler[r.slug];
    const k = id ? kiyaslar.get(id) : undefined;
    if (!k) return null;
    satirlar.push({ rol: r, kiyas: k });
  }
  if (satirlar.length === 0) return null;

  const toplam = satirlar.reduce(
    (t, s) => t + s.kiyas.median * Math.max(1, s.rol.adet),
    0
  );
  const kapsam = enKabaKapsam(satirlar.map((s) => s.kiyas));

  return (
    <div className="mb-6 bg-paper-2 border border-line rounded-xl px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
        Pazar kıyası
      </p>
      <p className="font-display font-semibold text-ink mt-1.5 break-words">
        Benzer etkinliklerde bu roller ~{formatTL(toplam)}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mt-1">
        son 90 gün · {GRANULARITY_ETIKETI[kapsam]}
      </p>

      <ul className="mt-3 space-y-1">
        {satirlar.map((s) => (
          <li key={s.rol.slug} className="text-sm text-ink-72 break-words">
            {s.rol.ad} × {Math.max(1, s.rol.adet)} · medyan{' '}
            {formatTL(s.kiyas.median)} · {ornekMetni(s.kiyas)}
          </li>
        ))}
      </ul>
    </div>
  );
}
