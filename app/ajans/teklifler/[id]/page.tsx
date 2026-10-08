import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { TeklifEditoru } from './teklif-editoru';
import type {
  KalemSatiri,
  TeklifRezervasyonu,
  PortalBaglantisi,
  SurumSatiri,
  TeklifSatiri,
} from '../teklif-data';

export const metadata = {
  title: 'Teklif — Kashe',
};

export default async function TeklifDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect(`/giris?redirect=/ajans/teklifler/${id}`);

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // RLS: satici kurulusta proposals.view / alici (draft disi) / admin.
  const { data: teklifData } = await supabase
    .from('proposals')
    .select(
      `id, title, client_name, client_email, status, current_version_id,
       event_id, crew_id, seller_organization_id, created_at, updated_at`
    )
    .eq('id', id)
    .maybeSingle();

  if (!teklifData) notFound();
  const teklif = teklifData as unknown as TeklifSatiri;

  const { orgs } = await getCrewContext();
  const kurulus =
    orgs.find((o) => o.id === teklif.seller_organization_id) ?? null;

  const { data: surumData, error: surumHatasi } = await supabase
    .from('proposal_versions')
    .select(
      `id, proposal_id, version_no, subtotal, tax_rate, tax_amount, total_amount,
       currency, valid_until, notes, client_note, sent_at, approved_by_name,
       approved_at, created_at`
    )
    .eq('proposal_id', id)
    .order('version_no', { ascending: false });
  if (surumHatasi) console.error('[teklif] surumler', surumHatasi);

  const surumler = (surumData ?? []) as unknown as SurumSatiri[];
  const gecerliSurum =
    surumler.find((s) => s.id === teklif.current_version_id) ??
    surumler[0] ??
    null;

  let kalemler: KalemSatiri[] = [];
  if (gecerliSurum) {
    const { data: kalemData, error: kalemHatasi } = await supabase
      .from('proposal_items')
      .select(
        `id, proposal_version_id, role_id, crew_member_id, description, quantity,
         unit_client_price, total_client_price, is_visible_to_client, sort_order`
      )
      .eq('proposal_version_id', gecerliSurum.id)
      .order('sort_order')
      .order('created_at');
    if (kalemHatasi) console.error('[teklif] kalemler', kalemHatasi);
    kalemler = (kalemData ?? []) as unknown as KalemSatiri[];
  }

  // FAZ 7c: gecerli surumun rezervasyonu (surum basina tek satir; RLS kurulus
  // politikasi gosterir). Rezervasyon yalniz `booking_from_proposal` ile acilir.
  let rezervasyon: TeklifRezervasyonu | null = null;
  if (gecerliSurum) {
    const { data: rezData, error: rezHatasi } = await supabase
      .from('bookings')
      .select('id, status, created_at')
      .eq('proposal_version_id', gecerliSurum.id)
      .maybeSingle();
    if (rezHatasi) console.error('[teklif] rezervasyon okuma', rezHatasi);
    rezervasyon = (rezData as TeklifRezervasyonu | null) ?? null;
  }

  // `token_hash` SECILMEZ — sutun yetkisi yok (secilirse 42501).
  const { data: baglantiData, error: baglantiHatasi } = await supabase
    .from('portal_access_links')
    .select(
      `id, scope, recipient_email, expires_at, max_views, view_count,
       first_viewed_at, last_viewed_at, revoked_at, created_at`
    )
    .eq('resource_type', 'proposal')
    .eq('resource_id', id)
    .order('created_at', { ascending: false });
  if (baglantiHatasi) console.error('[teklif] baglantilar', baglantiHatasi);

  const baglantilar = (baglantiData ?? []) as unknown as PortalBaglantisi[];

  return (
    <>
      <TopNav />
      <main className="bg-paper min-h-screen px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/ajans/teklifler"
            className="kashe-tap text-sm text-brand-ink hover:underline"
          >
            ← Teklifler
          </Link>

          <div className="mt-4">
            <TeklifEditoru
              teklif={teklif}
              gecerliSurum={gecerliSurum}
              surumler={surumler}
              kalemler={kalemler}
              baglantilar={baglantilar}
              canManage={!!kurulus?.canManageProposals}
              maliyetGorulur={!!kurulus?.canSeeRates}
              maliyetYazilir={!!kurulus?.canManageRates}
              rezervasyon={rezervasyon}
              silinebilir={
                !!kurulus?.canManageProposals &&
                teklif.status === 'draft' &&
                surumler.every((s) => !s.sent_at)
              }
            />
          </div>

          {teklif.event_id && (
            <p className="mt-6 text-sm text-ink-72">
              Bu teklif bir etkinliğe bağlı.{' '}
              <Link
                href={`/etkinliklerim/${teklif.event_id}`}
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
