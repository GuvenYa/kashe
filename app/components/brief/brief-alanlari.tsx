'use client';

import { useState } from 'react';
import { TarihSecici } from '@/app/components/ui/tarih-secici';
import type { BriefField } from '@/app/lib/brief-config';
import {
  BRIEF_ACIKLAMA_SONEKI,
  BRIEF_ESNEK_SONEKI,
  briefIlAlani,
} from '@/app/lib/brief-anahtarlari';
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
  konumCoz,
} from '@/app/lib/ilceler';

/**
 * BRIEF ALANLARI — TEK CIZICI (Duzeltme 10-D/E).
 *
 * Ayni alan listesi iki formda (profil "Teklif al" modali ve `/teklif-topla`)
 * ayri ayri ciziliyordu; uc yeni davranis (il secici, "Tarih henuz belli
 * degil", "Diger" aciklamasi) iki yerde yazilmasin diye cizim buraya tasindi.
 *
 * UC KURAL:
 *   1. IL SECICI — `location` / `city` anahtarli metin alanlari artik 81 ilden
 *      secim + istege bagli "Ilce / mekan" metni; kaydedilen deger ayni
 *      ANAHTARDA `"<mekan>, <Il>"` ya da `"<Il>"` (legacy sutun degismez).
 *      Duzeltme 14-B: il 30 buyuksehirden biriyse araya ILCE acilir kutusu
 *      girer (`app/lib/ilceler.ts`), metin alani yalniz "Mekan" olur; deger
 *      `"<mekan>, <ilce>, <Il>"`. Diger illerde "Ilce / mekan" metni aynen.
 *   2. TARIH ESNEK — her `date` alaninin altinda "Tarih henuz belli degil"
 *      secimi; seciliyse tarih bos, `<key>_esnek = true` ve zorunluluk kalkar.
 *      Duzeltme 14-A: alan Turkce tarih secici (`TarihSecici`); "henuz belli
 *      degil" hizli secimlerin yaninda bir cip, tarih secilince kalkar. Alt
 *      sinir Istanbul gunu (eskiden cagiranin UTC gunu geliyordu).
 *   3. "DIGER" ACIKLAMASI — `select`te `other` secilince zorunlu kisa metin
 *      (`<key>_aciklama`, en fazla 120); baska secenege donulunce temizlenir.
 *
 * SAGLAYICI KURALI: `yalnizKendiSehri` ise secici yalniz saglayicinin ili;
 * `saglayiciIli` listenin basinda durur ve sehir disi secimde not cikar.
 */

const ALAN =
  'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';
const ETIKET =
  'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

export type BriefAlanlariProps = {
  alanlar: BriefField[];
  degerler: Record<string, string>;
  /** Tek alan yazimi (bos metin anahtari siler — cagiranin kurali aynen). */
  setAlan: (key: string, value: string) => void;
  /**
   * Profilin dolu gunleri (elle dolu + rezervasyonlu); tarih secicide
   * secilemez. Profil disinda (teklif topla) verilmez.
   */
  doluGunler?: readonly string[];
  iller?: Il[];
  saglayiciIli?: string | null;
  yalnizKendiSehri?: boolean;
};

export function BriefAlanlari({
  alanlar,
  degerler,
  setAlan,
  doluGunler,
  iller = [],
  saglayiciIli = null,
  yalnizKendiSehri = false,
}: BriefAlanlariProps) {
  /**
   * Il + ilce + mekan YEREL durumda tutulur, alana BIRLESIK yazilir. Ilk
   * degerler mevcut metinden cozulur (eski dolgu bir il adiyla eslesirse
   * secili gelir; buyuksehirde ilce adi da listeyle eslesirse secili gelir).
   */
  const ilkIller: Record<string, string> = {};
  const ilkIlceler: Record<string, string> = {};
  const ilkMekanlar: Record<string, string> = {};
  for (const a of alanlar) {
    if (!briefIlAlani(a)) continue;
    const ham = degerler[a.key] ?? '';
    const il = yalnizKendiSehri && saglayiciIli ? saglayiciIli : ilEslestir(ham, iller);
    ilkIller[a.key] = il;
    // "Zorlu PSM, Besiktas, Istanbul" -> ilce "Besiktas", mekan "Zorlu PSM";
    // "Mengen, Bolu" (ilce listesi yok) -> mekan "Mengen".
    const cozum = konumCoz(ham, il);
    ilkIlceler[a.key] = cozum.ilce;
    ilkMekanlar[a.key] = cozum.mekan;
  }
  const [ilSecimi, setIlSecimi] = useState<Record<string, string>>(ilkIller);
  const [ilceSecimi, setIlceSecimi] =
    useState<Record<string, string>>(ilkIlceler);
  const [mekanlar, setMekanlar] = useState<Record<string, string>>(ilkMekanlar);

  /** Il + ilce + mekan -> alan degeri. */
  function konumYaz(key: string, il: string, ilce: string, mekan: string) {
    setAlan(key, konumBirlestir(il, ilce, mekan));
  }

  return (
    <>
      {alanlar.map((field) => {
        const value = degerler[field.key] ?? '';
        const esnekKey = `${field.key}${BRIEF_ESNEK_SONEKI}`;
        const aciklamaKey = `${field.key}${BRIEF_ACIKLAMA_SONEKI}`;
        const esnek = (degerler[esnekKey] ?? '') === '1';
        const zorunlu = field.required && !(field.type === 'date' && esnek);
        const wrapperClass =
          field.type === 'textarea' ? 'md:col-span-2' : '';
        // Il listesi gelmediyse (cagiran gecmediyse) secici BOS kalirdi;
        // eski serbest metin girisine dusulur.
        const ilAlani = briefIlAlani(field) && iller.length > 0;
        const seciliIl = ilSecimi[field.key] ?? '';
        // Buyuksehirse ilce listesi; degilse null (serbest "ilce / mekan").
        const ilceler = ilAlani ? ilceListesi(seciliIl) : null;
        const seciliIlce = ilceler ? (ilceSecimi[field.key] ?? '') : '';

        return (
          <div key={field.key} className={wrapperClass}>
            <label htmlFor={`brief-${field.key}`} className={ETIKET}>
              {field.label}
              {zorunlu && <span className="text-danger"> *</span>}
            </label>

            {ilAlani ? (
              /* ---- 1) IL SECICI + istege bagli ilce / mekan ---- */
              <div className="space-y-2">
                <IlSecici
                  id={`brief-${field.key}`}
                  iller={iller}
                  deger={seciliIl}
                  oncelikliIl={saglayiciIli}
                  sabitIl={yalnizKendiSehri ? saglayiciIli : null}
                  onChange={(ad) => {
                    // Ilce yeni ilin listesinde yoksa bosalir.
                    const yeniIlce = ilceTasi(ad, ilceSecimi[field.key] ?? '');
                    setIlSecimi((s) => ({ ...s, [field.key]: ad }));
                    setIlceSecimi((s) => ({ ...s, [field.key]: yeniIlce }));
                    konumYaz(field.key, ad, yeniIlce, mekanlar[field.key] ?? '');
                  }}
                />
                {ilceler && (
                  /* Duzeltme 14-B: buyuksehirde ilce listeden secilir. */
                  <IlceSecici
                    key={seciliIl}
                    id={`brief-${field.key}-ilce`}
                    ilceler={ilceler}
                    deger={seciliIlce}
                    onChange={(ad) => {
                      setIlceSecimi((s) => ({ ...s, [field.key]: ad }));
                      konumYaz(field.key, seciliIl, ad, mekanlar[field.key] ?? '');
                    }}
                  />
                )}
                <input
                  type="text"
                  maxLength={80}
                  value={mekanlar[field.key] ?? ''}
                  onChange={(e) => {
                    const m = e.target.value.slice(0, 80);
                    setMekanlar((s) => ({ ...s, [field.key]: m }));
                    konumYaz(field.key, seciliIl, seciliIlce, m);
                  }}
                  aria-label={ilceler ? 'Mekan' : 'İlçe / mekan'}
                  placeholder={
                    ilceler
                      ? 'Mekan (isteğe bağlı)'
                      : 'İlçe / mekan (isteğe bağlı)'
                  }
                  className={ALAN}
                />
                {yalnizKendiSehri && saglayiciIli && (
                  <p className="text-xs text-ink-72">
                    Bu profesyonel yalnız {saglayiciIli} içinde hizmet veriyor.
                  </p>
                )}
                {!yalnizKendiSehri &&
                  saglayiciIli &&
                  (ilSecimi[field.key] ?? '') !== '' &&
                  ilSecimi[field.key] !== saglayiciIli && (
                    <p className="text-xs text-ink-72">
                      Şehir dışı: ulaşım ve konaklama teklife eklenebilir.
                    </p>
                  )}
              </div>
            ) : field.type === 'select' ? (
              /* ---- 3) select + "Diger" aciklamasi ---- */
              <>
                <select
                  id={`brief-${field.key}`}
                  value={value}
                  onChange={(e) => {
                    const yeni = e.target.value;
                    setAlan(field.key, yeni);
                    // Baska secenege donulunce aciklama TEMIZLENIR.
                    if (yeni !== 'other') setAlan(aciklamaKey, '');
                  }}
                  className={ALAN}
                >
                  <option value="">Seç...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {value === 'other' && (
                  <div className="mt-2">
                    {/*
                      Duzeltme 11-F2: etiket uzun ana alan adini TEKRAR
                      ediyordu ("ETKINLIK / CEKIM TURU - KISACA YAZ *") ve iki
                      satira kiriliyordu. Alan zaten o secimin HEMEN altinda.
                    */}
                    <label htmlFor={`brief-${aciklamaKey}`} className={ETIKET}>
                      Diğer — kısaca yaz
                      <span className="text-danger"> *</span>
                    </label>
                    <input
                      id={`brief-${aciklamaKey}`}
                      type="text"
                      maxLength={120}
                      value={degerler[aciklamaKey] ?? ''}
                      onChange={(e) =>
                        setAlan(aciklamaKey, e.target.value.slice(0, 120))
                      }
                      className={ALAN}
                    />
                  </div>
                )}
              </>
            ) : field.type === 'textarea' ? (
              <textarea
                id={`brief-${field.key}`}
                rows={3}
                maxLength={1000}
                value={value}
                onChange={(e) => setAlan(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`${ALAN} resize-none`}
              />
            ) : field.type === 'date' ? (
              /* ---- 2) tarih + "henuz belli degil" (Duzeltme 14-A) ---- */
              <TarihSecici
                id={`brief-${field.key}`}
                deger={esnek ? '' : value}
                onDegis={(gun) => setAlan(field.key, gun)}
                doluGunler={doluGunler}
                belirsiz={{
                  secili: esnek,
                  onDegis: (acik) => {
                    setAlan(esnekKey, acik ? '1' : '');
                    if (acik) setAlan(field.key, '');
                  },
                  etiket: 'Tarih henüz belli değil',
                }}
                className={ALAN}
              />
            ) : field.type === 'number' ? (
              <input
                id={`brief-${field.key}`}
                type="number"
                min={0}
                max={100000}
                value={value}
                onChange={(e) => setAlan(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={ALAN}
              />
            ) : (
              <input
                id={`brief-${field.key}`}
                type="text"
                maxLength={200}
                value={value}
                onChange={(e) => setAlan(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={ALAN}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
