import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext } from '@/app/lib/org-context';
import { YeniTeklif } from './yeni-teklif';
import { TeklifSil } from './teklif-sil';
import {
  TEKLIF_DURUM_ETIKETLERI,
  paraMetni,
  tarihMetni,
  type SurumSatiri,
  type TeklifSatiri,
} from './teklif-data';

export const metadata = {
  title: 'Teklifler — Kashe',
};

export default async function AjansTekliflerPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/ajans/teklifler');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const gorulebilir = orgs.filter((o) => o.canViewProposals);
  if (gorulebilir.length === 0) redirect('/profil');

  const { data: teklifData, error: teklifHatasi } = await supabase
    .from('proposals')
    .select(
      `id, title, client_name, client_email, status, current_version_id,
       event_id, crew_id, seller_organization_id, created_at, updated_at`
    )
    .in(
      'seller_organization_id',
      gorulebilir.map((o) => o.id)
    )
    .order('created_at', { ascending: false });
  if (teklifHatasi) console.error('[teklif] liste', teklifHatasi);

  const teklifler = (teklifData ?? []) as unknown as TeklifSatiri[];

  // Gecerli surumler (toplam, gecerlilik, gonderim) — tek sorgu.
  const surumIdleri = teklifler
    .map((t) => t.current_version_id)
    .filter((v): v is string => !!v);
  const surumMap = new Map<string, SurumSatiri>();
  if (surumIdleri.length > 0) {
    const { data: surumData } = await supabase
      .from('proposal_versions')
      .select(
        `id, proposal_id, version_no, subtotal, tax_rate, tax_amount, total_amount,
         currency, valid_until, notes, client_note, sent_at, approved_by_name,
         approved_at, created_at`
      )
      .in('id', surumIdleri);
    for (const s of (surumData ?? []) as unknown as SurumSatiri[]) {
      surumMap.set(s.id, s);
    }
  }

  // FAZ 7a/P2 — silinebilir taslaklar: proposal_new_version durumu tekrar
  // draft yaptigi icin "taslak" olmak yetmez; HICBIR surumu gonderilmemis olmali.
  const gonderilmisOlanlar = new Set<string>();
  if (teklifler.length > 0) {
    const { data: gonderimData } = await supabase
      .from('proposal_versions')
      .select('proposal_id, sent_at')
      .in(
        'proposal_id',
        teklifler.map((t) => t.id)
      )
      .not('sent_at', 'is', null);
    for (const v of (gonderimData ?? []) as { proposal_id: string }[]) {
      gonderilmisOlanlar.add(v.proposal_id);
    }
  }

  // Etkinlik basligi: RLS gostermeyebilir (kurulus uyesi etkinligin sahibi degilse).
  const etkinlikIdleri = [
    ...new Set(teklifler.map((t) => t.event_id).filter((v): v is string => !!v)),
  ];
  const etkinlikMap = new Map<string, string | null>();
  if (etkinlikIdleri.length > 0) {
    const { data: evData } = await supabase
      .from('events')
      .select('id, title')
      .in('id', etkinlikIdleri);
    for (const e of (evData ?? []) as { id: string; title: string | null }[]) {
      etkinlikMap.set(e.id, e.title);
    }
  }

  const kurulusSecenekleri = orgs
    .filter((o) => o.canManageProposals)
    .map((o) => ({ id: o.id, name: o.name }));

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
              <em className="text-brand-ink not-italic italic font-medium">
                Teklifler
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Kuruluşunun müşterilerine gönderdiği teklifler. Teklif ekipten ya
              da buradan açılır; müşteri bağlantıyla görüntüler.
            </p>

            {kurulusSecenekleri.length > 0 && (
              <div className="mt-5">
                <YeniTeklif kuruluslar={kurulusSecenekleri} />
              </div>
            )}
          </header>

          {teklifler.length === 0 ? (
            <div className="bg-card border border-line rounded-lg p-6 text-sm text-ink-72">
              Henüz teklif yok.
            </div>
          ) : (
            <div className="space-y-3">
              {teklifler.map((t) => {
                const surum = t.current_version_id
                  ? (surumMap.get(t.current_version_id) ?? null)
                  : null;
                const etkinlikBasligi = t.event_id
                  ? etkinlikMap.get(t.event_id)
                  : undefined;
                return (
                  <Link
                    key={t.id}
                    href={`/ajans/teklifler/${t.id}`}
                    className="block bg-card border border-line rounded-lg p-5 hover:border-brand-ink transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink">
                          {t.title}
                        </p>
                        <p className="text-sm text-ink-72 mt-0.5">
                          {[
                            t.client_name || t.client_email || 'Müşteri girilmedi',
                            etkinlikBasligi
                              ? `Etkinlik: ${etkinlikBasligi}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {surum?.valid_until && (
                          <p className="text-sm text-ink-72 mt-0.5">
                            Geçerlilik: {tarihMetni(surum.valid_until)}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                          {TEKLIF_DURUM_ETIKETLERI[t.status] ?? t.status}
                        </p>
                        {t.status === 'draft' &&
                          !gonderilmisOlanlar.has(t.id) &&
                          kurulusSecenekleri.some(
                            (k) => k.id === t.seller_organization_id
                          ) && (
                            <div className="mt-1">
                              <TeklifSil proposalId={t.id} baslik={t.title} />
                            </div>
                          )}
                        {surum && (
                          <>
                            <p className="font-display font-semibold text-ink mt-0.5">
                              {paraMetni(surum.total_amount, surum.currency) ??
                                '—'}
                            </p>
                            <p className="text-xs text-ink-50 mt-0.5">
                              Sürüm {surum.version_no} ·{' '}
                              {tarihMetni(t.created_at)}
                            </p>
                          </>
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
