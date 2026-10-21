'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ASAMA_ETIKETLERI,
  FIRSAT_ASAMALARI,
  asamaEtiketi,
  asamaSinifi,
  type FirsatAsamasi,
} from '@/app/lib/crm';
import { firsatGuncelle, firsatSil } from '@/app/lib/crm-actions';
import { formatTL } from '@/app/lib/para';
import { tarihMetni, zamanMetni } from '@/app/lib/tarih';
import type { Firsat } from '@/app/lib/crm-data';
import type { SecimSecenegi } from './firsat-formu';

/**
 * FAZ 8b — firsat panosu ve duzenleme paneli.
 *
 * SURUKLE-BIRAK YOK (karar): asama `select` ile degisir. Dokunmatik ekranda
 * surukleme yanlis sutuna birakma riski tasiyor ve klavyeyle erisilemiyor;
 * `select` her ikisinde de calisir.
 *
 * Panel `?firsat=<id>` ile acilir — bildirim baglantisi da bu adresi yaziyor
 * (tetikleyici `/ajans/musteriler?firsat=<id>` uretir), yani bildirimden gelen
 * kullanici dogrudan panelde acilir.
 *
 * ALANDAN CIKINCA KAYDET (8a deseni): her alan `onBlur`'da DEGISTIYSE yazilir.
 * "Kaydet" dugmesi yok; kullanici bir alani duzeltip baska yere tikliyor ve
 * degisiklik kayboluyordu.
 *
 * TUTARI BU BILESEN HESAPLAMAZ: sutun toplamlari zaten gelen `estimatedValue`
 * alanlarinin toplami; bicim `para.ts`.
 */
const ALAN =
  'w-full bg-card border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink';
const ETIKET =
  'block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1.5';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink transition-colors disabled:opacity-50';
const BTN_TEHLIKE =
  'kashe-tap px-3 py-1.5 border border-danger/40 text-danger rounded-lg font-display font-semibold text-xs hover:bg-danger/[0.06] transition-colors disabled:opacity-50';

function AsamaRozeti({ asama }: { asama: string }) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.12em] border px-2 py-0.5 rounded ${asamaSinifi(asama)}`}
    >
      {asamaEtiketi(asama)}
    </span>
  );
}

/** Sonraki adim tarihi gectiyse `danger` rozet. */
function gecikmisMi(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

function FirsatKarti({
  firsat,
  secili,
  onAc,
}: {
  firsat: Firsat;
  secili: boolean;
  onAc: () => void;
}) {
  const gecikti = gecikmisMi(firsat.nextStepAt);

  return (
    <button
      type="button"
      onClick={onAc}
      className={
        secili
          ? 'kashe-tap w-full text-left bg-card border border-brand-ink/40 ring-2 ring-brand-ink rounded-xl p-3 transition-colors'
          : 'kashe-tap w-full text-left bg-card border border-line rounded-xl p-3 hover:border-brand-ink/40 transition-colors'
      }
    >
      <p className="font-display font-semibold text-sm text-ink leading-tight break-words">
        {firsat.title}
      </p>
      <p className="text-xs text-ink-72 mt-1 break-words">
        {firsat.kisiAdi}
        {firsat.kisiFirmasi ? ` · ${firsat.kisiFirmasi}` : ''}
      </p>

      {(firsat.estimatedValue !== null || firsat.expectedDate) && (
        <p className="text-xs text-ink mt-2 tabular-nums">
          {[
            firsat.estimatedValue !== null
              ? formatTL(firsat.estimatedValue)
              : null,
            firsat.expectedDate ? tarihMetni(firsat.expectedDate) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {firsat.sahipAdi && (
        <p className="text-[11px] text-ink-50 mt-1.5">{firsat.sahipAdi}</p>
      )}

      {firsat.nextStep && (
        <p
          className={
            gecikti
              ? 'font-mono text-[10px] uppercase tracking-[0.12em] text-danger bg-danger-08 border border-danger/25 px-2 py-0.5 rounded inline-block mt-2'
              : 'text-[11px] text-ink-72 mt-2 break-words'
          }
        >
          {gecikti ? `Gecikti · ${firsat.nextStep}` : firsat.nextStep}
        </p>
      )}

      {firsat.teklifBasligi && (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 bg-paper border border-line px-2 py-0.5 rounded inline-block mt-2">
          Teklif{firsat.teklifDurumu ? ` · ${firsat.teklifDurumu}` : ''}
        </p>
      )}
    </button>
  );
}

export function FirsatPanosu({
  firsatlar,
  uyeler,
  etkinlikler,
  teklifler,
  yazabilir,
}: {
  firsatlar: Firsat[];
  uyeler: { id: string; ad: string; altNot: string }[];
  etkinlikler: SecimSecenegi[];
  teklifler: SecimSecenegi[];
  yazabilir: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const acikId = params.get('firsat');

  const secili = useMemo(
    () => firsatlar.find((f) => f.id === acikId) ?? null,
    [firsatlar, acikId]
  );

  function panelAc(id: string | null) {
    const p = new URLSearchParams(params.toString());
    if (id) p.set('firsat', id);
    else p.delete('firsat');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const sutunlar = useMemo(
    () =>
      FIRSAT_ASAMALARI.map((asama) => {
        const liste = firsatlar.filter((f) => f.stage === asama);
        const toplam = liste.reduce((t, f) => t + (f.estimatedValue ?? 0), 0);
        return { asama, liste, toplam };
      }),
    [firsatlar]
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {sutunlar.map(({ asama, liste, toplam }) => (
          <div key={asama} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 min-w-0 break-words">
                {ASAMA_ETIKETLERI[asama]}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 shrink-0 tabular-nums">
                {liste.length}
              </p>
            </div>
            {toplam > 0 && (
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-2 tabular-nums">
                {formatTL(toplam)}
              </p>
            )}

            {liste.length === 0 ? (
              <div className="bg-card border border-line rounded-lg p-4 text-sm text-ink-72">
                Fırsat yok.
              </div>
            ) : (
              <div className="space-y-3">
                {liste.map((f) => (
                  <FirsatKarti
                    key={f.id}
                    firsat={f}
                    secili={f.id === acikId}
                    onAc={() => panelAc(f.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {secili && (
        /* `key`: baska bir firsat secilince panel YENIDEN KURULUR ve alan
           durumu yeni firsattan baslar. Eskiden bunu bir efekt yapiyordu
           (`setState` + bagimlilik listesi); `key` hem daha kisa hem de
           kullanicinin yazmakta oldugu degeri sunucu tazelenmesinde EZMEZ. */
        <FirsatPaneli
          key={secili.id}
          firsat={secili}
          uyeler={uyeler}
          etkinlikler={etkinlikler}
          teklifler={teklifler}
          yazabilir={yazabilir}
          onKapat={() => panelAc(null)}
        />
      )}
    </>
  );
}

/**
 * FIRSAT PANELI — `lg` ustunde sag cekmece, altinda tam ekran.
 *
 * Tek alan degistiginde TEK alan yazilir (`firsatGuncelle` kismi guncelleme):
 * boylece iki kullanici ayni firsatin farkli alanlarini duzenlerken birbirinin
 * yazdigini ezmez.
 */
function FirsatPaneli({
  firsat,
  uyeler,
  etkinlikler,
  teklifler,
  yazabilir,
  onKapat,
}: {
  firsat: Firsat;
  uyeler: { id: string; ad: string; altNot: string }[];
  etkinlikler: SecimSecenegi[];
  teklifler: SecimSecenegi[];
  yazabilir: boolean;
  onKapat: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [silOnayi, setSilOnayi] = useState(false);

  // Yerel kopya: alan degeri yazilirken ekranda kalsin (sunucu tazelenene dek).
  const [baslik, setBaslik] = useState(firsat.title);
  const [tutar, setTutar] = useState(
    firsat.estimatedValue !== null ? String(firsat.estimatedValue) : ''
  );
  const [beklenen, setBeklenen] = useState(firsat.expectedDate ?? '');
  const [adim, setAdim] = useState(firsat.nextStep ?? '');
  const [neden, setNeden] = useState(firsat.lostReason ?? '');


  // Esc ile kapanir — cekmece bir diyalog gibi davranir.
  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if (e.key === 'Escape') onKapat();
    }
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [onKapat]);

  function yaz(yama: Parameters<typeof firsatGuncelle>[0]) {
    setHata(null);
    startTransition(async () => {
      const res = await firsatGuncelle(yama);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      router.refresh();
    });
  }

  /** `onBlur`: deger DEGISTIYSE yazar (her odak kaybinda istek atilmaz). */
  function alandanCik(
    yeni: string,
    eski: string | null,
    kur: (v: string) => Parameters<typeof firsatGuncelle>[0]
  ) {
    if (yeni.trim() === (eski ?? '').trim()) return;
    yaz(kur(yeni));
  }

  function sil() {
    setHata(null);
    startTransition(async () => {
      const res = await firsatSil(firsat.id, firsat.contactId);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      onKapat();
      router.refresh();
    });
  }

  return (
    <>
      {/* Ortu — `lg` altinda tam ekran panelin arkasini kapatir. */}
      <div
        className="fixed inset-0 bg-ink/40 z-40"
        onClick={onKapat}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Fırsat ayrıntısı"
        className="fixed inset-0 lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[28rem] bg-paper z-50 overflow-y-auto border-l border-line"
      >
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3 sticky top-0 bg-paper">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
              Fırsat
            </p>
            <p className="font-display font-semibold text-ink break-words">
              {firsat.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onKapat}
            className="kashe-tap shrink-0 text-sm text-ink-72 hover:text-ink"
            aria-label="Kapat"
          >
            Kapat
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {!yazabilir && (
            <p className="text-sm text-ink-72">
              Bu fırsatı görüntülüyorsun; düzenlemek için yetkin yok.
            </p>
          )}

          <div>
            <label className={ETIKET} htmlFor="panel-baslik">
              Başlık
            </label>
            <input
              id="panel-baslik"
              value={baslik}
              onChange={(e) => setBaslik(e.target.value)}
              onBlur={() =>
                alandanCik(baslik, firsat.title, (v) => ({
                  id: firsat.id,
                  title: v,
                }))
              }
              disabled={!yazabilir || isPending}
              maxLength={200}
              className={ALAN}
            />
          </div>

          <div>
            <label className={ETIKET} htmlFor="panel-asama">
              Aşama
            </label>
            <select
              id="panel-asama"
              value={firsat.stage}
              onChange={(e) =>
                yaz({ id: firsat.id, stage: e.target.value as FirsatAsamasi })
              }
              disabled={!yazabilir || isPending}
              className={ALAN}
            >
              {FIRSAT_ASAMALARI.map((a) => (
                <option key={a} value={a}>
                  {ASAMA_ETIKETLERI[a]}
                </option>
              ))}
            </select>
          </div>

          {/* Kaybedilme nedeni YALNIZ `lost` asamasinda: diger asamalarda
              tetikleyici alani NULL'a cekiyor, gostermek yanlis olurdu. */}
          {firsat.stage === 'lost' && (
            <div>
              <label className={ETIKET} htmlFor="panel-neden">
                Kaybedilme nedeni
              </label>
              <textarea
                id="panel-neden"
                value={neden}
                onChange={(e) => setNeden(e.target.value)}
                onBlur={() =>
                  alandanCik(neden, firsat.lostReason, (v) => ({
                    id: firsat.id,
                    lostReason: v,
                  }))
                }
                disabled={!yazabilir || isPending}
                maxLength={500}
                rows={2}
                className={ALAN}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ETIKET} htmlFor="panel-tutar">
                Tahmini değer (TL)
              </label>
              <input
                id="panel-tutar"
                type="number"
                min={0}
                step={100}
                value={tutar}
                onChange={(e) => setTutar(e.target.value)}
                onBlur={() =>
                  alandanCik(
                    tutar,
                    firsat.estimatedValue !== null
                      ? String(firsat.estimatedValue)
                      : '',
                    (v) => ({ id: firsat.id, estimatedValue: v })
                  )
                }
                disabled={!yazabilir || isPending}
                className={ALAN}
              />
            </div>
            <div>
              <label className={ETIKET} htmlFor="panel-beklenen">
                Beklenen tarih
              </label>
              <input
                id="panel-beklenen"
                type="date"
                value={beklenen}
                onChange={(e) => setBeklenen(e.target.value)}
                onBlur={() =>
                  alandanCik(beklenen, firsat.expectedDate, (v) => ({
                    id: firsat.id,
                    expectedDate: v,
                  }))
                }
                disabled={!yazabilir || isPending}
                className={ALAN}
              />
            </div>
          </div>

          <div>
            <label className={ETIKET} htmlFor="panel-sahip">
              Sahip
            </label>
            <select
              id="panel-sahip"
              value={firsat.ownerUserId ?? ''}
              onChange={(e) =>
                yaz({ id: firsat.id, ownerUserId: e.target.value || null })
              }
              disabled={!yazabilir || isPending}
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
            <label className={ETIKET} htmlFor="panel-adim">
              Sonraki adım
            </label>
            <input
              id="panel-adim"
              value={adim}
              onChange={(e) => setAdim(e.target.value)}
              onBlur={() =>
                alandanCik(adim, firsat.nextStep, (v) => ({
                  id: firsat.id,
                  nextStep: v,
                }))
              }
              disabled={!yazabilir || isPending}
              maxLength={500}
              className={ALAN}
            />
            {firsat.nextStepAt && (
              <p
                className={
                  gecikmisMi(firsat.nextStepAt)
                    ? 'text-[11px] text-danger mt-1'
                    : 'text-[11px] text-ink-50 mt-1'
                }
              >
                {zamanMetni(firsat.nextStepAt)}
              </p>
            )}
          </div>

          <div>
            <label className={ETIKET} htmlFor="panel-etkinlik">
              Etkinlik
            </label>
            <select
              id="panel-etkinlik"
              value={firsat.eventId ?? ''}
              onChange={(e) =>
                yaz({ id: firsat.id, eventId: e.target.value || null })
              }
              disabled={!yazabilir || isPending}
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
            <label className={ETIKET} htmlFor="panel-teklif">
              Teklif
            </label>
            <select
              id="panel-teklif"
              value={firsat.proposalId ?? ''}
              onChange={(e) =>
                yaz({ id: firsat.id, proposalId: e.target.value || null })
              }
              disabled={!yazabilir || isPending}
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

          <div className="pt-2 border-t border-line space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
              Bağlantılar
            </p>
            <div className="flex flex-col gap-1.5">
              <Link
                href={`/ajans/musteriler/${firsat.contactId}`}
                className="kashe-tap text-sm text-brand-ink hover:underline"
              >
                Kişi sayfası →
              </Link>
              {firsat.proposalId && (
                <Link
                  href={`/ajans/teklifler/${firsat.proposalId}`}
                  className="kashe-tap text-sm text-brand-ink hover:underline"
                >
                  Teklife git →
                </Link>
              )}
              {firsat.eventId && (
                <Link
                  href={`/etkinliklerim/${firsat.eventId}`}
                  className="kashe-tap text-sm text-brand-ink hover:underline"
                >
                  Etkinliğe git →
                </Link>
              )}
            </div>
          </div>

          {hata && <p className="text-sm text-danger">{hata}</p>}

          {yazabilir && (
            <div className="pt-2 border-t border-line">
              {silOnayi ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-ink w-full">
                    Bu fırsat silinsin mi? Geri alınamaz.
                  </p>
                  <button
                    type="button"
                    onClick={sil}
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
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSilOnayi(true)}
                  className={BTN_TEHLIKE}
                >
                  Fırsatı sil
                </button>
              )}
            </div>
          )}

          <AsamaRozeti asama={firsat.stage} />
        </div>
      </aside>
    </>
  );
}
