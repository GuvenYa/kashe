import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { tarihMetni, zamanMetni, KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { YeniRfp, type RfpEtkinlik } from './yeni-rfp';
import {
  RFP_DURUM_ETIKETLERI,
  RFP_DURUM_SINIFLARI,
  sonTarihGecti,
  type RfpListeSatiri,
} from './rfp-data';

export const metadata = {
  title: 'Teklif talepleri (RFP) — Kashe',
};

/** `datetime-local` icin +7 gun (Istanbul). */
function yediGunSonra(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const p = new Intl.DateTimeFormat('tr-TR', {
    timeZone: KASHE_SAAT_DILIMI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const al = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${al('year')}-${al('month')}-${al('day')}T${al('hour')}:${al('minute')}`;
}

export default async function KurumsalRfpPage({
  searchParams,
}: {
  searchParams: Promise<{ etkinlik?: string }>;
}) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/kurumsal/rfp');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const gorulebilir = orgs.filter((o) => o.canViewEvents);
  if (gorulebilir.length === 0) redirect('/profil');

  const yonetilebilir = orgs.filter((o) => o.canManageEvents);

  const { data: rfpData, error: rfpHatasi } = await supabase
    .from('rfps')
    .select(
      `id, title, status, deadline, created_at, organization_id,
       event:events(id, title, start_date)`
    )
    .in(
      'organization_id',
      gorulebilir.map((o) => o.id)
    )
    .order('created_at', { ascending: false });
  if (rfpHatasi) console.error('[rfp] liste', rfpHatasi);

  const talepler = (rfpData ?? []) as unknown as RfpListeSatiri[];

  // Davet/yanit sayilari — tek sorgu (RLS: alici kendi taleplerinin davetlerini gorur).
  const davetSayisi = new Map<string, { toplam: number; yanit: number }>();
  if (talepler.length > 0) {
    const { data: davetData } = await supabase
      .from('rfp_invites')
      .select('rfp_id, status')
      .in(
        'rfp_id',
        talepler.map((t) => t.id)
      );
    for (const d of (davetData ?? []) as { rfp_id: string; status: string }[]) {
      const mevcut = davetSayisi.get(d.rfp_id) ?? { toplam: 0, yanit: 0 };
      mevcut.toplam += 1;
      if (d.status === 'responded') mevcut.yanit += 1;
      davetSayisi.set(d.rfp_id, mevcut);
    }
  }

  // Yeni talep formu icin kurulusun etkinlikleri (iptal olmayanlar).
  let etkinlikler: RfpEtkinlik[] = [];
  if (yonetilebilir.length > 0) {
    const { data: evData, error: evHatasi } = await supabase
      .from('events')
      .select('id, title, event_type, start_date, organization_id, status')
      .in(
        'organization_id',
        yonetilebilir.map((o) => o.id)
      )
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    if (evHatasi) console.error('[rfp] etkinlik listesi', evHatasi);
    etkinlikler = (
      (evData ?? []) as {
        id: string;
        title: string | null;
        event_type: string;
        start_date: string | null;
        organization_id: string | null;
      }[]
    ).map((e) => ({
      id: e.id,
      organizationId: e.organization_id ?? '',
      baslik:
        e.title?.trim() ||
        [e.event_type, tarihMetni(e.start_date)].filter(Boolean).join(' · ') ||
        'Etkinlik',
    }));
  }

  const params = await searchParams;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const varsayilanEtkinlik =
    params.etkinlik && UUID.test(params.etkinlik) ? params.etkinlik : null;

  return (
    <>
      <TopNav />
      <main className="bg-paper min-h-screen px-6 md:px-12 py-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              {gorulebilir.map((o) => o.name).join(' · ')}
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              Teklif{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                talepleri
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Etkinliğin için ajanslardan teklif topla. Talebi ajanslara
              gönderirsin, gelen teklifleri burada görürsün.
            </p>

            {yonetilebilir.length > 0 && (
              <div className="mt-5">
                <YeniRfp
                  kuruluslar={yonetilebilir.map((o) => ({
                    id: o.id,
                    name: o.name,
                  }))}
                  etkinlikler={etkinlikler}
                  varsayilanEtkinlikId={varsayilanEtkinlik}
                  varsayilanSonTarih={yediGunSonra()}
                />
              </div>
            )}
          </header>

          {talepler.length === 0 ? (
            <div className="bg-card border border-line rounded-lg p-6 text-sm text-ink-72">
              Henüz teklif talebi yok.
            </div>
          ) : (
            <div className="space-y-3">
              {talepler.map((t) => {
                const sayi = davetSayisi.get(t.id) ?? { toplam: 0, yanit: 0 };
                const gecti = sonTarihGecti(t.deadline);
                return (
                  <Link
                    key={t.id}
                    href={`/kurumsal/rfp/${t.id}`}
                    className="block bg-card border border-line rounded-lg p-5 hover:border-brand-ink transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink">
                          {t.title}
                        </p>
                        <p className="text-sm text-ink-72 mt-0.5">
                          {[
                            t.event?.title?.trim() || 'Etkinlik',
                            t.event?.start_date
                              ? tarihMetni(t.event.start_date)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <p className="text-sm text-ink-72 mt-0.5">
                          {sayi.toplam} davet · {sayi.yanit} yanıt
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono text-[10px] uppercase tracking-[0.14em] border px-2.5 py-1 rounded-full ${RFP_DURUM_SINIFLARI[t.status] ?? 'bg-paper-2 border-line text-ink-72'}`}
                        >
                          {RFP_DURUM_ETIKETLERI[t.status] ?? t.status}
                        </span>
                        {t.deadline && (
                          <p
                            className={
                              gecti
                                ? 'text-xs text-danger mt-2'
                                : 'text-xs text-ink-72 mt-2'
                            }
                          >
                            Son tarih: {zamanMetni(t.deadline)}
                            {gecti ? ' — geçti' : ''}
                          </p>
                        )}
                        <p className="text-xs text-ink-50 mt-0.5">
                          Açıldı: {tarihMetni(t.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
