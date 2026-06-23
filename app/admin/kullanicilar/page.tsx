import { createClient } from '@/app/lib/supabase-server';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { KullaniciAksiyonlar } from './kullanici-aksiyonlar';
import Link from 'next/link';

export const metadata = {
  title: 'Kullanıcılar — Kashe Admin',
};

type SearchParams = {
  q?: string;
  role?: string;
  filter?: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_admin: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  premium_tier: string | null;
  premium_until: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins} dk önce`;
  if (diffHours < 24) return `${diffHours} sa önce`;
  if (diffDays < 30) return `${diffDays} gün önce`;
  return formatDate(iso);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const searchQuery = params.q?.trim() || '';
  const roleFilter = params.role || '';
  const statusFilter = params.filter || ''; // 'suspended' | 'admins' | ''

  let query = supabase
    .from('profiles')
    .select(
      'id, full_name, company_name, email, role, avatar_url, created_at, updated_at, is_admin, suspended_at, suspension_reason, premium_tier, premium_until'
    )
    .order('created_at', { ascending: false });

  if (roleFilter && ['client', 'professional', 'agency', 'business'].includes(roleFilter)) {
    query = query.eq('role', roleFilter);
  }

  if (statusFilter === 'suspended') {
    query = query.not('suspended_at', 'is', null);
  } else if (statusFilter === 'admins') {
    query = query.eq('is_admin', true);
  }

  if (searchQuery) {
    query = query.or(
      `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`
    );
  }

  query = query.limit(200); // İlk sürüm: ilk 200 kullanıcı. Sonra pagination.

  const { data: usersData, error } = await query;
  const users = (usersData || []) as UserRow[];

  // Mevcut adminin kim olduğu — kendi hesabını ban'lamayı kapatmak için
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  return (
    <>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <Eyebrow variant="inline" className="mb-2">
          Admin / Kullanıcılar
        </Eyebrow>
        <h1 className="font-display font-light text-3xl md:text-4xl text-ink tracking-[-0.02em] leading-tight">
          Kullanıcılar
        </h1>
        <p className="text-sm text-ink-72 mt-2">
          Toplam {users.length} sonuç gösteriliyor (ilk 200 ile sınırlı).
        </p>
      </div>

      {/* Filtreler */}
      <form
        method="GET"
        className="bg-card border border-line rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3"
      >
        <input
          type="text"
          name="q"
          defaultValue={searchQuery}
          placeholder="İsim, e-posta veya firma ile ara..."
          className="flex-1 px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
        />
        <select
          name="role"
          defaultValue={roleFilter}
          className="px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
        >
          <option value="">Tüm roller</option>
          <option value="client">Müşteri</option>
          <option value="business">İşletme</option>
          <option value="professional">Profesyonel</option>
          <option value="agency">Ajans</option>
        </select>
        <select
          name="filter"
          defaultValue={statusFilter}
          className="px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
        >
          <option value="">Tüm durumlar</option>
          <option value="suspended">Askıdaki</option>
          <option value="admins">Adminler</option>
        </select>
        <button
          type="submit"
          className="kashe-tap px-5 py-2 bg-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-ink/85 transition"
        >
          Filtrele
        </button>
        {(searchQuery || roleFilter || statusFilter) && (
          <Link
            href="/admin/kullanicilar"
            className="kashe-tap px-3 py-2 text-ink-72 hover:text-ink rounded-lg text-sm font-mono uppercase tracking-[0.14em] text-[10px] flex items-center"
          >
            Temizle
          </Link>
        )}
      </form>

      {/* Tablo */}
      {error ? (
        <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-6">
          <p className="text-terracotta text-sm">
            Liste yüklenemedi: {error.message}
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-10 text-center">
          <p className="text-ink-72">Kriterlere uyan kullanıcı bulunamadı.</p>
        </div>
      ) : (
        <div className="bg-card border border-line rounded-2xl overflow-hidden">
          {/* Desktop tablo */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-paper-2/50 border-b border-line">
                <tr>
                  <Th>Kullanıcı</Th>
                  <Th>Rol</Th>
                  <Th>Kayıt</Th>
                  <Th>Son aktiflik</Th>
                  <Th>Durum</Th>
                  <Th className="text-right">Aksiyon</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isCurrentUser={currentUser?.id === u.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile kart liste */}
          <div className="lg:hidden divide-y divide-line">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                isCurrentUser={currentUser?.id === u.id}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 ${className}`}
    >
      {children}
    </th>
  );
}

function UserRow({
  user,
  isCurrentUser,
}: {
  user: UserRow;
  isCurrentUser: boolean;
}) {
  const displayName =
    (user.role === 'business' || user.role === 'agency') && user.company_name
      ? user.company_name
      : user.full_name || user.email || 'İsimsiz';

  const initials = displayName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <tr className="hover:bg-paper-2/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.avatar_url}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-terracotta/15 text-terracotta flex items-center justify-center font-display font-semibold text-xs shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm text-ink truncate">
              {displayName}
              {user.is_admin && (
                <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-terracotta bg-terracotta/10 px-1.5 py-0.5 rounded border border-terracotta/30">
                  Admin
                </span>
              )}
            </p>
            <p className="text-[11px] text-ink-50 truncate font-mono">
              {user.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-ink-72">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3 text-[12px] text-ink-72 font-mono whitespace-nowrap">
        {formatDate(user.created_at)}
      </td>
      <td className="px-4 py-3 text-[12px] text-ink-72 font-mono whitespace-nowrap">
        {formatRelativeDate(user.updated_at)}
      </td>
      <td className="px-4 py-3">
        <StatusPill user={user} />
      </td>
      <td className="px-4 py-3 text-right">
        <KullaniciAksiyonlar user={user} isCurrentUser={isCurrentUser} />
      </td>
    </tr>
  );
}

function UserCard({
  user,
  isCurrentUser,
}: {
  user: UserRow;
  isCurrentUser: boolean;
}) {
  const displayName =
    (user.role === 'business' || user.role === 'agency') && user.company_name
      ? user.company_name
      : user.full_name || user.email || 'İsimsiz';

  const initials = displayName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        {user.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={user.avatar_url}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-terracotta/15 text-terracotta flex items-center justify-center font-display font-semibold text-xs shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-ink truncate">
            {displayName}
            {user.is_admin && (
              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-terracotta bg-terracotta/10 px-1.5 py-0.5 rounded border border-terracotta/30">
                Admin
              </span>
            )}
          </p>
          <p className="text-[11px] text-ink-50 truncate font-mono">
            {user.email}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <RoleBadge role={user.role} />
            <StatusPill user={user} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-50 font-mono pt-2 border-t border-line">
        <span>Kayıt: {formatDate(user.created_at)}</span>
        <span>Aktif: {formatRelativeDate(user.updated_at)}</span>
      </div>
      <div className="flex justify-end">
        <KullaniciAksiyonlar user={user} isCurrentUser={isCurrentUser} />
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    client: 'bg-paper-2 text-ink-72',
    business: 'bg-plum/10 text-plum',
    professional: 'bg-moss/10 text-moss',
    agency: 'bg-ember/10 text-ember',
  };
  const labels: Record<string, string> = {
    client: 'Müşteri',
    business: 'İşletme',
    professional: 'Profesyonel',
    agency: 'Ajans',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] ${
        styles[role] || styles.client
      }`}
    >
      {labels[role] || role}
    </span>
  );
}

function StatusPill({ user }: { user: UserRow }) {
  if (user.suspended_at) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] bg-terracotta/10 text-terracotta border border-terracotta/30"
        title={user.suspension_reason || undefined}
      >
        Askıda
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] bg-moss/10 text-moss border border-moss/30">
      Aktif
    </span>
  );
}
