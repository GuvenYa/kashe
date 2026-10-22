'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  kisaListeGuncelle,
  kisaListeKalemGuncelle,
  kisaListeOlustur,
  kisaListeSil,
  kisaListedenCikar,
  kisaListeyeEkle,
} from '@/app/lib/tedarikci-actions';
import type { KisaListe, KisaListeKalemi } from '@/app/lib/tedarikci-data';

/**
 * FAZ 8c — kisa liste yonetimi (secili listenin basligi, kalemleri, ekleme).
 *
 * Saglayici arama listesi SUNUCUDAN hazir gelir (`v_providers_public`); bu
 * bilesen yeni sorgu atmaz, filtre bellekte. Kendi kurulusunun kaydi listede
 * olabilir — DB reddeder ve mesaj gosterilir (kural tek yerde, 22023).
 *
 * ALANDAN CIKINCA KAYDET: kalem notu `onBlur`'da DEGISTIYSE yazilir.
 */
const ALAN =
  'w-full bg-card border border-line rounded-lg px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink disabled:opacity-60';
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink transition-colors disabled:opacity-50';
const BTN_TEHLIKE =
  'kashe-tap px-3 py-1.5 border border-danger/40 text-danger rounded-lg font-display font-semibold text-xs hover:bg-danger/[0.06] transition-colors disabled:opacity-50';

export type SaglayiciAramaSecenegi = {
  id: string;
  ad: string;
  tur: string;
  sehir: string | null;
};

/** "Yeni liste" dugmesi ve formu — `PanelBaslik` sag alani icin. */
export function YeniListeDugmesi({
  organizationId,
  etkinlikler,
}: {
  organizationId: string;
  etkinlikler: { id: string; ad: string }[];
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [ad, setAd] = useState('');
  const [etkinlik, setEtkinlik] = useState('');
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  function olustur() {
    setHata(null);
    basla(async () => {
      const res = await kisaListeOlustur({
        organizationId,
        name: ad,
        eventId: etkinlik || null,
      });
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      setAd('');
      setEtkinlik('');
      setAcik(false);
      if (res.id) {
        router.push(
          `/kurumsal/kisa-liste?kurulus=${organizationId}&liste=${res.id}`
        );
      } else {
        router.refresh();
      }
    });
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className={BTN_BIRINCIL}
      >
        Yeni liste
      </button>
    );
  }

  return (
    <div className="bg-card border border-line rounded-xl p-4 w-full md:w-80 space-y-2">
      <input
        value={ad}
        onChange={(e) => setAd(e.target.value)}
        maxLength={120}
        placeholder="Liste adı"
        aria-label="Liste adı"
        className={ALAN}
      />
      <select
        value={etkinlik}
        onChange={(e) => setEtkinlik(e.target.value)}
        aria-label="Etkinlik"
        className={ALAN}
      >
        <option value="">Etkinliğe bağlı değil</option>
        {etkinlikler.map((e) => (
          <option key={e.id} value={e.id}>
            {e.ad}
          </option>
        ))}
      </select>
      {hata && <p className="text-xs text-danger">{hata}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={olustur}
          disabled={bekliyor || ad.trim().length < 2}
          className={BTN_IKINCIL}
        >
          {bekliyor ? 'Oluşturuluyor…' : 'Oluştur'}
        </button>
        <button
          type="button"
          onClick={() => setAcik(false)}
          disabled={bekliyor}
          className={BTN_IKINCIL}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}

export function KisaListeYonetimi({
  organizationId,
  liste,
  kalemler,
  saglayicilar,
  etkinlikler,
  yazabilir,
}: {
  organizationId: string;
  liste: KisaListe;
  kalemler: KisaListeKalemi[];
  saglayicilar: SaglayiciAramaSecenegi[];
  etkinlikler: { id: string; ad: string }[];
  yazabilir: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [duzenle, setDuzenle] = useState(false);
  const [silOnayi, setSilOnayi] = useState(false);
  const [ad, setAd] = useState(liste.name);
  const [not, setNot] = useState(liste.notes ?? '');
  const [etkinlik, setEtkinlik] = useState(liste.eventId ?? '');
  const [arama, setArama] = useState('');

  const eklenmis = useMemo(
    () => new Set(kalemler.map((k) => k.providerId)),
    [kalemler]
  );

  const suzulmus = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr');
    if (!q) return [];
    return saglayicilar
      .filter(
        (s) => !eklenmis.has(s.id) && s.ad.toLocaleLowerCase('tr').includes(q)
      )
      .slice(0, 12);
  }, [saglayicilar, arama, eklenmis]);

  function yaz(islem: () => Promise<{ ok: boolean; hata?: string }>) {
    setHata(null);
    startTransition(async () => {
      const res = await islem();
      if (!res.ok) {
        setHata(res.hata ?? 'İşlem tamamlanamadı.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* ── LISTE BASLIGI ── */}
      <div className="bg-card border border-line rounded-xl p-5">
        {duzenle ? (
          <div className="space-y-3">
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              maxLength={120}
              aria-label="Liste adı"
              className={ALAN}
            />
            <select
              value={etkinlik}
              onChange={(e) => setEtkinlik(e.target.value)}
              aria-label="Etkinlik"
              className={ALAN}
            >
              <option value="">Etkinliğe bağlı değil</option>
              {etkinlikler.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                </option>
              ))}
            </select>
            <textarea
              value={not}
              onChange={(e) => setNot(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Not (isteğe bağlı)"
              aria-label="Liste notu"
              className={ALAN}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  yaz(async () => {
                    const r = await kisaListeGuncelle({
                      id: liste.id,
                      name: ad,
                      eventId: etkinlik || null,
                      notes: not,
                    });
                    if (r.ok) setDuzenle(false);
                    return r;
                  })
                }
                disabled={isPending || ad.trim().length < 2}
                className={BTN_IKINCIL}
              >
                {isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuzenle(false);
                  setAd(liste.name);
                  setNot(liste.notes ?? '');
                  setEtkinlik(liste.eventId ?? '');
                }}
                disabled={isPending}
                className={BTN_IKINCIL}
              >
                Vazgeç
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-display font-semibold text-ink break-words">
                {liste.name}
              </p>
              {liste.eventId && (
                <p className="text-sm text-ink-72 mt-1">
                  Etkinlik:{' '}
                  <Link
                    href={`/etkinliklerim/${liste.eventId}`}
                    className="text-brand-ink hover:underline"
                  >
                    {liste.eventTitle ?? 'Etkinlik'} →
                  </Link>
                </p>
              )}
              {liste.notes && (
                <p className="text-sm text-ink-72 mt-1 whitespace-pre-wrap break-words">
                  {liste.notes}
                </p>
              )}
            </div>

            {yazabilir && (
              <div className="shrink-0 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDuzenle(true)}
                  className={BTN_IKINCIL}
                >
                  Düzenle
                </button>
                {silOnayi ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        yaz(async () => {
                          const r = await kisaListeSil(liste.id);
                          if (r.ok) {
                            router.push(
                              `/kurumsal/kisa-liste?kurulus=${organizationId}`
                            );
                          }
                          return r;
                        })
                      }
                      disabled={isPending}
                      className={BTN_TEHLIKE}
                    >
                      {isPending ? 'Siliniyor…' : 'Evet, sil'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSilOnayi(false)}
                      disabled={isPending}
                      className={BTN_IKINCIL}
                    >
                      Vazgeç
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSilOnayi(true)}
                    className={BTN_TEHLIKE}
                  >
                    Sil
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SAGLAYICI EKLE ── */}
      {yazabilir && (
        <div className="bg-card border border-line rounded-xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Sağlayıcı ekle
          </p>
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Kashe'de ajans ya da profesyonel ara"
            aria-label="Sağlayıcı ara"
            className={ALAN}
          />
          {suzulmus.length > 0 && (
            <div className="mt-2 border border-line rounded-lg divide-y divide-line max-h-48 overflow-y-auto">
              {suzulmus.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="text-sm text-ink min-w-0 break-words">
                    {s.ad}
                    <span className="text-ink-72">
                      {' '}
                      · {s.tur === 'organization' ? 'Ajans' : 'Profesyonel'}
                      {s.sehir ? ` · ${s.sehir}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      yaz(async () => {
                        const r = await kisaListeyeEkle(liste.id, s.id);
                        if (r.ok) setArama('');
                        return r;
                      })
                    }
                    disabled={isPending}
                    className={BTN_IKINCIL}
                  >
                    Ekle
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ink-50 mt-2 leading-relaxed">
            Kendi Kashe kaydını listeye ekleyemezsin.
          </p>
        </div>
      )}

      {hata && <p className="text-sm text-danger">{hata}</p>}

      {/* ── KALEMLER ── */}
      {kalemler.length === 0 ? (
        <div className="bg-card border border-line rounded-xl p-5 text-sm text-ink-72">
          Bu listede henüz sağlayıcı yok.
        </div>
      ) : (
        <div className="space-y-3">
          {kalemler.map((k) => (
            <div
              key={k.id}
              className="bg-card border border-line rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1 basis-56">
                  <Link
                    href={`/p/${k.providerId}`}
                    className="kashe-tap font-display font-semibold text-ink hover:underline break-words"
                  >
                    {k.ad}
                  </Link>
                  <p className="text-xs text-ink-72 mt-0.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
                      {k.tur === 'organization' ? 'Ajans' : 'Pro'}
                    </span>
                    {k.sehir ? ` · ${k.sehir}` : ''}
                  </p>
                </div>

                {yazabilir && (
                  <button
                    type="button"
                    onClick={() =>
                      yaz(() => kisaListedenCikar(k.id))
                    }
                    disabled={isPending}
                    className={BTN_TEHLIKE}
                  >
                    Çıkar
                  </button>
                )}
              </div>

              <div className="mt-3">
                <label
                  className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1"
                  htmlFor={`kalem-not-${k.id}`}
                >
                  Not
                </label>
                <KalemNotu
                  kalemId={k.id}
                  baslangic={k.note ?? ''}
                  yazabilir={yazabilir && !isPending}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-50 leading-relaxed">
        Kısa listedeki ajansları teklif talebine davet edebilirsin →{' '}
        <Link href="/kurumsal/rfp" className="text-brand-ink hover:underline">
          Teklif talepleri
        </Link>
      </p>
    </div>
  );
}

/** Kalem notu — alandan cikinca kaydeder. */
function KalemNotu({
  kalemId,
  baslangic,
  yazabilir,
}: {
  kalemId: string;
  baslangic: string;
  yazabilir: boolean;
}) {
  const router = useRouter();
  const [deger, setDeger] = useState(baslangic);
  const [bekliyor, basla] = useTransition();

  function cik() {
    if (deger.trim() === baslangic.trim()) return;
    basla(async () => {
      await kisaListeKalemGuncelle(kalemId, deger);
      router.refresh();
    });
  }

  return (
    <input
      id={`kalem-not-${kalemId}`}
      value={deger}
      onChange={(e) => setDeger(e.target.value)}
      onBlur={cik}
      disabled={!yazabilir || bekliyor}
      maxLength={500}
      placeholder="Neden bu listede? (isteğe bağlı)"
      className={ALAN}
    />
  );
}
