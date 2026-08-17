'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { EVENT_TYPES } from '@/app/mesajlar/data';

export type SihirbazProfil = {
  kategoriId: number | null;
  sehirId: number | null;
  rol: string;
  etkinlikTurleri: string[];
};

type Kategori = { id: number; slug: string; name_tr: string };
type Sehir = { id: number; name: string };

/** EVENT_TYPES'ın kaynaktaki kendi gruplaması — yeni küme UYDURULMADI. */
const TUR_GRUPLARI: { baslik: string; keyler: string[] }[] = [
  {
    baslik: 'Sosyal',
    keyler: [
      'wedding',
      'engagement',
      'henna',
      'birthday',
      'baby_shower',
      'graduation',
      'circumcision',
    ],
  },
  {
    baslik: 'Kurumsal',
    keyler: [
      'corporate',
      'launch',
      'fair',
      'conference',
      'congress',
      'gala',
      'concert',
    ],
  },
  { baslik: 'Diğer', keyler: ['other'] },
];

const ADIMLAR = ['Etkinlik türü', 'Şehir', 'Tarih', 'İhtiyaç'] as const;
const SON_ADIM = ADIMLAR.length;

const CIP =
  'kashe-tap px-4 py-2.5 rounded-full border text-sm font-medium transition-colors';
const CIP_PASIF =
  'bg-card border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink';
const CIP_AKTIF = 'bg-brand-ink border-brand-ink text-paper';
const CIP_KAPALI = 'bg-card border-line text-ink-32 cursor-not-allowed';

const BTN_BIRINCIL =
  'kashe-tap px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors';
const BTN_IKINCIL =
  'kashe-tap px-5 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors';
const ALAN =
  'w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

export function SihirbazClient({
  kategoriler,
  sehirler,
  profiller,
}: {
  kategoriler: Kategori[];
  sehirler: Sehir[];
  profiller: SihirbazProfil[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // URL = TEK GERÇEK. Adım ve seçimler URL'de: tarayıcı geri/ileri doğal çalışır,
  // link paylaşılabilir ve Faz 2'de kayıt duvarından dönüşte state kaybolmaz.
  const adim = Math.min(
    Math.max(Number(params.get('adim') ?? 1) || 1, 1),
    SON_ADIM
  );
  const tur = params.get('tur') ?? '';
  const sehir = params.get('sehir') ?? '';
  const tarih = params.get('tarih') ?? '';
  const secilenKategoriler = (params.get('kategoriler') ?? '')
    .split(',')
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);

  const guncelle = useCallback(
    (yamalar: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(yamalar)) {
        if (v === null || v === '') p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  // SAYAÇ — Keşfet filtre semantiğinin birebir istemci karşılığı.
  // Kategori seçimi HARİÇ eşleşme; adım 4'teki kategori sayıları bunun üstüne biner.
  const turSehirEslesen = useMemo(
    () =>
      profiller.filter((p) => {
        if (sehir && String(p.sehirId) !== sehir) return false;
        if (tur && !p.etkinlikTurleri.includes(tur)) return false;
        return true;
      }),
    [profiller, sehir, tur]
  );

  /** Kategori kırılımı — adım 4'te her çipin yanındaki sayı. */
  const kategoriSayilari = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of turSehirEslesen) {
      if (p.kategoriId == null) continue;
      m.set(p.kategoriId, (m.get(p.kategoriId) ?? 0) + 1);
    }
    return m;
  }, [turSehirEslesen]);

  /** Devam düğmesinin yanındaki canlı sayı — seçili kategoriler de uygulanmış hâli. */
  const sonucSayisi = useMemo(() => {
    if (secilenKategoriler.length === 0) return turSehirEslesen.length;
    return turSehirEslesen.filter(
      (p) => p.kategoriId != null && secilenKategoriler.includes(p.kategoriId)
    ).length;
  }, [turSehirEslesen, secilenKategoriler]);

  /** Keşfet çıkışı — MEVCUT parametre adları (kategori · sehir · etkinlik). */
  const kesfetLinki = useMemo(() => {
    const p = new URLSearchParams();
    if (secilenKategoriler.length > 0)
      p.set('kategori', secilenKategoriler.join(','));
    if (sehir) p.set('sehir', sehir);
    if (tur) p.set('etkinlik', tur);
    const qs = p.toString();
    return qs ? `/kesfet?${qs}` : '/kesfet';
  }, [secilenKategoriler, sehir, tur]);

  const turEtiketi = EVENT_TYPES.find((e) => e.key === tur)?.label ?? '';
  const sehirAdi = sehirler.find((c) => String(c.id) === sehir)?.name ?? '';

  function kategoriDegistir(id: number) {
    const yeni = secilenKategoriler.includes(id)
      ? secilenKategoriler.filter((v) => v !== id)
      : [...secilenKategoriler, id];
    guncelle({ kategoriler: yeni.length > 0 ? yeni.join(',') : null });
  }

  const yuzde = Math.round((adim / SON_ADIM) * 100);

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
          Etkinlik sihirbazı
        </p>
        <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight">
          Etkinliğini{' '}
          <em className="text-brand-ink not-italic italic font-medium">kur</em>,
          sana uyanları görelim.
        </h1>
        <p className="text-ink-72 mt-3 leading-relaxed">
          Dört kısa adım. Kayıt gerekmiyor; her adımda kaç profesyonelin uyduğunu
          anında görürsün.
        </p>
      </div>

      {/* İlerleme */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2 gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72">
            Adım {adim} / {SON_ADIM} — {ADIMLAR[adim - 1]}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72">
            {yuzde}%
          </p>
        </div>
        <div className="w-full h-1.5 bg-card border border-line rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-brand transition-all"
            style={{ width: `${yuzde}%` }}
          />
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
        {/* ADIM 1 — Etkinlik türü */}
        {adim === 1 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Nasıl bir etkinlik?
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              Türü seçince, o etkinlikte çalıştığını beyan eden profesyoneller
              süzülür. Seçmezsen hepsi kalır.
            </p>
            {TUR_GRUPLARI.map((grup) => (
              <div key={grup.baslik} className="mb-5 last:mb-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 mb-2.5">
                  {grup.baslik}
                </p>
                <div className="flex flex-wrap gap-2">
                  {grup.keyler.map((k) => {
                    const et = EVENT_TYPES.find((e) => e.key === k);
                    if (!et) return null;
                    const secili = tur === et.key;
                    return (
                      <button
                        key={et.key}
                        type="button"
                        onClick={() =>
                          guncelle({ tur: secili ? null : et.key })
                        }
                        className={secili ? `${CIP} ${CIP_AKTIF}` : `${CIP} ${CIP_PASIF}`}
                      >
                        {et.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADIM 2 — Şehir */}
        {adim === 2 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Nerede olacak?
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              Şehri boş bırakırsan tüm Türkiye görünür.
            </p>
            <label htmlFor="sihirbaz-sehir" className="sr-only">
              Şehir
            </label>
            <select
              id="sihirbaz-sehir"
              value={sehir}
              onChange={(e) => guncelle({ sehir: e.target.value || null })}
              className={ALAN}
            >
              <option value="">Tüm şehirler</option>
              {sehirler.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ADIM 3 — Tarih. OPSİYONEL ve FİLTRELEMEZ: toplanır, Faz 2'de teklif
            metnine taşınacak. Keşfet'te tarih diye bir filtre yok. */}
        {adim === 3 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Tarihi biliyor musun?
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              Zorunlu değil. Tarih arama sonuçlarını daraltmaz — teklif toplarken
              profesyonellere iletilir.
            </p>
            <label htmlFor="sihirbaz-tarih" className="sr-only">
              Etkinlik tarihi
            </label>
            <input
              id="sihirbaz-tarih"
              type="date"
              value={tarih}
              onChange={(e) => guncelle({ tarih: e.target.value || null })}
              className={ALAN}
            />
            {tarih ? (
              <button
                type="button"
                onClick={() => guncelle({ tarih: null })}
                className="kashe-tap mt-3 text-sm text-brand-ink hover:underline"
              >
                Tarihi temizle — henüz bilmiyorum
              </button>
            ) : null}
          </div>
        )}

        {/* ADIM 4 — İhtiyaç */}
        {adim === 4 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Kimlere ihtiyacın var?
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              Birden fazla seçebilirsin. Yanındaki sayı, önceki adımlardaki
              seçimlerine uyan profesyonel sayısıdır. Boş bırakırsan tüm alanlar
              dahil edilir.
            </p>
            <div className="flex flex-wrap gap-2">
              {kategoriler.map((kat) => {
                const sayi = kategoriSayilari.get(kat.id) ?? 0;
                const secili = secilenKategoriler.includes(kat.id);
                const kapali = sayi === 0 && !secili;
                const cipSinif = secili
                  ? `${CIP} ${CIP_AKTIF}`
                  : kapali
                    ? `${CIP} ${CIP_KAPALI}`
                    : `${CIP} ${CIP_PASIF}`;
                return (
                  <button
                    key={kat.id}
                    type="button"
                    disabled={kapali}
                    onClick={() => kategoriDegistir(kat.id)}
                    className={cipSinif}
                    title={
                      kapali
                        ? 'Bu seçimde şu an uygun profesyonel yok'
                        : undefined
                    }
                  >
                    {kat.name_tr}
                    <span className="ml-2 font-mono text-[11px] opacity-70">
                      {sayi}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 pt-5 border-t border-line">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 mb-2">
                Özet
              </p>
              <p className="text-ink text-sm leading-relaxed">
                {[
                  turEtiketi || 'Tüm etkinlik türleri',
                  sehirAdi || 'Tüm şehirler',
                  tarih || 'Tarih belirtilmedi',
                ].join(' · ')}
              </p>
            </div>
          </div>
        )}

        {/* Canlı sayaç — her adımda. Sıfırda dürüst uyarı; sahte sonuç gösterilmez. */}
        <div className="mt-7 pt-5 border-t border-line">
          {sonucSayisi === 0 ? (
            <div className="px-4 py-3 bg-brand-ink-08 border border-brand-ink/25 rounded-lg text-sm text-ink leading-relaxed">
              Bu kombinasyonda şu an profesyonel yok — şehri genişletmeyi dene
              veya teklif toplayarak yeni katılanların sana ulaşmasını sağla.
            </div>
          ) : (
            <p className="text-sm text-ink-72">
              Şu an{' '}
              <span className="font-display font-semibold text-ink">
                {sonucSayisi}
              </span>{' '}
              profesyonel uyuyor.
            </p>
          )}
        </div>

        {/* Gezinme */}
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          {adim > 1 ? (
            <button
              type="button"
              onClick={() => guncelle({ adim: String(adim - 1) })}
              className={BTN_IKINCIL}
            >
              ← Geri
            </button>
          ) : (
            <span />
          )}

          {adim < SON_ADIM ? (
            <button
              type="button"
              onClick={() => guncelle({ adim: String(adim + 1) })}
              className={BTN_BIRINCIL}
            >
              Devam →
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={kesfetLinki} className={BTN_BIRINCIL}>
                Profesyonelleri gör →
              </Link>
              <Link href="/teklif-topla" className={BTN_IKINCIL}>
                Teklif topla
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
