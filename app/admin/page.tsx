import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { Eyebrow } from '@/app/components/ui/eyebrow';

export const metadata = {
  title: 'Dashboard — Kashe Admin',
};

// Helper: tarih formatlama
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 4 ana sayı için paralel sorgular
  const [
    todayUsersResult,
    weekBookingsResult,
    pendingCategoryRequestsResult,
    suspendedUsersResult,
    pendingReportsResult,
    totalUsersResult,
    totalProsResult,
    totalBookingsResult,
    recentCategoryRequestsResult,
    recentSuspensionsResult,
    recentNewUsersResult,
  ] = await Promise.all([
    // Bugün yeni kayıt
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfToday.toISOString()),
    // Bu hafta yeni rezervasyon
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString()),
    // Bekleyen kategori talebi
    supabase
      .from('category_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    // Şu an askıda kullanıcı
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('suspended_at', 'is', null),
    // Bekleyen şikayet
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    // Toplam istatistikler (alt bilgi)
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['professional', 'agency']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true }),

    // Son 5 kategori talebi
    supabase
      .from('category_requests')
      .select('id, category_name, status, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(5),

    // Son 5 askıya alınan
    supabase
      .from('profiles')
      .select('id, full_name, email, suspended_at, suspension_reason')
      .not('suspended_at', 'is', null)
      .order('suspended_at', { ascending: false })
      .limit(5),

    // Son 5 yeni kullanıcı
    supabase
      .from('profiles')
      .select('id, full_name, company_name, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const todayUsers = todayUsersResult.count ?? 0;
  const weekBookings = weekBookingsResult.count ?? 0;
  const pendingCategoryRequests = pendingCategoryRequestsResult.count ?? 0;
  const suspendedUsers = suspendedUsersResult.count ?? 0;
  const pendingReports = pendingReportsResult.count ?? 0;

  const totalUsers = totalUsersResult.count ?? 0;
  const totalPros = totalProsResult.count ?? 0;
  const totalBookings = totalBookingsResult.count ?? 0;

  const recentCategoryRequests = recentCategoryRequestsResult.data ?? [];
  const recentSuspensions = recentSuspensionsResult.data ?? [];
  const recentNewUsers = recentNewUsersResult.data ?? [];

  return (
    <>
      {/* Header */}
      <div className="mb-8 md:mb-10">
        <Eyebrow variant="inline" className="mb-2">
          Admin Paneli
        </Eyebrow>
        <h1 className="font-display font-light text-3xl md:text-4xl text-ink tracking-[-0.02em] leading-tight">
          Dashboard
        </h1>
        <p className="text-sm text-ink-72 mt-2">
          Platformun canlı durumu ve hızlı aksiyonlar.
        </p>
      </div>

      {/* 4 büyük sayı kartı */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-10">
        <StatCard
          label="Bugün yeni kayıt"
          value={todayUsers}
          accent="terracotta"
        />
        <StatCard
          label="Bu hafta rezervasyon"
          value={weekBookings}
          accent="moss"
        />
        <StatCard
          label="Bekleyen kategori talebi"
          value={pendingCategoryRequests}
          accent="plum"
          href="/admin/kategori-talepleri"
        />
        <StatCard
          label="Askıdaki kullanıcı"
          value={suspendedUsers}
          accent="ember"
          href={
            suspendedUsers > 0
              ? '/admin/kullanicilar?filter=suspended'
              : undefined
          }
        />
        <StatCard
          label="Bekleyen şikayet"
          value={pendingReports}
          accent="terracotta"
          href={
            pendingReports > 0 ? '/admin/sikayetler' : '/admin/sikayetler'
          }
        />
      </div>

      {/* 2 kolon — son aktiviteler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Sol — son kategori talepleri */}
        <div className="bg-card border border-line rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-medium text-lg text-ink">
              Son kategori talepleri
            </h2>
            <Link
              href="/admin/kategori-talepleri"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:underline"
            >
              Tümü →
            </Link>
          </div>
          {recentCategoryRequests.length === 0 ? (
            <p className="text-sm text-ink-50 py-4">Henüz talep yok.</p>
          ) : (
            <ul className="space-y-2.5">
              {recentCategoryRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink font-medium truncate">
                      {req.category_name}
                    </p>
                    <p className="text-[11px] text-ink-50 font-mono">
                      {formatDate(req.created_at)}
                    </p>
                  </div>
                  <StatusPill status={req.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sağ — son yeni kullanıcılar */}
        <div className="bg-card border border-line rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-medium text-lg text-ink">
              Son yeni kullanıcılar
            </h2>
            <Link
              href="/admin/kullanicilar"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:underline"
            >
              Tümü →
            </Link>
          </div>
          {recentNewUsers.length === 0 ? (
            <p className="text-sm text-ink-50 py-4">Henüz kullanıcı yok.</p>
          ) : (
            <ul className="space-y-2.5">
              {recentNewUsers.map((u) => {
                const displayName =
                  (u.role === 'business' || u.role === 'agency') &&
                  u.company_name
                    ? u.company_name
                    : u.full_name || u.email || 'İsimsiz';
                return (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink font-medium truncate">
                        {displayName}
                      </p>
                      <p className="text-[11px] text-ink-50 font-mono">
                        <RoleBadge role={u.role} /> ·{' '}
                        {formatDate(u.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Son askıya alınanlar (varsa) */}
      {recentSuspensions.length > 0 && (
        <div className="bg-card border border-line rounded-2xl p-5 md:p-6 mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-medium text-lg text-ink">
              Son askıya alınanlar
            </h2>
            <Link
              href="/admin/kullanicilar?filter=suspended"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:underline"
            >
              Tümü →
            </Link>
          </div>
          <ul className="space-y-3">
            {recentSuspensions.map((u) => (
              <li
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-line last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink font-medium truncate">
                    {u.full_name || u.email || 'İsimsiz'}
                  </p>
                  {u.suspension_reason && (
                    <p className="text-[12px] text-ink-72 truncate">
                      Sebep: {u.suspension_reason}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-ink-50 font-mono shrink-0">
                  {u.suspended_at ? formatDate(u.suspended_at) : '—'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Toplam istatistikler — küçük şerit */}
      <div className="bg-paper-2/50 border border-line rounded-2xl px-5 py-4 md:px-6 md:py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-3">
          Toplam — tüm zamanlar
        </p>
        <div className="grid grid-cols-3 gap-4">
          <MiniStat label="Toplam kullanıcı" value={totalUsers} />
          <MiniStat label="Profesyonel + ajans" value={totalPros} />
          <MiniStat label="Rezervasyon" value={totalBookings} />
        </div>
      </div>
    </>
  );
}

// --- Yardımcı bileşenler ---

function StatCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent: 'terracotta' | 'moss' | 'plum' | 'ember';
  href?: string;
}) {
  const accentColors = {
    terracotta: 'border-terracotta/30 bg-terracotta/[0.04]',
    moss: 'border-moss/30 bg-moss/[0.04]',
    plum: 'border-plum/30 bg-plum/[0.04]',
    ember: 'border-ember/30 bg-ember/[0.04]',
  };
  const accentText = {
    terracotta: 'text-terracotta',
    moss: 'text-moss',
    plum: 'text-plum',
    ember: 'text-ember',
  };

  const content = (
    <div
      className={`relative rounded-2xl border p-4 md:p-5 transition-all ${
        accentColors[accent]
      } ${href ? 'hover:-translate-y-0.5 cursor-pointer' : ''}`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.16em] ${accentText[accent]} mb-1.5`}
      >
        {label}
      </p>
      <p className="font-display font-light text-3xl md:text-4xl text-ink tabular-nums leading-none">
        {value.toLocaleString('tr-TR')}
      </p>
      {href && (
        <span className="absolute top-3 right-3 text-ink-50 text-xs">→</span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display font-semibold text-xl text-ink tabular-nums">
        {value.toLocaleString('tr-TR')}
      </p>
      <p className="text-[11px] text-ink-72">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    reviewing: 'bg-plum/10 text-plum border-plum/30',
    approved: 'bg-moss/10 text-moss border-moss/30',
    declined: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };
  const labels: Record<string, string> = {
    pending: 'Bekliyor',
    reviewing: 'İnceleniyor',
    approved: 'Kabul',
    declined: 'Red',
  };
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] border ${
        styles[status] || styles.pending
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    client: 'Müşteri',
    professional: 'Profesyonel',
    agency: 'Ajans',
    business: 'İşletme',
  };
  return <span>{labels[role] || role}</span>;
}
