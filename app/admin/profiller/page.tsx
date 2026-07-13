import { createClient } from '@/app/lib/supabase-server';
import Link from 'next/link';
import { ProfilOnayAksiyonlari } from './profil-onay-aksiyonlari';
import { ProfilArama } from './profil-arama';

const ROLE_LABELS: Record<string, string> = {
  professional: 'Profesyonel',
  business: 'Kurumsal',
  agency: 'Ajans',
  client: 'Müşteri',
};

// Onay akışına giren roller (müşteri profilleri onay gerektirmez → panel dışı).
const APPROVABLE_ROLES = ['professional', 'business', 'agency'];
const PAGE_SIZE = 25;

type Durum = 'pending' | 'revision' | 'rejected' | 'all';

const TABS: { key: Durum; label: string }[] = [
  { key: 'pending', label: 'Onay Bekleyen' },
  { key: 'revision', label: 'Revizyonda' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'all', label: 'Tümü' },
];

const APPROVAL_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Onay bekliyor', cls: 'bg-amber-500/12 text-amber-700 border-amber-500/30' },
  revision: { label: 'Revizyonda', cls: 'bg-blue-500/12 text-blue-700 border-blue-500/30' },
  rejected: { label: 'Reddedildi', cls: 'bg-danger/10 text-danger border-danger/30' },
  approved: { label: 'Onaylı', cls: 'bg-moss/12 text-moss border-moss/30' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default async function AdminProfillerPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; q?: string; sayfa?: string }>;
}) {
  const params = await searchParams;
  const durum: Durum =
    params.durum === 'revision' ||
    params.durum === 'rejected' ||
    params.durum === 'all'
      ? params.durum
      : 'pending';

  const rawQ = (params.q ?? '').trim();
  // PostgREST or-filtresini bozan karakterleri ayıkla (virgül/parantez/wildcard).
  const q = rawQ.replace(/[%,()*\\]/g, '').slice(0, 80);

  const page = Math.max(1, parseInt(params.sayfa ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Sekme sayaçları — hepsi onay-akışı rollerine filtreli (global, aramadan bağımsız).
  const [pendingCount, revisionCount, rejectedCount, allCount] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', APPROVABLE_ROLES).eq('approval_status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', APPROVABLE_ROLES).eq('approval_status', 'revision'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', APPROVABLE_ROLES).eq('approval_status', 'rejected'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', APPROVABLE_ROLES),
  ]);

  const counts: Record<Durum, number> = {
    pending: pendingCount.count ?? 0,
    revision: revisionCount.count ?? 0,
    rejected: rejectedCount.count ?? 0,
    all: allCount.count ?? 0,
  };

  // Aktif sekme + arama + sayfalama
  let listQuery = supabase
    .from('profiles')
    .select(
      `
      id, full_name, company_name, email, role, avatar_url,
      approval_status, approval_note, is_published, created_at,
      service_categories!profiles_primary_category_id_fkey(name_tr)
    `,
      { count: 'exact' }
    )
    .in('role', APPROVABLE_ROLES);

  if (durum !== 'all') listQuery = listQuery.eq('approval_status', durum);
  if (q)
    listQuery = listQuery.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`
    );

  // Onay bekleyen = eski FIFO (en eski önce); diğer sekmeler = en yeni önce.
  const { data: profiles, count: totalCount } = await listQuery
    .order('created_at', { ascending: durum === 'pending' })
    .range(from, to);

  const list = profiles || [];
  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(n: number): string {
    const p = new URLSearchParams();
    if (durum !== 'pending') p.set('durum', durum);
    if (rawQ) p.set('q', rawQ);
    if (n > 1) p.set('sayfa', String(n));
    const qs = p.toString();
    return qs ? `/admin/profiller?${qs}` : '/admin/profiller';
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-72 mb-2">
          Admin
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight">
          Profiller
        </h1>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-2 mb-5 flex-wrap">
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

      {/* Arama */}
      <div className="mb-7">
        <ProfilArama initialQuery={rawQ} durum={durum} />
      </div>

      {list.length === 0 ? (
        <div className="bg-card border border-line rounded-lg p-12 text-center">
          <p className="font-display text-xl text-ink mb-2">
            {rawQ ? 'Eşleşen profil yok' : 'Profil yok'}
          </p>
          <p className="text-ink-72 text-sm">
            {rawQ
              ? `"${rawQ}" için isim veya e-posta eşleşmesi bulunamadı.`
              : durum === 'pending'
              ? 'Yeni profesyonel veya kurumsal kayıtlar burada görünecek.'
              : 'Bu sekmede profil bulunmuyor.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {list.map((p: any) => {
              const displayName =
                (p.role === 'business' || p.role === 'agency') && p.company_name
                  ? p.company_name
                  : p.full_name || 'İsimsiz';
              const categoryName = p.service_categories?.name_tr;
              const approval = APPROVAL_BADGE[p.approval_status as string] ?? {
                label: p.approval_status || '—',
                cls: 'bg-ink/6 text-ink-72 border-line',
              };

              return (
                <div key={p.id} className="bg-card border border-line rounded-lg p-6">
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
                        <p className="text-sm text-ink-72 mt-0.5 truncate">{p.email}</p>

                        {/* Rozetler: onay durumu + yayın durumu + kayıt tarihi */}
                        <div className="flex items-center gap-2 flex-wrap mt-2.5">
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${approval.cls}`}
                          >
                            {approval.label}
                          </span>
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${
                              p.is_published
                                ? 'bg-moss/12 text-moss border-moss/30'
                                : 'bg-ink/6 text-ink-72 border-line'
                            }`}
                          >
                            {p.is_published ? 'Yayında' : 'Yayında değil'}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
                            Kayıt: {formatDate(p.created_at)}
                          </span>
                        </div>

                        {/* Önceki admin notu (revision/rejected için) */}
                        {p.approval_note && (
                          <p className="text-sm text-ink mt-2.5 p-2 bg-paper border border-line rounded">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                              Not:
                            </span>{' '}
                            {p.approval_note}
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2.5">
                          <a
                            href={`/p/${p.id}`}
                            className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:text-ink transition-colors"
                          >
                            Önizle →
                          </a>
                          <Link
                            href={`/admin/kullanicilar?q=${encodeURIComponent(p.email ?? '')}`}
                            className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 hover:text-danger transition-colors"
                          >
                            Askıya al →
                          </Link>
                        </div>
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

          {/* Sayfalama */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 mt-8">
              <p className="text-xs text-ink-72 font-mono">
                {from + 1}–{Math.min(from + PAGE_SIZE, total)} / {total}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(page - 1)}
                    className="px-3 py-1.5 rounded-lg border border-line text-ink-72 hover:border-ink font-mono text-[11px] uppercase tracking-[0.1em] transition"
                  >
                    ← Önceki
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg border border-line/50 text-ink-72/40 font-mono text-[11px] uppercase tracking-[0.1em] cursor-not-allowed">
                    ← Önceki
                  </span>
                )}
                <span className="text-xs text-ink-72 font-mono px-1">
                  {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={pageHref(page + 1)}
                    className="px-3 py-1.5 rounded-lg border border-line text-ink-72 hover:border-ink font-mono text-[11px] uppercase tracking-[0.1em] transition"
                  >
                    Sonraki →
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg border border-line/50 text-ink-72/40 font-mono text-[11px] uppercase tracking-[0.1em] cursor-not-allowed">
                    Sonraki →
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
