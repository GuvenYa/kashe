import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase-server';

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
        ? [
            gunMetni(etkinlik.start_date),
            etkinlik.end_date ? gunMetni(etkinlik.end_date) : null,
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
                  const kesfetLinki =
                    '/kesfet' +
                    sorguDizesi([
                      ['kategori', kategoriId],
                      ['sehir', etkinlik.city_id],
                      ['etkinlik', etkinlik.event_type],
                    ]);
                  const teklifLinki =
                    '/teklif-topla' +
                    sorguDizesi([
                      ['tur', etkinlik.event_type],
                      ['sehir', etkinlik.city_id],
                      ['tarih', etkinlik.start_date],
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
                          href="/ilanlar/yeni"
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
