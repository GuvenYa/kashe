'use client';

import { useMemo, useRef, useState } from 'react';
import { aramaKatla } from '@/app/lib/arama';

/**
 * IL SECICI — 81 il, aranabilir (Duzeltme 10-D, bulgu 82).
 *
 * Il bugun SERBEST METIN olarak yaziliyordu (profil sag karti ve brief
 * `location` alani): "Istanbul", "ist", "İSTANBUL", "Kadikoy" hepsi ayni alana
 * giriyor, eslesme ve suzme imkansiz oluyordu.
 *
 * DEGER ADI TASIR, kimlik degil: legacy `location` sutunu ve `brief_data` ayni
 * ANAHTARI metin olarak tutuyor (alan adi degismesin diye). Secim il ADINI
 * yazar; cagiran isterse mekan metnini basa ekler ("Kadikoy, Istanbul").
 *
 * Arama Turkce harf duyarsiz (`aramaKatla`): "ist" -> Istanbul, "sanli" ->
 * Sanliurfa.
 *
 * SAGLAYICI KURALI (`category_attributes.service_region`): cagiran
 * `sabitIl` verirse liste O ILDEN ibarettir (secili gelir, degistirilemez);
 * `oncelikliIl` verirse o il listenin BASINDA durur.
 *
 * ILCE (Duzeltme 14-B): ayni kutu `IlceSecici` ile ilce listesinde de
 * kullanilir; arama etiketi ve "bulunamadi" metni bu yuzden prop.
 */

export type Il = { id: number; name: string };

export function IlSecici({
  iller,
  deger,
  onChange,
  id,
  placeholder = 'İl seç',
  oncelikliIl = null,
  sabitIl = null,
  className,
  aramaEtiketi = 'İl ara',
  bosMetin = 'İl bulunamadı.',
}: {
  iller: Il[];
  /** Secili il ADI ('' = secim yok). */
  deger: string;
  onChange: (ad: string) => void;
  id?: string;
  placeholder?: string;
  /** Listenin basinda duracak il (saglayicinin ili). */
  oncelikliIl?: string | null;
  /** Yalniz bu il secilebilir (saglayici yalniz kendi sehrinde hizmet veriyor). */
  sabitIl?: string | null;
  className?: string;
  /** Arama kutusunun etiketi ve yer tutucusu ("Il ara" / "Ilce ara"). */
  aramaEtiketi?: string;
  /** Arama sonuc vermeyince gorunen satir. */
  bosMetin?: string;
}) {
  const [acik, setAcik] = useState(false);
  const [sorgu, setSorgu] = useState('');
  // Klavye ile gezilen satir (ok tuslari); sorgu degisince basa doner.
  const [vurgu, setVurgu] = useState(0);
  const sarmalayici = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);

  const ALAN =
    className ??
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink text-left focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

  // Sabit il: tek secenek, kutu kilitli.
  if (sabitIl) {
    return (
      <input
        id={id}
        type="text"
        value={sabitIl}
        readOnly
        aria-readonly="true"
        className={`${ALAN} opacity-80 cursor-not-allowed`}
      />
    );
  }

  const sirali = oncelikliIl
    ? [
        ...iller.filter((i) => i.name === oncelikliIl),
        ...iller.filter((i) => i.name !== oncelikliIl),
      ]
    : iller;

  const katli = aramaKatla(sorgu.trim());
  const suzulmus = katli
    ? sirali.filter((i) => aramaKatla(i.name).includes(katli))
    : sirali;

  function sec(ad: string) {
    onChange(ad);
    setSorgu('');
    setVurgu(0);
    setAcik(false);
  }

  /**
   * Klavye (Duzeltme 10 incelemesi): ok tuslari satir gezer, Enter secer,
   * Escape kapatir. Enter VARSAYILANI ENGELLENIR: secici bir <form> icinde
   * (teklif / rezervasyon modali) ve arama kutusunda Enter formu
   * gonderiyordu.
   */
  function tus(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVurgu((v) => Math.min(v + 1, Math.max(suzulmus.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVurgu((v) => Math.max(v - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hedef = suzulmus[vurgu];
      if (hedef) {
        sec(hedef.name);
        dugme.current?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // modalin Escape kapatmasina gitmesin
      setAcik(false);
      dugme.current?.focus();
    }
  }

  return (
    <div className="relative" ref={sarmalayici}>
      <button
        ref={dugme}
        type="button"
        id={id}
        onClick={() => setAcik((v) => !v)}
        className={`${ALAN} flex items-center justify-between gap-2`}
        aria-expanded={acik}
        aria-haspopup="listbox"
      >
        <span className={deger ? 'text-ink' : 'text-ink-72/60'}>
          {deger || placeholder}
        </span>
        <span aria-hidden="true" className="text-ink-72 shrink-0">
          {acik ? '▴' : '▾'}
        </span>
      </button>

      {acik && (
        <div className="absolute z-30 mt-1 w-full bg-card border border-line rounded-lg shadow-lg overflow-hidden">
          <input
            type="text"
            value={sorgu}
            onChange={(e) => {
              setSorgu(e.target.value);
              setVurgu(0);
            }}
            onKeyDown={tus}
            onBlur={(e) => {
              // Odak secicinin ICINDE kaliyorsa (liste dugmesi, kaydirma
              // cubugu) kapanmaz; disari cikinca kapanir. Secim onMouseDown
              // ile blur'dan once yakalanir.
              if (sarmalayici.current?.contains(e.relatedTarget as Node | null)) return;
              window.setTimeout(() => setAcik(false), 120);
            }}
            role="combobox"
            aria-expanded={acik}
            aria-autocomplete="list"
            aria-label={aramaEtiketi}
            aria-activedescendant={
              suzulmus[vurgu] ? `${id ?? 'il'}-secenek-${suzulmus[vurgu].id}` : undefined
            }
            placeholder={aramaEtiketi + '…'}
            autoFocus
            className="w-full px-3 py-2 bg-paper border-b border-line text-sm text-ink focus:outline-none"
          />
          <ul role="listbox" className="max-h-56 overflow-y-auto">
            {deger && (
              <li>
                <button
                  type="button"
                  onMouseDown={() => sec('')}
                  className="w-full text-left px-3 py-2 text-sm text-ink-72 hover:bg-paper"
                >
                  Seçimi temizle
                </button>
              </li>
            )}
            {suzulmus.map((i, sira) => (
              <li key={i.id}>
                <button
                  type="button"
                  id={`${id ?? 'il'}-secenek-${i.id}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i.name === deger}
                  onMouseDown={() => sec(i.name)}
                  onMouseEnter={() => setVurgu(sira)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-paper ${
                    sira === vurgu ? 'bg-paper' : ''
                  } ${i.name === deger ? 'text-brand-ink font-medium' : 'text-ink'}`}
                >
                  {i.name}
                </button>
              </li>
            ))}
            {suzulmus.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-72">{bosMetin}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * ILCE SECICI (Duzeltme 14-B) - buyuksehir ilinin ilce listesi, aranabilir.
 *
 * `IlSecici`nin ayni kutusu; liste `app/lib/ilceler.ts`ten gelir (cagiran
 * `ilceListesi(il)` sonucunu verir). Secim istege bagli: secili ilce varken
 * listenin basinda "Secimi temizle" durur. Deger ilce ADIDIR ('' = secim yok).
 *
 * Il degisince kutunun arama metni ve acik / kapali durumu eskisinden
 * kalmasin diye cagiran `key={il}` verir.
 */
export function IlceSecici({
  ilceler,
  deger,
  onChange,
  id,
  placeholder = 'İlçe seç (isteğe bağlı)',
  className,
}: {
  ilceler: readonly string[];
  /** Secili ilce ADI ('' = secim yok). */
  deger: string;
  onChange: (ad: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const secenekler = useMemo(
    () => ilceler.map((name, sira) => ({ id: sira + 1, name })),
    [ilceler]
  );
  return (
    <IlSecici
      id={id}
      iller={secenekler}
      deger={deger}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      aramaEtiketi="İlçe ara"
      bosMetin="İlçe bulunamadı."
    />
  );
}

/**
 * Serbest metin dolgusunu il listesiyle esler (Duzeltme 10-D3).
 *
 * Eski metin dolgusu ("istanbul", "İSTANBUL", "Kadikoy, Istanbul") bir il
 * adiyla Turkce harf DUYARSIZ esleserse o il secili gelir; eslesmezse secim
 * bos kalir (uydurma il yazilmaz).
 */
export function ilEslestir(ham: string | null | undefined, iller: Il[]): string {
  const n = aramaKatla((ham ?? '').trim());
  if (!n) return '';
  const tam = iller.find((i) => aramaKatla(i.name) === n);
  if (tam) return tam.name;
  // Kaydedilen bicim "<mekan>, <Il>": once SONDAKI il aranir. Aksi halde
  // mekan metnindeki baska bir il adi ("Ankara Caddesi, Izmir") kazanirdi.
  const sondaki = iller
    .filter((i) => n.endsWith(aramaKatla(i.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (sondaki[0]) return sondaki[0].name;
  // "Kadikoy, Istanbul" gibi birlesik metinde il adini ara (en uzun esleme).
  const icerenler = iller
    .filter((i) => n.includes(aramaKatla(i.name)))
    .sort((a, b) => b.name.length - a.name.length);
  return icerenler[0]?.name ?? '';
}
