import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase-server';
import { STATUS_LABELS as TALEP_DURUMLARI } from '@/app/teklif-taleplerim/page';
import { LISTING_STATUS_OPTIONS } from '@/app/ilanlar/listings-data';
import { getCrewContext } from '@/app/lib/org-context';
import { AdayPaneli } from './aday-paneli';
import { EkipPaneli } from './ekip-paneli';
import type {
  EkipRolBloku,
  EkipSatiri,
  EkipUyesi,
  KapsamSatiri,
  UyeKarti,
} from './ekip-data';
import {
  gerekceEtiketleri,
  kapsamYuzdesi,
  uyumYuzdesi,
  type AdayKarti,
  type AdayKosu,
  type AdayRolGrubu,
  type AdaySaglayici,
  type AdaySatiri,
} from './aday-data';

export const metadata = {
  title: 'Etkinlik — Kashe',
};

const DURUM_ETIKETLERI: Record<string, string> = {
  draft: 'Taslak',
  confirmed: 'Onaylandı',
  matching: 'Eşleştiriliyor',
  booked: 'Rezerve',
  running: 'Devam ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

const MEKAN_ETIKETLERI: Record<string, string> = {
  confirmed: 'Mekan belli',
  searching: 'Mekan aranıyor',
  not_needed: 'Mekan gerekmiyor',
};

const ACILIYET_ETIKETLERI: Record<string, string> = {
  urgent: 'Acil',
  flexible: 'Esnek',
};

/**
 * Ilan durum etiketleri. Kaynak `listings-data.ts` — ilan alan adlarinin ve
 * sabitlerinin yasadigi, istemciye bagli OLMAYAN modul. (Sekme listesi
 * `ilanlarim-listesi.tsx` icinde ama o dosya `'use client'`; oradan sunucu
 * bilesenine import etmek sayfa verisi toplamayi kiriyor.)
 */
const ILAN_DURUMLARI: Record<string, string> = Object.fromEntries(
  LISTING_STATUS_OPTIONS.map((o) => [o.key, o.label])
);

type Gereksinim = {
  id: string;
  quantity: number;
  is_required: boolean;
  sort_order: number | null;
  notes: string | null;
  service_roles: {
    id: number;
    slug: string;
    name_tr: string;
    legacy_category_id: number | null;
  } | null;
};

type Etkinlik = {
  id: string;
  /** FAZ 6/P1: eslestirmeyi yalniz sahip calistirir. */
  owner_user_id: string;
  title: string | null;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  is_date_flexible: boolean;
  city_id: number | null;
  district: string | null;
  venue_status: string | null;
  participant_count: number | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: string | null;
  status: string;
  extra: Record<string, unknown> | null;
  spec_version_id: string | null;
  event_types: { name_tr: string } | null;
  turkish_cities: { name: string } | null;
  event_requirements: Gereksinim[] | null;
  event_spec_versions: { version_no: number } | null;
};

function gunMetni(g: string): string {
  return new Date(g + 'T00:00:00Z').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Bos parametreler atlanarak sorgu dizesi kurar. */
function sorguDizesi(girdiler: [string, string | number | null | undefined][]) {
  const p = new URLSearchParams();
  for (const [k, v] of girdiler) {
    if (v === null || v === undefined || v === '') continue;
    p.set(k, String(v));
  }
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

export default async function EtkinlikDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect(`/giris?redirect=/etkinliklerim/${id}`);

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // RLS: sahip / kurulus events.view / admin. Yetkisiz kullanici icin satir gelmez.
  const { data } = await supabase
    .from('events')
    .select(
      `
      *,
      event_types (name_tr),
      turkish_cities (name),
      event_spec_versions (version_no),
      event_requirements (
        id, quantity, is_required, sort_order, notes,
        service_roles (id, slug, name_tr, legacy_category_id)
      )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  const etkinlik = data as unknown as Etkinlik;

  const turAdi = etkinlik.event_types?.name_tr ?? etkinlik.event_type;
  const sehirAdi = etkinlik.turkish_cities?.name ?? null;
  const gereksinimler = [...(etkinlik.event_requirements ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  // FAZ 4c/P3 — bagli kayitlar. RLS ne gosteriyorsa o (kendi/kurulus/admin);
  // bag kurulmamis kayitlar burada gorunmez.
  type BagliTalep = {
    id: string;
    status: string;
    created_at: string;
    recipient_count: number;
    category_id: number | null;
    service_categories: { name_tr: string } | null;
  };
  type BagliIlan = {
    id: string;
    title: string;
    status: string;
    created_at: string;
  };
  type BagliSohbet = {
    id: string;
    professional_id: string;
    last_message_at: string | null;
    profiles: { full_name: string | null; company_name: string | null } | null;
  };

  const [talepRes, ilanRes, sohbetRes] = await Promise.all([
    supabase
      .from('quote_requests')
      .select(
        'id, status, created_at, recipient_count, category_id, service_categories(name_tr)'
      )
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('listings').select('id, title, status, created_at').eq('event_id', id),
    supabase
      .from('conversations')
      .select(
        'id, professional_id, last_message_at, profiles!conversations_professional_id_fkey(full_name, company_name)'
      )
      .eq('event_id', id),
  ]);

  const talepler = (talepRes.data ?? []) as unknown as BagliTalep[];
  const ilanlar = (ilanRes.data ?? []) as unknown as BagliIlan[];
  const sohbetler = (sohbetRes.data ?? []) as unknown as BagliSohbet[];
  const bagliVar =
    talepler.length > 0 || ilanlar.length > 0 || sohbetler.length > 0;

  // ---- FAZ 6/P1 — eslestirme kosulari ve adaylar ----
  // Skor/siralama DB'de uretildi; burada YALNIZ okuma + gosterim birlestirmesi var.
  // `match_*` tablolarina yazma YOK (yetki de yok); kosu `run_event_match` ile.
  const sahip = etkinlik.owner_user_id === user.id;
  const durumUygun =
    etkinlik.status === 'confirmed' || etkinlik.status === 'matching';

  const { data: kosuData, error: kosuHatasi } = await supabase
    .from('match_runs')
    .select('id, strategy, algorithm_version, candidate_count, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false });
  if (kosuHatasi) console.error('[match] kosu listesi', kosuHatasi);

  const kosular = (kosuData ?? []) as unknown as AdayKosu[];
  const sonKosu = kosular[0] ?? null;
  const oncekiKosular = kosular.slice(1);

  let ajansAdaylari: AdayKarti[] = [];
  let rolGruplari: AdayRolGrubu[] = [];

  if (sonKosu) {
    const { data: adayData, error: adayHatasi } = await supabase
      .from('match_candidates')
      .select(
        `id, provider_id, role_id, match_score, coverage_ratio,
         full_service_eligible, final_rank, reason_codes, was_shown, was_clicked`
      )
      .eq('match_run_id', sonKosu.id)
      .order('final_rank');
    if (adayHatasi) console.error('[match] aday listesi', adayHatasi);

    const adaylar = (adayData ?? []) as unknown as AdaySatiri[];
    const saglayiciIdleri = [...new Set(adaylar.map((a) => a.provider_id))];

    // Pazaryeri bilgisi gorunumden (FAZ 2c sozlesmesi), profiles'tan DEGIL.
    let saglayicilar: AdaySaglayici[] = [];
    if (saglayiciIdleri.length > 0) {
      const { data: sagData, error: sagHatasi } = await supabase
        .from('v_providers_public')
        .select(
          'id, display_name, provider_slug, city_id, avatar_url, provider_type, headline'
        )
        .in('id', saglayiciIdleri);
      if (sagHatasi) console.error('[match] saglayici bilgisi', sagHatasi);
      saglayicilar = (sagData ?? []) as unknown as AdaySaglayici[];
    }
    const saglayiciMap = new Map(saglayicilar.map((s) => [s.id, s]));

    const sehirIdleri = [
      ...new Set(
        saglayicilar
          .map((s) => s.city_id)
          .filter((v): v is number => typeof v === 'number')
      ),
    ];
    const sehirMap = new Map<number, string>();
    if (sehirIdleri.length > 0) {
      const { data: sehirData } = await supabase
        .from('turkish_cities')
        .select('id, name')
        .in('id', sehirIdleri);
      for (const s of (sehirData ?? []) as { id: number; name: string }[]) {
        sehirMap.set(s.id, s.name);
      }
    }

    const kart = (a: AdaySatiri): AdayKarti => {
      const s = saglayiciMap.get(a.provider_id);
      return {
        id: a.id,
        providerId: a.provider_id,
        ad: s?.display_name?.trim() || 'İsimsiz profil',
        sehir: s?.city_id != null ? (sehirMap.get(s.city_id) ?? null) : null,
        headline: s?.headline?.trim() || null,
        uyum: uyumYuzdesi(a.match_score),
        kapsam: kapsamYuzdesi(a.coverage_ratio),
        tamHizmet: a.full_service_eligible,
        gerekceler: gerekceEtiketleri(a.reason_codes),
        wasShown: a.was_shown,
      };
    };

    // Siralama DB'den (`final_rank`); filtreleme sirayi korur.
    ajansAdaylari = adaylar.filter((a) => a.role_id === null).map(kart);
    rolGruplari = gereksinimler
      .filter((g) => g.service_roles != null)
      .map((g) => ({
        roleId: g.service_roles!.id,
        rolAdi: g.service_roles!.name_tr,
        ihtiyac: g.quantity,
        zorunlu: g.is_required,
        adaylar: adaylar
          .filter((a) => a.role_id === g.service_roles!.id)
          .map(kart),
      }));
  }

  // ---- FAZ 6/P2 — ekip ----
  // Yazim RLS ile (action'lar); burada yalniz okuma. Ekip yoksa ve sahip degilse
  // bolum render edilmez. V0: etkinlik basina TEK ekip (DB coklu ekibe izin verir).
  const { orgs: ekipKuruluslari } = await getCrewContext();

  const { data: ekipData, error: ekipHatasi } = await supabase
    .from('crews')
    .select(
      'id, event_id, organization_id, name, status, source_policy, objective, created_at'
    )
    .eq('event_id', id)
    .order('created_at');
  if (ekipHatasi) console.error('[ekip] liste', ekipHatasi);

  const ekip = ((ekipData ?? []) as unknown as EkipSatiri[])[0] ?? null;

  let ekipUyeleri: UyeKarti[] = [];
  let kapsam: KapsamSatiri[] = [];
  let rolBloklari: EkipRolBloku[] = [];

  const rolSlugAdlari: Record<string, string> = {};
  for (const g of gereksinimler) {
    if (g.service_roles) rolSlugAdlari[g.service_roles.slug] = g.service_roles.name_tr;
  }

  const ekipKurulusu = ekip?.organization_id
    ? (ekipKuruluslari.find((o) => o.id === ekip.organization_id) ?? null)
    : null;

  if (ekip) {
    const { data: uyeData, error: uyeHatasi } = await supabase
      .from('crew_members')
      .select(
        `id, crew_id, role_id, talent_record_id, provider_id, pool_origin, status,
         is_locked, sort_order, note, match_candidate_id, created_at`
      )
      .eq('crew_id', ekip.id)
      .order('sort_order')
      .order('created_at');
    if (uyeHatasi) console.error('[ekip] uyeler', uyeHatasi);

    const uyeSatirlari = (uyeData ?? []) as unknown as EkipUyesi[];

    // Kisi bilgisi: pazaryeri saglayicisi gorunumden, havuz kaydi adi RLS ile.
    const uyeSaglayiciIdleri = [
      ...new Set(
        uyeSatirlari
          .map((u) => u.provider_id)
          .filter((v): v is string => !!v)
      ),
    ];
    const uyeKayitIdleri = [
      ...new Set(
        uyeSatirlari
          .map((u) => u.talent_record_id)
          .filter((v): v is string => !!v)
      ),
    ];

    const uyeSaglayiciMap = new Map<
      string,
      { display_name: string | null; city_id: number | null }
    >();
    if (uyeSaglayiciIdleri.length > 0) {
      const { data: sagData } = await supabase
        .from('v_providers_public')
        .select('id, display_name, city_id')
        .in('id', uyeSaglayiciIdleri);
      for (const s of (sagData ?? []) as {
        id: string;
        display_name: string | null;
        city_id: number | null;
      }[]) {
        uyeSaglayiciMap.set(s.id, {
          display_name: s.display_name,
          city_id: s.city_id,
        });
      }
    }

    const uyeKayitMap = new Map<string, string>();
    if (uyeKayitIdleri.length > 0) {
      const { data: kayitData } = await supabase
        .from('organization_talent_records')
        .select('id, name')
        .in('id', uyeKayitIdleri);
      for (const k of (kayitData ?? []) as { id: string; name: string }[]) {
        uyeKayitMap.set(k.id, k.name);
      }
    }

    const uyeSehirIdleri = [
      ...new Set(
        [...uyeSaglayiciMap.values()]
          .map((s) => s.city_id)
          .filter((v): v is number => typeof v === 'number')
      ),
    ];
    const uyeSehirMap = new Map<number, string>();
    if (uyeSehirIdleri.length > 0) {
      const { data: sehirData } = await supabase
        .from('turkish_cities')
        .select('id, name')
        .in('id', uyeSehirIdleri);
      for (const s of (sehirData ?? []) as { id: number; name: string }[]) {
        uyeSehirMap.set(s.id, s.name);
      }
    }

    const rolAdiById = new Map<number, string>();
    for (const g of gereksinimler) {
      if (g.service_roles) rolAdiById.set(g.service_roles.id, g.service_roles.name_tr);
    }

    ekipUyeleri = uyeSatirlari.map((u) => {
      const sag = u.provider_id ? uyeSaglayiciMap.get(u.provider_id) : null;
      const kayitAdi = u.talent_record_id
        ? uyeKayitMap.get(u.talent_record_id)
        : null;
      // Iki kaynagi da silinmis uye kalabilir (FK SET NULL; asama14 K7).
      const ad =
        kayitAdi?.trim() ||
        sag?.display_name?.trim() ||
        (u.provider_id || u.talent_record_id
          ? 'İsimsiz üye'
          : 'Kaynağı silinmiş üye');
      return {
        id: u.id,
        roleId: u.role_id,
        rolAdi: rolAdiById.get(u.role_id) ?? 'Rol',
        ad,
        sehir:
          sag?.city_id != null ? (uyeSehirMap.get(sag.city_id) ?? null) : null,
        kaynak: u.pool_origin,
        durum: u.status,
        kilitli: u.is_locked,
        not: u.note,
        providerId: u.provider_id,
        havuzKaydiVar: !!u.talent_record_id,
      };
    });

    kapsam = gereksinimler
      .filter((g) => g.service_roles != null)
      .map((g) => ({
        roleId: g.service_roles!.id,
        rolAdi: g.service_roles!.name_tr,
        gereken: g.quantity,
        onaylanan: uyeSatirlari.filter(
          (u) => u.role_id === g.service_roles!.id && u.status === 'confirmed'
        ).length,
        zorunlu: g.is_required,
      }));

    // Havuzdan ekleme: yalniz kurulus ekibi + talent.view + modul acik (RLS de kisitlar).
    const havuzAcik =
      !!ekip.organization_id &&
      !!ekipKurulusu?.canViewTalent &&
      !!ekipKurulusu?.talentPoolEnabled;

    type HavuzKayitSatiri = {
      id: string;
      name: string;
      status: string;
      organization_talent_record_roles: { role_id: number }[] | null;
    };
    let havuzKayitlari: HavuzKayitSatiri[] = [];
    if (havuzAcik) {
      const { data: havuzData, error: havuzHatasi } = await supabase
        .from('organization_talent_records')
        .select('id, name, status, organization_talent_record_roles(role_id)')
        .eq('organization_id', ekip.organization_id!)
        .neq('status', 'blocked')
        .order('name');
      if (havuzHatasi) console.error('[ekip] havuz listesi', havuzHatasi);
      havuzKayitlari = (havuzData ?? []) as unknown as HavuzKayitSatiri[];
    }

    rolBloklari = gereksinimler
      .filter((g) => g.service_roles != null)
      .map((g) => {
        const roleId = g.service_roles!.id;
        const grup = rolGruplari.find((r) => r.roleId === roleId);
        return {
          roleId,
          rolAdi: g.service_roles!.name_tr,
          gereken: g.quantity,
          zorunlu: g.is_required,
          adaylar: (grup?.adaylar ?? []).map((a) => ({
            candidateId: a.id,
            providerId: a.providerId,
            ad: a.ad,
            uyum: a.uyum,
            ekipte: uyeSatirlari.some(
              (u) => u.role_id === roleId && u.provider_id === a.providerId
            ),
          })),
          // Rolu atanmis kayitlar once, digerleri altta ("rolu yok" notuyla).
          havuz: [...havuzKayitlari]
            .map((k) => ({
              recordId: k.id,
              ad: k.name,
              roldeVar: (k.organization_talent_record_roles ?? []).some(
                (r) => r.role_id === roleId
              ),
            }))
            .sort((a, b) => Number(b.roldeVar) - Number(a.roldeVar)),
        };
      });
  }

  const ekstra = (etkinlik.extra ?? {}) as Record<string, unknown>;
  const tarihNotu =
    typeof ekstra.date_note === 'string' ? ekstra.date_note : null;
  const sehirNotu =
    typeof ekstra.city_note === 'string' ? ekstra.city_note : null;

  const baslik =
    etkinlik.title || [turAdi, sehirAdi].filter(Boolean).join(' · ') || turAdi;

  const satirlar: { etiket: string; deger: string }[] = [
    { etiket: 'Tür', deger: turAdi },
    {
      etiket: 'Tarih',
      deger: etkinlik.start_date
        ? // Bitis = baslangic ise tek tarih gosterilir (ok isareti yok).
          [
            gunMetni(etkinlik.start_date),
            etkinlik.end_date && etkinlik.end_date !== etkinlik.start_date
              ? gunMetni(etkinlik.end_date)
              : null,
          ]
            .filter(Boolean)
            .join(' → ') + (etkinlik.is_date_flexible ? ' (esnek)' : '')
        : etkinlik.is_date_flexible
          ? 'Esnek'
          : 'Belirtilmedi',
    },
    {
      etiket: 'Şehir',
      deger: [sehirAdi ?? 'Belirtilmedi', etkinlik.district]
        .filter(Boolean)
        .join(' / '),
    },
    {
      etiket: 'Katılımcı',
      deger: etkinlik.participant_count
        ? `${etkinlik.participant_count} kişi`
        : 'Belirtilmedi',
    },
    {
      etiket: 'Bütçe',
      deger:
        etkinlik.budget_min != null || etkinlik.budget_max != null
          ? `${etkinlik.budget_min ?? '?'} – ${etkinlik.budget_max ?? '?'} TL`
          : 'Belirtilmedi',
    },
    {
      etiket: 'Mekan',
      deger: etkinlik.venue_status
        ? MEKAN_ETIKETLERI[etkinlik.venue_status] ?? etkinlik.venue_status
        : 'Belirtilmedi',
    },
  ];
  if (etkinlik.urgency && etkinlik.urgency !== 'normal') {
    satirlar.push({
      etiket: 'Aciliyet',
      deger: ACILIYET_ETIKETLERI[etkinlik.urgency] ?? etkinlik.urgency,
    });
  }

  return (
    <>
      <TopNav />
      <div className="bg-paper min-h-screen">
        <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
          <Link
            href="/etkinliklerim"
            className="kashe-tap text-sm text-brand-ink hover:underline"
          >
            ← Etkinliklerim
          </Link>

          <div className="mt-4 mb-8">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink bg-brand-ink/8 px-2 py-0.5 rounded">
                {turAdi}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                {DURUM_ETIKETLERI[etkinlik.status] ?? etkinlik.status}
              </span>
            </div>
            <h1 className="font-display text-4xl text-ink leading-tight">
              {baslik}
            </h1>
          </div>

          {/* Alanlar */}
          <div className="bg-card border border-line rounded-lg p-6">
            <dl className="space-y-3">
              {satirlar.map((s) => (
                <div
                  key={s.etiket}
                  className="flex items-start justify-between gap-4 flex-wrap"
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                    {s.etiket}
                  </dt>
                  <dd className="text-sm text-ink text-right">{s.deger}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Notlar — AI'nin cikardigi ama alana donusmeyen ipuclari */}
          {(tarihNotu || sehirNotu) && (
            <div className="mt-6 bg-card border border-line rounded-lg p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
                Notlar
              </p>
              <ul className="space-y-2 text-sm text-ink-72">
                {tarihNotu && <li>Tarih: {tarihNotu}</li>}
                {sehirNotu && <li>Şehir: {sehirNotu}</li>}
              </ul>
            </div>
          )}

          {/* İhtiyaçlar */}
          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
              İhtiyaçlar
            </p>
            {gereksinimler.length === 0 ? (
              <div className="bg-card border border-line rounded-lg p-6 text-sm text-ink-72">
                Bu etkinlikte ihtiyaç kaydı yok.
              </div>
            ) : (
              <div className="space-y-3">
                {gereksinimler.map((g) => {
                  const rol = g.service_roles;
                  const kategoriId = rol?.legacy_category_id ?? null;
                  // FAZ 4c/P3: baglar — `etkinlik` kesfet'te TUR demek oldugu icin
                  // orada `etkinlik_id` kullanilir.
                  const kesfetLinki =
                    '/kesfet' +
                    sorguDizesi([
                      ['kategori', kategoriId],
                      ['sehir', etkinlik.city_id],
                      ['etkinlik', etkinlik.event_type],
                      ['etkinlik_id', etkinlik.id],
                    ]);
                  const teklifLinki =
                    '/teklif-topla' +
                    sorguDizesi([
                      ['tur', etkinlik.event_type],
                      ['sehir', etkinlik.city_id],
                      ['tarih', etkinlik.start_date],
                      ['kategori', kategoriId],
                      ['etkinlik', etkinlik.id],
                      ['butce_min', etkinlik.budget_min],
                      ['butce_max', etkinlik.budget_max],
                    ]);
                  const ilanLinki =
                    '/ilanlar/yeni' +
                    sorguDizesi([
                      ['etkinlik', etkinlik.id],
                      ['kategori', kategoriId],
                    ]);
                  return (
                    <div
                      key={g.id}
                      className="bg-card border border-line rounded-lg p-5"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                        <div>
                          <p className="font-display font-semibold text-ink">
                            {rol?.name_tr ?? 'Rol'}
                          </p>
                          <p className="text-sm text-ink-72 mt-0.5">
                            {g.quantity} kişi ·{' '}
                            {g.is_required ? 'zorunlu' : 'isteğe bağlı'}
                          </p>
                          {g.notes && (
                            <p className="text-sm text-ink-72 mt-1">{g.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          href={kesfetLinki}
                          className="kashe-tap text-sm text-brand-ink hover:underline"
                        >
                          Keşfet
                        </Link>
                        <Link
                          href={teklifLinki}
                          className="kashe-tap text-sm text-brand-ink hover:underline"
                        >
                          Teklif topla
                        </Link>
                        <Link
                          href={ilanLinki}
                          className="kashe-tap text-sm text-brand-ink hover:underline"
                        >
                          İlan aç
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Adaylar — FAZ 6/P1. Kosu yoksa ve sahip degilse bolum HIC render edilmez. */}
          {(sonKosu || sahip) && (
            <div className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
                Adaylar
              </p>
              <AdayPaneli
                eventId={etkinlik.id}
                sahip={sahip}
                durumUygun={durumUygun}
                sonKosu={sonKosu}
                oncekiKosular={oncekiKosular}
                ajansAdaylari={ajansAdaylari}
                rolGruplari={rolGruplari}
              />
            </div>
          )}

          {/* Ekip — FAZ 6/P2. Ekip yoksa ve sahip degilse bolum HIC render edilmez. */}
          {(ekip || sahip) && (
            <div className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
                Ekip
              </p>
              <EkipPaneli
                eventId={etkinlik.id}
                sahip={sahip}
                ekip={ekip}
                uyeler={ekipUyeleri}
                kapsam={kapsam}
                rolBloklari={rolBloklari}
                rolAdlari={rolSlugAdlari}
                kurulusSecenekleri={ekipKuruluslari
                  .filter((o) => o.canManageCrew)
                  .map((o) => ({ id: o.id, name: o.name }))}
                yazabilir={sahip || !!ekipKurulusu?.canManageCrew}
                havuzdanEklenebilir={
                  !!ekip?.organization_id &&
                  !!ekipKurulusu?.canViewTalent &&
                  !!ekipKurulusu?.talentPoolEnabled
                }
                maliyetGorulur={
                  !!ekip?.organization_id && !!ekipKurulusu?.canSeeRates
                }
                maliyetYazilir={
                  !!ekip?.organization_id && !!ekipKurulusu?.canManageRates
                }
              />
            </div>
          )}

          {/* Bagli kayitlar — etkinlikten baslatilan talep / ilan / sohbet */}
          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
              Bağlı kayıtlar
            </p>
            {!bagliVar ? (
              <div className="bg-card border border-line rounded-lg p-6 text-sm text-ink-72">
                Henüz bağlı talep/ilan/sohbet yok.
              </div>
            ) : (
              <div className="space-y-3">
                {talepler.map((t) => (
                  <Link
                    key={t.id}
                    href={`/teklif-taleplerim/${t.id}`}
                    className="block bg-card border border-line rounded-lg p-4 hover:border-brand-ink transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm text-ink">
                        Teklif talebi
                        {t.service_categories?.name_tr
                          ? ` · ${t.service_categories.name_tr}`
                          : ''}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                        {TALEP_DURUMLARI[t.status] ?? t.status} ·{' '}
                        {t.recipient_count} profesyonel
                      </span>
                    </div>
                  </Link>
                ))}
                {ilanlar.map((i) => (
                  <Link
                    key={i.id}
                    href={`/ilanlar/${i.id}`}
                    className="block bg-card border border-line rounded-lg p-4 hover:border-brand-ink transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm text-ink">İlan · {i.title}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                        {ILAN_DURUMLARI[i.status] ?? i.status}
                      </span>
                    </div>
                  </Link>
                ))}
                {sohbetler.map((s) => (
                  <Link
                    key={s.id}
                    href={`/mesajlar/${s.id}`}
                    className="block bg-card border border-line rounded-lg p-4 hover:border-brand-ink transition-colors"
                  >
                    <span className="text-sm text-ink">
                      Sohbet ·{' '}
                      {s.profiles?.company_name ||
                        s.profiles?.full_name ||
                        'Profesyonel'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {etkinlik.event_spec_versions?.version_no != null && (
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
              EventSpec sürümü: v{etkinlik.event_spec_versions.version_no}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
