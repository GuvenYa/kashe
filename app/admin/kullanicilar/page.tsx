import { createClient } from '@/app/lib/supabase-server';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  professional: 'Profesyonel',
  business: 'Kurumsal',
  agency: 'Ajans',
  client: 'Müşteri',
};

const APPROVAL_LABELS: Record<string, string> = {
  approved: 'Onaylı',
  pending: 'Onay bekliyor',
  revision: 'Revizyonda',
  rejected: 'Reddedildi',
  draft: 'Taslak',
};

type Filtre = 'all' | 'professional' | 'business' | 'agency' | 'client';

const TABS: { key: Filtre; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'professional', label: 'Profesyonel' },
  { key: 'business', label: 'Kurumsal' },
  { key: 'agency', label: 'Ajans' },
  { key: 'client', label: 'Müşteri' },
];

export default async function AdminKullanicilarPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const params = await searchParams;
  const rol: Filtre =
    params.rol === 'professional' ||
    params.rol === 'business' ||
    params.rol === 'agency' ||
    params.rol === 'client'
      ? params.rol
      : 'all';

  const supabase = await createClient();

  // Rol sayaçları (tüm kullanıcılardan)
  const { data: allRoles } = await supabase.from('profiles').select('role');
  const counts: Record<string, number> = { all: (allRoles || []).length };
  (allRoles || []).forEach((r) => {
    counts[r.role] = (counts[r.role] ?? 0) + 1;
  });

  // Liste sorgusu
  let query = supabase
    .from('profiles')
    .select(
      'id, full_name, company_name, email, phone, role, approval_status, is_published, is_admin, created_at, turkish_cities(name)'
    )
    .order('created_at', { ascending: false });

  if (rol !== 'all') {
    query = query.eq('role', rol);
  }

  const { data: users } = await query;
  const list = users || [];

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-72 mb-2">
          Admin
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight">
          Kullanıcılar
        </h1>
        <p className="text-ink-72 mt-2">Toplam {counts.all} kullanıcı.</p>
      </div>

      {/* Rol sekmeleri */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map((tab) => {
          const isActive = rol === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/admin/kullanicilar?rol=${tab.key}`}
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
                {counts[tab.key] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Tablo */}
      {list.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-12 text-center">
          <p className="font-display text-xl text-ink">Kullanıcı yok</p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/50">
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 px-4 py-3">
                    İsim
                  </th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 px-4 py-3">
                    Rol
                  </th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 px-4 py-3">
                    Durum
                  </th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 px-4 py-3">
                    İletişim
                  </th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 px-4 py-3">
                    Kayıt
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((u: any) => {
                  const displayName =
                    (u.role === 'business' || u.role === 'agency') &&
                    u.company_name
                      ? u.company_name
                      : u.full_name || 'İsimsiz';
                  const cityName = u.turkish_cities?.name;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-line last:border-0 hover:bg-paper/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-ink">
                            {displayName}
                          </span>
                          {u.is_admin && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-plum bg-plum/10 px-1.5 py-0.5 rounded">
                              Admin
                            </span>
                          )}
                        </div>
                        {cityName && (
                          <p className="text-xs text-ink-72 mt-0.5">
                            {cityName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72">
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.role === 'client' ? (
                          <span className="text-xs text-ink-72">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                                u.approval_status === 'approved'
                                  ? 'text-moss'
                                  : u.approval_status === 'rejected'
                                  ? 'text-ember'
                                  : 'text-ink-72'
                              }`}
                            >
                              {APPROVAL_LABELS[u.approval_status] ??
                                u.approval_status}
                            </span>
                            {u.is_published && (
                              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-moss">
                                Yayında
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink-72 text-xs">{u.email}</p>
                        {u.phone && (
                          <p className="text-ink-72 text-xs mt-0.5">
                            {u.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-ink-72 text-xs">
                          {new Date(u.created_at).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}