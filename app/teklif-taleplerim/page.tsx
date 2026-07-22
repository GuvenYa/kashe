import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase-server';
import { getTeamContext } from '@/app/lib/business-write';

export const metadata = {
  title: 'Teklif Taleplerim — Kashe',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  closed: 'Kapatıldı',
  expired: 'Süresi doldu',
  fulfilled: 'Tamamlandı',
};

export default async function TeklifTaleplerimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/teklif-taleplerim');

  // Suspension kontrolü — askıdaki kullanıcı teklif taleplerini göremez
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // Kurumsal ekip bağlamı — tek sorgu (getTeamContext). teamBusinessIds = üyesi
  // olunan tüm kurumlar; talepleri read-only ayrı grupta göstermek için.
  const { teamBusinessIds } = await getTeamContext();

  // Kendi taleplerim + üyesi olunan kurumların talepleri (RLS: sahip + business üye SELECT)
  const customerIds = [user.id, ...teamBusinessIds];
  const { data: requests } = await supabase
    .from('quote_requests')
    .select(
      `
      id, customer_id, status, recipient_count, created_at, response_deadline,
      service_categories (name_tr),
      turkish_cities (name),
      quote_request_recipients (id, status)
    `
    )
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  // Üyesi olunan kurumların adları (kurum taleplerini gruplamak için)
  const businessNames: Record<string, string> = {};
  if (teamBusinessIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .in('id', teamBusinessIds);
    (profs ?? []).forEach((p) => {
      businessNames[p.id] = p.company_name || p.full_name || 'Kurum';
    });
  }

  type RequestRow = {
    id: string;
    customer_id: string;
    status: string;
    recipient_count: number;
    created_at: string;
    service_categories: { name_tr: string } | null;
    turkish_cities: { name: string } | null;
    quote_request_recipients: { id: string; status: string }[] | null;
    is_own: boolean;
    owner_business_name: string | null;
  };

  const list = ((requests ?? []) as unknown as Omit<
    RequestRow,
    'is_own' | 'owner_business_name'
  >[]).map((r): RequestRow => {
    const isOwn = r.customer_id === user.id;
    return {
      ...r,
      is_own: isOwn,
      owner_business_name: isOwn ? null : businessNames[r.customer_id] ?? 'Kurum',
    };
  });

  const ownRequests = list.filter((r) => r.is_own);
  const teamRequests = list.filter((r) => !r.is_own);

  // Kurum taleplerini kurum adına göre grupla
  const teamGroups: { name: string; items: RequestRow[] }[] = [];
  const teamGroupIndex: Record<string, number> = {};
  teamRequests.forEach((r) => {
    const name = r.owner_business_name ?? 'Kurum';
    if (teamGroupIndex[name] === undefined) {
      teamGroupIndex[name] = teamGroups.length;
      teamGroups.push({ name, items: [] });
    }
    teamGroups[teamGroupIndex[name]].items.push(r);
  });

  // Kendi talep bölümü: kendi talebi varsa ya da hiç kurum talebi yoksa
  // (sahip/normal client davranışı bire bir korunur)
  const showOwnSection = ownRequests.length > 0 || teamRequests.length === 0;

  const renderCard = (req: RequestRow) => {
    const categoryName = req.service_categories?.name_tr;
    const cityName = req.turkish_cities?.name;
    const recipients = req.quote_request_recipients || [];
    const offerCount = recipients.filter((r) => r.status === 'quoted').length;

    return (
      <Link
        key={req.id}
        href={`/teklif-taleplerim/${req.id}`}
        className="block bg-card border border-line rounded-lg p-6 hover:border-brand-ink hover:shadow-[4px_4px_0_var(--color-brand-ink)] transition-all"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {categoryName && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink bg-brand-ink/8 px-2 py-0.5 rounded">
                  {categoryName}
                </span>
              )}
              {cityName && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                  {cityName}
                </span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                {STATUS_LABELS[req.status] ?? req.status}
              </span>
            </div>
            <p className="text-sm text-ink-72">
              {req.recipient_count} profesyonele gönderildi ·{' '}
              {new Date(req.created_at).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>

          <div className="text-right">
            <p className="font-display text-3xl text-ink leading-none">
              {offerCount}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-1">
              teklif
            </p>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
    <TopNav />
    <div className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Teklif Taleplerim
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-brand-ink not-italic italic font-medium">
                Topladığın
              </em>{' '}
              teklifler
            </h1>
            <p className="mt-2 text-ink-72 text-sm">
              Oluşturduğun teklif talepleri ve gelen teklifler.
            </p>
          </div>
          <Link
            href="/teklif-topla"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all whitespace-nowrap"
          >
            <span className="text-base leading-none">+</span>
            Yeni talep
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="bg-card border border-line rounded-lg p-12 text-center">
            <p className="font-display text-xl text-ink mb-2">
              Henüz teklif talebin yok
            </p>
            <p className="text-ink-72 text-sm mb-6">
              Bir kez ihtiyacını anlat, birden fazla profesyonelden teklif al.
            </p>
            <Link
              href="/teklif-topla"
              className="inline-block px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
            >
              İlk talebini oluştur
            </Link>
          </div>
        ) : (
          <>
            {/* Kendi taleplerin */}
            {showOwnSection && (
              <div className="space-y-4">{ownRequests.map(renderCard)}</div>
            )}

            {/* Kurum talepleri — üyesi olunan kurumlar adına (read-only, gruplu) */}
            {teamGroups.map((group) => (
              <section
                key={group.name}
                className={showOwnSection ? 'mt-12' : ''}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
                  Kurum: {group.name} adına
                </p>
                <div className="space-y-4">{group.items.map(renderCard)}</div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
    </>
  );
}