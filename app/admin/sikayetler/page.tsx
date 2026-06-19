import { createClient } from '@/app/lib/supabase-server';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { SikayetAksiyonlari } from './sikayet-aksiyonlari';
import Link from 'next/link';
import type { Report, ReportStatus, ReportReason, ReportTargetType } from '@/app/lib/types';

export const metadata = {
  title: 'Şikayet Yönetimi — Kashe Admin',
};

type SearchParams = { filter?: string };

const REASON_LABEL: Record<ReportReason, string> = {
  spam: 'Spam / reklam',
  inappropriate: 'Uygunsuz içerik',
  fake: 'Sahte / yanıltıcı',
  harassment: 'Taciz / hakaret',
  other: 'Diğer',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: 'Bekleyen',
  reviewing: 'İnceleniyor',
  resolved: 'Çözüldü',
  dismissed: 'Reddedildi',
};

const TARGET_LABEL: Record<ReportTargetType, string> = {
  listing: 'İlan',
  profile: 'Profil',
  review: 'Yorum',
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins} dk önce`;
  if (diffHours < 24) return `${diffHours} sa önce`;
  if (diffDays < 30) return `${diffDays} gün önce`;
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const filter = params.filter || 'pending';

  // Sayaçlar için tüm şikayet durumları
  const { data: allData } = await supabase.from('reports').select('id, status');
  const all = allData || [];
  const counts: Record<string, number> = {
    all: all.length,
    pending: all.filter((r) => r.status === 'pending').length,
    reviewing: all.filter((r) => r.status === 'reviewing').length,
    resolved: all.filter((r) => r.status === 'resolved').length,
    dismissed: all.filter((r) => r.status === 'dismissed').length,
  };

  // Filtreli liste
  let query = supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter !== 'all') {
    query = query.eq('status', filter);
  }
  const { data: reportsRaw } = await query;
  const reports = (reportsRaw ?? []) as Report[];

  // Hedef detaylarını topla — target_type'a göre id'leri ayır, toplu çek
  const listingIds = reports.filter((r) => r.target_type === 'listing').map((r) => r.target_id);
  const profileIds = reports.filter((r) => r.target_type === 'profile').map((r) => r.target_id);
  const reviewIds = reports.filter((r) => r.target_type === 'review').map((r) => r.target_id);
  const reporterIds = reports.map((r) => r.reporter_id);

  const [listingsRes, profilesRes, reviewsRes, reportersRes] = await Promise.all([
    listingIds.length
      ? supabase.from('listings').select('id, title').in('id', listingIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    profileIds.length
      ? supabase.from('profiles').select('id, full_name, company_name, role').in('id', profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; company_name: string | null; role: string }[] }),
    reviewIds.length
      ? supabase.from('reviews').select('id, body, professional_id').in('id', reviewIds)
      : Promise.resolve({ data: [] as { id: string; body: string | null; professional_id: string }[] }),
    reporterIds.length
      ? supabase.from('profiles').select('id, full_name, company_name, role, email').in('id', reporterIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; company_name: string | null; role: string; email: string | null }[] }),
  ]);

  const listingMap = new Map((listingsRes.data ?? []).map((l) => [l.id, l]));
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const reviewMap = new Map((reviewsRes.data ?? []).map((r) => [r.id, r]));
  const reporterMap = new Map((reportersRes.data ?? []).map((p) => [p.id, p]));

  function reporterName(id: string): string {
    const p = reporterMap.get(id);
    if (!p) return 'Bilinmeyen';
    return p.full_name || p.email || 'İsimsiz';
  }

  // Hedef için okunabilir etiket + link
  function targetInfo(r: Report): { label: string; href: string | null } {
    if (r.target_type === 'listing') {
      const l = listingMap.get(r.target_id);
      return {
        label: l?.title ?? '(silinmiş ilan)',
        href: `/ilanlar/${r.target_id}`,
      };
    }
    if (r.target_type === 'profile') {
      const p = profileMap.get(r.target_id);
      const name =
        (p?.role === 'business' || p?.role === 'agency') && p?.company_name
          ? p.company_name
          : p?.full_name ?? '(silinmiş profil)';
      return { label: name, href: `/p/${r.target_id}` };
    }
    // review — yoruma doğrudan link yok, ait olduğu profile götür
    const rev = reviewMap.get(r.target_id);
    const snippet = rev?.body
      ? rev.body.slice(0, 60) + (rev.body.length > 60 ? '…' : '')
      : '(metinsiz yorum)';
    return {
      label: snippet,
      href: rev ? `/p/${rev.professional_id}/yorumlar` : null,
    };
  }

  const FILTERS = [
    { key: 'pending', label: 'Bekleyen' },
    { key: 'reviewing', label: 'İnceleniyor' },
    { key: 'resolved', label: 'Çözüldü' },
    { key: 'dismissed', label: 'Reddedildi' },
    { key: 'all', label: 'Tümü' },
  ];

  return (
    <>
      <div className="mb-6 md:mb-8">
        <Eyebrow variant="inline" className="mb-2">
          Admin / Şikayet Yönetimi
        </Eyebrow>
        <h1 className="font-display font-light text-3xl md:text-4xl text-ink tracking-[-0.02em] leading-tight">
          Şikayetler
        </h1>
        <p className="text-sm text-ink-72 mt-2">
          Kullanıcı şikayetlerini incele. Hedefe giderek mevcut araçlarla
          (ilanı kaldır, kullanıcıyı askıya al, yorumu sil) işlem alabilirsin.
        </p>
      </div>

      {/* Filtre chip'leri */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {FILTERS.map((opt) => {
          const count = counts[opt.key] ?? 0;
          const isActive = filter === opt.key;
          return (
            <Link
              key={opt.key}
              href={
                opt.key === 'pending'
                  ? '/admin/sikayetler'
                  : `/admin/sikayetler?filter=${opt.key}`
              }
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                isActive
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-card text-ink-72 border-line hover:border-ink-50 hover:text-ink'
              }`}
            >
              {opt.label}
              <span className={`tabular-nums ${isActive ? 'text-paper/70' : 'text-ink-50'}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Liste */}
      {reports.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-10 text-center">
          <p className="font-display font-medium text-lg text-ink mb-1">
            Bu filtrede şikayet yok.
          </p>
          <p className="text-sm text-ink-72">Diğer filtreleri dene.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const t = targetInfo(report);
            return (
              <div
                key={report.id}
                className="bg-card border border-line rounded-2xl p-5 md:p-6"
              >
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] bg-ink/8 text-ink border border-line">
                        {TARGET_LABEL[report.target_type]}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] bg-terracotta/10 text-terracotta border border-terracotta/30">
                        {REASON_LABEL[report.reason]}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] border ${
                          report.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : report.status === 'reviewing'
                              ? 'bg-ink/8 text-ink border-line'
                              : report.status === 'resolved'
                                ? 'bg-moss/10 text-moss border-moss/30'
                                : 'bg-ink-72/8 text-ink-72 border-ink-72/20'
                        }`}
                      >
                        {STATUS_LABEL[report.status]}
                      </span>
                    </div>

                    {/* Hedef */}
                    <p className="text-sm text-ink mb-1">
                      <span className="text-ink-72">Hedef: </span>
                      {t.href ? (
                        <Link
                          href={t.href}
                          target="_blank"
                          className="text-ink font-medium underline-offset-2 hover:underline hover:text-terracotta transition-colors"
                        >
                          {t.label}
                        </Link>
                      ) : (
                        <span className="text-ink font-medium">{t.label}</span>
                      )}
                    </p>

                    <p className="text-[12px] text-ink-72 font-mono">
                      Şikayet eden: {reporterName(report.reporter_id)}
                      <span className="text-ink-50 mx-2">·</span>
                      {formatRelative(report.created_at)}
                    </p>
                  </div>
                </div>

                {/* Açıklama */}
                {report.details && (
                  <div className="bg-paper-2/50 border border-line rounded-xl p-3 mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                      Açıklama
                    </p>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {report.details}
                    </p>
                  </div>
                )}

                {/* Admin notu (çözüldü/reddedildiyse) */}
                {report.admin_note && (
                  <div className="bg-moss/[0.06] border border-moss/20 rounded-xl p-3 mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-moss mb-1">
                      Admin notu
                    </p>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {report.admin_note}
                    </p>
                  </div>
                )}

                {/* Aksiyonlar */}
                <div className="pt-3 border-t border-line">
                  <SikayetAksiyonlari reportId={report.id} status={report.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}