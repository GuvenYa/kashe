'use client';

import { useState } from 'react';
import {
  IlSecici,
  IlceSecici,
  ilEslestir,
  type Il,
} from '@/app/components/ui/il-secici';
import {
  ilceListesi,
  ilceTasi,
  konumBirlestir,
  konumKutulari,
} from '@/app/lib/ilceler';

/**
 * KONUM ALANI (Duzeltme 18-B) - il + ilce + mekan, TEK metin degeri.
 *
 * Rezervasyon talebi ve brief formlarindaki kalibin (10-D4, 14-B) tasinabilir
 * hali: il listeden secilir; il 30 buyuksehirden biriyse ilce de listeden
 * secilir, metin alani yalniz "Mekan" olur; diger illerde "Ilce / mekan"
 * serbest metindir. Uretilen deger ayni bicimde: "<mekan>, <ilce>, <Il>".
 *
 * `deger` yalniz KURULUSTA cozulur (il / ilce / mekan kutulari ondan dolar);
 * sonrasinda kutular yerel durumdur ve her degisiklikte `onChange` birlesik
 * metni verir. Deger disaridan degisecekse cagiran `key` verir.
 *
 * Cozulemeyen eski metin KAYBOLMAZ (`konumKutulari`): il adi metnin icinde
 * gecip kalan guvenle ayrilamiyorsa ("Ankara Caddesi 12") il secili gelmez,
 * metnin tamami mekan kutusuna yazilir.
 *
 * Il listesi gelmediyse (bos dizi) tek serbest metin kutusu cizilir.
 */
export function KonumAlani({
  iller,
  deger,
  onChange,
  id,
  kutuSinifi,
  mekanSiniri = 80,
}: {
  iller: Il[];
  /** Birlesik konum metni (yalniz kurulusta okunur). */
  deger: string;
  onChange: (deger: string) => void;
  id: string;
  /** Uc kutunun ortak sinifi (verilmezse `IlSecici` varsayilani). */
  kutuSinifi?: string;
  mekanSiniri?: number;
}) {
  const [ilk] = useState(() =>
    konumKutulari(deger, ilEslestir(deger, iller))
  );
  const [il, setIl] = useState(ilk.il);
  const [ilce, setIlce] = useState(ilk.ilce);
  const [mekan, setMekan] = useState(ilk.mekan);
  const [serbest, setSerbest] = useState(deger);

  const metinSinifi =
    kutuSinifi ??
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

  if (iller.length === 0) {
    return (
      <input
        id={id}
        type="text"
        maxLength={200}
        value={serbest}
        onChange={(e) => {
          setSerbest(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="Örn: Moda Sahnesi, Kadıköy, İstanbul"
        className={metinSinifi}
      />
    );
  }

  // Buyuksehirse ilce listesi; degilse null (serbest "ilce / mekan").
  const ilceler = ilceListesi(il);
  const secilenIlce = ilceler ? ilce : '';

  return (
    <div className="space-y-2">
      <IlSecici
        id={id}
        iller={iller}
        deger={il}
        className={kutuSinifi}
        onChange={(ad) => {
          // Ilce yeni ilin listesinde yoksa bosalir.
          const yeniIlce = ilceTasi(ad, ilce);
          setIl(ad);
          setIlce(yeniIlce);
          onChange(konumBirlestir(ad, yeniIlce, mekan));
        }}
      />
      {ilceler && (
        <IlceSecici
          key={il}
          id={`${id}-ilce`}
          ilceler={ilceler}
          deger={secilenIlce}
          className={kutuSinifi}
          onChange={(ad) => {
            setIlce(ad);
            onChange(konumBirlestir(il, ad, mekan));
          }}
        />
      )}
      <input
        type="text"
        maxLength={mekanSiniri}
        value={mekan}
        onChange={(e) => {
          const m = e.target.value.slice(0, mekanSiniri);
          setMekan(m);
          onChange(konumBirlestir(il, secilenIlce, m));
        }}
        aria-label={ilceler ? 'Mekan' : 'İlçe / mekan'}
        placeholder={
          ilceler ? 'Mekan (isteğe bağlı)' : 'İlçe / mekan (isteğe bağlı)'
        }
        className={metinSinifi}
      />
    </div>
  );
}
