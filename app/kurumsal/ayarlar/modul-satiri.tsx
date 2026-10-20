'use client';

import { useState, useTransition } from 'react';
import { modulAyarla } from '@/app/lib/modul-actions';

/**
 * FAZ 8a — modul ac/kapat satiri.
 *
 * SATIR ICI ONAY (`kurulus-rol-secici.tsx` deseni): modulu kapatmak ekibin
 * gordugu bir yuzeyi kaldirir, tek tikla olmaz. ACMAK da onay ister ki iki yon
 * ayni davransin ve yanlis tikla modul durumu degismesin.
 *
 * Gorevler KAYBOLMAZ: modul kapaninca yalniz yeni kayit ve yuzey kapanir
 * (tetikleyici INSERT'i reddeder), mevcut satirlar yerinde durur.
 */
export function ModulSatiri({
  orgId,
  modulAnahtari,
  baslik,
  aciklama,
  acik,
}: {
  orgId: string;
  modulAnahtari: string;
  baslik: string;
  aciklama: string;
  acik: boolean;
}) {
  const [onayAcik, setOnayAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function uygula() {
    setHata(null);
    basla(async () => {
      const sonuc = await modulAyarla(orgId, modulAnahtari, !acik);
      if (sonuc.ok) setOnayAcik(false);
      else setHata(sonuc.hata);
    });
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display font-semibold text-base text-ink">
              {baslik}
            </p>
            <span
              className={
                acik
                  ? 'font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 rounded-full bg-moss/10 border-moss/40 text-moss'
                  : 'font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 rounded-full bg-paper-2 border-line text-ink-72'
              }
            >
              {acik ? 'Açık' : 'Kapalı'}
            </span>
          </div>
          <p className="text-sm text-ink-72 mt-1">{aciklama}</p>
        </div>

        {onayAcik ? (
          <div className="shrink-0">
            <p className="text-[12px] text-ink-72 mb-1.5">
              {acik ? 'Kapatılsın mı?' : 'Açılsın mı?'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={uygula}
                disabled={bekliyor}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand-ink hover:underline disabled:opacity-50"
              >
                {bekliyor ? 'Uygulanıyor…' : 'Onayla'}
              </button>
              <button
                type="button"
                onClick={() => setOnayAcik(false)}
                disabled={bekliyor}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 hover:underline disabled:opacity-50"
              >
                Vazgeç
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOnayAcik(true)}
            className="shrink-0 px-4 py-2 border border-line rounded-lg font-mono text-[10px] uppercase tracking-[0.12em] text-ink hover:border-brand-ink hover:text-brand-ink transition-colors"
          >
            {acik ? 'Kapat' : 'Aç'}
          </button>
        )}
      </div>
      {hata && <p className="mt-2 text-[12px] text-danger">{hata}</p>}
    </div>
  );
}
