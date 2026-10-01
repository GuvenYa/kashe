'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { addProviderToTalentPool } from '@/app/ajans/havuz/havuz-actions';
import {
  ILISKI_ETIKETLERI,
  ILISKI_SECENEKLERI,
  type HavuzIliskiTuru,
} from '@/app/ajans/havuz/havuz-data';

/**
 * FAZ 5 / P3 — "Havuza ekle" (yalniz `talent.manage` yetkisi olan ajans uyesine).
 *
 * Sunucu bu bileseni ANCAK yonetilebilir kurulus varsa render eder; musteri
 * gorunumunde DOM'da da yoktur. Istemci yalniz `providerId` + iliski turu
 * gonderir; `talent_id` ve roller sunucuda cozulur.
 */

export type HavuzaEkleKurulus = {
  id: string;
  name: string;
  durum: 'havuzda' | 'eklenebilir';
};

const ALAN =
  'w-full px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

export function HavuzaEkle({
  providerId,
  providerName,
  kuruluslar,
  rolEtiketleri,
}: {
  providerId: string;
  providerName: string;
  kuruluslar: HavuzaEkleKurulus[];
  /** `provider_services`'tan on dolu roller — SALT OKUNUR ozet. */
  rolEtiketleri: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [eklenen, setEklenen] = useState<string[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [iliski, setIliski] = useState<HavuzIliskiTuru>('occasional');

  const eklenebilir = kuruluslar.filter(
    (k) => k.durum === 'eklenebilir' && !eklenen.includes(k.id)
  );
  const havuzda = kuruluslar.filter(
    (k) => k.durum === 'havuzda' || eklenen.includes(k.id)
  );
  const [secilen, setSecilen] = useState<string>(kuruluslar[0]?.id ?? '');
  const hedef = eklenebilir.some((k) => k.id === secilen)
    ? secilen
    : (eklenebilir[0]?.id ?? '');

  function ekle() {
    if (!hedef) return;
    setHata(null);
    startTransition(async () => {
      const res = await addProviderToTalentPool({
        organizationId: hedef,
        providerId,
        relationshipType: iliski,
      });
      if (res.success) {
        setEklenen((o) => [...o, hedef]);
        setAcik(false);
        return;
      }
      setHata(res.error);
    });
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink mb-2.5">
        Yetenek havuzu
      </p>

      {havuzda.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2.5">
          {havuzda.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-2 flex-wrap text-[13px]"
            >
              <span className="inline-flex items-center gap-1.5 text-ink">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-brand-ink)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <polyline points="4 12.5 9.5 18 20 6.5" />
                </svg>
                {kuruluslar.length > 1 ? `${k.name}: havuzunda` : 'Havuzunda'}
              </span>
              <Link
                href="/ajans/havuz"
                className="text-[12.5px] text-brand-ink hover:underline"
              >
                Havuzu aç
              </Link>
            </div>
          ))}
        </div>
      )}

      {hata && <p className="text-[13px] text-danger mb-2.5">{hata}</p>}

      {eklenebilir.length > 0 && !acik && (
        <button
          type="button"
          onClick={() => setAcik(true)}
          className="kashe-tap w-full px-4 py-2.5 bg-brand-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
        >
          Havuza ekle
        </button>
      )}

      {eklenebilir.length > 0 && acik && (
        <div className="space-y-3">
          {eklenebilir.length > 1 && (
            <div>
              <label className="block text-[11.5px] text-ink-72 mb-1">
                Kuruluş
              </label>
              <select
                value={hedef}
                onChange={(e) => setSecilen(e.target.value)}
                className={ALAN}
              >
                {eklenebilir.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11.5px] text-ink-72 mb-1">
              İlişki türü
            </label>
            <select
              value={iliski}
              onChange={(e) => setIliski(e.target.value as HavuzIliskiTuru)}
              className={ALAN}
            >
              {ILISKI_SECENEKLERI.map((t) => (
                <option key={t} value={t}>
                  {ILISKI_ETIKETLERI[t]}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[12.5px] text-ink-72 leading-relaxed">
            {rolEtiketleri.length > 0
              ? `Roller: ${rolEtiketleri.join(', ')}`
              : 'Rol yok; havuzda atayabilirsin.'}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={ekle}
              disabled={isPending || !hedef}
              className="kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50"
            >
              {isPending ? 'Ekleniyor…' : 'Ekle'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAcik(false);
                setHata(null);
              }}
              className="kashe-tap px-4 py-2 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {eklenen.length > 0 && (
        <p className="text-[12.5px] text-ink-72 mt-2.5">
          {providerName} havuza eklendi.{' '}
          <Link href="/ajans/havuz" className="text-brand-ink hover:underline">
            Rolleri ve ilişki türünü havuzda düzenle
          </Link>
          .
        </p>
      )}
    </div>
  );
}
