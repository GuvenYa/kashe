import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { tarihMetni, zamanMetni } from '@/app/lib/tarih';
import {
  DAVET_DURUM_ETIKETLERI,
  RFP_DURUM_ETIKETLERI,
  RFP_DURUM_SINIFLARI,
  sonTarihGecti,
} from '@/app/kurumsal/rfp/rfp-data';

export const metadata = {
  title: "Gelen RFP'ler — Kashe",
};

/**
 * FAZ 7b / P1 — ajansa gelen teklif talepleri (davetler).
 * RLS: kurulusun saglayicisina gelen davetler (`rfp_invites`).
 */
type DavetSatiri = {
  id: string;
  status: string;
  rfp_id: string;
  proposal_id: string | null;
  created_at: string;
  rfp: {
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    organization_id: string;
    buyer: { display_name: string | null } | null;
    event: { title: string | null; start_date: string | null } | null;
  } | null;
};

export default async function AjansRfpPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/ajans/rfp');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const gorulebilir = orgs.filter((o) => o.canViewProposals);
  if (gorulebilir.length === 0) redirect('/profil');

  // Embed ipucu: rfps -> organizations iliskisi FK adiyla verilir.
  const { data: davetData, error: davetHatasi } = await supabase
    .from('rfp_invites')
    .select(
      `id, status, rfp_id, proposal_id, created_at,
       rfp:rfps(
         id, title, status, deadline, organization_id,
         buyer:organizations!rfps_organization_id_fkey(display_name),
         event:events(title, start_date)
       )`
    )
    .order('created_at', { ascending: false });
  if (davetHatasi) console.error('[rfp] gelen davetler', davetHatasi);

  const davetler = (davetData ?? []) as unknown as DavetSatiri[];

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
              Gelen{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                RFP&apos;ler
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Kurumların ve ajansların kuruluşuna gönderdiği teklif talepleri.
              Talebi açıp teklif hazırlayabilirsin.
            </p>
          </header>

          {davetler.length === 0 ? (
            <div className="bg-card border border-line rounded-lg p-6 text-sm text-ink-72">
              Henüz gelen teklif talebi yok.
            </div>
          ) : (
            <div className="space-y-3">
              {davetler.map((d) => {
                const rfp = d.rfp;
                if (!rfp) return null;
                const gecti = sonTarihGecti(rfp.deadline);
                return (
                  <Link
                    key={d.id}
                    href={`/ajans/rfp/${rfp.id}`}
                    className="block bg-card border border-line rounded-lg p-5 hover:border-brand-ink transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink">
                          {rfp.title}
                        </p>
                        <p className="text-sm text-ink-72 mt-0.5">
                          {[
                            rfp.buyer?.display_name?.trim() || 'Kuruluş',
                            rfp.event?.title?.trim() || null,
                            rfp.event?.start_date
                              ? tarihMetni(rfp.event.start_date)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {d.status === 'responded' && d.proposal_id && (
                          <p className="text-sm text-moss mt-0.5">
                            Teklifin gönderildi
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono text-[10px] uppercase tracking-[0.14em] border px-2.5 py-1 rounded-full ${RFP_DURUM_SINIFLARI[rfp.status] ?? 'bg-paper-2 border-line text-ink-72'}`}
                        >
                          {RFP_DURUM_ETIKETLERI[rfp.status] ?? rfp.status}
                        </span>
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 mt-2">
                          {DAVET_DURUM_ETIKETLERI[d.status] ?? d.status}
                        </p>
                        {rfp.deadline && (
                          <p
                            className={
                              gecti
                                ? 'text-xs text-danger mt-1'
                                : 'text-xs text-ink-72 mt-1'
                            }
                          >
                            Son tarih: {zamanMetni(rfp.deadline)}
                            {gecti ? ' — geçti' : ''}
                          </p>
                        )}
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
