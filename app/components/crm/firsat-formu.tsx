'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ASAMA_ETIKETLERI,
  FIRSAT_ASAMALARI,
  type FirsatAsamasi,
} from '@/app/lib/crm';
import { firsatOlustur } from '@/app/lib/crm-actions';

/**
 * FAZ 8b — yeni firsat formu (8a `gorev-formu.tsx` kalibi).
 *
 * Kisi secimi ARAMALI: kurulusun yuzlerce kisisi olabilir ve uzun bir `select`
 * telefonda kullanilamaz. Liste sunucudan hazir gelir (yeni sorgu yok), filtre
 * bellekte.
 *
 * DOGRULAMA BURADA TEKRARLANMAZ: "kisi/etkinlik/teklif ayni kurulusun mu",
 * "sahip aktif uye mi" kontrolleri tetikleyicide; action mesaji cevirir.
 */
const ALAN =
  'w-full bg-card border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink';
const ETIKET =
  'block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1.5';
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-4 py-2 border border-line text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink transition-colors disabled:opacity-50';

export type KisiSecenegi = {
  id: string;
  ad: string;
  firma: string | null;
};

export type SecimSecenegi = { id: string; ad: string };

export function FirsatFormu({
  organizationId,
  kisiler,
  uyeler,
  etkinlikler,
  teklifler,
  kullaniciId,
  /** Kisi sayfasindan aciliyorsa o kisi sabit gelir. */
  sabitKisiId,
  onIptal,
  onBitti,
}: {
  organizationId: string;
  kisiler: KisiSecenegi[];
  uyeler: { id: string; ad: string; altNot: string }[];
  etkinlikler: SecimSecenegi[];
  teklifler: SecimSecenegi[];
  kullaniciId: string;
  sabitKisiId?: string;
  onIptal?: () => void;
  onBitti?: (firsatId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  const [kisiId, setKisiId] = useState(sabitKisiId ?? '');
  const [kisiArama, setKisiArama] = useState('');
  const [baslik, setBaslik] = useState('');
  const [asama, setAsama] = useState<FirsatAsamasi>('new');
  const [tutar, setTutar] = useState('');
  const [beklenen, setBeklenen] = useState('');
  // Varsayilan sahip BEN: firsati acan kisi genelde takip edecek olan kisi.
  const [sahip, setSahip] = useState(kullaniciId);
  const [adim, setAdim] = useState('');
  const [adimZamani, setAdimZamani] = useState('');
  const [etkinlik, setEtkinlik] = useState('');
  const [teklif, setTeklif] = useState('');

  const suzulmus = useMemo(() => {
    const q = kisiArama.trim().toLocaleLowerCase('tr');
    if (!q) return kisiler.slice(0, 20);
    return kisiler
      .filter(
        (k) =>
          k.ad.toLocaleLowerCase('tr').includes(q) ||
          (k.firma ?? '').toLocaleLowerCase('tr').includes(q)
      )
      .slice(0, 20);
  }, [kisiler, kisiArama]);

  const secilenKisi = kisiler.find((k) => k.id === kisiId) ?? null;

  function kaydet() {
    setHata(null);
    startTransition(async () => {
      const res = await firsatOlustur({
        organizationId,
        contactId: kisiId,
        title: baslik,
        stage: asama,
        estimatedValue: tutar,
        expectedDate: beklenen,
        ownerUserId: sahip || null,
        nextStep: adim,
        nextStepAt: adimZamani,
        eventId: etkinlik || null,
        proposalId: teklif || null,
      });
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      router.refresh();
      if (res.id) onBitti?.(res.id);
    });
  }

  return (
    <div className="space-y-4">
      {/* Kisi secimi — sabit kisi varsa arama gosterilmez. */}
      {sabitKisiId ? (
        <p className="text-sm text-ink-72">
          Kişi:{' '}
          <span className="text-ink font-medium">
            {secilenKisi?.ad ?? 'Seçili kişi'}
          </span>
        </p>
      ) : (
        <div>
          <label className={ETIKET} htmlFor="firsat-kisi-arama">
            Kişi
          </label>
          {secilenKisi ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-ink">
                {secilenKisi.ad}
                {secilenKisi.firma ? ` · ${secilenKisi.firma}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setKisiId('')}
                className="kashe-tap text-xs text-brand-ink hover:underline"
              >
                Değiştir
              </button>
            </div>
          ) : (
            <>
              <input
                id="firsat-kisi-arama"
                value={kisiArama}
                onChange={(e) => setKisiArama(e.target.value)}
                placeholder="Ad ya da firma ile ara"
                className={ALAN}
              />
              {kisiler.length === 0 ? (
                <p className="text-sm text-ink-72 mt-2">
                  Henüz kişi yok. Önce bir kişi ekle.
                </p>
              ) : (
                <div className="mt-2 border border-line rounded-lg divide-y divide-line max-h-48 overflow-y-auto">
                  {suzulmus.length === 0 ? (
                    <p className="text-sm text-ink-72 px-3 py-2">
                      Eşleşen kişi yok.
                    </p>
                  ) : (
                    suzulmus.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setKisiId(k.id)}
                        className="kashe-tap w-full text-left px-3 py-2 text-sm text-ink hover:bg-paper-2"
                      >
                        {k.ad}
                        {k.firma && (
                          <span className="text-ink-72"> · {k.firma}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={ETIKET} htmlFor="firsat-baslik">
            Başlık
          </label>
          <input
            id="firsat-baslik"
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            maxLength={200}
            required
            placeholder="Örnek: Bayi lansmanı organizasyonu"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-asama">
            Aşama
          </label>
          <select
            id="firsat-asama"
            value={asama}
            onChange={(e) => setAsama(e.target.value as FirsatAsamasi)}
            className={ALAN}
          >
            {FIRSAT_ASAMALARI.map((a) => (
              <option key={a} value={a}>
                {ASAMA_ETIKETLERI[a]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-tutar">
            Tahmini değer (TL)
          </label>
          <input
            id="firsat-tutar"
            type="number"
            min={0}
            step={100}
            value={tutar}
            onChange={(e) => setTutar(e.target.value)}
            placeholder="İsteğe bağlı"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-beklenen">
            Beklenen tarih
          </label>
          <input
            id="firsat-beklenen"
            type="date"
            value={beklenen}
            onChange={(e) => setBeklenen(e.target.value)}
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-sahip">
            Sahip
          </label>
          <select
            id="firsat-sahip"
            value={sahip}
            onChange={(e) => setSahip(e.target.value)}
            className={ALAN}
          >
            <option value="">Sahipsiz</option>
            {uyeler.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ad} · {u.altNot}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-adim">
            Sonraki adım
          </label>
          <input
            id="firsat-adim"
            value={adim}
            onChange={(e) => setAdim(e.target.value)}
            maxLength={500}
            placeholder="Örnek: Teklifi gönder"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-adim-zaman">
            Adım tarihi
          </label>
          <input
            id="firsat-adim-zaman"
            type="datetime-local"
            value={adimZamani}
            onChange={(e) => setAdimZamani(e.target.value)}
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-etkinlik">
            Etkinlik
          </label>
          <select
            id="firsat-etkinlik"
            value={etkinlik}
            onChange={(e) => setEtkinlik(e.target.value)}
            className={ALAN}
          >
            <option value="">Bağlı değil</option>
            {etkinlikler.map((e) => (
              <option key={e.id} value={e.id}>
                {e.ad}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="firsat-teklif">
            Teklif
          </label>
          <select
            id="firsat-teklif"
            value={teklif}
            onChange={(e) => setTeklif(e.target.value)}
            className={ALAN}
          >
            <option value="">Bağlı değil</option>
            {teklifler.map((t) => (
              <option key={t.id} value={t.id}>
                {t.ad}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hata && <p className="text-sm text-danger">{hata}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={kaydet}
          disabled={isPending || !kisiId || baslik.trim().length < 2}
          className={BTN_BIRINCIL}
        >
          {isPending ? 'Kaydediliyor…' : 'Fırsat ekle'}
        </button>
        {onIptal && (
          <button
            type="button"
            onClick={onIptal}
            disabled={isPending}
            className={BTN_IKINCIL}
          >
            Vazgeç
          </button>
        )}
      </div>
    </div>
  );
}
