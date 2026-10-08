'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createRfp } from './rfp-actions';

/**
 * FAZ 7b / P1 — yeni teklif talebi (RFP) formu.
 *
 * Talep YALNIZ `rfp_create` ile acilir; kalemler etkinligin gereksinimlerinden
 * DB tarafinda kopyalanir (ipucu alanlari dahil). Form yalniz kurulus, etkinlik,
 * baslik ve son tarih toplar.
 */

const ALAN =
  'w-full px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-4 py-2 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors';

export type RfpEtkinlik = {
  id: string;
  organizationId: string;
  baslik: string;
};

export function YeniRfp({
  kuruluslar,
  etkinlikler,
  varsayilanEtkinlikId,
  varsayilanSonTarih,
}: {
  kuruluslar: { id: string; name: string }[];
  etkinlikler: RfpEtkinlik[];
  /** `/kurumsal/rfp?etkinlik=<id>` ile gelindiyse form o etkinlikle acilir. */
  varsayilanEtkinlikId: string | null;
  /** Sunucuda hesaplanan +7 gun (`datetime-local` bicimi). */
  varsayilanSonTarih: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acik, setAcik] = useState(!!varsayilanEtkinlikId);
  const [hata, setHata] = useState<string | null>(null);

  const ilkEtkinlik =
    etkinlikler.find((e) => e.id === varsayilanEtkinlikId) ?? etkinlikler[0];
  const [etkinlikId, setEtkinlikId] = useState(ilkEtkinlik?.id ?? '');
  const [orgId, setOrgId] = useState(
    ilkEtkinlik?.organizationId ?? kuruluslar[0]?.id ?? ''
  );
  const [baslik, setBaslik] = useState(ilkEtkinlik?.baslik ?? '');
  const [sonTarih, setSonTarih] = useState(varsayilanSonTarih);

  function etkinlikSec(id: string) {
    setEtkinlikId(id);
    const e = etkinlikler.find((x) => x.id === id);
    if (e) {
      setOrgId(e.organizationId);
      if (!baslik.trim()) setBaslik(e.baslik);
    }
  }

  function olustur() {
    if (!etkinlikId) {
      setHata('Etkinlik seç.');
      return;
    }
    if (baslik.trim().length < 2) {
      setHata('Başlık 2-200 karakter olmalı.');
      return;
    }
    setHata(null);
    startTransition(async () => {
      const res = await createRfp({
        organizationId: orgId,
        eventId: etkinlikId,
        title: baslik,
        deadline: sonTarih,
      });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      router.push(`/kurumsal/rfp/${res.data!.id}`);
    });
  }

  if (etkinlikler.length === 0) {
    return (
      <div className="bg-card border border-line rounded-lg p-5">
        <p className="text-sm text-ink-72">
          Teklif talebi bir etkinliğe bağlanır. Önce bir etkinlik oluştur.
        </p>
        <Link href="/etkinlik-sihirbazi" className={`${BTN_BIRINCIL} mt-3 inline-block`}>
          Etkinlik oluştur
        </Link>
      </div>
    );
  }

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className={BTN_BIRINCIL}>
        Yeni teklif talebi
      </button>
    );
  }

  return (
    <div className="bg-card border border-line rounded-lg p-5 w-full">
      <p className="font-display font-semibold text-ink mb-3">
        Yeni teklif talebi
      </p>
      {hata && <p className="text-sm text-danger mb-3">{hata}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {kuruluslar.length > 1 && (
          <div>
            <label className="block text-xs text-ink-72 mb-1">Kuruluş</label>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className={ALAN}
            >
              {kuruluslar.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-ink-72 mb-1">Etkinlik</label>
          <select
            value={etkinlikId}
            onChange={(e) => etkinlikSec(e.target.value)}
            className={ALAN}
          >
            {etkinlikler
              .filter((e) => kuruluslar.length <= 1 || e.organizationId === orgId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.baslik}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-72 mb-1">Başlık</label>
          <input
            type="text"
            value={baslik}
            onChange={(e) => setBaslik(e.target.value.slice(0, 200))}
            placeholder="Teklif talebi başlığı"
            className={ALAN}
          />
        </div>
        <div>
          <label className="block text-xs text-ink-72 mb-1">
            Son tarih (yanıt için)
          </label>
          <input
            type="datetime-local"
            value={sonTarih}
            onChange={(e) => setSonTarih(e.target.value)}
            className={ALAN}
          />
        </div>
      </div>
      <p className="text-xs text-ink-50 mt-3">
        Etkinliğin ihtiyaç kalemleri talebe kopyalanır; taslakta düzenleyebilirsin.
      </p>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={olustur}
          disabled={isPending}
          className={BTN_BIRINCIL}
        >
          {isPending ? 'Oluşturuluyor…' : 'Oluştur'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAcik(false);
            setHata(null);
          }}
          className={BTN_IKINCIL}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
