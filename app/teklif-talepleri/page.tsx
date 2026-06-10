import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { TalepKartiAksiyonlari } from './talep-karti-aksiyonlari';
import { BriefEkButonu } from './brief-ek-butonu';

export const metadata = {
  title: 'Teklif Talepleri — Kashe',
};

export default async function TeklifTalepleriPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/giris?redirect=/teklif-talepleri');

  // Rol + suspension kontrolü — sadece professional/agency
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü
  if (profile?.suspended_at) return <SuspendedNotice />;

  if (profile?.role !== 'professional' && profile?.role !== 'agency') {
    redirect('/profil');
  }

  // Bana gelen recipient kayıtları + talep + müşteri bilgisi
  const { data: recipients } = await supabase
    .from('quote_request_recipients')
    .select(
      `
      id, status, conversation_id, created_at,
      quote_requests (
        id, brief_data, event_date, event_type, budget_min, budget_max,
        share_budget, response_deadline, status,
        attachment_path, attachment_name, attachment_type,
        service_categories (name_tr),
        turkish_cities (name),
        customer:profiles!quote_requests_customer_id_fkey (full_name, company_name, role)
      )
    `
    )
    .eq('professional_id', user.id)
    .order('created_at', { ascending: false });

  const list = (recipients || []).filter((r: any) => r.quote_requests);

  // Bekleyen (sent/viewed) sayısı
  const pendingCount = list.filter(
    (r: any) => r.status === 'sent' || r.status === 'viewed'
  ).length;

  return (
    <>
    <TopNav />
    <div className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        <header className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Teklif Talepleri
          </p>
          <h1 className="font-display text-4xl text-ink leading-tight">
            Sana gelen{' '}
            <em className="text-terracotta not-italic italic font-medium">
              teklif talepleri
            </em>
          </h1>
          <p className="mt-3 text-ink-72 text-base">
            {pendingCount > 0
              ? `${pendingCount} talep yanıtını bekliyor. Teklif ver, müşteriyle mesajlaşma açılsın.`
              : 'Müşterilerin sana özel gönderdiği talepler burada görünür.'}
          </p>
        </header>

        {list.length === 0 ? (
          <div className="bg-white border border-line rounded-lg p-12 text-center">
            <p className="font-display text-xl text-ink mb-2">
              Henüz teklif talebin yok
            </p>
            <p className="text-ink-72 text-sm">
              Profilin yayında ve onaylıysa, sana uygun talepler buraya düşer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((r: any) => {
              const req = r.quote_requests;
              const customer = req.customer;
              const customerName =
                customer?.company_name || customer?.full_name || 'Müşteri';
              const categoryName = req.service_categories?.name_tr;
              const cityName = req.turkish_cities?.name;
              const brief = (req.brief_data || {}) as Record<string, string>;
              const briefEntries = Object.entries(brief).slice(0, 4);

              const budget =
                req.share_budget && (req.budget_min || req.budget_max)
                  ? `${req.budget_min ?? '?'} - ${req.budget_max ?? '?'} TL`
                  : null;

              return (
                <div
                  key={r.id}
                  className="bg-white border border-line rounded-lg p-6"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {categoryName && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta bg-terracotta/8 px-2 py-0.5 rounded">
                            {categoryName}
                          </span>
                        )}
                        {cityName && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                            {cityName}
                          </span>
                        )}
                        {r.status === 'sent' && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta">
                            • Yeni
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-lg text-ink">
                        {customerName}
                      </h3>
                    </div>
                    {budget && (
                      <span className="font-mono text-[11px] text-ink-72">
                        Bütçe: {budget}
                      </span>
                    )}
                  </div>

                  {/* Brief özeti */}
                  {briefEntries.length > 0 && (
                    <div className="bg-paper rounded-lg p-3 mb-3 space-y-1">
                      {briefEntries.map(([k, v]) => (
                        <p key={k} className="text-sm text-ink-72">
                          <span className="text-ink">{v}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Müşterinin eklediği dosya */}
                  {req.attachment_path && (
                    <BriefEkButonu
                      requestId={req.id}
                      attachmentName={req.attachment_name}
                      attachmentType={req.attachment_type}
                    />
                  )}

                  <div className="pt-3 border-t border-line">
                    <TalepKartiAksiyonlari
                      recipientId={r.id}
                      customerName={customerName}
                      alreadyResponded={
                        r.status === 'quoted' || r.status === 'declined'
                      }
                      conversationId={r.conversation_id}
                      status={r.status}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}