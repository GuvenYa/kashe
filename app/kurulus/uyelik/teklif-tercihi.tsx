'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SecimKutulari, type Secenek } from '@/app/components/ui/secim';
import { setOfferRouting } from '@/app/ajans/agency-actions';

/**
 * TEKLIF TERCIHI (Duzeltme 15-E, karar 1-A) - ajansa bagli profesyonel secer:
 * ona gelen talepleri kendi mi yanitlar, ajansi mi.
 *
 * Secim aninda kaydedilir (tek tercih, ayri "Kaydet" yok); hata olursa secim
 * geri alinir. Yazma yolu `org_member_set_offer_routing` (uye yalniz kendi
 * tercihini yazar).
 */
type Tercih = 'kendim' | 'ajans';

export function TeklifTercihi({
  orgId,
  ajansAdi,
  ajansUzerinden,
}: {
  orgId: string;
  ajansAdi: string;
  ajansUzerinden: boolean;
}) {
  const router = useRouter();
  const [secim, setSecim] = useState<Tercih>(ajansUzerinden ? 'ajans' : 'kendim');
  const [hata, setHata] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [bekliyor, baslat] = useTransition();

  const secenekler: Secenek<Tercih>[] = [
    {
      deger: 'kendim',
      etiket: 'Kendim teklif veririm',
      ipucu: 'Talepler sana gelir; teklif ve rezervasyon senin adına oluşur.',
    },
    {
      deger: 'ajans',
      etiket: 'Ajansım üzerinden',
      ipucu: `Talepler ${ajansAdi} hesabına gider; teklifi ajans verir.`,
    },
  ];

  function degistir(yeni: Tercih) {
    if (yeni === secim || bekliyor) return;
    const onceki = secim;
    setSecim(yeni);
    setHata(null);
    setKaydedildi(false);
    baslat(async () => {
      const sonuc = await setOfferRouting(orgId, yeni === 'ajans');
      if (!sonuc.success) {
        setSecim(onceki);
        setHata(sonuc.error ?? 'Tercih kaydedilemedi.');
        return;
      }
      setKaydedildi(true);
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <SecimKutulari
        etiket="Bana gelen talepler"
        ad="teklif-tercihi"
        secenekler={secenekler}
        deger={secim}
        onDegis={degistir}
      />
      <p className="text-sm text-ink-72 mt-3">
        {secim === 'ajans'
          ? `Müşteri profilinden talep gönderdiğinde ya da teklif topladığında talep ${ajansAdi} hesabına düşer; müşteri seni tercih ettiğini ajansa iletir. Süren sohbetlerin ve verdiğin teklifler etkilenmez.`
          : 'Müşteri sana doğrudan yazar ve teklifi senden alır. Ajans da kendi adına ayrıca teklif verebilir.'}
      </p>
      <p className="text-xs mt-2 min-h-4" aria-live="polite">
        {bekliyor ? (
          <span className="text-ink-50">Kaydediliyor…</span>
        ) : hata ? (
          <span role="alert" className="text-danger">
            {hata}
          </span>
        ) : kaydedildi ? (
          <span className="text-moss">Tercihin kaydedildi.</span>
        ) : null}
      </p>
    </div>
  );
}
