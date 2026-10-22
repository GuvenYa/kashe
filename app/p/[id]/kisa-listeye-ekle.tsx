'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { kisaListeyeHizliEkle } from '@/app/lib/tedarikci-actions';

/**
 * FAZ 8c / hijyen 04 — "Kisa listeye ekle" (`havuza-ekle.tsx` kalibi).
 *
 * Sunucu bu bileseni ANCAK `supplier_search` modulu acik ve `events.manage`
 * yetkili kurulusu olan kullaniciya render eder; musteri gorunumunde DOM'da da
 * yoktur. Kullanicinin kendi profili ve kendi kurulusunun kaydi icin bant hic
 * cizilmez (DB de 22023 ile reddeder — kural tek yerde).
 *
 * Liste secimi SORULMAZ: action kurulusun "Genel" listesine ekler ve liste
 * yoksa onu da acar. Kullanici sonradan `/kurumsal/kisa-liste`'den duzenler;
 * burada iki adimli bir secim dayatmak kisa yolu kisa yol yapmazdi.
 */
export type KisaListeKurulus = {
  id: string;
  name: string;
  durum: 'listede' | 'eklenebilir';
};

const ALAN =
  'px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

export function KisaListeyeEkle({
  providerId,
  kuruluslar,
}: {
  providerId: string;
  kuruluslar: KisaListeKurulus[];
}) {
  const [isPending, startTransition] = useTransition();
  const [eklenen, setEklenen] = useState<string[]>([]);
  const [hata, setHata] = useState<string | null>(null);

  const eklenebilir = kuruluslar.filter(
    (k) => k.durum === 'eklenebilir' && !eklenen.includes(k.id)
  );
  const listede = kuruluslar.filter(
    (k) => k.durum === 'listede' || eklenen.includes(k.id)
  );

  const [secilen, setSecilen] = useState<string>(kuruluslar[0]?.id ?? '');
  const hedef = eklenebilir.some((k) => k.id === secilen)
    ? secilen
    : (eklenebilir[0]?.id ?? '');

  function ekle() {
    if (!hedef) return;
    setHata(null);
    startTransition(async () => {
      const res = await kisaListeyeHizliEkle(hedef, providerId);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      setEklenen((o) => [...o, hedef]);
    });
  }

  return (
    <div className="bg-paper-2 border border-line rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
            Kısa liste
          </p>
          {listede.length > 0 && (
            <p className="text-sm text-ink mt-0.5 break-words">
              {/* Tek kurulusta ad yazmak gereksiz tekrar olurdu. */}
              {kuruluslar.length === 1
                ? 'Kısa listede'
                : `Kısa listede: ${listede.map((k) => k.name).join(', ')}`}
            </p>
          )}
          {eklenebilir.length > 0 && listede.length === 0 && (
            <p className="text-sm text-ink-72 mt-0.5">
              Teklif talebi açarken buradan davet edebilirsin.
            </p>
          )}
        </div>

        {eklenebilir.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Kurulus secimi yalniz BIRDEN COK aday varsa. */}
            {eklenebilir.length > 1 && (
              <select
                value={hedef}
                onChange={(e) => setSecilen(e.target.value)}
                aria-label="Kuruluş"
                className={ALAN}
              >
                {eklenebilir.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={ekle}
              disabled={isPending || !hedef}
              className="kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50"
            >
              {isPending ? 'Ekleniyor…' : 'Kısa listeye ekle'}
            </button>
          </div>
        )}

        {eklenebilir.length === 0 && listede.length > 0 && (
          <Link
            href="/kurumsal/kisa-liste"
            className="kashe-tap shrink-0 text-sm text-brand-ink hover:underline"
          >
            Listeyi aç →
          </Link>
        )}
      </div>

      {hata && <p className="text-sm text-danger mt-2">{hata}</p>}
    </div>
  );
}
