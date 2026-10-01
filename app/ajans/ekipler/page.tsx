import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { EKIP_DURUM_ETIKETLERI } from '@/app/etkinliklerim/[id]/ekip-data';

export const metadata = {
  title: 'Ekipler — Kashe',
};

function gunMetni(g: string): string {
  return new Date(g + 'T00:00:00Z').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function AjansEkiplerPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/ajans/ekipler');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const gorulebilir = orgs.filter((o) => o.canViewCrew);
  if (gorulebilir.length === 0) redirect('/profil');

  type EkipRow = {
    id: string;
    event_id: string;
    organization_id: string | null;
    name: string;
    status: string;
    created_at: string;
  };

  const { data: ekipData, error: ekipHatasi } = await supabase
    .from('crews')
    .select('id, event_id, organization_id, name, status, created_at')
    .in(
      'organization_id',
      gorulebilir.map((o) => o.id)
    )
    .order('created_at', { ascending: false });
  if (ekipHatasi) console.error('[ekip] kurulus listesi', ekipHatasi);

  const ekipler = (ekipData ?? []) as unknown as EkipRow[];

  // Uye sayisi: tek sorgu, istemcide gruplanir (ekip sayisi kucuk).
  const uyeSayisi = new Map<string, number>();
  if (ekipler.length > 0) {
    const { data: uyeData } = await supabase
      .from('crew_members')
      .select('id, crew_id')
      .in(
        'crew_id',
        ekipler.map((e) => e.id)
      );
    for (const u of (uyeData ?? []) as { id: string; crew_id: string }[]) {
      uyeSayisi.set(u.crew_id, (uyeSayisi.get(u.crew_id) ?? 0) + 1);
    }
  }

  // Etkinlik ayrintisi: RLS gostermeyebilir (FAZ 8 oncesi `events.organization_id`
  // NULL; kurulus uyesi sahibi degilse satir gelmez). Gelmezse satir yine listelenir.
  type EtkinlikRow = {
    id: string;
    title: string | null;
    start_date: string | null;
    city_id: number | null;
  };
  const etkinlikMap = new Map<string, EtkinlikRow>();
  if (ekipler.length > 0) {
    const { data: evData } = await supabase
      .from('events')
      .select('id, title, start_date, city_id')
      .in(
        'id',
        ekipler.map((e) => e.event_id)
      );
    for (const e of (evData ?? []) as EtkinlikRow[]) etkinlikMap.set(e.id, e);
  }

  const sehirIdleri = [
    ...new Set(
      [...etkinlikMap.values()]
        .map((e) => e.city_id)
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

  const kurulusAdlari = new Map(gorulebilir.map((o) => [o.id, o.name]));

  return (
    <>
      <TopNav />
      <main className="bg-paper min-h-screen px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              {gorulebilir.map((o) => o.name).join(' · ')}
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-brand-ink not-italic italic font-medium">
                Ekipler
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Kuruluşunun etkinlikler için kurduğu ekipler. Ekip ayrıntısı
              etkinlik sayfasında.
            </p>
          </header>

          {ekipler.length === 0 ? (
            <div className="bg-card border border-line rounded-lg p-6 text-sm text-ink-72">
              Henüz ekip yok. Ekip, etkinlik sayfasındaki &quot;Ekip&quot;
              bölümünden kurulur.
            </div>
          ) : (
            <div className="space-y-3">
              {ekipler.map((e) => {
                const etkinlik = etkinlikMap.get(e.event_id) ?? null;
                const sehirAdi =
                  etkinlik?.city_id != null
                    ? (sehirMap.get(etkinlik.city_id) ?? null)
                    : null;
                const baslik =
                  etkinlik?.title?.trim() ||
                  (etkinlik ? 'Başlıksız etkinlik' : null);
                const govde = (
                  <div className="bg-card border border-line rounded-lg p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink">
                          {e.name}
                          {e.organization_id && (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
                              {kurulusAdlari.get(e.organization_id) ?? ''}
                            </span>
                          )}
                        </p>
                        {baslik ? (
                          <p className="text-sm text-ink-72 mt-0.5">
                            {[
                              baslik,
                              sehirAdi,
                              etkinlik?.start_date
                                ? gunMetni(etkinlik.start_date)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : (
                          <p className="text-sm text-ink-72 mt-0.5">
                            Etkinlik ayrıntısı görünmüyor (sahibi değilsin)
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                          {EKIP_DURUM_ETIKETLERI[e.status] ?? e.status}
                        </p>
                        <p className="text-sm text-ink-72 mt-0.5">
                          {uyeSayisi.get(e.id) ?? 0} üye
                        </p>
                      </div>
                    </div>
                  </div>
                );

                // Etkinlik satiri RLS'ten geldiyse detaya baglanir; gelmediyse baglanti yok.
                return etkinlik ? (
                  <Link
                    key={e.id}
                    href={`/etkinliklerim/${e.event_id}`}
                    className="block hover:opacity-90 transition-opacity"
                  >
                    {govde}
                  </Link>
                ) : (
                  <div key={e.id}>{govde}</div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
