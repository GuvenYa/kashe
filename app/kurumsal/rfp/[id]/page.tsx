import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { KASHE_SAAT_DILIMI, tarihMetni } from '@/app/lib/tarih';
import { RfpEditoru } from './rfp-editoru';
import { TeklifKarsilastirma } from './teklif-karsilastirma';
import type {
  KarsilastirmaKalemi,
  KarsilastirmaSutunu,
  RfpDetay,
  RolSecenegi,
} from '../rfp-data';

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

  // ---- P2: GELEN TEKLIFLER (karsilastirma) --------------------------------
  // Okuma RLS ile: alici kurulus YALNIZ gonderilmis surumleri ve musteriye
  // gorunur kalemleri gorur (`proposal_versions_select`, `proposal_items_select`
  // 7b surumu). `is_visible_to_client` burada AYRICA filtrelenmez — gizli kalemi
  // politika zaten vermez; filtre eklemek ikinci bir dogruluk kaynagi olurdu.
  // Satici adi `rfp_detail` davetlerinden gelir (ek sorgu yok).
  const davetler = rfp.invites ?? [];
  const teklifIdler = davetler
    .map((d) => d.proposal_id)
    .filter((v): v is string => !!v);

  let sutunlar: KarsilastirmaSutunu[] = [];
  let rezervasyon: { id: string; tarih: string } | null = null;

  if (teklifIdler.length > 0) {
    const { data: surumData, error: surumHatasi } = await supabase
      .from('proposal_versions')
      .select(
        `id, proposal_id, version_no, subtotal, tax_amount, total_amount,
         currency, valid_until, client_note, sent_at, approved_at, approved_by_name`
      )
      .in('proposal_id', teklifIdler)
      .not('sent_at', 'is', null)
      .order('version_no', { ascending: false });
    if (surumHatasi) console.error('[rfp] surumler', surumHatasi);

    type SurumSatiri = {
      id: string;
      proposal_id: string;
      version_no: number;
      subtotal: number | string | null;
      tax_amount: number | string | null;
      total_amount: number | string | null;
      currency: string | null;
      valid_until: string | null;
      client_note: string | null;
      sent_at: string | null;
      approved_at: string | null;
      approved_by_name: string | null;
    };

    // Teklif basina EN SON gonderilmis surum (sorgu version_no DESC geliyor).
    const sonSurum = new Map<string, SurumSatiri>();
    for (const s of (surumData ?? []) as unknown as SurumSatiri[]) {
      if (!sonSurum.has(s.proposal_id)) sonSurum.set(s.proposal_id, s);
    }

    const surumIdler = [...sonSurum.values()].map((s) => s.id);
    const kalemHaritasi = new Map<string, KarsilastirmaKalemi[]>();
    if (surumIdler.length > 0) {
      const { data: kalemData, error: kalemHatasi } = await supabase
        .from('proposal_items')
        .select(
          'id, proposal_version_id, role_id, description, quantity, unit_client_price, total_client_price, sort_order'
        )
        .in('proposal_version_id', surumIdler)
        .order('sort_order');
      if (kalemHatasi) console.error('[rfp] kalemler', kalemHatasi);
      for (const k of (kalemData ?? []) as unknown as (KarsilastirmaKalemi & {
        proposal_version_id: string;
      })[]) {
        const liste = kalemHaritasi.get(k.proposal_version_id) ?? [];
        liste.push(k);
        kalemHaritasi.set(k.proposal_version_id, liste);
      }
    }

    sutunlar = davetler
      .map((d) => {
        if (!d.proposal_id) return null;
        const s = sonSurum.get(d.proposal_id);
        if (!s) return null;
        return {
          proposalId: d.proposal_id,
          saticiAdi: d.seller_name?.trim() || 'İsimsiz kuruluş',
          proposalStatus: d.proposal_status ?? 'sent',
          versionId: s.id,
          versionNo: s.version_no,
          subtotal: s.subtotal,
          taxAmount: s.tax_amount,
          totalAmount: s.total_amount,
          currency: s.currency ?? 'TRY',
          validUntil: s.valid_until,
          clientNote: s.client_note,
          approvedAt: s.approved_at,
          approvedByName: s.approved_by_name,
          kalemler: kalemHaritasi.get(s.id) ?? [],
        } satisfies KarsilastirmaSutunu;
      })
      .filter((v): v is KarsilastirmaSutunu => v !== null);

    // Secilen surumden rezervasyon acildi mi (alici kurulus `can_access_booking_row`
    // ile okur). Baglanti YOK — alici rezervasyon sayfasi 7c-b acik kalemi.
    const secilenSutun = rfp.awarded_proposal_id
      ? sutunlar.find((s) => s.proposalId === rfp.awarded_proposal_id)
      : undefined;
    if (secilenSutun) {
      const { data: rez } = await supabase
        .from('bookings')
        .select('id, created_at')
        .eq('proposal_version_id', secilenSutun.versionId)
        .maybeSingle();
      if (rez) {
        const satir = rez as { id: string; created_at: string };
        rezervasyon = {
          id: satir.id,
          tarih: tarihMetni(satir.created_at) ?? '',
        };
      }
    }
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

          <div className="mt-4 space-y-5">
            <RfpEditoru
              rfp={rfp}
              roller={roller}
              canManage={!!kurulus?.canManageEvents}
              datetimeLocal={datetimeLocal(rfp.deadline)}
            />

            <TeklifKarsilastirma
              rfp={rfp}
              sutunlar={sutunlar}
              canManage={!!kurulus?.canManageEvents}
              rezervasyon={rezervasyon}
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
