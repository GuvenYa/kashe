import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { RfpEditoru } from './rfp-editoru';
import type { RfpDetay, RolSecenegi } from '../rfp-data';

export const metadata = {
  title: 'Teklif talebi (RFP) — Kashe',
};

/** ISO -> `<input type="datetime-local">` degeri (Istanbul). */
function datetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
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

export default async function KurumsalRfpDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect(`/giris?redirect=/kurumsal/rfp/${id}`);

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // Tek cagri: role gore JSON (alici ipucu + davetler; satici ipucusuz + kendi daveti).
  const { data, error } = await supabase.rpc('rfp_detail', { p_rfp_id: id });
  if (error) {
    console.error('[rfp] detay', error.code, error.message);
    notFound();
  }
  if (!data) notFound();

  const rfp = data as unknown as RfpDetay;
  // Satici bu rotaya geldiyse kendi ekranina gonder.
  if (!rfp.is_buyer) redirect(`/ajans/rfp/${id}`);

  const { orgs } = await getCrewContext();
  const kurulus = orgs.find((o) => o.id === rfp.organization_id) ?? null;

  // Taslakta rol secimi icin aktif roller.
  let roller: RolSecenegi[] = [];
  if (rfp.status === 'draft' && kurulus?.canManageEvents) {
    const { data: rolData, error: rolHatasi } = await supabase
      .from('service_roles')
      .select('id, name_tr')
      .eq('is_active', true)
      .order('sort_order');
    if (rolHatasi) console.error('[rfp] rol listesi', rolHatasi);
    roller = (rolData ?? []) as unknown as RolSecenegi[];
  }

  return (
    <>
      <TopNav />
      <main className="bg-paper min-h-screen px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/kurumsal/rfp"
            className="kashe-tap text-sm text-brand-ink hover:underline"
          >
            ← Teklif talepleri
          </Link>

          <div className="mt-4">
            <RfpEditoru
              rfp={rfp}
              roller={roller}
              canManage={!!kurulus?.canManageEvents}
              datetimeLocal={datetimeLocal(rfp.deadline)}
            />
          </div>

          {rfp.event?.id && (
            <p className="mt-6 text-sm text-ink-72">
              Bu talep bir etkinliğe bağlı.{' '}
              <Link
                href={`/etkinliklerim/${rfp.event.id}`}
                className="text-brand-ink hover:underline"
              >
                Etkinliğe git
              </Link>
              {' '}(etkinliğin sahibi değilsen görünmez).
            </p>
          )}
        </div>
      </main>
    </>
  );
}
