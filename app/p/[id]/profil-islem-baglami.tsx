'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * PROFIL ISLEM BAGLAMI (D2-ek) — fiyat/takvim karti ile mobil alt CTA cubugu
 * AYNI durumu paylasir.
 *
 * NEDEN BAGLAM: `lg` altinda kart CTA tasimaz (dugmeler alt sabit cubukta);
 * kullanici kartta tarih/sehir/kisi giriyor, sonra cubuktaki "Teklif Al"a
 * basiyor. Iki ayri bilesen, ikisi de istemci, aralarinda SUNUCU bileseni var —
 * prop ile deger tasimak mumkun degil.
 *
 * NEDEN FONKSIYON PROP YOK: D2'de kart CTA'larini bir RENDER FONKSIYONU ile
 * aliyordu; sunucu bileseninden istemci bilesenine fonksiyon gecirilemedigi
 * icin uretim dustu. Baglam bu sorunu kokunden kaldirir: sunucu yalniz
 * `children` gecer, degerler istemci tarafinda akar.
 *
 * Saglayici YOKSA kanca guvenli varsayilan doner (deger yok, yazma islemsiz):
 * kart ve cubuk tek baslarina da render edilebilir, cokmezler.
 */
export type ProfilIslemDegerleri = {
  tarih: string | null;
  sehir: string | null;
  kisi: number | null;
};

type Baglam = ProfilIslemDegerleri & {
  tarihAta: (v: string) => void;
  sehirAta: (v: string) => void;
  kisiAta: (v: string) => void;
  /** Ham girdi degerleri (kontrollu alanlar icin). */
  hamTarih: string;
  hamSehir: string;
  hamKisi: string;
};

const BOS: Baglam = {
  tarih: null,
  sehir: null,
  kisi: null,
  tarihAta: () => {},
  sehirAta: () => {},
  kisiAta: () => {},
  hamTarih: '',
  hamSehir: '',
  hamKisi: '',
};

const ProfilIslemContext = createContext<Baglam>(BOS);

export function ProfilIslemSaglayici({
  varsayilanSehir,
  children,
}: {
  varsayilanSehir: string | null;
  /** Sunucu bileseninin govdesi — fonksiyon DEGIL, hazir elemanlar. */
  children: ReactNode;
}) {
  const [hamTarih, setHamTarih] = useState('');
  const [hamSehir, setHamSehir] = useState(varsayilanSehir ?? '');
  const [hamKisi, setHamKisi] = useState('');

  const deger = useMemo<Baglam>(() => {
    const n = Number(hamKisi);
    return {
      tarih: hamTarih.trim() || null,
      sehir: hamSehir.trim() || null,
      kisi: Number.isFinite(n) && n > 0 ? Math.trunc(n) : null,
      tarihAta: setHamTarih,
      sehirAta: setHamSehir,
      kisiAta: setHamKisi,
      hamTarih,
      hamSehir,
      hamKisi,
    };
  }, [hamTarih, hamSehir, hamKisi]);

  return (
    <ProfilIslemContext.Provider value={deger}>
      {children}
    </ProfilIslemContext.Provider>
  );
}

export function useProfilIslem(): Baglam {
  return useContext(ProfilIslemContext);
}
