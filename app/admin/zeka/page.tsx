'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { createClient } from '@/app/lib/supabase-browser';
import {
  PanelBaslik,
  PanelKart,
  KpiKutu,
  KpiSatir,
  VeriTablosu,
  type VeriSatiri,
  type VeriSutunu,
} from '@/app/components/panel';
import { C, MONO, tooltipStyle } from '@/app/lib/grafik-tema';
import { formatTL } from '@/app/lib/para';
import {
  AILE_ETIKETI,
  HUNI_ADIMLARI,
  TRUST_ARALIK_ETIKETI,
  OLAY_GRUP_ETIKETI,
  OLAY_SIRASI,
  olayEtiketi,
  ondalik3,
  oran,
  sayi,
  yuzde,
} from '@/app/lib/zeka';
import {
  BILESENLER,
  GUVEN_ESIGI,
  ITIRAZ_DURUMU,
  SAGLAYICI_TURU,
  skorMetni,
  type ItirazDurumu,
} from '@/app/lib/guven';
import { istanbulGunu, tarihMetni } from '@/app/lib/tarih';

/**
 * FAZ 9a / P1 — admin zeka gostergeleri (`/admin/zeka`).
 *
 * TEK VERI KAYNAGI `analytics_summary(p_days)` RPC'sidir. `analytics_events`
 * tablosu buradan DOGRUDAN SORGULANMAZ: RLS yalniz admine SELECT veriyor ama
 * ham olay satirlarini istemciye tasimak hem gereksiz hem de ileride tablo
 * buyudugunde tarayiciyi kilitleyecek bir yol olurdu. Ozet DB'de uretilir.
 *
 * ERISIM KORUMASI `app/admin/layout.tsx`'te; burada IKINCI bir kontrol YOK
 * (iki yerde yazilan bir kural kayar). RPC de admin degilse 42501 doner ve o
 * durum asagida kullaniciya anlasilir bir cumleye cevrilir.
 *
 * SAYI UYDURULMAZ: RPC'nin `null` dondurdugu her oran "—" gorunur; sifir
 * yuzdeyle ("%0,0") KARISTIRILMAZ — biri olculmus, oteki olculememis.
 */

const RANGE_OPTIONS = [
  { key: 7, label: '7 gün' },
  { key: 30, label: '30 gün' },
  { key: 90, label: '90 gün' },
  { key: 365, label: '365 gün' },
] as const;

/** Adalet karsilastirmasinda SABIT pencereler (secili pencereden bagimsiz). */
const SABIT_PENCERELER = [7, 30, 90] as const;

type GunlukSatiri = { day: string; event_name: string; count: number };

type Huni = {
  brief_created: number;
  event_confirmed: number;
  match_run: number;
  match_shown: number;
  match_clicked: number;
  selection: number;
  approval: number;
  booking_created: number;
  booking_completed: number;
  booking_cancelled: number;
};

type Adalet = {
  shown_total: number;
  shown_new_talent: number;
  new_talent_share: number | null;
  top3_new_talent_share: number | null;
  providers_shown: number;
  gini: number | null;
};

/** `price_benchmarks_summary()` donusu (FAZ 9b). */
type KiyasHucresi = {
  role_id: number;
  role_name: string | null;
  city_id: number | null;
  city_name: string | null;
  event_type: string | null;
  event_type_name: string | null;
  granularity: string;
  sample_size: number;
  p25: number | string;
  median: number | string;
  p75: number | string;
};

type EsigeYakin = KiyasHucresi & { missing: number };

type KiyasOzeti = {
  period_end: string | null;
  threshold: number;
  cells_total: number;
  cells_published: number;
  observations_total?: number;
  by_granularity: Record<string, { total: number; published: number }>;
  published_cells: KiyasHucresi[];
  near_threshold: EsigeYakin[];
};

/**
 * `trust_score_summary()` donusu (FAZ 9c).
 *
 * `numeric` alanlar PostgREST'te METIN gelir (`avg`, `snapshot_score`,
 * bilesen ortalamalari): hepsi gosterimden once `Number(...)` ile cevrilir.
 */
type GuvenDagilimi = {
  low: number;
  mid: number;
  high: number;
  scored: number;
  avg: number | string | null;
  not_computed: number;
  invisible: number;
};

type GuvenItirazSayilari = { open: number; reviewed: number; closed: number };

type GuvenKuyrugu = {
  id: string;
  provider_id: string;
  provider_name: string | null;
  provider_type: string | null;
  status: string;
  message: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  snapshot_id: number | null;
  snapshot_score: number | string | null;
  current_score: number | string | null;
};

type GuvenOzeti = {
  last_computed_at: string | null;
  distribution: GuvenDagilimi;
  appeals: GuvenItirazSayilari;
  appeal_queue: GuvenKuyrugu[];
  component_avgs: Record<string, number | string | null>;
  high_threshold: number;
};

type Ozet = {
  from: string;
  days: number;
  totals: Record<string, number>;
  daily: GunlukSatiri[];
  funnel: Huni;
  fairness: Adalet;
};

/** "2026-10-01" -> "01 Eki" (grafik ekseni; dar alanda yil gereksiz). */
function eksenGunu(gun: string): string {
  const d = new Date(`${gun}T00:00:00Z`);
  if (isNaN(d.getTime())) return gun;
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function ZekaPage() {
  const [pDays, setPDays] = useState<number>(30);
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [sabitler, setSabitler] = useState<Record<number, Adalet | null>>({});
  const [kiyas, setKiyas] = useState<KiyasOzeti | null>(null);
  const [kiyasHatasi, setKiyasHatasi] = useState<string | null>(null);
  const [guven, setGuven] = useState<GuvenOzeti | null>(null);
  const [guvenHatasi, setGuvenHatasi] = useState<string | null>(null);
  /** Itiraz karari: islenen satir ve o satirin not kutusu. */
  const [islemde, setIslemde] = useState<string | null>(null);
  const [notlar, setNotlar] = useState<Record<string, string>>({});
  const [kararHatasi, setKararHatasi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  /**
   * Hata metni: 42501 beklenen durum (admin degil), digerleri teknik.
   * Ham DB metni kullaniciya SIZDIRILMAZ; yalniz mesaj kismi gosterilir.
   */
  const hataMetni = useCallback(
    (e: { code?: string | null; message?: string | null } | null): string => {
      if (e?.code === '42501') {
        return 'Bu sayfa yalnızca platform yöneticisine açık.';
      }
      return `Veriler yüklenemedi: ${e?.message ?? 'bilinmeyen hata'}`;
    },
    []
  );

  // Ilk yukleme: secili pencere + uc sabit pencere (adalet karsilastirmasi).
  useEffect(() => {
    let iptal = false;
    const supabase = createClient();

    (async () => {
      setYukleniyor(true);
      setHata(null);
      // FAZ 9b: fiyat kiyasi ozeti pencere seciciden BAGIMSIZ (gunluk hesap);
      // pencere degisiminde yeniden cekilmez. Digerleriyle PARALEL baslar.
      const kiyasIstegi = supabase.rpc('price_benchmarks_summary');
      // FAZ 9c: guven ozeti de pencere seciciden BAGIMSIZ (gunluk hesap).
      const guvenIstegi = supabase.rpc('trust_score_summary');
      const [secili, ...digerleri] = await Promise.all([
        supabase.rpc('analytics_summary', { p_days: pDays }),
        ...SABIT_PENCERELER.map((g) =>
          supabase.rpc('analytics_summary', { p_days: g })
        ),
      ]);
      const kiyasSonuc = await kiyasIstegi;
      const guvenSonuc = await guvenIstegi;
      if (iptal) return;

      if (secili.error) {
        setHata(hataMetni(secili.error));
        setYukleniyor(false);
        return;
      }
      setOzet(secili.data as unknown as Ozet);

      const harita: Record<number, Adalet | null> = {};
      SABIT_PENCERELER.forEach((g, i) => {
        const sonuc = digerleri[i];
        harita[g] = sonuc?.error
          ? null
          : ((sonuc?.data as unknown as Ozet | null)?.fairness ?? null);
      });
      setSabitler(harita);
      if (kiyasSonuc.error) {
        setKiyasHatasi(hataMetni(kiyasSonuc.error));
      } else {
        setKiyas(kiyasSonuc.data as unknown as KiyasOzeti);
      }
      if (guvenSonuc.error) {
        setGuvenHatasi(hataMetni(guvenSonuc.error));
      } else {
        setGuven(guvenSonuc.data as unknown as GuvenOzeti);
      }
      setYukleniyor(false);
    })();

    return () => {
      iptal = true;
    };
    // Ilk yukleme sabit pencereleri de ceker; `pDays` degisiminde asagidaki
    // AYRI effect yalniz secili pencereyi yeniler (uc cagri tekrar atilmaz).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Pencere degisimi: YALNIZ secili pencere yenilenir (uc sabit pencere
   * tekrar cekilmez — onlar karsilastirma icin ve degismiyor).
   *
   * `useRef`: ilk kosu yukaridaki effect tarafindan zaten yapildi; bu effect
   * mount'ta atlanir. Ref yalniz effect ICINDE okunup yazilir (render sirasinda
   * ref erisimi React kuralini ihlal ederdi).
   */
  const ilkAtlandi = useRef(false);
  useEffect(() => {
    if (!ilkAtlandi.current) {
      ilkAtlandi.current = true;
      return;
    }
    let iptal = false;
    const supabase = createClient();

    (async () => {
      setYukleniyor(true);
      setHata(null);
      const { data, error } = await supabase.rpc('analytics_summary', {
        p_days: pDays,
      });
      if (iptal) return;
      if (error) {
        setHata(hataMetni(error));
        setYukleniyor(false);
        return;
      }
      setOzet(data as unknown as Ozet);
      setYukleniyor(false);
    })();

    return () => {
      iptal = true;
    };
  }, [pDays, hataMetni]);

  /**
   * FAZ 9c — itiraz karari (admin): `trust_appeal_review(p_appeal, p_status,
   * p_note)`. Kararin kurallari DB'de (durum yalniz `reviewed`/`closed`, not
   * en fazla 2000 karakter, `reviewed_by`/`reviewed_at` RPC'de dolar); burada
   * TEKRAR EDILMEZ. Karardan sonra YALNIZ guven ozeti yeniden cekilir —
   * olay/huni/kiyas verisi degismedi.
   */
  const itirazKarari = useCallback(
    async (appealId: string, durum: 'reviewed' | 'closed') => {
      setIslemde(appealId);
      setKararHatasi(null);
      const supabase = createClient();
      const not = (notlar[appealId] ?? '').trim();
      const { error } = await supabase.rpc('trust_appeal_review', {
        p_appeal: appealId,
        p_status: durum,
        p_note: not === '' ? null : not,
      });
      if (error) {
        setKararHatasi(hataMetni(error));
        setIslemde(null);
        return;
      }
      const { data, error: ozetHatasi } =
        await supabase.rpc('trust_score_summary');
      if (!ozetHatasi) setGuven(data as unknown as GuvenOzeti);
      setNotlar((o) => {
        const y = { ...o };
        delete y[appealId];
        return y;
      });
      setIslemde(null);
    },
    [notlar, hataMetni]
  );

  // ---------------------------------------------------------------------------
  // Turetimler
  // ---------------------------------------------------------------------------

  /**
   * Gunluk toplam serisi: pencere BASINDAN bugune her gun bir nokta.
   * `daily` yalniz olay OLAN gunleri getiriyor; aradaki bos gunler 0 ile
   * doldurulur, aksi halde grafik zaman eksenini sikistirip yaniltirdi.
   */
  const gunlukSeri = useMemo(() => {
    if (!ozet) return [];
    const toplamlar = new Map<string, number>();
    const kirilim = new Map<string, { ad: string; adet: number }[]>();
    for (const s of ozet.daily ?? []) {
      toplamlar.set(s.day, (toplamlar.get(s.day) ?? 0) + s.count);
      const liste = kirilim.get(s.day) ?? [];
      liste.push({ ad: s.event_name, adet: s.count });
      kirilim.set(s.day, liste);
    }

    const baslangic = new Date(ozet.from);
    if (isNaN(baslangic.getTime())) return [];
    const bugun = new Date();
    const noktalar: {
      gun: string;
      etiket: string;
      toplam: number;
      ilk3: { ad: string; adet: number }[];
    }[] = [];

    for (
      const d = new Date(baslangic);
      d <= bugun;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const gun = istanbulGunu(d);
      const liste = (kirilim.get(gun) ?? [])
        .slice()
        .sort((a, b) => b.adet - a.adet)
        .slice(0, 3);
      noktalar.push({
        gun,
        etiket: eksenGunu(gun),
        toplam: toplamlar.get(gun) ?? 0,
        ilk3: liste,
      });
      // 365 gunluk pencerede nokta sayisi sinirlanir (grafik okunur kalsin).
      if (noktalar.length > 400) break;
    }
    return noktalar;
  }, [ozet]);

  /** Son 7 gun toplami (olay basina) — `daily`'den istemcide. */
  const son7 = useMemo(() => {
    const harita = new Map<string, number>();
    if (!ozet) return harita;
    const esik = new Date();
    esik.setUTCDate(esik.getUTCDate() - 7);
    const esikGun = istanbulGunu(esik);
    for (const s of ozet.daily ?? []) {
      if (s.day < esikGun) continue;
      harita.set(s.event_name, (harita.get(s.event_name) ?? 0) + s.count);
    }
    return harita;
  }, [ozet]);

  const olayToplami = useMemo(
    () =>
      Object.values(ozet?.totals ?? {}).reduce(
        (t, n) => t + (Number(n) || 0),
        0
      ),
    [ozet]
  );

  const huni = ozet?.funnel ?? null;
  const adalet = ozet?.fairness ?? null;

  const huniVerisi = useMemo(() => {
    if (!huni) return [];
    return HUNI_ADIMLARI.map((a) => ({
      etiket: a.etiket,
      anahtar: a.anahtar,
      sayi: Number(huni[a.anahtar as keyof Huni] ?? 0),
    }));
  }, [huni]);

  const huniBos = !huni || (huni.brief_created === 0 && huni.booking_created === 0);

  /** Adalet grafigi: sabit pencereler; `null` pay cubuk CIZMEZ (0 degil). */
  const adaletVerisi = useMemo(
    () =>
      SABIT_PENCERELER.map((g) => {
        const f = sabitler[g];
        return {
          pencere: `${g} gün`,
          yeniPay:
            f?.new_talent_share != null ? f.new_talent_share * 100 : undefined,
          ilk3Pay:
            f?.top3_new_talent_share != null
              ? f.top3_new_talent_share * 100
              : undefined,
        };
      }),
    [sabitler]
  );

  // ---------------------------------------------------------------------------
  // Tablolar
  // ---------------------------------------------------------------------------

  /** Blok 4 grafigi: aile basina toplam/yayinlanan (eksik anahtar 0). */
  const aileVerisi = useMemo(
    () =>
      (['role_city_type', 'role_city', 'role'] as const).map((anahtar) => {
        const a = kiyas?.by_granularity?.[anahtar];
        return {
          aile: AILE_ETIKETI[anahtar] ?? anahtar,
          toplam: Number(a?.total ?? 0),
          yayinlanan: Number(a?.published ?? 0),
        };
      }),
    [kiyas]
  );

  const kiyasSutunlari: VeriSutunu[] = [
    { anahtar: 'rol', baslik: 'Rol', kartEtiketiGizle: true },
    { anahtar: 'sehir', baslik: 'Şehir', dar: true },
    { anahtar: 'tur', baslik: 'Tür', dar: true },
    { anahtar: 'islem', baslik: 'İşlem', sayisal: true },
    { anahtar: 'p25', baslik: 'p25', sayisal: true },
    { anahtar: 'medyan', baslik: 'Medyan', sayisal: true },
    { anahtar: 'p75', baslik: 'p75', sayisal: true },
  ];

  const kiyasSatirlari: VeriSatiri[] = useMemo(
    () =>
      (kiyas?.published_cells ?? []).map((h, i) => ({
        anahtar: `${h.role_id}-${h.city_id ?? 'x'}-${h.event_type ?? 'x'}-${i}`,
        hucreler: {
          rol: (
            <span className="block min-w-0">
              <span className="block text-ink break-words">
                {h.role_name ?? '—'}
              </span>
              {/* Sehir/tur sutunlari `lg` altinda gizli (dar): ayni rolun uc
                  ailesi ayirt edilemiyordu — kapsam burada da yazilir. */}
              <span className="block font-mono text-[10px] text-ink-50 break-words">
                {h.city_name ?? 'Tüm şehirler'} · {h.event_type_name ?? 'Tüm türler'}
              </span>
            </span>
          ),
          sehir: h.city_name ?? 'Tümü',
          tur: h.event_type_name ?? 'Tümü',
          islem: sayi(h.sample_size),
          // Tutarlar `para.ts` ile; burada hesap YOK, RPC degeri bicimlenir.
          p25: formatTL(Number(h.p25)),
          medyan: formatTL(Number(h.median)),
          p75: formatTL(Number(h.p75)),
        },
      })),
    [kiyas]
  );

  const yakinSutunlari: VeriSutunu[] = [
    { anahtar: 'rol', baslik: 'Rol', kartEtiketiGizle: true },
    { anahtar: 'sehir', baslik: 'Şehir', dar: true },
    { anahtar: 'tur', baslik: 'Tür', dar: true },
    { anahtar: 'islem', baslik: 'İşlem', sayisal: true },
    { anahtar: 'eksik', baslik: 'Eksik', sayisal: true },
  ];

  const yakinSatirlari: VeriSatiri[] = useMemo(
    () =>
      (kiyas?.near_threshold ?? []).map((h, i) => ({
        anahtar: `y-${h.role_id}-${h.city_id ?? 'x'}-${h.event_type ?? 'x'}-${i}`,
        hucreler: {
          rol: (
            <span className="block min-w-0">
              <span className="block text-ink break-words">
                {h.role_name ?? '—'}
              </span>
              <span className="block font-mono text-[10px] text-ink-50 break-words">
                {h.city_name ?? 'Tüm şehirler'} · {h.event_type_name ?? 'Tüm türler'}
              </span>
            </span>
          ),
          sehir: h.city_name ?? 'Tümü',
          tur: h.event_type_name ?? 'Tümü',
          islem: sayi(h.sample_size),
          eksik: sayi(h.missing),
        },
      })),
    [kiyas]
  );

  const olaySutunlari: VeriSutunu[] = [
    { anahtar: 'olay', baslik: 'Olay', kartEtiketiGizle: true },
    { anahtar: 'grup', baslik: 'Grup', dar: true },
    { anahtar: 'pencere', baslik: 'Pencere toplamı', sayisal: true },
    { anahtar: 'son7', baslik: 'Son 7 gün', sayisal: true },
  ];

  const olaySatirlari: VeriSatiri[] = useMemo(() => {
    const satirlar: VeriSatiri[] = OLAY_SIRASI.map((ad) => ({
      anahtar: ad,
      hucreler: {
        olay: (
          <span className="block min-w-0">
            <span className="block text-ink break-words">
              {olayEtiketi(ad)}
            </span>
            <span className="block font-mono text-[10px] text-ink-50 break-words">
              {ad}
            </span>
          </span>
        ),
        grup: OLAY_GRUP_ETIKETI[ad] ?? '—',
        pencere: sayi(Number(ozet?.totals?.[ad] ?? 0)),
        son7: sayi(son7.get(ad) ?? 0),
      },
    }));
    satirlar.push({
      anahtar: 'toplam',
      hucreler: {
        olay: <span className="font-medium text-ink">Toplam</span>,
        grup: '',
        pencere: <span className="font-medium">{sayi(olayToplami)}</span>,
        son7: (
          <span className="font-medium">
            {sayi([...son7.values()].reduce((t, n) => t + n, 0))}
          </span>
        ),
      },
    });
    return satirlar;
  }, [ozet, son7, olayToplami]);

  const huniSutunlari: VeriSutunu[] = [
    { anahtar: 'adim', baslik: 'Adım', kartEtiketiGizle: true },
    { anahtar: 'sayi', baslik: 'Sayı', sayisal: true },
    { anahtar: 'onceki', baslik: 'Önceki adıma oran', sayisal: true },
    { anahtar: 'brief', baslik: "Brief'e oran", sayisal: true, dar: true },
  ];

  const huniSatirlari: VeriSatiri[] = useMemo(() => {
    if (!huni) return [];
    const brief = huniVerisi[0]?.sayi ?? 0;
    const satirlar: VeriSatiri[] = huniVerisi.map((a, i) => ({
      anahtar: a.anahtar,
      hucreler: {
        adim: <span className="text-ink">{a.etiket}</span>,
        sayi: sayi(a.sayi),
        onceki: i === 0 ? '—' : oran(a.sayi, huniVerisi[i - 1].sayi),
        brief: i === 0 ? '—' : oran(a.sayi, brief),
      },
    }));
    satirlar.push({
      anahtar: 'booking_cancelled',
      hucreler: {
        adim: (
          <span className="text-ink-72">İptal edilen rezervasyon</span>
        ),
        sayi: <span className="text-ink-72">{sayi(huni.booking_cancelled)}</span>,
        onceki: <span className="text-ink-72">—</span>,
        brief: <span className="text-ink-72">—</span>,
      },
    });
    return satirlar;
  }, [huni, huniVerisi]);

  const adaletSutunlari: VeriSutunu[] = [
    { anahtar: 'pencere', baslik: 'Pencere', kartEtiketiGizle: true },
    { anahtar: 'gosterim', baslik: 'Gösterim', sayisal: true },
    { anahtar: 'yeni', baslik: 'Yeni yetenek', sayisal: true },
    { anahtar: 'pay', baslik: 'Pay', sayisal: true },
    { anahtar: 'ilk3', baslik: 'İlk 3 pay', sayisal: true },
    { anahtar: 'saglayici', baslik: 'Sağlayıcı', sayisal: true, dar: true },
    { anahtar: 'gini', baslik: 'Gini', sayisal: true, dar: true },
  ];

  const adaletSatirlari: VeriSatiri[] = useMemo(() => {
    const satir = (etiket: string, f: Adalet | null): VeriSatiri => ({
      anahtar: etiket,
      hucreler: {
        pencere: <span className="text-ink">{etiket}</span>,
        gosterim: sayi(f?.shown_total ?? null),
        yeni: sayi(f?.shown_new_talent ?? null),
        pay: yuzde(f?.new_talent_share ?? null),
        ilk3: yuzde(f?.top3_new_talent_share ?? null),
        saglayici: sayi(f?.providers_shown ?? null),
        gini: ondalik3(f?.gini ?? null),
      },
    });
    const satirlar = SABIT_PENCERELER.map((g) =>
      satir(`${g} gün`, sabitler[g] ?? null)
    );
    // Secili pencere sabitlerden biri DEGILSE dorduncu satir eklenir.
    if (ozet && !SABIT_PENCERELER.includes(ozet.days as 7 | 30 | 90)) {
      satirlar.push(satir(`Seçili (${ozet.days} gün)`, adalet));
    }
    return satirlar;
  }, [sabitler, ozet, adalet]);

  // --- Blok 5 (FAZ 9c) --------------------------------------------------------

  /** Dagilim grafigi: 0-39 / 40-69 / 70+ — sira `TRUST_ARALIK_ETIKETI` ile ayni. */
  const guvenDagilimi = useMemo(() => {
    const d = guven?.distribution;
    return [
      { aralik: TRUST_ARALIK_ETIKETI[0], adet: Number(d?.low ?? 0) },
      { aralik: TRUST_ARALIK_ETIKETI[1], adet: Number(d?.mid ?? 0) },
      { aralik: TRUST_ARALIK_ETIKETI[2], adet: Number(d?.high ?? 0) },
    ];
  }, [guven]);

  const guvenDagilimiBos = guvenDagilimi.every((g) => g.adet === 0);

  /** Dagilim cubuk renkleri — grafik, kart skor renkleriyle ayni dili konusur. */
  const DAGILIM_RENKLERI = [C.brandAccent, C.brandInk, C.moss];

  const bilesenSutunlari: VeriSutunu[] = [
    { anahtar: 'bilesen', baslik: 'Bileşen', kartEtiketiGizle: true },
    { anahtar: 'ortalama', baslik: 'Ortalama puan', sayisal: true },
    { anahtar: 'maks', baslik: 'Maksimum', sayisal: true },
    { anahtar: 'doluluk', baslik: 'Doluluk', sayisal: true },
  ];

  const bilesenSatirlari: VeriSatiri[] = useMemo(
    () =>
      BILESENLER.map((b) => {
        const ham = guven?.component_avgs?.[b.anahtar];
        const ort = ham === null || ham === undefined ? null : Number(ham);
        const gecerli = ort !== null && Number.isFinite(ort);
        // Iptal bileseni NEGATIF: "doluluk" orani anlamsiz olur, "—" yazilir.
        const iptal = b.anahtar === 'cancel';
        return {
          anahtar: b.anahtar,
          hucreler: {
            bilesen: <span className="block text-ink">{b.etiket}</span>,
            ortalama: (
              <span className="tabular-nums">
                {gecerli ? skorMetni(ort) : '—'}
              </span>
            ),
            maks: (
              <span className="tabular-nums text-ink-72">
                {iptal ? '0 (−15)' : b.maks}
              </span>
            ),
            doluluk: (
              <span className="tabular-nums text-ink-72">
                {iptal || !gecerli ? '—' : oran(ort, b.maks)}
              </span>
            ),
          },
        };
      }),
    [guven]
  );

  const kuyrukSutunlari: VeriSutunu[] = [
    { anahtar: 'saglayici', baslik: 'Sağlayıcı', kartEtiketiGizle: true },
    { anahtar: 'puan', baslik: 'Puan', sayisal: true, dar: true },
    { anahtar: 'itiraz', baslik: 'İtiraz' },
    { anahtar: 'islem', baslik: 'Karar' },
  ];

  const kuyrukSatirlari: VeriSatiri[] = useMemo(
    () =>
      (guven?.appeal_queue ?? []).map((a) => {
        const durum = ITIRAZ_DURUMU[a.status as ItirazDurumu] ?? null;
        const dokumPuani =
          a.snapshot_score === null || a.snapshot_score === undefined
            ? null
            : Number(a.snapshot_score);
        const guncelPuan =
          a.current_score === null || a.current_score === undefined
            ? null
            : Number(a.current_score);
        return {
          anahtar: a.id,
          hucreler: {
            saglayici: (
              <span className="block min-w-0">
                <span className="block text-ink truncate">
                  {a.provider_name ?? 'Adsız sağlayıcı'}
                </span>
                <span className="block text-[11px] text-ink-50">
                  {SAGLAYICI_TURU[a.provider_type ?? ''] ??
                    (a.provider_type ?? '')}
                  {durum ? ` · ${durum.etiket}` : ''} ·{' '}
                  {tarihMetni(a.created_at) ?? ''}
                </span>
              </span>
            ),
            puan: (
              <span className="tabular-nums">
                {dokumPuani === null ? '—' : skorMetni(dokumPuani)}
                <span className="block text-[11px] text-ink-50">
                  güncel {guncelPuan === null ? '—' : skorMetni(guncelPuan)}
                </span>
              </span>
            ),
            itiraz: (
              <span className="block min-w-0">
                <span className="block text-sm text-ink whitespace-pre-wrap break-words">
                  {a.message}
                </span>
                {a.admin_note && (
                  <span className="block text-[11px] text-ink-50 mt-1 whitespace-pre-wrap break-words">
                    Kashe notu: {a.admin_note}
                  </span>
                )}
              </span>
            ),
            islem:
              a.status === 'closed' ? (
                <span className="text-[11px] text-ink-50">
                  {tarihMetni(a.reviewed_at) ?? 'Kapatıldı'}
                </span>
              ) : (
                <span className="block min-w-0">
                  <textarea
                    value={notlar[a.id] ?? ''}
                    onChange={(e) =>
                      setNotlar((o) => ({ ...o, [a.id]: e.target.value }))
                    }
                    rows={2}
                    maxLength={2000}
                    placeholder="Kashe notu (isteğe bağlı)"
                    aria-label="İtiraz notu"
                    className="w-full bg-card border border-line rounded-lg px-2 py-1.5 text-xs text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink"
                  />
                  <span className="flex items-center gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => itirazKarari(a.id, 'reviewed')}
                      disabled={islemde === a.id}
                      className="kashe-tap px-2.5 py-1 bg-brand-ink text-paper rounded-lg font-display font-semibold text-[11px] hover:bg-brand-ink-deep transition-colors disabled:opacity-50"
                    >
                      İncelendi
                    </button>
                    <button
                      type="button"
                      onClick={() => itirazKarari(a.id, 'closed')}
                      disabled={islemde === a.id}
                      className="kashe-tap px-2.5 py-1 border border-line text-ink rounded-lg font-display font-semibold text-[11px] hover:border-brand-ink transition-colors disabled:opacity-50"
                    >
                      Kapat
                    </button>
                  </span>
                </span>
              ),
          },
        };
      }),
    [guven, notlar, islemde, itirazKarari]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const pencereNotu = ozet?.from
    ? `Pencere: ${tarihMetni(ozet.from) ?? ozet.from} — bugün`
    : null;

  const pencereSecici = (
    <div className="inline-flex rounded-xl border border-line bg-card p-1">
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setPDays(o.key)}
          aria-pressed={pDays === o.key}
          style={{ fontFamily: MONO }}
          className={
            pDays === o.key
              ? 'kashe-tap px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] rounded-lg bg-brand-ink text-paper transition-colors'
              : 'kashe-tap px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] rounded-lg text-ink-50 hover:text-ink transition-colors'
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PanelBaslik
        eyebrow="Admin · Zeka katmanı"
        sagAlan={pencereSecici}
        altNot="Olay zinciri analytics_events üzerinden; sayılar seçili pencereye göre (İstanbul günü)."
      >
        Zeka{' '}
        <em className="not-italic text-brand-accent">göstergeleri</em>
      </PanelBaslik>

      {pencereNotu && (
        <p
          className="mb-6 text-[11px] uppercase tracking-[0.14em] text-ink-50"
          style={{ fontFamily: MONO }}
        >
          {pencereNotu}
        </p>
      )}

      {hata ? (
        <PanelKart baslik="Zeka göstergeleri">
          <p className="text-sm text-ink-72">{hata}</p>
        </PanelKart>
      ) : yukleniyor && !ozet ? (
        <div className="space-y-6">
          <div className="h-56 bg-card border border-line rounded-xl animate-pulse" />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-72 bg-card border border-line rounded-xl animate-pulse" />
            <div className="h-72 bg-card border border-line rounded-xl animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── BLOK 1 — Gunluk olaylar ── */}
          <PanelKart baslik="Günlük olaylar">
            {olayToplami === 0 ? (
              <p className="text-sm text-ink-72">Bu pencerede olay yok.</p>
            ) : (
              <div className="w-full" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={gunlukSeri}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={`${C.ink}14`}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="etiket"
                      tick={{ fontSize: 11, fill: `${C.ink}99` }}
                      interval="preserveStartEnd"
                      minTickGap={16}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: `${C.ink}99` }}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: unknown) => [sayi(Number(v)), 'Toplam']}
                      labelFormatter={(_etiket, yuk) => {
                        const n = yuk?.[0]?.payload as
                          | { gun: string; ilk3: { ad: string; adet: number }[] }
                          | undefined;
                        if (!n) return '';
                        const kirilim = n.ilk3
                          .map((k) => `${olayEtiketi(k.ad)} · ${k.adet}`)
                          .join('  |  ');
                        return kirilim
                          ? `${tarihMetni(n.gun) ?? n.gun} — ${kirilim}`
                          : (tarihMetni(n.gun) ?? n.gun);
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="toplam"
                      stroke={C.brandInk}
                      fill={`${C.brandInk}26`}
                      strokeWidth={2}
                      name="Toplam"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-5">
              <VeriTablosu
                sutunlar={olaySutunlari}
                satirlar={olaySatirlari}
                bosMetin="Olay listesi yüklenemedi."
              />
            </div>
          </PanelKart>

          {/* ── BLOK 4 — Fiyat kiyaslari (FAZ 9b) ── */}
          <PanelKart baslik="Fiyat kıyasları · yayınlanan hücreler">
            {kiyasHatasi ? (
              <p className="text-sm text-ink-72">{kiyasHatasi}</p>
            ) : (
              <>
                <KpiSatir>
                  <KpiKutu
                    etiket="Hücre"
                    deger={
                      kiyas?.period_end ? sayi(kiyas.cells_total) : '—'
                    }
                    altNot="Son hesap"
                  />
                  <KpiKutu
                    etiket="Yayınlanan"
                    deger={
                      kiyas?.period_end ? sayi(kiyas.cells_published) : '—'
                    }
                    altNot="Eşiği geçen"
                    vurgu={
                      (kiyas?.cells_published ?? 0) > 0 ? 'moss' : 'none'
                    }
                  />
                  <KpiKutu
                    etiket="Gözlem"
                    deger={
                      kiyas?.period_end
                        ? sayi(kiyas.observations_total ?? 0)
                        : '—'
                    }
                    altNot="son 90 gün"
                  />
                  <KpiKutu
                    etiket="Eşik"
                    deger={
                      kiyas ? `${sayi(kiyas.threshold)} işlem` : '—'
                    }
                    altNot={
                      kiyas?.period_end
                        ? (tarihMetni(kiyas.period_end) ?? '')
                        : 'Hesap yok'
                    }
                  />
                </KpiSatir>

                {!kiyas?.period_end ? (
                  <p className="text-sm text-ink-72">Henüz hesap yok.</p>
                ) : (
                  <>
                    <div className="w-full" style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={aileVerisi}
                          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={`${C.ink}14`}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="aile"
                            tick={{ fontSize: 11, fill: `${C.ink}99` }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: `${C.ink}99` }}
                            allowDecimals={false}
                            width={36}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v: unknown, ad: unknown) => [
                              sayi(Number(v)),
                              String(ad),
                            ]}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar
                            dataKey="toplam"
                            name="Toplam"
                            fill={C.brandInkDeep}
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="yayinlanan"
                            name="Yayınlanan"
                            fill={C.moss}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-5">
                      <VeriTablosu
                        sutunlar={kiyasSutunlari}
                        satirlar={kiyasSatirlari}
                        bosMetin={`Yayınlanan hücre yok (eşik ${sayi(
                          kiyas.threshold
                        )} işlem).`}
                      />
                    </div>

                    <p className="font-display text-sm text-ink mt-6 mb-3">
                      Eşiğe yakın
                    </p>
                    <VeriTablosu
                      sutunlar={yakinSutunlari}
                      satirlar={yakinSatirlari}
                      bosMetin="Eşiğe yakın hücre yok."
                    />
                  </>
                )}
              </>
            )}
          </PanelKart>

          {/* ── BLOK 5 — Guven puani (FAZ 9c) ──
              Dagilim ve bilesen ortalamalari `trust_score_summary`'den gelir;
              `trust_score_snapshots` tablosu buradan DA okunmaz. Itiraz karari
              tek RPC ile yazilir, sonra yalniz bu ozet yenilenir. */}
          <PanelKart baslik="Güven puanı · Trust Score V0">
            {guvenHatasi ? (
              <p className="text-sm text-ink-72">{guvenHatasi}</p>
            ) : (
              <>
                <KpiSatir>
                  <KpiKutu
                    etiket="Puanlı sağlayıcı"
                    deger={guven ? sayi(guven.distribution.scored) : '—'}
                    altNot={
                      guven?.last_computed_at
                        ? (tarihMetni(guven.last_computed_at) ?? '')
                        : 'Hesap yok'
                    }
                  />
                  <KpiKutu
                    etiket="Ortalama"
                    deger={
                      guven?.distribution.avg === null ||
                      guven?.distribution.avg === undefined
                        ? '—'
                        : skorMetni(Number(guven.distribution.avg))
                    }
                    altNot="100 üzerinden"
                  />
                  <KpiKutu
                    etiket={`Yüksek güven (${guven?.high_threshold ?? GUVEN_ESIGI}+)`}
                    deger={guven ? sayi(guven.distribution.high) : '—'}
                    altNot={
                      guven
                        ? `Puanlının ${oran(
                            guven.distribution.high,
                            guven.distribution.scored
                          )}`
                        : '—'
                    }
                    vurgu={
                      (guven?.distribution.high ?? 0) > 0 ? 'moss' : 'none'
                    }
                  />
                  <KpiKutu
                    etiket="Açık itiraz"
                    deger={guven ? sayi(guven.appeals.open) : '—'}
                    altNot={
                      guven
                        ? `İncelendi ${sayi(guven.appeals.reviewed)} · kapatıldı ${sayi(
                            guven.appeals.closed
                          )}`
                        : '—'
                    }
                    vurgu={(guven?.appeals.open ?? 0) > 0 ? 'accent' : 'none'}
                  />
                </KpiSatir>

                {(guven?.distribution.not_computed ?? 0) > 0 && (
                  <p className="text-xs text-ink-50 mb-4">
                    {sayi(guven?.distribution.not_computed ?? 0)} yayında
                    sağlayıcının puanı henüz hesaplanmadı (gece hesabını
                    bekliyor).
                  </p>
                )}

                {guvenDagilimiBos ? (
                  <p className="text-sm text-ink-72">Henüz puan yok.</p>
                ) : (
                  <div className="w-full" style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={guvenDagilimi}
                        margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={`${C.ink}14`}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="aralik"
                          tick={{ fontSize: 11, fill: `${C.ink}99` }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: `${C.ink}99` }}
                          allowDecimals={false}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: unknown) => [
                            sayi(Number(v)),
                            'Sağlayıcı',
                          ]}
                        />
                        <Bar dataKey="adet" radius={[4, 4, 0, 0]}>
                          {guvenDagilimi.map((g, i) => (
                            <Cell
                              key={g.aralik}
                              fill={DAGILIM_RENKLERI[i] ?? C.brandInk}
                            />
                          ))}
                          <LabelList
                            dataKey="adet"
                            position="top"
                            style={{ fontSize: 11, fill: `${C.ink}99` }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="mt-5">
                  <VeriTablosu
                    sutunlar={bilesenSutunlari}
                    satirlar={bilesenSatirlari}
                    bosMetin="Bileşen ortalaması yok."
                  />
                </div>

                <p className="font-display text-sm text-ink mt-6 mb-3">
                  İtiraz kuyruğu
                </p>
                {kararHatasi && (
                  <p className="text-sm text-danger mb-3">{kararHatasi}</p>
                )}
                <VeriTablosu
                  sutunlar={kuyrukSutunlari}
                  satirlar={kuyrukSatirlari}
                  bosMetin="İtiraz yok."
                />
              </>
            )}
          </PanelKart>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* ── BLOK 2 — Huni ── */}
            <PanelKart baslik="Huni · talepten rezervasyona">
              <KpiSatir>
                <KpiKutu
                  etiket="Brief → rezervasyon"
                  deger={oran(huni?.booking_created ?? 0, huni?.brief_created ?? 0)}
                  altNot="Tüm pencere"
                />
                <KpiKutu
                  etiket="Gösterim → tıklama"
                  deger={oran(huni?.match_clicked ?? 0, huni?.match_shown ?? 0)}
                  altNot="Aday kartları"
                />
                <KpiKutu
                  etiket="Rezervasyon tamamlanma"
                  deger={oran(
                    huni?.booking_completed ?? 0,
                    huni?.booking_created ?? 0
                  )}
                  altNot="Tamamlanan / oluşan"
                  vurgu="moss"
                />
              </KpiSatir>

              {huniBos ? (
                <p className="text-sm text-ink-72">
                  Bu pencerede huni verisi yok.
                </p>
              ) : (
                <>
                  <div
                    className="w-full"
                    style={{ height: HUNI_ADIMLARI.length * 28 + 24 }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={huniVerisi}
                        layout="vertical"
                        margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={`${C.ink}14`}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: `${C.ink}99` }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="etiket"
                          tick={{ fontSize: 11, fill: `${C.ink}99` }}
                          width={110}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: unknown) => [sayi(Number(v)), 'Sayı']}
                        />
                        <Bar dataKey="sayi" radius={[0, 4, 4, 0]}>
                          {huniVerisi.map((a) => (
                            <Cell
                              key={a.anahtar}
                              fill={
                                a.anahtar === 'booking_completed'
                                  ? C.moss
                                  : C.brandInk
                              }
                            />
                          ))}
                          <LabelList
                            dataKey="sayi"
                            position="right"
                            style={{ fontSize: 11, fill: C.ink }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-5">
                    <VeriTablosu
                      sutunlar={huniSutunlari}
                      satirlar={huniSatirlari}
                      bosMetin="Huni verisi yok."
                    />
                  </div>

                  {/* Adimlar ic ice DEGIL: eslestirme olmadan da secim/teklif olur
                      (havuzdan ekip, dogrudan teklif, RFP). Oran %100'u asabilir;
                      bu bir hata degil, okuyan sasirmasin diye yazilir. */}
                  <p className="mt-4 text-xs text-ink-50 leading-relaxed">
                    Adımlar iç içe değildir: eşleştirme olmadan da seçim ya da
                    teklif olabilir (havuzdan ekip, doğrudan teklif, RFP). Bu
                    yüzden önceki adıma oran %100&apos;ü aşabilir.
                  </p>
                </>
              )}
            </PanelKart>

            {/* ── BLOK 3 — Adalet ── */}
            <PanelKart baslik="Adalet · görünürlük dağılımı">
              {adalet && adalet.shown_total === 0 && (
                <p className="text-sm text-ink-72 mb-4">
                  Bu pencerede eşleştirme gösterimi yok; Match koşusu
                  yapıldıkça dolar.
                </p>
              )}

              <KpiSatir>
                <KpiKutu
                  etiket="Yeni yetenek payı"
                  deger={yuzde(adalet?.new_talent_share ?? null)}
                  altNot="Gösterimlerde"
                  vurgu="accent"
                />
                <KpiKutu
                  etiket="İlk 3'te yeni yetenek"
                  deger={yuzde(adalet?.top3_new_talent_share ?? null)}
                  altNot="Üst sıralarda"
                />
                <KpiKutu
                  etiket="Gini"
                  deger={ondalik3(adalet?.gini ?? null)}
                  altNot="0 eşit dağılım · 1 tek sağlayıcı"
                />
                <KpiKutu
                  etiket="Gösterilen sağlayıcı"
                  deger={sayi(adalet?.providers_shown ?? null)}
                  altNot={`${sayi(adalet?.shown_total ?? null)} toplam gösterim`}
                />
              </KpiSatir>

              <div className="w-full" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={adaletVerisi}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={`${C.ink}14`}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="pencere"
                      tick={{ fontSize: 11, fill: `${C.ink}99` }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: `${C.ink}99` }}
                      width={36}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: unknown, ad: unknown) => [
                        yuzde(Number(v) / 100),
                        String(ad),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="yeniPay"
                      name="Yeni yetenek payı"
                      fill={C.brandInk}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="ilk3Pay"
                      name="İlk 3'te yeni yetenek"
                      fill={C.brandAccent}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-5">
                <VeriTablosu
                  sutunlar={adaletSutunlari}
                  satirlar={adaletSatirlari}
                  bosMetin="Adalet verisi yok."
                />
              </div>

              <p className="mt-4 text-xs text-ink-50 leading-relaxed">
                Yeni yetenek: eşleştirme koşusunda <code>new_talent</code> kodu
                alan sağlayıcı. Gini, sağlayıcı başına gösterim sayısının
                dağılımıdır.
              </p>
            </PanelKart>
          </div>
        </div>
      )}
    </>
  );
}
