import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { EKIP_DURUM_ETIKETLERI } from '@/app/etkinliklerim/[id]/ekip-data';
import { VurguEtiketi } from '@/app/components/ui/vurgu-etiketi';

/** Ekip kurulabilecek etkinlik durumlari (liste satirindaki kisa etiket). */
const ETKINLIK_DURUMU: Record<string, string> = {
  confirmed: 'Onaylandı',
  matching: 'Eşleştiriliyor',
  booked: 'Rezerve',
  running: 'Devam ediyor',
};

export const metadata = {
  title: 'Ekip yönetimi — Kashe',
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

  /**
   * Duzeltme 15-C (bulgu 130): "Yeni ekip" buradan baslar. Ekip kurulabilecek
   * etkinlikler = ekip yonetme yetkisi olan kurulusun, suren (onayli /
   * eslesen / rezerve / devam eden) ve HENUZ ekibi olmayan etkinlikleri. Ekip
   * etkinligin Adaylar sekmesinde kurulur; satir dogrudan oraya gider.
   */
  const yonetilebilir = gorulebilir.filter((o) => o.canManageCrew);
  type AdayEtkinlik = EtkinlikRow & {
    status: string;
    organization_id: string | null;
  };
  let ekipsizEtkinlikler: AdayEtkinlik[] = [];
  if (yonetilebilir.length > 0) {
    const { data: adayData } = await supabase
      .from('events')
      .select('id, title, start_date, city_id, status, organization_id')
      .in(
        'organization_id',
        yonetilebilir.map((o) => o.id)
      )
      .in('status', ['confirmed', 'matching', 'booked', 'running'])
      .order('start_date', { ascending: true, nullsFirst: false })
      .limit(50);
    const ekipliEtkinlikler = new Set(ekipler.map((e) => e.event_id));
    ekipsizEtkinlikler = ((adayData ?? []) as AdayEtkinlik[]).filter(
      (e) => !ekipliEtkinlikler.has(e.id)
    );
  }
  const yeniEtkinlikKurulusu = gorulebilir.find((o) => o.canManageEvents);

  const sehirIdleri = [
    ...new Set(
      [...etkinlikMap.values(), ...ekipsizEtkinlikler]
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

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-4xl">
          <PanelBaslik
            eyebrow={<>{gorulebilir.map((o) => o.name).join(' · ')}</>}
            altNot="Etkinliklerin için kurduğun ekipler ve ekip bekleyen etkinlikler. Bir ekibe tıklayınca etkinliğin ekip ayrıntısı açılır."
          >
            <em className="not-italic font-medium text-brand-accent">Ekip</em>{' '}
            yönetimi
          </PanelBaslik>

          {/* Duzeltme 15-C: yeni ekip bu sayfadan baslar. */}
          {yonetilebilir.length > 0 && (
            <section className="bg-card border border-line rounded-xl p-5 mb-8">
              <VurguEtiketi>Yeni ekip kur</VurguEtiketi>
              {ekipsizEtkinlikler.length === 0 ? (
                <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-ink-72">
                    Ekip bekleyen etkinlik yok. Ekip bir etkinlik için kurulur;
                    önce etkinliği oluştur.
                  </p>
                  {yeniEtkinlikKurulusu && (
                    <Link
                      href={`/etkinlik-sihirbazi?kurulus=${yeniEtkinlikKurulusu.id}`}
                      className="kashe-tap shrink-0 px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
                    >
                      Yeni etkinlik →
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-ink-72 mt-2 mb-3">
                    Ekibi olmayan {ekipsizEtkinlikler.length} etkinlik var.
                    Birini seç; Kashe AI adayları önerir, ekibi oradan kurarsın.
                  </p>
                  <ul className="divide-y divide-line border border-line rounded-lg">
                    {ekipsizEtkinlikler.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap"
                      >
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-sm text-ink break-words">
                            {e.title?.trim() || 'Başlıksız etkinlik'}
                          </p>
                          <p className="text-xs text-ink-72 mt-0.5">
                            {[
                              e.city_id != null
                                ? (sehirMap.get(e.city_id) ?? null)
                                : null,
                              e.start_date ? gunMetni(e.start_date) : 'Tarih belli değil',
                              ETKINLIK_DURUMU[e.status] ?? null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <Link
                          href={`/etkinliklerim/${e.id}?sekme=adaylar`}
                          className="kashe-tap shrink-0 px-3.5 py-2 bg-brand-accent text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity"
                        >
                          Ekip kur →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <VurguEtiketi>Kurulan ekipler</VurguEtiketi>
          <div className="h-3" />
          {ekipler.length === 0 ? (
            <div className="bg-card border border-line rounded-lg p-6 text-sm text-ink-72">
              Henüz ekip kurulmadı.
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
                    href={`/etkinliklerim/${e.event_id}?sekme=ekip`}
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
    </PanelKabugu>
  );
}
