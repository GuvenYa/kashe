import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { TeklifEditoru } from './teklif-editoru';
import type {
  KalemSatiri,
  RfpBaglami,
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
       event_id, crew_id, rfp_id, seller_organization_id, created_at, updated_at`
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

  // FAZ 7b: RFP yaniti ise talebi oku (RLS: satici davetli kurulus uyesi gorur).
  // Embed ipucu: rfps -> organizations FK adiyla verilir.
  let rfpBaglami: RfpBaglami | null = null;
  if (teklif.rfp_id) {
    const { data: rfpData, error: rfpHatasi } = await supabase
      .from('rfps')
      .select(
        'id, title, status, deadline, buyer:organizations_public!rfps_organization_id_fkey(display_name)'
      )
      .eq('id', teklif.rfp_id)
      .maybeSingle();
    if (rfpHatasi) console.error('[teklif] rfp baglami', rfpHatasi);
    const r = rfpData as {
      id: string;
      title: string;
      status: string;
      deadline: string | null;
      buyer: { display_name: string | null } | null;
    } | null;
    if (r) {
      rfpBaglami = {
        id: r.id,
        title: r.title,
        status: r.status,
        deadline: r.deadline,
        buyerName: r.buyer?.display_name ?? null,
      };
    }
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

  // Etkinlige erisim (RLS): satici kurulus cogu zaman gormez — o durumda
  // "Etkinlige git" satiri hic basilmaz.
  let etkinlikErisimi = false;
  let etkinlikOzeti: {
    title: string | null;
    event_type: string | null;
    start_date: string | null;
    city: string | null;
    participant_count: number | null;
  } | null = null;
  if (teklif.event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select(
        'id, title, event_type, start_date, participant_count, turkish_cities(name)'
      )
      .eq('id', teklif.event_id)
      .maybeSingle();
    etkinlikErisimi = !!ev;
    const e = ev as unknown as {
      title: string | null;
      event_type: string | null;
      start_date: string | null;
      participant_count: number | null;
      turkish_cities: { name: string } | null;
    } | null;
    if (e) {
      etkinlikOzeti = {
        title: e.title,
        event_type: e.event_type,
        start_date: e.start_date,
        city: e.turkish_cities?.name ?? null,
        participant_count: e.participant_count,
      };
    }
  }

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps(kurulus?.id);

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-4xl">
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
              rfpBaglami={rfpBaglami}
              etkinlikOzeti={etkinlikOzeti}
              rezervasyon={rezervasyon}
              silinebilir={
                !!kurulus?.canManageProposals &&
                teklif.status === 'draft' &&
                surumler.every((s) => !s.sent_at)
              }
            />
          </div>

          {/* Etkinlige erisim YOKSA satir hic basilmaz: "gorunmez" uyarisi
             yerine calismayan bir baglanti gostermek daha kotuydu. */}
          {etkinlikErisimi && teklif.event_id && (
            <p className="mt-6 text-sm text-ink-72">
              <Link
                href={`/etkinliklerim/${teklif.event_id}`}
                className="text-brand-ink hover:underline"
              >
                Etkinliğe git →
              </Link>
            </p>
          )}
        </div>
    </PanelKabugu>
  );
}
