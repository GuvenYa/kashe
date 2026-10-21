import type { ReactNode } from 'react';

/**
 * OZET SERIT — sayfanin altinda duran yapiskan serit (D1b-3).
 *
 * VARSAYILAN (`md` alti, acik zemin): masaustunde YOK, cunku genis ekranda ayni
 * bilgi ve ayni birincil dugme baslik kartinda zaten duruyor; serit tekrar
 * olurdu. Telefonda ise uzun bir tablonun dibine inen kullanici "toplam ne,
 * simdi ne yapacagim" sorusunun yanitini kaydirma yapmadan goruyor.
 *
 * `herGenislik` + `koyu` (D3): aday secimi her genislikte DEVAM EDEN bir karar;
 * secim sayisi ve butce oraninin masaustunde de gorunmesi gerekiyor. Lacivert
 * zemin seridi icerikten ayirir (desen 5).
 *
 * Dugme EYLEM URETMEZ: `aksiyon` olarak verilen dugme cagiranin kendi dugmesidir
 * (ayni action, ayni onay kapisi). `orta` da oyle — serit yalniz kabuktur.
 * RAKAM URETMEZ: `deger`, `altNot` ve `orta` hazir bicimlenmis gelir.
 */
export function OzetSerit({
  etiket,
  deger,
  altNot,
  orta,
  aksiyon,
  koyu = false,
  herGenislik = false,
  panelKabugunda = false,
}: {
  etiket?: string;
  deger: string;
  altNot?: string;
  /** Orta blok (ornek: butce kullanim cubugu). Bos birakilabilir. */
  orta?: ReactNode;
  aksiyon?: ReactNode;
  /** Lacivert zemin — desen 5. */
  koyu?: boolean;
  /** `md` ustunde de gorunur (varsayilan: yalniz telefonda). */
  herGenislik?: boolean;
  /**
   * Sayfa `PanelKabugu` icinde mi? Kabukta sol sutun `lg`'de 240 px ve
   * `fixed` + `z-40`: serit `left-0` kalirsa sol blogu menunun ARKASINDA
   * kalir ve okunmaz. `lg:left-60` seridi icerik alaniyla hizalar.
   * Yalniz `herGenislik` ile anlamli (varsayilan serit `lg`'de zaten yok).
   */
  panelKabugunda?: boolean;
}) {
  // Kosullu ifade sinifin TAMAMININ yerine gecer: `${` bitisik yazilmaz
  // (CLAUDE.md — bitisik yazim sinifi uretilen CSS'ten sessizce dusuruyor).
  const bosluk = herGenislik ? 'h-20' : 'h-20 md:hidden';
  // Varsayilan kabuk D1b-3'teki sinif dizisiyle BIREBIR ayni kalir (mevcut uc
  // cagiran: teklif editoru, teklif karsilastirma x2). `flex-wrap` yalniz
  // `herGenislik` dalinda: orta blok masaustunde yer isteyince satir kirilir.
  const kabuk = herGenislik
    ? panelKabugunda
      ? 'fixed bottom-0 left-0 right-0 lg:left-60 z-30 border-t px-4 py-3 flex items-center justify-between gap-3 flex-wrap'
      : 'fixed bottom-0 left-0 right-0 z-30 border-t px-4 py-3 flex items-center justify-between gap-3 flex-wrap'
    : 'md:hidden fixed bottom-0 left-0 right-0 z-30 border-t px-4 py-3 flex items-center justify-between gap-3';
  const zemin = koyu
    ? 'bg-ink border-paper-14'
    : 'bg-card border-line-strong';
  const etiketRengi = koyu ? 'text-paper-50' : 'text-ink-50';
  const degerRengi = koyu ? 'text-paper' : 'text-ink';
  const notRengi = koyu ? 'text-paper-72' : 'text-ink-72';

  return (
    <>
      {/* Serit sabit konumda durdugu icin sayfanin son icerigini kapatmasin:
          ayni yukseklikte bos bir alan birakilir. */}
      <div className={bosluk} aria-hidden />
      <div className={`${kabuk} ${zemin}`}>
        <div className="min-w-0">
          {etiket && (
            <p
              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${etiketRengi}`}
            >
              {etiket}
            </p>
          )}
          <p
            className={`font-display font-semibold tabular-nums leading-tight truncate ${degerRengi}`}
          >
            {deger}
          </p>
          {altNot && <p className={`text-[11px] ${notRengi}`}>{altNot}</p>}
        </div>
        {orta && <div className="min-w-0 flex-1 hidden md:block">{orta}</div>}
        {aksiyon && <div className="shrink-0">{aksiyon}</div>}
      </div>
    </>
  );
}
