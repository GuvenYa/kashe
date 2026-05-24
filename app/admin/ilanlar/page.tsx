import { createClient } from '@/app/lib/supabase-server';
import Link from 'next/link';
import { IlanOnayAksiyonlari } from './ilan-onay-aksiyonlari';
import { formatBudgetRange } from '@/app/ilanlar/listings-data';

type Durum = 'pending_approval' | 'revision' | 'rejected';

const TABS: { key: Durum; label: string }[] = [
  { key: 'pending_approval', label: 'Onay Bekleyen' },
  { key: 'revision', label: 'Revizyonda' },
  { key: 'rejected', label: 'Reddedilen' },
];

export default async function AdminIlanlarPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const params = await searchParams;
  const durum: Durum =
    params.durum === 'revision' || params.durum === 'rejected'
      ? params.durum
      : 'pending_approval';

  const supabase = await createClient();

  const [pendingCount, revisionCount, rejectedCount] = await Promise.all([
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'revision'),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected'),
  ]);

  const counts: Record<Durum, number> = {
    pending_approval: pendingCount.count ?? 0,
    revision: revisionCount.count ?? 0,
    rejected: rejectedCount.count ?? 0,
  };

  const { data: listings } = await supabase
    .from('listings')
    .select(
      `
      id, title, description, budget_min, budget_max, currency,
      status, approval_note, created_at, creator_id,
      service_categories (name_tr),
      turkish_cities (name),
      creator:profiles!listings_creator_id_fkey (full_name, company_name, role, email)
    `
    )
    .eq('status', durum)
    .order('created_at', { ascending: true });

  const list = listings || [];

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-72 mb-2">
          Admin
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight">
          İlan Onayları
        </h1>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map((tab) => {
          const isActive = durum === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/admin/ilanlar?durum=${tab.key}`}
              className={`px-4 py-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] border transition flex items-center gap-2 ${
                isActive
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-transparent text-ink-72 border-line hover:border-ink'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] ${
                  isActive ? 'bg-paper text-ink' : 'bg-ink/8 text-ink-72'
                }`}
              >
                {counts[tab.key]}
              </span>
            </Link>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-12 text-center">
          <p className="font-display text-xl text-ink mb-2">
            {durum === 'pending_approval'
              ? 'Onay bekleyen ilan yok'
              : durum === 'revision'
              ? 'Revizyonda ilan yok'
              : 'Reddedilen ilan yok'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((l: any) => {
            const creator = l.creator;
            const creatorName =
              creator?.company_name || creator?.full_name || 'İsimsiz';
            const categoryName = l.service_categories?.name_tr;
            const cityName = l.turkish_cities?.name;
            const budget = formatBudgetRange(
              l.budget_min,
              l.budget_max,
              l.currency
            );

            return (
              <div
                key={l.id}
                className="bg-white border border-line rounded-lg p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:justify-between">
                  <div className="min-w-0 flex-1">
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
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                        {budget}
                      </span>
                    </div>
                    <h3 className="font-display text-xl text-ink">{l.title}</h3>
                    <p className="text-sm text-ink-72 mt-1">
                      {creatorName}
                      {creator?.email ? ` · ${creator.email}` : ''}
                    </p>
                    <p className="text-sm text-ink-72 mt-2 line-clamp-4 max-w-2xl whitespace-pre-wrap">
                      {l.description}
                    </p>
                    {l.approval_note && (
                      <p className="text-sm text-ink mt-2 p-2 bg-paper border border-line rounded">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                          Not:
                        </span>{' '}
                        {l.approval_note}
                      </p>
                    )}
                    <a
                      href={`/ilanlar/${l.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:text-ink transition-colors"
                    >
                      İlanı önizle →
                    </a>
                  </div>

                  <div className="shrink-0 lg:w-72">
                    <IlanOnayAksiyonlari listingId={l.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}