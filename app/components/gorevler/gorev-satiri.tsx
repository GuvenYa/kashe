'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  GOREV_DURUMLARI,
  gorevDurumEtiketi,
  gorevDurumSinifi,
  type GorevDurumu,
} from '@/app/lib/gorevler';
import { gorevGuncelle, gorevSil } from '@/app/lib/gorev-actions';
import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import type { GorevSatiri as Gorev } from '@/app/lib/gorev-data';

/**
 * FAZ 8a — gorev listesindeki tek satir.
 *
 * Durum kutusu ONAY KUTUSU GORUNUMUNDE ama davranisi todo <-> done degil: bes
 * durum var, kutu bir SECICI acar. Tek tikla "tamamlandi" yapmak iptal ve
 * engellendi durumlarini erisilemez kilardi.
 */
const DURUM_ISARETI: Record<GorevDurumu, string> = {
  todo: '',
  in_progress: '•',
  blocked: '!',
  done: '✓',
  cancelled: '–',
};

function sonTarihMetni(due: string | null): {
  metin: string;
  gecikmis: boolean;
  bugun: boolean;
} | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const gun = (x: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: KASHE_SAAT_DILIMI }).format(x);
  const bugunGun = gun(new Date());
  const dueGun = gun(d);
  const saat = d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KASHE_SAAT_DILIMI,
  });
  if (dueGun === bugunGun) {
    return { metin: `bugün ${saat}`, gecikmis: d < new Date(), bugun: true };
  }
  return {
    metin:
      d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        timeZone: KASHE_SAAT_DILIMI,
      }) + (saat === '00:00' ? '' : ` ${saat}`),
    gecikmis: dueGun < bugunGun,
    bugun: false,
  };
}

export function GorevSatiri({
  gorev,
  yazabilir,
  etkinlikSutunu,
  vurgulu,
  onDuzenle,
}: {
  gorev: Gorev;
  yazabilir: boolean;
  /** Kurulus genel listesinde etkinlik adi gosterilir; etkinlik sekmesinde hayir. */
  etkinlikSutunu: boolean;
  vurgulu?: boolean;
  onDuzenle: (gorev: Gorev) => void;
}) {
  const [durumAcik, setDurumAcik] = useState(false);
  const [menuAcik, setMenuAcik] = useState(false);
  const [silOnayi, setSilOnayi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const durum = gorev.status as GorevDurumu;
  const tarih = sonTarihMetni(gorev.due_at);
  const kapali = durum === 'done' || durum === 'cancelled';

  const atananAdi =
    gorev.assignee?.full_name?.trim() || gorev.havuz?.name || null;

  function durumDegistir(yeni: GorevDurumu) {
    setDurumAcik(false);
    if (yeni === durum) return;
    setHata(null);
    basla(async () => {
      const sonuc = await gorevGuncelle({ id: gorev.id, status: yeni });
      if (!sonuc.ok) setHata(sonuc.hata);
    });
  }

  function sil() {
    setHata(null);
    basla(async () => {
      const sonuc = await gorevSil(gorev.id, gorev.event_id);
      if (!sonuc.ok) {
        setHata(sonuc.hata);
        setSilOnayi(false);
        setMenuAcik(false);
      }
    });
  }

  return (
    <div
      className={
        vurgulu
          ? 'border border-brand-accent/40 bg-brand-accent-soft rounded-lg p-3'
          : 'border-b border-line last:border-b-0 py-3'
      }
    >
      <div className="flex items-start gap-3">
        {/* Durum kutusu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => yazabilir && setDurumAcik((v) => !v)}
            disabled={!yazabilir || bekliyor}
            aria-label={`Durum: ${gorevDurumEtiketi(durum)}`}
            aria-expanded={durumAcik}
            className={`w-5 h-5 mt-0.5 rounded border flex items-center justify-center font-mono text-[11px] leading-none transition-colors ${gorevDurumSinifi(durum)} ${yazabilir ? 'hover:border-brand-ink cursor-pointer' : 'cursor-default'}`}
          >
            {DURUM_ISARETI[durum]}
          </button>
          {durumAcik && (
            <div className="absolute left-0 top-7 z-20 w-44 bg-card border border-line rounded-lg shadow-lg py-1">
              {GOREV_DURUMLARI.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => durumDegistir(d)}
                  className={
                    d === durum
                      ? 'w-full text-left px-3 py-1.5 text-sm text-brand-ink bg-brand-ink-08'
                      : 'w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-brand-ink-08'
                  }
                >
                  {gorevDurumEtiketi(d)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Govde */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {gorev.is_milestone && (
              <span
                className="font-mono text-[10px] text-brand-accent"
                title="Kilometre taşı"
              >
                ◆
              </span>
            )}
            <p
              className={
                kapali
                  ? gorev.is_milestone
                    ? 'text-sm text-ink-50 font-semibold line-through'
                    : 'text-sm text-ink-50 line-through'
                  : gorev.is_milestone
                    ? 'text-sm text-ink font-semibold'
                    : 'text-sm text-ink'
              }
            >
              {gorev.title}
            </p>
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 rounded-full ${gorevDurumSinifi(durum)}`}
            >
              {gorevDurumEtiketi(durum)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px]">
            <span className={atananAdi ? 'text-ink-72' : 'text-ink-50'}>
              {atananAdi ?? 'Atanmamış'}
            </span>
            {tarih && (
              <span
                className={
                  tarih.gecikmis
                    ? 'text-danger font-medium'
                    : tarih.bugun
                      ? 'text-brand-ink font-medium'
                      : 'text-ink-72'
                }
              >
                {tarih.metin}
              </span>
            )}
            {etkinlikSutunu && gorev.event && (
              <Link
                href={`/etkinliklerim/${gorev.event.id}?sekme=gorevler`}
                className="kashe-tap text-brand-ink hover:underline truncate max-w-[200px]"
              >
                {gorev.event.title?.trim() || 'Etkinlik'}
              </Link>
            )}
            {gorev.bagli && (
              <span className="text-ink-50">
                ↳ {gorev.bagli.title}&apos;ten sonra
              </span>
            )}
          </div>

          {hata && <p className="mt-1.5 text-[12px] text-danger">{hata}</p>}
        </div>

        {/* Islemler */}
        {yazabilir && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setMenuAcik((v) => !v);
                setSilOnayi(false);
              }}
              disabled={bekliyor}
              aria-label="Görev işlemleri"
              aria-expanded={menuAcik}
              className="kashe-tap px-2 py-1 text-ink-50 hover:text-ink rounded"
            >
              …
            </button>
            {menuAcik && (
              <div className="absolute right-0 top-7 z-20 w-56 bg-card border border-line rounded-lg shadow-lg py-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuAcik(false);
                    onDuzenle(gorev);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-brand-ink-08"
                >
                  Düzenle
                </button>
                {silOnayi ? (
                  <div className="px-3 py-2 border-t border-line">
                    <p className="text-[12px] text-ink-72 mb-1.5">Silinsin mi?</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={sil}
                        disabled={bekliyor}
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-danger hover:underline disabled:opacity-50"
                      >
                        Onayla
                      </button>
                      <button
                        type="button"
                        onClick={() => setSilOnayi(false)}
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 hover:underline"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSilOnayi(true)}
                    className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger-08"
                  >
                    Sil
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
