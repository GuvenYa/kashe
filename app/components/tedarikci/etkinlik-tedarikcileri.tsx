'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ATAMA_DURUMLARI,
  DURUM_ETIKETLERI,
  durumSinifi,
  kategoriEtiketi,
  type AtamaDurumu,
} from '@/app/lib/tedarikci';
import {
  atamaGuncelle,
  atamaSil,
  etkinligeTedarikciEkle,
  tedarikciMaliyetYaz,
  type TedarikciMaliyeti,
} from '@/app/lib/tedarikci-actions';
import { formatTL } from '@/app/lib/para';
import type { Atama } from '@/app/lib/tedarikci-data';

/**
 * FAZ 8c — etkinlik sayfasinin "Tedarikciler" sekmesi.
 *
 * TUTAR SUTUNU `internal.event_supplier_costs`'tan gelir ve YALNIZ RPC ile
 * okunur/yazilir (`tedarikci-actions.ts`). `maliyetler === null` ise kullanici
 * `commercial.view` yetkisine sahip DEGIL: sutun HIC cizilmez (bos gostermek
 * "tutar girilmemis" sanirdi). Bos dizi ise yetki var, tutar henuz yok.
 *
 * ALANDAN CIKINCA KAYDET (8a/8b deseni): hizmet ve tutar `onBlur`'da DEGISTIYSE
 * yazilir. "Kaydet" dugmesi yok; kullanici bir alani duzeltip baska yere
 * tikliyor ve degisiklik kayboluyordu.
 *
 * KURAL KOPYALANMAZ: "arsivdeki tedarikci atanamaz", "etkinlik bu kurulusa ait
 * degil" kontrolleri DB'de; action mesaji cevirir.
 */
const ALAN =
  'w-full bg-card border border-line rounded-lg px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink disabled:opacity-60';
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink transition-colors disabled:opacity-50';
const BTN_TEHLIKE =
  'kashe-tap px-3 py-1.5 border border-danger/40 text-danger rounded-lg font-display font-semibold text-xs hover:bg-danger/[0.06] transition-colors disabled:opacity-50';

type Secenek = { id: string; ad: string; kategori: string };

export function EtkinlikTedarikcileri({
  organizationId,
  eventId,
  atamalar,
  secenekler,
  maliyetler,
  yazabilir,
  maliyetYazilir,
}: {
  organizationId: string;
  eventId: string;
  atamalar: Atama[];
  /** Aktif tedarikciler (arsiv listede YOK — DB de reddeder). */
  secenekler: Secenek[];
  /** `null` = `commercial.view` yetkisi yok -> tutar sutunu cizilmez. */
  maliyetler: TedarikciMaliyeti[] | null;
  yazabilir: boolean;
  maliyetYazilir: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [silOnayi, setSilOnayi] = useState<string | null>(null);

  const maliyetGorulur = maliyetler !== null;
  const maliyetHaritasi = useMemo(() => {
    const m = new Map<string, TedarikciMaliyeti>();
    for (const k of maliyetler ?? []) m.set(k.eventSupplierId, k);
    return m;
  }, [maliyetler]);

  /** Toplam: `cancelled` atamalar HARIC (iptal edilen is maliyet degil). */
  const toplam = useMemo(() => {
    if (!maliyetGorulur) return 0;
    return atamalar
      .filter((a) => a.status !== 'cancelled')
      .reduce(
        (t, a) => t + (maliyetHaritasi.get(a.id)?.amount ?? 0),
        0
      );
  }, [atamalar, maliyetHaritasi, maliyetGorulur]);

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
    <div className="space-y-4">
      {/* ── TEDARIKCI EKLE ── */}
      {yazabilir && (
        <div className="bg-card border border-line rounded-xl p-4">
          {ekleAcik ? (
            <TedarikciEkle
              organizationId={organizationId}
              eventId={eventId}
              secenekler={secenekler.filter(
                (s) => !atamalar.some((a) => a.supplierId === s.id)
              )}
              onIptal={() => setEkleAcik(false)}
              onBitti={() => {
                setEkleAcik(false);
                router.refresh();
              }}
            />
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-ink-72">
                Etkinliğe defterden tedarikçi ata.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={`/ajans/tedarikciler?kurulus=${organizationId}&yeni=tedarikci`}
                  className="kashe-tap text-sm text-brand-ink hover:underline"
                >
                  Defterde yok → Yeni tedarikçi
                </Link>
                <button
                  type="button"
                  onClick={() => setEkleAcik(true)}
                  className={BTN_BIRINCIL}
                >
                  Tedarikçi ekle
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LISTE ── */}
      {atamalar.length === 0 ? (
        <div className="bg-card border border-line rounded-xl p-5 text-sm text-ink-72">
          Bu etkinliğe henüz tedarikçi atanmadı.
        </div>
      ) : (
        <div className="space-y-3">
          {atamalar.map((a) => {
            const maliyet = maliyetHaritasi.get(a.id);
            return (
              <div
                key={a.id}
                className="bg-card border border-line rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1 basis-56">
                    <Link
                      href={`/ajans/tedarikciler/${a.supplierId}`}
                      className="kashe-tap font-display font-semibold text-ink hover:underline break-words"
                    >
                      {a.tedarikciAdi}
                    </Link>
                    <p className="text-xs text-ink-72 mt-0.5">
                      {kategoriEtiketi(a.tedarikciKategorisi)}
                      {a.tedarikciTelefonu && (
                        <>
                          {' · '}
                          <a
                            href={`tel:${a.tedarikciTelefonu}`}
                            className="hover:underline"
                          >
                            {a.tedarikciTelefonu}
                          </a>
                        </>
                      )}
                    </p>
                  </div>

                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.12em] border px-2 py-0.5 rounded shrink-0 ${durumSinifi(a.status)}`}
                  >
                    {DURUM_ETIKETLERI[a.status]}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label
                      className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1"
                      htmlFor={`hizmet-${a.id}`}
                    >
                      Hizmet
                    </label>
                    <HizmetAlani
                      atamaId={a.id}
                      baslangic={a.service ?? ''}
                      yazabilir={yazabilir && !isPending}
                    />
                  </div>

                  <div>
                    <label
                      className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1"
                      htmlFor={`durum-${a.id}`}
                    >
                      Durum
                    </label>
                    <select
                      id={`durum-${a.id}`}
                      value={a.status}
                      onChange={(e) =>
                        yaz(() =>
                          atamaGuncelle({
                            id: a.id,
                            status: e.target.value as AtamaDurumu,
                          })
                        )
                      }
                      disabled={!yazabilir || isPending}
                      className={ALAN}
                    >
                      {ATAMA_DURUMLARI.map((d) => (
                        <option key={d} value={d}>
                          {DURUM_ETIKETLERI[d]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tutar — yalniz ticari yetkide. */}
                  {maliyetGorulur && (
                    <div className="sm:col-span-2">
                      <label
                        className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1"
                        htmlFor={`tutar-${a.id}`}
                      >
                        Anlaşılan tutar
                        <span className="ml-2 text-ink-50 normal-case tracking-normal">
                          İç maliyet gizli — yalnız ticari yetkililer
                        </span>
                      </label>
                      {maliyetYazilir ? (
                        <TutarAlani
                          atamaId={a.id}
                          eventId={eventId}
                          baslangicTutar={
                            maliyet?.amount !== null &&
                            maliyet?.amount !== undefined
                              ? String(maliyet.amount)
                              : ''
                          }
                          baslangicNot={maliyet?.note ?? ''}
                          pasif={isPending}
                        />
                      ) : (
                        <p className="text-sm text-ink tabular-nums">
                          {maliyet?.amount !== null &&
                          maliyet?.amount !== undefined
                            ? formatTL(maliyet.amount)
                            : '—'}
                          {maliyet?.note && (
                            <span className="text-ink-72"> · {maliyet.note}</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {yazabilir && (
                  <div className="mt-3 pt-3 border-t border-line">
                    {silOnayi === a.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-ink w-full">
                          Bu tedarikçi etkinlikten kaldırılsın mı?
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            yaz(async () => {
                              const r = await atamaSil(a.id, eventId);
                              if (r.ok) setSilOnayi(null);
                              return r;
                            })
                          }
                          disabled={isPending}
                          className={BTN_TEHLIKE}
                        >
                          {isPending ? 'Kaldırılıyor…' : 'Evet, kaldır'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSilOnayi(null)}
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Vazgeç
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSilOnayi(a.id)}
                        className={BTN_TEHLIKE}
                      >
                        Kaldır
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hata && <p className="text-sm text-danger">{hata}</p>}

      {/* ── TOPLAM ── */}
      {maliyetGorulur && atamalar.length > 0 && (
        <div className="bg-paper-2 border border-line rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
            Tedarikçi maliyeti toplamı
          </p>
          <p className="font-display font-semibold text-ink tabular-nums">
            {toplam > 0 ? formatTL(toplam) : '—'}
          </p>
        </div>
      )}

      {maliyetGorulur && (
        <p className="text-xs text-ink-50 leading-relaxed">
          Tutarlar yalnız ticari yetkili üyelere görünür, müşteriye gönderilen
          teklifte yer almaz. İptal edilen atamalar toplama girmez.
        </p>
      )}
    </div>
  );
}

/** Hizmet alani — alandan cikinca kaydeder. */
function HizmetAlani({
  atamaId,
  baslangic,
  yazabilir,
}: {
  atamaId: string;
  baslangic: string;
  yazabilir: boolean;
}) {
  const router = useRouter();
  const [deger, setDeger] = useState(baslangic);
  const [bekliyor, basla] = useTransition();

  function cik() {
    if (deger.trim() === baslangic.trim()) return;
    basla(async () => {
      await atamaGuncelle({ id: atamaId, service: deger });
      router.refresh();
    });
  }

  return (
    <input
      id={`hizmet-${atamaId}`}
      value={deger}
      onChange={(e) => setDeger(e.target.value)}
      onBlur={cik}
      disabled={!yazabilir || bekliyor}
      maxLength={200}
      placeholder="Örnek: Ses sistemi"
      className={ALAN}
    />
  );
}

/**
 * Tutar + not — alandan cikinca RPC'ye yazar.
 * BOS BIRAKMAK tutari SILER (RPC `p_amount = NULL` dali).
 */
function TutarAlani({
  atamaId,
  eventId,
  baslangicTutar,
  baslangicNot,
  pasif,
}: {
  atamaId: string;
  eventId: string;
  baslangicTutar: string;
  baslangicNot: string;
  pasif: boolean;
}) {
  const router = useRouter();
  const [tutar, setTutar] = useState(baslangicTutar);
  const [not, setNot] = useState(baslangicNot);
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  function kaydet() {
    if (
      tutar.trim() === baslangicTutar.trim() &&
      not.trim() === baslangicNot.trim()
    ) {
      return;
    }
    setHata(null);
    basla(async () => {
      const sayi = tutar.trim() === '' ? null : Number(tutar);
      if (sayi !== null && !Number.isFinite(sayi)) {
        setHata('Tutar okunamadı.');
        return;
      }
      const res = await tedarikciMaliyetYaz(atamaId, sayi, not, eventId);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2">
        <input
          id={`tutar-${atamaId}`}
          type="number"
          min={0}
          step={100}
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          onBlur={kaydet}
          disabled={pasif || bekliyor}
          placeholder="Tutar (TL)"
          className={ALAN}
        />
        <input
          value={not}
          onChange={(e) => setNot(e.target.value)}
          onBlur={kaydet}
          disabled={pasif || bekliyor}
          placeholder="Gizli not (isteğe bağlı)"
          aria-label="Tutar notu"
          className={ALAN}
        />
      </div>
      {hata && <p className="text-xs text-danger">{hata}</p>}
    </div>
  );
}

/** Defterden tedarikci secip atar. Arama bellekte (yeni sorgu yok). */
function TedarikciEkle({
  organizationId,
  eventId,
  secenekler,
  onIptal,
  onBitti,
}: {
  organizationId: string;
  eventId: string;
  secenekler: Secenek[];
  onIptal: () => void;
  onBitti: () => void;
}) {
  const [arama, setArama] = useState('');
  const [secili, setSecili] = useState('');
  const [hizmet, setHizmet] = useState('');
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  const suzulmus = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr');
    if (!q) return secenekler.slice(0, 12);
    return secenekler
      .filter((s) => s.ad.toLocaleLowerCase('tr').includes(q))
      .slice(0, 12);
  }, [secenekler, arama]);

  const seciliKayit = secenekler.find((s) => s.id === secili) ?? null;

  function ekle() {
    setHata(null);
    basla(async () => {
      const res = await etkinligeTedarikciEkle({
        organizationId,
        eventId,
        supplierId: secili,
        service: hizmet,
      });
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      onBitti();
    });
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
        Tedarikçi ekle
      </p>

      {seciliKayit ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-ink">
            {seciliKayit.ad}
            <span className="text-ink-72">
              {' '}
              · {kategoriEtiketi(seciliKayit.kategori)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSecili('')}
            className="kashe-tap text-xs text-brand-ink hover:underline"
          >
            Değiştir
          </button>
        </div>
      ) : (
        <>
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Defterde ara"
            aria-label="Tedarikçi ara"
            className={ALAN}
          />
          {secenekler.length === 0 ? (
            <p className="text-sm text-ink-72">
              Atanabilir tedarikçi yok. Defterden ekle ya da arşivden çıkar.
            </p>
          ) : (
            <div className="border border-line rounded-lg divide-y divide-line max-h-44 overflow-y-auto">
              {suzulmus.length === 0 ? (
                <p className="text-sm text-ink-72 px-3 py-2">
                  Eşleşen tedarikçi yok.
                </p>
              ) : (
                suzulmus.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSecili(s.id)}
                    className="kashe-tap w-full text-left px-3 py-2 text-sm text-ink hover:bg-paper-2"
                  >
                    {s.ad}
                    <span className="text-ink-72">
                      {' '}
                      · {kategoriEtiketi(s.kategori)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      <input
        value={hizmet}
        onChange={(e) => setHizmet(e.target.value)}
        maxLength={200}
        placeholder="Hizmet (örnek: Ses sistemi)"
        aria-label="Hizmet"
        className={ALAN}
      />

      {hata && <p className="text-sm text-danger">{hata}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={ekle}
          disabled={bekliyor || !secili}
          className={BTN_BIRINCIL}
        >
          {bekliyor ? 'Ekleniyor…' : 'Ekle'}
        </button>
        <button
          type="button"
          onClick={onIptal}
          disabled={bekliyor}
          className={BTN_IKINCIL}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
