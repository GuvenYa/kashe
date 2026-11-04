'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lightbulb, Sparkles } from 'lucide-react';
import { analyzeEventNeeds } from '@/app/lib/ai-actions';
import type { EventSpecV1 } from '@/app/lib/eventspec';
import { spectenSihirbazParametreleri } from '@/app/lib/sihirbaz-url';
import {
  GirisGerekliKutusu,
  GirissizHakNotu,
} from '@/app/components/girissiz-hak';
import { ProfileCard } from '@/app/kesfet/profile-card';
import { kasheAiAdaylar, type KasheAiAdayGrubu } from './actions';

/**
 * KASHE AI TEK KUTU (Duzeltme 06-C).
 *
 * TEK MODEL CAGRISI: `analyzeEventNeeds` hem niyeti hem yapisal alanlari
 * cikarir. Profesyonel listesi VERITABANINDAN (`kasheAiAdaylar`) gelir —
 * ikinci bir model cagrisi yok, model kimlik/rakam uretmez.
 *
 * NIYET KURALI (C3): `spec.suggested_roles` sayisi
 *   1  -> "Aradigin: <rol>" + en fazla 6 aday (ikincil cikis: sihirbaz)
 *   >1 -> "Etkinligin icin onerdiklerimiz": her rol + en fazla 3 aday
 *         (birincil cikis: sihirbazda etkinligi olustur)
 *   0  -> model hata mesaji ("uygun oneri bulunamadi"); liste cizilmez.
 *
 * SIHIRBAZA GECIS: ayni spec'ten URL kurulur (`spectenSihirbazParametreleri`)
 * — sihirbaz ikinci analiz YAPMAZ, dolu adimdan devam eder.
 */

type Kategori = { id: number; slug: string; name_tr: string };
type Sehir = { id: number; name: string };
type Tur = { key: string; label: string };

const BTN_BIRINCIL =
  'kashe-tap inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap inline-flex items-center gap-2 px-5 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors';

type Sonuc = {
  spec: EventSpecV1;
  roller: { slug: string; name: string; reason: string }[];
  tip: string;
  metin: string;
  /** Girisli analizin EventSpec kaydi; sihirbaz onayi bu brief'e baglanir (girissizde yok). */
  kayit: { briefId?: string; specVersionId?: string };
};

/** `YYYY-MM-DD` -> "14 Mayıs 2026" (gecersizse oldugu gibi). */
function tarihGoster(gun: string): string {
  const t = new Date(`${gun}T12:00:00`);
  return Number.isNaN(t.getTime())
    ? gun
    : t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function KasheAiClient({
  kategoriler,
  sehirler,
  turler,
  oturumVar,
}: {
  kategoriler: Kategori[];
  sehirler: Sehir[];
  turler: Tur[];
  oturumVar: boolean;
}) {
  /**
   * URL'deki `metin` kutuyu DOGRUDAN besler (ilk degerle): efekt icinde
   * setState cagirmak kademeli render uretiyor (react-hooks/set-state-in-effect).
   * `useSearchParams` sunucuda da okunur — sayfa bu istemciyi Suspense ile
   * sarmaliyor (Next sarti).
   */
  const aramaParams = useSearchParams();
  const urlMetni = (aramaParams.get('metin') ?? '').slice(0, 1000);
  const [metin, setMetin] = useState(urlMetni);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [girisGerekli, setGirisGerekli] = useState(false);
  const [kalanHak, setKalanHak] = useState<number | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [gruplar, setGruplar] = useState<KasheAiAdayGrubu[] | null>(null);

  /**
   * URL'den gelen metin (hero aramasi, Kesfet "yakin sonuclar", ornek kartlar).
   * `otomatik=1` ise analiz BIR KEZ kendiliginden baslar (sihirbazdaki EK-3
   * kalibi): ikinci kez tetiklenmez, hak bosa gitmez.
   */
  const otomatikCalisti = useRef(false);
  useEffect(() => {
    if (otomatikCalisti.current) return;
    const gelen = urlMetni.trim();
    if (aramaParams.get('otomatik') !== '1' || gelen.length < 10) return;
    otomatikCalisti.current = true;
    // Zamanlayici: `sor` senkron setState cagiriyor; efekt govdesinden
    // dogrudan cagirmak kademeli render uyarisi verir.
    const t = setTimeout(() => {
      void sor(gelen);
    }, 0);
    return () => clearTimeout(t);
    // Bilerek tek sefer: bagimlilik eklemek her tus vurusunda tetiklerdi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Giris donusu anlatilan metni korur. */
  function girisHref(): string {
    const p = new URLSearchParams();
    const m = metin.trim();
    if (m) p.set('metin', m);
    const qs = p.toString();
    const hedef = qs ? `/kashe-ai?${qs}` : '/kashe-ai';
    return `/giris?redirect=${encodeURIComponent(hedef)}`;
  }

  async function sor(girdiMetni?: string) {
    const girdi = (girdiMetni ?? metin).trim();
    if (girdi.length < 10) return;
    setHata(null);
    setGirisGerekli(false);
    setKalanHak(null);
    setSonuc(null);
    setGruplar(null);
    setYukleniyor(true);

    const res = await analyzeEventNeeds({
      eventDescription: girdi,
      categories: kategoriler.map((k) => ({
        slug: k.slug,
        name_tr: k.name_tr,
      })),
    });

    if (!res.success) {
      setYukleniyor(false);
      setHata(res.error);
      setGirisGerekli(res.girisGerekli === true);
      return;
    }

    if (res.kalanHak !== undefined) setKalanHak(res.kalanHak);
    const roller = res.categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      reason: c.reason,
    }));
    setSonuc({
      spec: res.spec,
      roller,
      tip: res.tip,
      metin: girdi,
      kayit: { briefId: res.briefId, specVersionId: res.specVersionId },
    });

    // Adaylar: tek rolde 6, cok rolde rol basina 3 (C3).
    const adayliklar = await kasheAiAdaylar({
      rolSluglari: roller.map((r) => r.slug),
      sehirId: res.spec.city_id ?? null,
      etkinlikTuru: res.spec.event_type ?? null,
      adet: roller.length === 1 ? 6 : 3,
    });
    setGruplar(adayliklar.gruplar);
    setYukleniyor(false);
  }

  const spec = sonuc?.spec;
  const turEtiketi = spec?.event_type
    ? (turler.find((t) => t.key === spec.event_type)?.label ?? null)
    : null;
  const sehirAdi =
    spec?.city_id != null
      ? (sehirler.find((c) => c.id === spec.city_id)?.name ?? null)
      : null;

  /** "Anladiklarim" satiri — spec'te OLAN alanlar; olmayan gosterilmez. */
  const anladiklarim = [
    turEtiketi,
    sehirAdi,
    spec?.start_date ? tarihGoster(spec.start_date) : null,
    spec?.participant_count != null
      ? `${spec.participant_count} kişi`
      : null,
  ].filter((v): v is string => !!v);

  /** Kesfet cikisi — MEVCUT parametre adlari (kategori · sehir · etkinlik). */
  function kesfetLinki(kategoriId: number | null): string {
    const p = new URLSearchParams();
    if (kategoriId != null) p.set('kategori', String(kategoriId));
    if (spec?.city_id != null) p.set('sehir', String(spec.city_id));
    if (spec?.event_type) p.set('etkinlik', spec.event_type);
    const qs = p.toString();
    return qs ? `/kesfet?${qs}` : '/kesfet';
  }

  /** Sihirbaz cikisi — AYNI spec, ikinci analiz yok (D1 ortak yardimci). */
  function sihirbazLinki(): string {
    if (!sonuc) return '/etkinlik-sihirbazi';
    const p = spectenSihirbazParametreleri(
      sonuc.spec,
      kategoriler,
      sonuc.metin,
      sonuc.kayit
    );
    const qs = p.toString();
    return qs ? `/etkinlik-sihirbazi?${qs}` : '/etkinlik-sihirbazi';
  }

  const tekRol = sonuc?.roller.length === 1;

  return (
    <div>
      {/* ───────── TEK KUTU ───────── */}
      <div className="bg-card border border-line rounded-2xl p-5 md:p-6">
        <label
          htmlFor="kashe-ai-metin"
          className="block text-sm text-ink-72 mb-1.5"
        >
          Ne arıyorsun?
        </label>
        <textarea
          id="kashe-ai-metin"
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Örn: Eylül'de İstanbul'da 150 kişilik bahçe düğünü; fotoğrafçı ve DJ arıyoruz."
          className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
        />
        <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
          <span className="text-[11px] text-ink-72 font-mono">
            {metin.length}/1000
          </span>
          <button
            type="button"
            onClick={() => void sor()}
            disabled={yukleniyor || metin.trim().length < 10}
            className={BTN_BIRINCIL}
          >
            <Sparkles size={16} />
            {yukleniyor ? 'Kashe AI düşünüyor…' : "Kashe AI'a sor"}
          </button>
        </div>

        {hata && !girisGerekli && (
          <p className="text-sm text-danger mt-3">{hata}</p>
        )}
        {hata && girisGerekli && (
          <GirisGerekliKutusu mesaj={hata} girisHref={girisHref()} />
        )}
      </div>

      {/* ───────── SONUC ───────── */}
      {sonuc && (
        <div className="mt-8">
          {anladiklarim.length > 0 && (
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-4">
              Anladıklarım: {anladiklarim.join(' · ')}
            </p>
          )}

          {tekRol ? (
            <>
              <h2 className="font-display font-semibold text-2xl text-ink mb-1">
                Aradığın: {sonuc.roller[0].name}
              </h2>
              {sonuc.roller[0].reason && (
                <p className="text-sm text-ink-72 leading-relaxed mb-5">
                  {sonuc.roller[0].reason}
                </p>
              )}
            </>
          ) : (
            <h2 className="font-display font-semibold text-2xl text-ink mb-5">
              Etkinliğin için önerdiklerimiz
            </h2>
          )}

          <div className="space-y-8">
            {(gruplar ?? []).map((grup) => {
              const rol = sonuc.roller.find((r) => r.slug === grup.rolSlug);
              return (
                <section key={grup.rolSlug}>
                  {!tekRol && (
                    <div className="mb-3">
                      <p className="font-display font-semibold text-lg text-ink">
                        {grup.rolAdi}
                      </p>
                      {rol?.reason && (
                        <p className="text-sm text-ink-72 leading-relaxed mt-0.5">
                          {rol.reason}
                        </p>
                      )}
                    </div>
                  )}

                  {grup.sehirGenel && sehirAdi && (
                    <p className="text-[11px] text-ink-72 font-mono mb-2">
                      Bu şehirde ({sehirAdi}) bulunamadı; Türkiye geneli
                      gösteriliyor.
                    </p>
                  )}

                  {grup.adaylar.length === 0 ? (
                    <p className="text-sm text-ink-72">
                      Bu rolde yayında profil bulunamadı.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {grup.adaylar.map((p) => (
                        <ProfileCard
                          key={p.id}
                          profile={p}
                          rating={null}
                          isLoggedIn={oturumVar}
                        />
                      ))}
                    </div>
                  )}

                  <Link
                    href={kesfetLinki(grup.kategoriId)}
                    className="inline-block mt-3 text-sm text-brand-ink underline hover:text-brand-ink-deep transition-colors"
                  >
                    {tekRol ? "Keşfet'te tümünü gör" : 'Tümü'}
                  </Link>
                </section>
              );
            })}
          </div>

          {sonuc.tip && (
            <div className="mt-6 flex items-start gap-3 bg-brand-ink/5 border border-brand-ink/20 rounded-xl p-4">
              <Lightbulb size={18} className="shrink-0 mt-0.5 text-brand-ink" />
              <p className="text-sm text-ink-72 leading-relaxed">{sonuc.tip}</p>
            </div>
          )}

          {/* Cikislar: tek rolde sihirbaz IKINCIL, cok rolde BIRINCIL. */}
          <div className="flex items-center gap-3 flex-wrap mt-6">
            <Link
              href={sihirbazLinki()}
              className={tekRol ? BTN_IKINCIL : BTN_BIRINCIL}
            >
              {tekRol
                ? 'Etkinlik olarak planla'
                : 'Etkinliği oluştur ve teklif topla'}
            </Link>
          </div>

          <p className="text-[11px] text-ink-72 mt-5 leading-relaxed">
            Bu öneriler yapay zeka tarafından hazırlanmıştır, yalnızca yol
            gösterme amaçlıdır. Etkinliğinin ihtiyaçları farklılık gösterebilir.
          </p>

          {kalanHak !== null && <GirissizHakNotu kalan={kalanHak} />}
        </div>
      )}
    </div>
  );
}
