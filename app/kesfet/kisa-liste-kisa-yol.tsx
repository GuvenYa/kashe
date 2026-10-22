'use client';

import { useState, useTransition } from 'react';
import { kisaListeyeHizliEkle } from '@/app/lib/tedarikci-actions';

/**
 * FAZ 8c — kesfet kartindaki kisa liste kisa yolu
 * (`havuz-kisa-yol.tsx` kalibi).
 *
 * Sunucu bu bileseni ANCAK tek yonetilebilir (modul acik + `events.manage`)
 * kurulus varsa gonderir; kurulus secimi `/p/[id]` panelinde.
 *
 * Liste secimi burada sorulmaz: action kurulusun "Genel" listesine ekler ve
 * liste yoksa onu da acar. Kullanici sonradan `/kurumsal/kisa-liste`'den
 * listeyi yeniden adlandirabilir ya da kalemi baska listeye tasiyabilir.
 *
 * Kart geneli bir stretched link oldugu icin tiklama YUKARI TASINMAZ
 * (preventDefault + stopPropagation) — karta gidilmez.
 */
export function KisaListeKisaYol({
  providerId,
  orgId,
  durum,
}: {
  providerId: string;
  orgId: string;
  durum: 'listede' | 'eklenebilir';
}) {
  const [isPending, startTransition] = useTransition();
  const [eklendi, setEklendi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Prop ile state ayrismasin: sunucu tazelendiginde `durum` zaten 'listede' olur.
  const listede = durum === 'listede' || eklendi;

  if (listede) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 bg-paper border border-line px-2 py-1 rounded">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-brand-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <polyline points="4 12.5 9.5 18 20 6.5" />
        </svg>
        Kısa listede
      </span>
    );
  }

  function ekle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setHata(null);
    startTransition(async () => {
      const res = await kisaListeyeHizliEkle(orgId, providerId);
      if (res.ok) setEklendi(true);
      else setHata(res.hata);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={ekle}
        disabled={isPending}
        className="kashe-tap font-mono text-[10px] uppercase tracking-[0.12em] text-brand-ink bg-paper border border-brand-ink/40 px-2 py-1 rounded hover:bg-brand-ink hover:text-paper transition-colors disabled:opacity-50"
      >
        {isPending ? 'Ekleniyor…' : 'Kısa listeye ekle'}
      </button>
      {hata && <span className="text-[11px] text-danger">{hata}</span>}
    </span>
  );
}
