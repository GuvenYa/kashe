'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { sonucEtiketi } from '@/app/lib/discover-base';
import { analyzeEventNeeds } from '@/app/lib/ai-actions';
import { confirmEventFromWizard } from './actions';

export type SihirbazProfil = {
  kategoriId: number | null;
  sehirId: number | null;
  rol: string;
  etkinlikTurleri: string[];
};

type Kategori = { id: number; slug: string; name_tr: string };
type Sehir = { id: number; name: string };
/** Etkinlik turleri artik `event_types` tablosundan gelir (sabit liste YOK). */
export type EtkinlikTuru = {
  key: string;
  name_tr: string;
  group_key: string;
};

const GRUP_BASLIKLARI: Record<string, string> = {
  sosyal: 'Sosyal',
  kurumsal: 'Kurumsal',
  diger: 'Diğer',
};
const GRUP_SIRASI = ['sosyal', 'kurumsal', 'diger'];

const ADIMLAR = [
  'Anlat',
  'Etkinlik türü',
  'Şehir',
  'Tarih ve ölçek',
  'İhtiyaç',
] as const;
const SON_ADIM = ADIMLAR.length - 1;

const MEKAN_ETIKETLERI: { value: string; label: string }[] = [
  { value: '', label: 'Belirtilmedi' },
  { value: 'confirmed', label: 'Mekan belli' },
  { value: 'searching', label: 'Mekan aranıyor' },
  { value: 'not_needed', label: 'Mekan gerekmiyor' },
];

const CIP =
  'kashe-tap px-4 py-2.5 rounded-full border text-sm font-medium transition-colors';
const CIP_PASIF =
  'bg-card border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink';
const CIP_AKTIF = 'bg-brand-ink border-brand-ink text-paper';
const CIP_KAPALI = 'bg-card border-line text-ink-32 cursor-not-allowed';

const BTN_BIRINCIL =
  'kashe-tap px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-5 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors';
const ALAN =
  'w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';
const ETIKET = 'block text-sm text-ink-72 mb-1.5';

/** Anlat adiminda URL'ye yazilan/temizlenen tum anahtarlar. */
const ANLAT_ANAHTARLARI = [
  'tur',
  'sehir',
  'ilce',
  'tarih',
  'bitis',
  'esnek',
  'katilimci',
  'butce_min',
  'butce_max',
  'mekan',
  'baslik',
  'kategoriler',
  'adet',
  'opsiyonel',
  'brief',
  'surum',
  'tarih_notu',
  'sehir_notu',
];

/**
 * URL'ye bagli metin/sayi kutusu.
 *
 * NEDEN AYRI BILESEN: gosterilen deger YEREL state'ten gelir, yani tus aninda
 * ekrana duser; URL'ye yazim yan etkidir. Kutu dogrudan URL'den okusaydi her
 * karakter bir tur bekleyip gorunurdu (P2 canli turundaki 6-7 saniyelik gecikme).
 *
 * DISARIDAN DEGISIM: geri/ileri tusu, "Analiz et" sonucu ve giris donusu URL'yi
 * degistirir. Bu durumda yerel deger tazelenir — ama YALNIZ odak bu kutuda
 * degilken; aksi halde kullanicinin yazdigi harf ezilir.
 */
function UrlKutusu({
  id,
  urlDegeri,
  onYaz,
  type = 'text',
  className,
  maxLength,
  min,
  max,
  placeholder,
}: {
  id: string;
  urlDegeri: string;
  onYaz: (deger: string) => void;
  type?: 'text' | 'number';
  className?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const [yerel, setYerel] = useState(urlDegeri);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) setYerel(urlDegeri);
  }, [urlDegeri]);

  function degisti(e: ChangeEvent<HTMLInputElement>) {
    setYerel(e.target.value);
    onYaz(e.target.value);
  }

  return (
    <input
      id={id}
      ref={ref}
      type={type}
      value={yerel}
      onChange={degisti}
      className={className ?? ALAN}
      maxLength={maxLength}
      min={min}
      max={max}
      placeholder={placeholder}
    />
  );
}

export function SihirbazClient({
  kategoriler,
  sehirler,
  turler,
  profiller,
  oturumVar,
}: {
  kategoriler: Kategori[];
  sehirler: Sehir[];
  turler: EtkinlikTuru[];
  profiller: SihirbazProfil[];
  oturumVar: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const aramaParams = useSearchParams();

  /**
   * URL = TEK GERÇEK, ama okuma YEREL AYNADAN yapilir.
   *
   * `guncelle` artik `router.push` cagirmiyor — `router.push` App Router'da sunucu
   * bilesenini yeniden kosar (page.tsx `searchParams` okumadigi halde: kategoriler,
   * sehirler, event_types ve sayac sorgulari yeniden doner) ve her tus bir tur
   * beklerdi. Yerine `window.history.pushState/replaceState` kullaniliyor: adres
   * cubugu ve gecmis dogru kalir, sunucuya gidilmez.
   *
   * Ayna (`sorgu`) neden var: history API ile yazinca arayuzun ANINDA guncellenmesi
   * `useSearchParams`'in senkronuna kalir. Ayna sayesinde cipler, sayac ve ozet
   * senkrondan bagimsiz olarak hemen tazelenir; ayna disaridan gelen degisimlerle
   * (params ve `popstate`) geri beslenir.
   */
  const [sorgu, setSorgu] = useState(() => aramaParams.toString());
  const sorguRef = useRef(sorgu);

  // Disaridan gelen URL degisimi (giris donusu, Analiz sonrasi RSC senkronu, vb.)
  useEffect(() => {
    const yeni = aramaParams.toString();
    sorguRef.current = yeni;
    setSorgu(yeni);
  }, [aramaParams]);

  // Geri/ileri tusu: adres cubugundaki gercek degeri esas al.
  useEffect(() => {
    function gecmisDegisti() {
      const yeni = window.location.search.replace(/^\?/, '');
      sorguRef.current = yeni;
      setSorgu(yeni);
    }
    window.addEventListener('popstate', gecmisDegisti);
    return () => window.removeEventListener('popstate', gecmisDegisti);
  }, []);

  const params = useMemo(() => new URLSearchParams(sorgu), [sorgu]);

  const adim = Math.min(
    Math.max(Number(params.get('adim') ?? 0) || 0, 0),
    SON_ADIM
  );
  const tur = params.get('tur') ?? '';
  const sehir = params.get('sehir') ?? '';
  const ilce = params.get('ilce') ?? '';
  const tarih = params.get('tarih') ?? '';
  const bitis = params.get('bitis') ?? '';
  const esnek = params.get('esnek') === '1';
  const katilimci = params.get('katilimci') ?? '';
  const butceMin = params.get('butce_min') ?? '';
  const butceMax = params.get('butce_max') ?? '';
  const mekan = params.get('mekan') ?? '';
  const baslik = params.get('baslik') ?? '';
  const briefId = params.get('brief') ?? '';
  const surumId = params.get('surum') ?? '';
  const tarihNotu = params.get('tarih_notu') ?? '';
  const sehirNotu = params.get('sehir_notu') ?? '';

  const secilenKategoriler = (params.get('kategoriler') ?? '')
    .split(',')
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);

  /** `adet` = "<kategoriId>:<n>,..."; yazilmayan kategori 1 adet. */
  const adetHaritasi = useMemo(() => {
    const m = new Map<number, number>();
    for (const parca of (params.get('adet') ?? '').split(',')) {
      const [k, v] = parca.split(':');
      const id = Number(k);
      const n = Number(v);
      if (Number.isFinite(id) && id > 0 && Number.isInteger(n) && n >= 1 && n <= 50) {
        m.set(id, n);
      }
    }
    return m;
  }, [params]);

  /** `opsiyonel` = "<kategoriId>,..."; listede OLMAYAN kategori zorunludur. */
  const opsiyonelKumesi = useMemo(() => {
    const s = new Set<number>();
    for (const v of (params.get('opsiyonel') ?? '').split(',')) {
      const id = Number(v);
      if (Number.isFinite(id) && id > 0) s.add(id);
    }
    return s;
  }, [params]);

  const [metin, setMetin] = useState(params.get('metin') ?? '');
  const [analizYukleniyor, setAnalizYukleniyor] = useState(false);
  const [analizHatasi, setAnalizHatasi] = useState<string | null>(null);
  const [onayYukleniyor, setOnayYukleniyor] = useState(false);
  const [onayHatasi, setOnayHatasi] = useState<string | null>(null);

  /**
   * URL'yi gunceller. `gecmis: 'push'` yalniz ADIM degisimlerinde kullanilir
   * (geri tusu adimlar arasinda dolassin); alan duzenlemeleri `replace` ile
   * gecmis yigini sismeden yazilir.
   */
  const guncelle = useCallback(
    (
      yamalar: Record<string, string | null>,
      secenek?: { gecmis?: 'push' | 'replace' }
    ) => {
      const p = new URLSearchParams(sorguRef.current);
      for (const [k, v] of Object.entries(yamalar)) {
        if (v === null || v === '') p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      sorguRef.current = qs;
      setSorgu(qs);

      const url = qs ? `${pathname}?${qs}` : pathname;
      if (typeof window !== 'undefined') {
        if (secenek?.gecmis === 'push') {
          window.history.pushState(null, '', url);
        } else {
          window.history.replaceState(null, '', url);
        }
      }
    },
    [pathname]
  );

  /** Giris duvarina giderken mevcut URL (metin dahil) korunur. */
  const girisYolu = useCallback(
    (metinDahil: boolean) => {
      const p = new URLSearchParams(sorguRef.current);
      if (metinDahil && metin.trim()) p.set('metin', metin.trim());
      const qs = p.toString();
      const hedef = qs ? `${pathname}?${qs}` : pathname;
      return `/giris?redirect=${encodeURIComponent(hedef)}`;
    },
    [pathname, metin]
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

  /** Devam düğmesinin yanındaki canlı sayı — seçili kategoriler de uygulanmış hali. */
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

  /**
   * Teklif çıkışı — sihirbazın topladığı dörtlüyü teklif formuna taşır.
   * KATEGORİ: teklif formu TEKİL seçim aldığı için yalnız tam bir kategori
   * seçiliyken taşınır; çoklu seçim zorla tekile indirgenmez.
   */
  const teklifLinki = useMemo(() => {
    const p = new URLSearchParams();
    if (tur) p.set('tur', tur);
    if (sehir) p.set('sehir', sehir);
    if (tarih) p.set('tarih', tarih);
    if (secilenKategoriler.length === 1)
      p.set('kategori', String(secilenKategoriler[0]));
    const qs = p.toString();
    return qs ? `/teklif-topla?${qs}` : '/teklif-topla';
  }, [tur, sehir, tarih, secilenKategoriler]);

  const turEtiketi = turler.find((t) => t.key === tur)?.name_tr ?? '';
  const sehirAdi = sehirler.find((c) => String(c.id) === sehir)?.name ?? '';

  const turGruplari = useMemo(() => {
    const gruplar = new Map<string, EtkinlikTuru[]>();
    for (const t of turler) {
      const liste = gruplar.get(t.group_key) ?? [];
      liste.push(t);
      gruplar.set(t.group_key, liste);
    }
    const sirali = [...gruplar.keys()].sort(
      (a, b) => GRUP_SIRASI.indexOf(a) - GRUP_SIRASI.indexOf(b)
    );
    return sirali.map((k) => ({
      anahtar: k,
      baslik: GRUP_BASLIKLARI[k] ?? k,
      turler: gruplar.get(k) ?? [],
    }));
  }, [turler]);

  function kategoriDegistir(id: number) {
    const yeni = secilenKategoriler.includes(id)
      ? secilenKategoriler.filter((v) => v !== id)
      : [...secilenKategoriler, id];
    guncelle({ kategoriler: yeni.length > 0 ? yeni.join(',') : null });
  }

  function adetDegistir(id: number, n: number) {
    const m = new Map(adetHaritasi);
    if (!Number.isFinite(n) || n <= 1) m.delete(id);
    else m.set(id, Math.min(Math.trunc(n), 50));
    const dize = [...m.entries()].map(([k, v]) => `${k}:${v}`).join(',');
    guncelle({ adet: dize || null });
  }

  function zorunluDegistir(id: number, zorunlu: boolean) {
    const s = new Set(opsiyonelKumesi);
    if (zorunlu) s.delete(id);
    else s.add(id);
    guncelle({ opsiyonel: s.size > 0 ? [...s].join(',') : null });
  }

  async function analizEt() {
    const girdi = metin.trim();
    if (girdi.length < 10) return;
    if (!oturumVar) {
      router.push(girisYolu(true));
      return;
    }
    setAnalizHatasi(null);
    setAnalizYukleniyor(true);
    const res = await analyzeEventNeeds({
      eventDescription: girdi,
      categories: kategoriler.map((k) => ({ slug: k.slug, name_tr: k.name_tr })),
    });
    setAnalizYukleniyor(false);
    if (!res.success) {
      setAnalizHatasi(res.error);
      return;
    }

    // Onceki analizden kalan degerler temizlenir; yalniz yeni spec yazilir.
    const yama: Record<string, string | null> = { metin: girdi, adim: '1' };
    for (const k of ANLAT_ANAHTARLARI) yama[k] = null;

    const s = res.spec;
    if (s.event_type) yama.tur = s.event_type;
    if (s.city_id != null) yama.sehir = String(s.city_id);
    if (s.district) yama.ilce = s.district;
    if (s.start_date) yama.tarih = s.start_date;
    if (s.end_date) yama.bitis = s.end_date;
    if (s.is_date_flexible) yama.esnek = '1';
    if (s.participant_count != null) yama.katilimci = String(s.participant_count);
    if (s.budget_min != null) yama.butce_min = String(s.budget_min);
    if (s.budget_max != null) yama.butce_max = String(s.budget_max);
    if (s.venue_status) yama.mekan = s.venue_status;
    if (s.title) yama.baslik = s.title;

    const roller = s.suggested_roles ?? [];
    const idler: number[] = [];
    const adetler: string[] = [];
    const opsiyoneller: string[] = [];
    for (const r of roller) {
      const kat = kategoriler.find((k) => k.slug === r.slug);
      if (!kat) continue; // eslesmeyen rol atlanir
      idler.push(kat.id);
      if (r.quantity && r.quantity > 1) adetler.push(`${kat.id}:${r.quantity}`);
      if (r.is_required === false) opsiyoneller.push(String(kat.id));
    }
    if (idler.length > 0) yama.kategoriler = idler.join(',');
    if (adetler.length > 0) yama.adet = adetler.join(',');
    if (opsiyoneller.length > 0) yama.opsiyonel = opsiyoneller.join(',');

    if (res.briefId) yama.brief = res.briefId;
    if (res.specVersionId) yama.surum = res.specVersionId;
    const ekstra = (s.extra ?? {}) as Record<string, unknown>;
    if (typeof ekstra.date_note === 'string') yama.tarih_notu = ekstra.date_note;
    if (typeof ekstra.city_note === 'string') yama.sehir_notu = ekstra.city_note;

    // Adim degisiyor -> gecmis kaydi (geri tusu Anlat adimina donsun).
    guncelle(yama, { gecmis: 'push' });
  }

  async function onayla() {
    setOnayHatasi(null);
    if (!tur) {
      setOnayHatasi('Once etkinlik turunu sec (adim 1).');
      return;
    }
    if (secilenKategoriler.length === 0) {
      setOnayHatasi('En az bir ihtiyac sec.');
      return;
    }
    if (!oturumVar) {
      router.push(girisYolu(true));
      return;
    }

    const roller = secilenKategoriler
      .map((id) => {
        const kat = kategoriler.find((k) => k.id === id);
        if (!kat) return null;
        return {
          slug: kat.slug,
          quantity: adetHaritasi.get(id) ?? 1,
          isRequired: !opsiyonelKumesi.has(id),
        };
      })
      .filter((r): r is { slug: string; quantity: number; isRequired: boolean } => r !== null);

    setOnayYukleniyor(true);
    const res = await confirmEventFromWizard({
      briefId: briefId || undefined,
      baseVersionId: surumId || undefined,
      rawText: metin.trim() || undefined,
      eventType: tur,
      title: baslik || undefined,
      cityId: sehir ? Number(sehir) : undefined,
      district: ilce || undefined,
      startDate: tarih || undefined,
      endDate: bitis || undefined,
      isDateFlexible: esnek ? true : undefined,
      participantCount: katilimci ? Number(katilimci) : undefined,
      budgetMin: butceMin ? Number(butceMin) : undefined,
      budgetMax: butceMax ? Number(butceMax) : undefined,
      venueStatus:
        mekan === 'confirmed' || mekan === 'searching' || mekan === 'not_needed'
          ? mekan
          : undefined,
      roles: roller,
    });
    if (res.success) {
      router.push(`/etkinliklerim/${res.eventId}`);
      return;
    }
    setOnayYukleniyor(false);
    setOnayHatasi(res.error);
  }

  const yuzde = Math.round(((adim + 1) / (SON_ADIM + 1)) * 100);

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
          Beş kısa adım; ilki isteğe bağlı. Adımları gezmek için kayıt
          gerekmiyor; anlatmak ve onaylamak için giriş istenir.
        </p>
      </div>

      {/* İlerleme */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2 gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72">
            Adım {adim + 1} / {SON_ADIM + 1} — {ADIMLAR[adim]}
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
        {/* ADIM 0 — Anlat (isteğe bağlı) */}
        {adim === 0 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Etkinliğini anlat, gerisini biz dolduralım.
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              İstersen atla — formu kendin de doldurabilirsin.
            </p>
            <label htmlFor="sihirbaz-metin" className="sr-only">
              Etkinlik açıklaması
            </label>
            <textarea
              id="sihirbaz-metin"
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Örn: Eylül ayında İstanbul'da 150 kişilik bir düğün yapıyoruz. Bahçe düğünü olacak, akşam başlayıp gece devam edecek. Hem fotoğraf hem eğlence tarafını düşünüyoruz."
              className={`${ALAN} resize-none`}
            />
            <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
              <span className="text-[11px] text-ink-72 font-mono">
                {metin.length}/1000
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => guncelle({ adim: '1' }, { gecmis: 'push' })}
                  className={BTN_IKINCIL}
                >
                  Atla, formu kendim doldurayım
                </button>
                <button
                  type="button"
                  onClick={analizEt}
                  disabled={analizYukleniyor || metin.trim().length < 10}
                  className={BTN_BIRINCIL}
                >
                  {analizYukleniyor ? 'Analiz ediliyor…' : 'Analiz et'}
                </button>
              </div>
            </div>
            {analizHatasi && (
              <p className="text-sm text-danger mt-3">{analizHatasi}</p>
            )}
          </div>
        )}

        {/* ADIM 1 — Etkinlik türü */}
        {adim === 1 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Nasıl bir etkinlik?
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              Türü seçince, o etkinlikte çalıştığını beyan eden profesyoneller
              süzülür. Onaylamak için tür seçmen gerekir.
            </p>
            {turGruplari.map((grup) => (
              <div key={grup.anahtar} className="mb-5 last:mb-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 mb-2.5">
                  {grup.baslik}
                </p>
                <div className="flex flex-wrap gap-2">
                  {grup.turler.map((t) => {
                    const secili = tur === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => guncelle({ tur: secili ? null : t.key })}
                        className={secili ? `${CIP} ${CIP_AKTIF}` : `${CIP} ${CIP_PASIF}`}
                      >
                        {t.name_tr}
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
            {sehirNotu && (
              <p className="mb-3 px-4 py-2.5 bg-brand-ink-08 border border-brand-ink/25 rounded-lg text-sm text-ink">
                Metinde geçen şehir: {sehirNotu} — listeden seç
              </p>
            )}
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

            <div className="mt-4">
              <label htmlFor="sihirbaz-ilce" className={ETIKET}>
                İlçe / semt (isteğe bağlı)
              </label>
              <UrlKutusu
                id="sihirbaz-ilce"
                urlDegeri={ilce}
                onYaz={(v) => guncelle({ ilce: v || null })}
                maxLength={100}
                placeholder="Örn: Kadıköy"
              />
            </div>
          </div>
        )}

        {/* ADIM 3 — Tarih ve ölçek. Tarih arama sonuçlarını daraltmaz. */}
        {adim === 3 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Tarih, ölçek ve bütçe
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              Hepsi isteğe bağlı. Tarih arama sonuçlarını daraltmaz — teklif
              toplarken profesyonellere iletilir.
            </p>
            {tarihNotu && (
              <p className="mb-4 px-4 py-2.5 bg-brand-ink-08 border border-brand-ink/25 rounded-lg text-sm text-ink">
                Metinde: {tarihNotu}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sihirbaz-tarih" className={ETIKET}>
                  Başlangıç tarihi
                </label>
                <input
                  id="sihirbaz-tarih"
                  type="date"
                  value={tarih}
                  onChange={(e) => guncelle({ tarih: e.target.value || null })}
                  className={ALAN}
                />
              </div>
              <div>
                <label htmlFor="sihirbaz-bitis" className={ETIKET}>
                  Bitiş tarihi (çok günlükse)
                </label>
                <input
                  id="sihirbaz-bitis"
                  type="date"
                  value={bitis}
                  onChange={(e) => guncelle({ bitis: e.target.value || null })}
                  className={ALAN}
                />
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2.5 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={esnek}
                onChange={(e) => guncelle({ esnek: e.target.checked ? '1' : null })}
                className="w-4 h-4 accent-brand-ink"
              />
              Tarih esnek
            </label>

            {tarih ? (
              <button
                type="button"
                onClick={() => guncelle({ tarih: null })}
                className="kashe-tap mt-3 text-sm text-brand-ink hover:underline block"
              >
                Tarihi temizle — henüz bilmiyorum
              </button>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div>
                <label htmlFor="sihirbaz-katilimci" className={ETIKET}>
                  Katılımcı sayısı
                </label>
                <UrlKutusu
                  id="sihirbaz-katilimci"
                  type="number"
                  min={1}
                  max={100000}
                  urlDegeri={katilimci}
                  onYaz={(v) => guncelle({ katilimci: v || null })}
                />
              </div>
              <div>
                <label htmlFor="sihirbaz-butce-min" className={ETIKET}>
                  Bütçe alt (TL)
                </label>
                <UrlKutusu
                  id="sihirbaz-butce-min"
                  type="number"
                  min={0}
                  urlDegeri={butceMin}
                  onYaz={(v) => guncelle({ butce_min: v || null })}
                />
              </div>
              <div>
                <label htmlFor="sihirbaz-butce-max" className={ETIKET}>
                  Bütçe üst (TL)
                </label>
                <UrlKutusu
                  id="sihirbaz-butce-max"
                  type="number"
                  min={0}
                  urlDegeri={butceMax}
                  onYaz={(v) => guncelle({ butce_max: v || null })}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="sihirbaz-mekan" className={ETIKET}>
                Mekan durumu
              </label>
              <select
                id="sihirbaz-mekan"
                value={mekan}
                onChange={(e) => guncelle({ mekan: e.target.value || null })}
                className={ALAN}
              >
                {MEKAN_ETIKETLERI.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ADIM 4 — İhtiyaç + onay */}
        {adim === 4 && (
          <div>
            <h2 className="font-display font-semibold text-xl text-ink mb-1">
              Kimlere ihtiyacın var?
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              Birden fazla seçebilirsin. Yanındaki sayı, önceki adımlardaki
              seçimlerine uyan profesyonel sayısıdır.
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

            {/* Seçili her ihtiyaç için adet + zorunluluk */}
            {secilenKategoriler.length > 0 && (
              <div className="mt-6 space-y-3">
                {secilenKategoriler.map((id) => {
                  const kat = kategoriler.find((k) => k.id === id);
                  if (!kat) return null;
                  const adet = adetHaritasi.get(id) ?? 1;
                  const zorunlu = !opsiyonelKumesi.has(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-4 flex-wrap px-4 py-3 bg-paper border border-line rounded-lg"
                    >
                      <span className="text-sm text-ink font-medium">
                        {kat.name_tr}
                      </span>
                      <div className="flex items-center gap-4 flex-wrap">
                        <label
                          htmlFor={`adet-${id}`}
                          className="text-sm text-ink-72 flex items-center gap-2"
                        >
                          Adet
                          <UrlKutusu
                            id={`adet-${id}`}
                            type="number"
                            min={1}
                            max={50}
                            urlDegeri={String(adet)}
                            onYaz={(v) => adetDegistir(id, Number(v))}
                            className="w-20 px-2 py-1.5 bg-card border border-line rounded text-ink text-sm focus:outline-none focus:border-brand-ink"
                          />
                        </label>
                        <label className="text-sm text-ink-72 flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={zorunlu}
                            onChange={(e) =>
                              zorunluDegistir(id, e.target.checked)
                            }
                            className="w-4 h-4 accent-brand-ink"
                          />
                          zorunlu
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6">
              <label htmlFor="sihirbaz-baslik" className={ETIKET}>
                Etkinlik başlığı (isteğe bağlı)
              </label>
              <UrlKutusu
                id="sihirbaz-baslik"
                urlDegeri={baslik}
                onYaz={(v) => guncelle({ baslik: v || null })}
                maxLength={200}
                placeholder="Örn: İstanbul'da 120 kişilik düğün"
              />
            </div>

            <div className="mt-7 pt-5 border-t border-line">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 mb-2">
                Özet
              </p>
              <p className="text-ink text-sm leading-relaxed">
                {[
                  turEtiketi || 'Tür seçilmedi',
                  [sehirAdi || 'Tüm şehirler', ilce].filter(Boolean).join(' / '),
                  [tarih || 'Tarih belirtilmedi', bitis]
                    .filter(Boolean)
                    .join(' → ') + (esnek ? ' (esnek)' : ''),
                  katilimci ? `${katilimci} kişi` : 'Katılımcı belirtilmedi',
                  butceMin || butceMax
                    ? `${butceMin || '?'}–${butceMax || '?'} TL`
                    : 'Bütçe belirtilmedi',
                  MEKAN_ETIKETLERI.find((m) => m.value === mekan)?.label ??
                    'Belirtilmedi',
                  secilenKategoriler.length > 0
                    ? `${secilenKategoriler.length} ihtiyaç`
                    : 'İhtiyaç seçilmedi',
                ].join(' · ')}
              </p>
            </div>

            {onayHatasi && (
              <p className="text-sm text-danger mt-4">{onayHatasi}</p>
            )}
          </div>
        )}

        {/* Canlı sayaç — adım 1'den itibaren. Sıfırda dürüst uyarı. */}
        {adim >= 1 && (
          <div className="mt-7 pt-5 border-t border-line">
            {sonucSayisi === 0 ? (
              <div className="px-4 py-3 bg-brand-ink-08 border border-brand-ink/25 rounded-lg text-sm text-ink leading-relaxed">
                Bu kombinasyonda şu an kimse yok — şehri genişletmeyi dene veya
                teklif toplayarak yeni katılanların sana ulaşmasını sağla.
              </div>
            ) : (
              <p className="text-sm text-ink-72">
                Şu an{' '}
                <span className="font-display font-semibold text-ink">
                  {sonucEtiketi(sonucSayisi)}
                </span>{' '}
                uyuyor — Keşfet&apos;te göreceğin sayı bu.
              </p>
            )}
          </div>
        )}

        {/* Gezinme */}
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          {adim > 0 ? (
            <button
              type="button"
              onClick={() =>
                guncelle({ adim: String(adim - 1) }, { gecmis: 'push' })
              }
              className={BTN_IKINCIL}
            >
              ← Geri
            </button>
          ) : (
            <span />
          )}

          {adim === 0 ? (
            <span />
          ) : adim < SON_ADIM ? (
            <button
              type="button"
              onClick={() =>
                guncelle({ adim: String(adim + 1) }, { gecmis: 'push' })
              }
              className={BTN_BIRINCIL}
            >
              Devam →
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={onayla}
                disabled={onayYukleniyor}
                className={BTN_BIRINCIL}
              >
                {onayYukleniyor
                  ? 'Oluşturuluyor…'
                  : 'Onayla ve etkinliği oluştur'}
              </button>
              <Link href={kesfetLinki} className={BTN_IKINCIL}>
                Keşfet&apos;te gör
              </Link>
              <Link href={teklifLinki} className={BTN_IKINCIL}>
                Teklif topla
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
