'use client';

import { useState } from 'react';
import { takvimiAc } from '@/app/lib/tarih-girdisi';
import type { BriefField } from '@/app/lib/brief-config';
import {
  BRIEF_ACIKLAMA_SONEKI,
  BRIEF_ESNEK_SONEKI,
  briefIlAlani,
} from '@/app/lib/brief-anahtarlari';
import { IlSecici, ilEslestir, type Il } from '@/app/components/ui/il-secici';

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
 *   2. TARIH ESNEK — her `date` alaninin altinda "Tarih henuz belli degil"
 *      kutusu; isaretliyse tarih bos + devre disi, `<key>_esnek = true` ve
 *      zorunluluk kalkar.
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
  /** Mantiksal anahtarlar (`<key>_esnek`) icin; metin '1' / '' olarak tasinir. */
  bugun: string;
  iller?: Il[];
  saglayiciIli?: string | null;
  yalnizKendiSehri?: boolean;
};

export function BriefAlanlari({
  alanlar,
  degerler,
  setAlan,
  bugun,
  iller = [],
  saglayiciIli = null,
  yalnizKendiSehri = false,
}: BriefAlanlariProps) {
  /**
   * Il + mekan YEREL durumda tutulur, alana BIRLESIK yazilir. Ilk degerler
   * mevcut metinden cozulur (eski dolgu bir il adiyla eslesirse secili gelir).
   */
  const ilkIller: Record<string, string> = {};
  const ilkMekanlar: Record<string, string> = {};
  for (const a of alanlar) {
    if (!briefIlAlani(a)) continue;
    const ham = degerler[a.key] ?? '';
    const il = yalnizKendiSehri && saglayiciIli ? saglayiciIli : ilEslestir(ham, iller);
    ilkIller[a.key] = il;
    // "Kadikoy, Istanbul" -> mekan "Kadikoy"
    const mekan = il && ham.toLocaleLowerCase('tr').endsWith(il.toLocaleLowerCase('tr'))
      ? ham.slice(0, ham.length - il.length).replace(/[,\s]+$/, '').trim()
      : il
        ? ''
        : ham;
    ilkMekanlar[a.key] = mekan;
  }
  const [ilSecimi, setIlSecimi] = useState<Record<string, string>>(ilkIller);
  const [mekanlar, setMekanlar] = useState<Record<string, string>>(ilkMekanlar);

  /** Il + mekan -> alan degeri. */
  function konumYaz(key: string, il: string, mekan: string) {
    const m = mekan.trim();
    const birlesik = il ? (m ? `${m}, ${il}` : il) : m;
    setAlan(key, birlesik);
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
                  deger={ilSecimi[field.key] ?? ''}
                  oncelikliIl={saglayiciIli}
                  sabitIl={yalnizKendiSehri ? saglayiciIli : null}
                  onChange={(ad) => {
                    setIlSecimi((s) => ({ ...s, [field.key]: ad }));
                    konumYaz(field.key, ad, mekanlar[field.key] ?? '');
                  }}
                />
                <input
                  type="text"
                  maxLength={80}
                  value={mekanlar[field.key] ?? ''}
                  onChange={(e) => {
                    const m = e.target.value.slice(0, 80);
                    setMekanlar((s) => ({ ...s, [field.key]: m }));
                    konumYaz(field.key, ilSecimi[field.key] ?? '', m);
                  }}
                  placeholder="İlçe / mekan (isteğe bağlı)"
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
                    <label htmlFor={`brief-${aciklamaKey}`} className={ETIKET}>
                      {field.label} - kısaca yaz
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
              /* ---- 2) tarih + "henuz belli degil" ---- */
              <>
                <input
                  id={`brief-${field.key}`}
                  type="date"
                  onClick={takvimiAc}
                  min={bugun}
                  value={esnek ? '' : value}
                  disabled={esnek}
                  onChange={(e) => setAlan(field.key, e.target.value)}
                  className={`${ALAN} ${esnek ? 'opacity-50' : ''}`}
                />
                <label className="flex items-center gap-2 mt-2 text-sm text-ink-72">
                  <input
                    type="checkbox"
                    checked={esnek}
                    onChange={(e) => {
                      const acik = e.target.checked;
                      setAlan(esnekKey, acik ? '1' : '');
                      if (acik) setAlan(field.key, '');
                    }}
                    className="w-4 h-4 accent-[var(--color-brand-ink)]"
                  />
                  Tarih henüz belli değil
                </label>
              </>
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
