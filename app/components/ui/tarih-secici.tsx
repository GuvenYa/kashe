'use client';

import { useEffect, useRef, useState } from 'react';
import { istanbulGunu } from '@/app/lib/tarih';
import {
  AYLAR,
  GUN_KISALTMALARI,
  HIZLI_SECENEKLER,
  ayEkle,
  ayHucreleri,
  ayOf,
  gecerliGun,
  gunEkle,
  gunEtiketi,
  gunSecilebilir,
  ilkUygunGun,
  type HizliSecenek,
} from '@/app/lib/tarih-secim';

/**
 * TARIH SECICI (Duzeltme 14-A, bulgu 126; Fahri satir 27).
 *
 * `<input type="date">` tarayicinin dilini kullaniyordu: Ingilizce tarayicida
 * "ay / gun / yil" gorunuyor, hizli secenek yok. Bu bilesen:
 *   - degeri Turkce yazar ("27 Kasım 2026, Cuma"),
 *   - tiklayinca alanin ALTINDA Pazartesi ile baslayan ay takvimi acar
 *     (yuzer pencere degil: modal ve dar kartlarda kesilmesin),
 *   - altinda hizli secimler: "Gelecek hafta / 2 hafta sonra / Gelecek ay"
 *     ve istenirse "Tarih belli değil",
 *   - dolu gunleri (profil takvimiyle ayni kural) secilemez cizer; hizli
 *     secim dolu gune denk gelirse ilk musait gune kayar ve bunu soyler.
 *
 * DEGER bicimi degismedi: "YYYY-MM-DD" ('' = secim yok). Eylemler, sutunlar
 * ve `brief_data` ayni metni alir.
 *
 * `min` VERILMEZSE bugun (Istanbul gunu) alt sinirdir; `null` verilirse sinir
 * yok. "Bugun" yalniz etkilesimde okunur (render saf kalir, sunucu ile
 * tarayici ayni dugme metnini cizer).
 *
 * KLAVYE: oklar gun / hafta, PageUp / PageDown ay gezer, Enter / bosluk secer,
 * Escape takvimi kapatir ve odak alana doner (modalin Escape'ine gitmez).
 */

const DUGME =
  'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

function cip(basili: boolean): string {
  return `kashe-tap px-2.5 py-1 rounded-full border text-xs transition disabled:opacity-50 ${
    basili
      ? 'bg-brand-ink text-paper border-brand-ink'
      : 'bg-card text-ink-72 border-line hover:border-brand-ink hover:text-brand-ink'
  }`;
}

export type TarihSeciciProps = {
  /** Dugmenin id'si (etiketin `htmlFor`u). */
  id?: string;
  /** "YYYY-MM-DD" ya da '' (secim yok). */
  deger: string;
  onDegis: (gun: string) => void;
  /** Alt sinir. Verilmezse bugun; `null` = sinirsiz. */
  min?: string | null;
  /** Ust sinir (yoksa sinirsiz). */
  max?: string | null;
  /** Secilemeyen gunler (profesyonelin dolu / rezervasyonlu gunleri). */
  doluGunler?: readonly string[];
  /** Hizli secim cipleri (varsayilan acik). */
  hizli?: boolean;
  /** "Tarih belli değil" cipi; cagiranin esnek / belirsiz durumuna bagli. */
  belirsiz?: {
    secili: boolean;
    onDegis: (secili: boolean) => void;
    etiket?: string;
  };
  /** Takvimde "Temizle" (istege bagli alanlar). */
  temizlenebilir?: boolean;
  yerTutucu?: string;
  devreDisi?: boolean;
  /** Dugme sinifi (formun alan sinifi); verilmezse varsayilan. */
  className?: string;
  /**
   * Takvim zaten sayfada (profil fiyat / takvim karti): dugme kendi takvimini
   * ACMAZ, bunu cagirir (cagiran kendi takvimini acar / gosterir). Hizli
   * secimler aynen calisir.
   */
  disTakvim?: () => void;
};

export function TarihSecici({
  id,
  deger,
  onDegis,
  min,
  max = null,
  doluGunler,
  hizli = true,
  belirsiz,
  temizlenebilir = false,
  yerTutucu = 'Tarih seç',
  devreDisi = false,
  className,
  disTakvim,
}: TarihSeciciProps) {
  const [acik, setAcik] = useState(false);
  const [bugun, setBugun] = useState<string | null>(null);
  const [gorunen, setGorunen] = useState<{ yil: number; ay0: number }>({
    yil: 2026,
    ay0: 0,
  });
  const [odak, setOdak] = useState<string | null>(null);
  const [sonHizli, setSonHizli] = useState<{ anahtar: string; gun: string } | null>(
    null
  );
  const [kaymaNotu, setKaymaNotu] = useState<string | null>(null);
  const sarmalayici = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);
  const izgara = useRef<HTMLDivElement>(null);
  /** Bir sonraki cizimde `odak` gunune klavye odagi tasinsin mi. */
  const odakTasi = useRef(false);

  const dolu = new Set(doluGunler ?? []);
  const secili = gecerliGun(deger) ? deger : '';
  /** Etkin alt sinir: `min` verilmediyse acilista okunan bugun. */
  const altSinir = min === undefined ? bugun : min;

  // Takvim acikken disari tiklama kapatir.
  useEffect(() => {
    if (!acik) return;
    function disari(e: MouseEvent | TouchEvent) {
      if (sarmalayici.current && !sarmalayici.current.contains(e.target as Node)) {
        setAcik(false);
      }
    }
    document.addEventListener('mousedown', disari);
    document.addEventListener('touchstart', disari);
    return () => {
      document.removeEventListener('mousedown', disari);
      document.removeEventListener('touchstart', disari);
    };
  }, [acik]);

  // Klavye ile gezilen gune odak.
  useEffect(() => {
    if (!acik || !odak || !odakTasi.current) return;
    odakTasi.current = false;
    izgara.current
      ?.querySelector<HTMLButtonElement>(`[data-gun="${odak}"]`)
      ?.focus();
  }, [acik, odak, gorunen]);

  function ac() {
    const b = istanbulGunu();
    const alt = min === undefined ? b : min;
    const baz = secili || (alt && alt > b ? alt : b);
    setBugun(b);
    setGorunen(ayOf(baz) ?? { yil: Number(b.slice(0, 4)), ay0: Number(b.slice(5, 7)) - 1 });
    setOdak(baz);
    odakTasi.current = true;
    setAcik(true);
  }

  function kapat(alanaDon: boolean) {
    setAcik(false);
    if (alanaDon) dugme.current?.focus();
  }

  function sec(gun: string) {
    if (!gunSecilebilir(gun, altSinir, max, dolu)) return;
    onDegis(gun);
    if (belirsiz?.secili) belirsiz.onDegis(false);
    setSonHizli(null);
    setKaymaNotu(null);
    kapat(true);
  }

  function hizliSec(h: HizliSecenek) {
    const b = istanbulGunu();
    const alt = min === undefined ? b : min;
    const hedef = h.hesapla(b);
    const gun = ilkUygunGun(hedef, alt, max, dolu);
    if (!gun) {
      // Yakinda musait gun yok: takvimi hedef ayda ac, kullanici secsin.
      setBugun(b);
      setGorunen(ayOf(hedef) ?? gorunen);
      setOdak(hedef);
      setKaymaNotu('Bu aralıkta müsait gün bulunamadı; takvimden seç.');
      setAcik(true);
      return;
    }
    onDegis(gun);
    if (belirsiz?.secili) belirsiz.onDegis(false);
    setSonHizli({ anahtar: h.anahtar, gun });
    setKaymaNotu(
      gun !== hedef && dolu.has(hedef)
        ? `${gunEtiketi(hedef).split(',')[0]} dolu; ilk müsait gün seçildi.`
        : null
    );
    setAcik(false);
  }

  function belirsizDegis() {
    if (!belirsiz) return;
    if (belirsiz.secili) {
      belirsiz.onDegis(false);
      return;
    }
    if (secili) onDegis('');
    belirsiz.onDegis(true);
    setSonHizli(null);
    setKaymaNotu(null);
    setAcik(false);
  }

  function ayaGit(fark: number) {
    const toplam = gorunen.yil * 12 + gorunen.ay0 + fark;
    setGorunen({ yil: Math.floor(toplam / 12), ay0: ((toplam % 12) + 12) % 12 });
  }

  function panelTus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // modalin Escape kapatmasina gitmesin
      kapat(true);
      return;
    }
    const hedefGun = (e.target as HTMLElement).dataset?.gun;
    if (!hedefGun) return;
    let yeni: string | null = null;
    if (e.key === 'ArrowLeft') yeni = gunEkle(hedefGun, -1);
    else if (e.key === 'ArrowRight') yeni = gunEkle(hedefGun, 1);
    else if (e.key === 'ArrowUp') yeni = gunEkle(hedefGun, -7);
    else if (e.key === 'ArrowDown') yeni = gunEkle(hedefGun, 7);
    else if (e.key === 'PageUp') yeni = ayEkle(hedefGun, -1);
    else if (e.key === 'PageDown') yeni = ayEkle(hedefGun, 1);
    if (!yeni) return;
    e.preventDefault();
    if (altSinir && yeni < altSinir) yeni = altSinir;
    if (max && yeni > max) yeni = max;
    const a = ayOf(yeni);
    if (a) setGorunen(a);
    setOdak(yeni);
    odakTasi.current = true;
  }

  const metin = belirsiz?.secili
    ? belirsiz.etiket ?? 'Tarih belli değil'
    : secili
      ? gunEtiketi(secili)
      : '';

  const hucreler = ayHucreleri(gorunen.yil, gorunen.ay0);
  const ayIndeksi = gorunen.yil * 12 + gorunen.ay0;
  const altAy = altSinir ? ayOf(altSinir) : null;
  const ustAy = max ? ayOf(max) : null;
  const oncekiKapali = !!altAy && ayIndeksi <= altAy.yil * 12 + altAy.ay0;
  const sonrakiKapali = !!ustAy && ayIndeksi >= ustAy.yil * 12 + ustAy.ay0;
  // Sekme ile girilecek tek gun (gezinme oklarla): odak, yoksa ilk secilebilir.
  const gorunurGunler = hucreler.filter((g): g is string => g !== null);
  const sekmeGunu =
    (odak && gorunurGunler.includes(odak) ? odak : null) ??
    gorunurGunler.find((g) => gunSecilebilir(g, altSinir, max, dolu)) ??
    gorunurGunler[0];

  return (
    <div ref={sarmalayici}>
      <button
        ref={dugme}
        id={id}
        type="button"
        disabled={devreDisi}
        onClick={() => (disTakvim ? disTakvim() : acik ? kapat(false) : ac())}
        aria-haspopup={disTakvim ? undefined : 'dialog'}
        aria-expanded={disTakvim ? undefined : acik}
        aria-describedby={id ? `${id}-deger` : undefined}
        className={`${className ?? DUGME} text-left flex items-center justify-between gap-2 disabled:opacity-50`}
      >
        {/* Etiket (`htmlFor`) dugmenin adi olur; secili deger ayrica okunsun. */}
        <span id={id ? `${id}-deger` : undefined} className={metin ? 'text-ink' : 'text-ink-72/60'}>
          {metin || yerTutucu}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-ink-72"
        >
          <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {(hizli || belirsiz) && (
        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Hızlı tarih seçimi">
          {hizli &&
            HIZLI_SECENEKLER.map((h) => {
              const basili =
                !belirsiz?.secili &&
                sonHizli?.anahtar === h.anahtar &&
                sonHizli.gun === secili;
              return (
                <button
                  key={h.anahtar}
                  type="button"
                  disabled={devreDisi}
                  aria-pressed={basili}
                  onClick={() => hizliSec(h)}
                  className={cip(basili)}
                >
                  {h.etiket}
                </button>
              );
            })}
          {belirsiz && (
            <button
              type="button"
              disabled={devreDisi}
              aria-pressed={belirsiz.secili}
              onClick={belirsizDegis}
              className={cip(belirsiz.secili)}
            >
              {belirsiz.etiket ?? 'Tarih belli değil'}
            </button>
          )}
        </div>
      )}
      {kaymaNotu && <p className="text-xs text-ink-72 mt-1.5">{kaymaNotu}</p>}

      {acik && (
        <div
          role="dialog"
          aria-label="Tarih seç"
          onKeyDown={panelTus}
          className="mt-2 w-full max-w-sm bg-card border border-line rounded-xl p-3 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => ayaGit(-1)}
              disabled={oncekiKapali}
              aria-label="Önceki ay"
              className="kashe-tap w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink-72 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <p className="font-display text-sm font-semibold text-ink" aria-live="polite">
              {AYLAR[gorunen.ay0]} {gorunen.yil}
            </p>
            <button
              type="button"
              onClick={() => ayaGit(1)}
              disabled={sonrakiKapali}
              aria-label="Sonraki ay"
              className="kashe-tap w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink-72 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
            {GUN_KISALTMALARI.map((g) => (
              <div
                key={g}
                className="text-center font-mono text-[10px] uppercase tracking-[0.06em] text-ink-50"
              >
                {g}
              </div>
            ))}
          </div>

          <div
            ref={izgara}
            className="grid grid-cols-7 gap-1"
            aria-label={`${AYLAR[gorunen.ay0]} ${gorunen.yil}`}
          >
            {hucreler.map((g, i) => {
              if (!g) return <div key={`bos-${i}`} />;
              const secilebilir = gunSecilebilir(g, altSinir, max, dolu);
              const doluMu = dolu.has(g) && !(altSinir && g < altSinir);
              const seciliMi = g === secili;
              const bugunMu = g === bugun;
              let cls =
                'h-9 w-full flex items-center justify-center rounded-lg text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink';
              if (seciliMi) cls += ' bg-brand-accent text-paper font-semibold';
              else if (doluMu) cls += ' bg-ink-72/10 text-ink-50 line-through cursor-not-allowed';
              else if (!secilebilir) cls += ' text-ink-32 cursor-not-allowed';
              else cls += ' text-ink hover:bg-brand-accent/15';
              if (bugunMu && !seciliMi) cls += ' ring-1 ring-inset ring-ink-72/40';
              return (
                <button
                  key={g}
                  type="button"
                  data-gun={g}
                  tabIndex={g === sekmeGunu ? 0 : -1}
                  aria-disabled={!secilebilir || undefined}
                  aria-pressed={seciliMi}
                  aria-label={`${gunEtiketi(g)}${doluMu ? ' — dolu' : ''}${bugunMu ? ' — bugün' : ''}`}
                  onFocus={() => setOdak(g)}
                  onClick={() => sec(g)}
                  className={cls}
                >
                  {Number(g.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 mt-3 pt-2.5 border-t border-line">
            <span className="text-[11px] text-ink-72">
              {dolu.size > 0 ? 'Üstü çizili günler dolu.' : ''}
            </span>
            <span className="flex items-center gap-3">
              {temizlenebilir && secili && (
                <button
                  type="button"
                  onClick={() => {
                    onDegis('');
                    setSonHizli(null);
                    setKaymaNotu(null);
                    kapat(true);
                  }}
                  className="kashe-tap text-xs text-ink-72 hover:text-brand-ink hover:underline"
                >
                  Temizle
                </button>
              )}
              <button
                type="button"
                onClick={() => kapat(true)}
                className="kashe-tap text-xs font-semibold text-brand-ink hover:underline"
              >
                Kapat
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
