'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProposal } from './teklif-actions';

/**
 * FAZ 7a / P1 — bos teklif acma formu.
 * Teklif yalniz `proposal_create` ile acilir; form yalniz baslik ve musteri
 * bilgisini toplar, kalemler editorde eklenir.
 */

const ALAN =
  'w-full px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-4 py-2 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors';

export function YeniTeklif({
  kuruluslar,
}: {
  kuruluslar: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [orgId, setOrgId] = useState(kuruluslar[0]?.id ?? '');
  const [baslik, setBaslik] = useState('');
  const [musteriAdi, setMusteriAdi] = useState('');
  const [musteriEposta, setMusteriEposta] = useState('');

  function olustur() {
    if (!baslik.trim()) {
      setHata('Başlık gerekir.');
      return;
    }
    setHata(null);
    startTransition(async () => {
      const res = await createProposal({
        organizationId: orgId || kuruluslar[0]?.id,
        title: baslik,
        clientName: musteriAdi,
        clientEmail: musteriEposta,
      });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      router.push(`/ajans/teklifler/${res.data!.id}`);
    });
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className={BTN_BIRINCIL}
      >
        Yeni teklif
      </button>
    );
  }

  return (
    <div className="bg-card border border-line rounded-lg p-5 w-full">
      <p className="font-display font-semibold text-ink mb-3">Yeni teklif</p>
      {hata && <p className="text-sm text-danger mb-3">{hata}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {kuruluslar.length > 1 && (
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
        )}
        <input
          type="text"
          value={baslik}
          onChange={(e) => setBaslik(e.target.value.slice(0, 200))}
          placeholder="Teklif başlığı"
          className={ALAN}
        />
        <input
          type="text"
          value={musteriAdi}
          onChange={(e) => setMusteriAdi(e.target.value.slice(0, 200))}
          placeholder="Müşteri adı (isteğe bağlı)"
          className={ALAN}
        />
        <input
          type="email"
          value={musteriEposta}
          onChange={(e) => setMusteriEposta(e.target.value.slice(0, 200))}
          placeholder="Müşteri e-postası (isteğe bağlı)"
          className={ALAN}
        />
      </div>
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
