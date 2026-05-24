import { createClient } from '@/app/lib/supabase-server';
import Link from 'next/link';
import { ProfilOnayAksiyonlari } from './profil-onay-aksiyonlari';

const ROLE_LABELS: Record<string, string> = {
  professional: 'Profesyonel',
  business: 'Kurumsal',
  agency: 'Ajans',
  client: 'Müşteri',
};

type Durum = 'pending' | 'revision' | 'rejected';

const TABS: { key: Durum; label: string }[] = [
  { key: 'pending', label: 'Onay Bekleyen' },
  { key: 'revision', label: 'Revizyonda' },
  { key: 'rejected', label: 'Reddedilen' },
];

export default async function AdminProfillerPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const params = await searchParams;
  const durum: Durum =
    params.durum === 'revision' || params.durum === 'rejected'
      ? params.durum
      : 'pending';

  const supabase = await createClient();

  // Sekme sayıları (her durum için count)
  const [pendingCount, revisionCount, rejectedCount] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'revision'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'rejected'),
  ]);

  const counts: Record<Durum, number> = {
    pending: pendingCount.count ?? 0,
    revision: revisionCount.count ?? 0,
    rejected: rejectedCount.count ?? 0,
  };

  // Aktif sekmenin profilleri
  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      `
      id, full_name, company_name, email, phone, role, bio, avatar_url,
      approval_status, approval_note, created_at,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr)
    `
    )
    .eq('approval_status', durum)
    .order('created_at', { ascending: true });

  const list = profiles || [];

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-72 mb-2">
          Admin
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight">
          Profil Onayları
        </h1>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map((tab) => {
          const isActive = durum === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/admin/profiller?durum=${tab.key}`}
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
            {durum === 'pending'
              ? 'Onay bekleyen profil yok'
              : durum === 'revision'
              ? 'Revizyonda profil yok'
              : 'Reddedilen profil yok'}
          </p>
          <p className="text-ink-72 text-sm">
            {durum === 'pending'
              ? 'Yeni profesyonel veya kurumsal kayıtlar burada görünecek.'
              : durum === 'revision'
              ? 'Revizyon istenen profiller burada listelenir.'
              : 'Reddettiğin profiller burada listelenir.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((p: any) => {
            const displayName =
              (p.role === 'business' || p.role === 'agency') && p.company_name
                ? p.company_name
                : p.full_name || 'İsimsiz';
            const cityName = p.turkish_cities?.name;
            const categoryName = p.service_categories?.name_tr;

            return (
              <div
                key={p.id}
                className="bg-white border border-line rounded-lg p-6"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4 md:justify-between">
                  <div className="flex items-start gap-4 min-w-0">
                    {p.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.avatar_url}
                        alt={displayName}
                        className="w-14 h-14 rounded-full object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-terracotta/10 flex items-center justify-center text-terracotta font-display font-semibold shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta bg-terracotta/8 px-2 py-0.5 rounded">
                          {ROLE_LABELS[p.role] ?? p.role}
                        </span>
                        {categoryName && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                            {categoryName}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-xl text-ink mt-1 truncate">
                        {displayName}
                      </h3>
                      <p className="text-sm text-ink-72 mt-0.5">
                        {p.email}
                        {p.phone ? ` · ${p.phone}` : ''}
                        {cityName ? ` · ${cityName}` : ''}
                      </p>
                      {p.bio && (
                        <p className="text-sm text-ink-72 mt-2 line-clamp-3 max-w-2xl">
                          {p.bio}
                        </p>
                      )}
                      {/* Önceki admin notu (revision/rejected için) */}
                      {p.approval_note && (
                        <p className="text-sm text-ink mt-2 p-2 bg-paper border border-line rounded">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                            Not:
                          </span>{' '}
                          {p.approval_note}
                        </p>
                      )}
                      <a
                        href={`/p/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:text-ink transition-colors"
                      >
                        Profili önizle →
                      </a>
                    </div>
                  </div>

                  <div className="shrink-0 md:w-72">
                    <ProfilOnayAksiyonlari profileId={p.id} />
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