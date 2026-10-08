import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { tarihMetni, zamanMetni } from '@/app/lib/tarih';
import { RfpSaticiIslemleri } from './rfp-satici-islemleri';
import { markRfpViewed } from '../rfp-satici-actions';
import {
  RFP_DURUM_ETIKETLERI,
  RFP_DURUM_SINIFLARI,
  sonTarihGecti,
  type RfpDetay,
} from '@/app/kurumsal/rfp/rfp-data';

export const metadata = {
  title: 'Teklif talebi (RFP) — Kashe',
};

/**
 * FAZ 7b / P1 — satici tarafi teklif talebi ekrani.
 *
 * `rfp_detail` saticiya BUTCE IPUCU GONDERMEZ (JSON'da alan yok) — bu sayfa
 * ipucu alanlarini hic render etmez ve `rfp_items`'tan okumaz.
 */
export default async function AjansRfpDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect(`/giris?redirect=/ajans/rfp/${id}`);

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const { data, error } = await supabase.rpc('rfp_detail', { p_rfp_id: id });
  if (error) {
    console.error('[rfp] satici detay', error.code, error.message);
    notFound();
  }
  if (!data) notFound();

  const rfp = data as unknown as RfpDetay;
  // Alici bu rotaya geldiyse kendi ekranina gonder.
  if (rfp.is_buyer) redirect(`/kurumsal/rfp/${id}`);

  // Goruntuleme isareti (sessiz; davet `sent` ise `viewed` olur).
  await markRfpViewed(id);

  const { orgs } = await getCrewContext();
  const kurulus = orgs.find((o) => o.canManageProposals) ?? null;

  const davet = rfp.my_invite ?? null;
  const gecti = sonTarihGecti(rfp.deadline);
  const yanitlanabilir =
    !!davet &&
    ['sent', 'viewed'].includes(davet.status) &&
    ['sent', 'collecting'].includes(rfp.status) &&
    !gecti &&
    !!kurulus;

  const etkinlikSatiri = rfp.event
    ? [
        rfp.event.title?.trim() || null,
        rfp.event.event_type,
        tarihMetni(rfp.event.start_date),
        [rfp.event.city, rfp.event.district].filter(Boolean).join(' / ') || null,
        rfp.event.participant_count
          ? `${rfp.event.participant_count} kişi`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const secildi =
    rfp.status === 'awarded' &&
    !!davet?.proposal_id &&
    davet.proposal_id === rfp.awarded_proposal_id;

  return (
    <>
      <TopNav />
      <main className="bg-paper min-h-screen px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/ajans/rfp"
            className="kashe-tap text-sm text-brand-ink hover:underline"
          >
            ← Gelen RFP&apos;ler
          </Link>

          <div className="mt-4 space-y-5">
            {/* Ust blok */}
            <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand-ink">
                    Teklif talebi (RFP)
                  </p>
                  <h1 className="mt-2 font-display text-2xl md:text-3xl text-ink leading-tight">
                    {rfp.title}
                  </h1>
                  <p className="text-sm text-ink-72 mt-1">
                    {rfp.buyer_name?.trim() || 'Kuruluş'}
                  </p>
                  {etkinlikSatiri && (
                    <p className="text-sm text-ink-72 mt-2">{etkinlikSatiri}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.14em] border px-2.5 py-1 rounded-full ${RFP_DURUM_SINIFLARI[rfp.status] ?? 'bg-paper-2 border-line text-ink-72'}`}
                  >
                    {RFP_DURUM_ETIKETLERI[rfp.status] ?? rfp.status}
                  </span>
                  {rfp.deadline && (
                    <p
                      className={
                        gecti
                          ? 'text-xs text-danger mt-2'
                          : 'text-xs text-ink-72 mt-2'
                      }
                    >
                      Son tarih: {zamanMetni(rfp.deadline)}
                      {gecti ? ' — geçti' : ''}
                    </p>
                  )}
                </div>
              </div>

              {rfp.description && (
                <div className="mt-5 pt-5 border-t border-line">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-2">
                    Açıklama
                  </p>
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {rfp.description}
                  </p>
                </div>
              )}
            </div>

            {/* Kalemler — ipucu alanlari JSON'da YOK */}
            <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
              <p className="font-display font-semibold text-ink mb-3">
                İstenen roller
              </p>
              {rfp.items.length === 0 ? (
                <p className="text-sm text-ink-72">Talepte kalem yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 border-b border-line-strong">
                        <th className="py-2 pr-3 font-normal">Rol</th>
                        <th className="py-2 pr-3 font-normal">Adet</th>
                        <th className="py-2 pr-3 font-normal">Zorunlu</th>
                        <th className="py-2 font-normal">Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfp.items.map((k) => (
                        <tr key={k.id} className="border-b border-line">
                          <td className="py-3 pr-3 text-ink">{k.role}</td>
                          <td className="py-3 pr-3 text-ink-72">{k.quantity}</td>
                          <td className="py-3 pr-3 text-ink-72">
                            {k.is_required ? 'Zorunlu' : 'İsteğe bağlı'}
                          </td>
                          <td className="py-3 text-ink-72">{k.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Durum / islemler */}
            <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
              {secildi ? (
                <div className="px-4 py-3 bg-moss/10 border border-moss/40 rounded-lg">
                  <p className="text-sm text-ink">Teklifin seçildi.</p>
                  {davet?.proposal_id && (
                    <Link
                      href={`/ajans/teklifler/${davet.proposal_id}`}
                      className="kashe-tap text-sm text-brand-ink hover:underline"
                    >
                      Teklife git
                    </Link>
                  )}
                </div>
              ) : davet?.status === 'responded' ? (
                <div>
                  <p className="text-sm text-ink">Teklifin gönderildi.</p>
                  {davet.proposal_id && (
                    <Link
                      href={`/ajans/teklifler/${davet.proposal_id}`}
                      className="kashe-tap text-sm text-brand-ink hover:underline"
                    >
                      Teklife git
                    </Link>
                  )}
                </div>
              ) : davet?.status === 'declined' ? (
                <p className="text-sm text-ink-72">Daveti reddettin.</p>
              ) : davet?.status === 'not_selected' ? (
                <p className="text-sm text-ink-72">
                  Talep başka bir teklife verildi.
                </p>
              ) : yanitlanabilir && kurulus ? (
                <RfpSaticiIslemleri
                  rfpId={rfp.id}
                  organizationId={kurulus.id}
                />
              ) : (
                <p className="text-sm text-ink-72">
                  {gecti
                    ? 'Talebin son tarihi geçti; teklif gönderilemez.'
                    : 'Teklif talebi şu an yanıt kabul etmiyor.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
