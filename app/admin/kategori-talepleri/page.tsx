import { createClient } from '@/app/lib/supabase-server';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { TalepAksiyonlari } from './talep-aksiyonlari';
import { YeniKategoriFormu } from './yeni-kategori-formu';
import Link from 'next/link';

export const metadata = {
  title: 'Kategori Talepleri — Kashe Admin',
};

type SearchParams = {
  status?: string;
};

type CategoryRequestRow = {
  id: string;
  category_name: string;
  description: string | null;
  event_context: string | null;
  status: 'pending' | 'reviewing' | 'approved' | 'declined';
  created_at: string;
  reviewed_at: string | null;
  user_id: string;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    company_name: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  reviewing: 'İnceleniyor',
  approved: 'Onaylı',
  declined: 'Reddedildi',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-brand-ink/10 text-brand-ink border-brand-ink/30',
  reviewing: 'bg-brand-accent/10 text-brand-accent border-brand-accent/30',
  approved: 'bg-moss/10 text-moss border-moss/30',
  declined: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
};

const EVENT_CONTEXT_LABELS: Record<string, string> = {
  wedding: 'Düğün',
  engagement: 'Nişan / Kına',
  birthday: 'Doğum günü',
  corporate: 'Kurumsal',
  baby: 'Bebek partisi',
  other: 'Diğer',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string): string {
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

export default async function AdminCategoryRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const statusFilter = params.status || 'pending';

  // Tüm talepler (status istatistikleri için)
  const { data: allRequestsData } = await supabase
    .from('category_requests')
    .select('id, status, category_name');

  const allRequests = allRequestsData || [];

  // Status sayıları (chip rakamları için)
  const statusCounts: Record<string, number> = {
    all: allRequests.length,
    pending: 0,
    reviewing: 0,
    approved: 0,
    declined: 0,
  };
  allRequests.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  // Filtreli liste — user join
  let query = supabase
    .from('category_requests')
    .select(
      `
      id, category_name, description, event_context, status,
      created_at, reviewed_at, user_id,
      user:profiles!category_requests_user_id_fkey (
        id, full_name, email, role, company_name
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: requestsData } = await query;
  const requests = (requestsData ?? []) as unknown as CategoryRequestRow[];

  // Aynı kategori adı kaç kez talep edilmiş (popülarite için)
  // Tüm talepler üzerinden hesaplanır, filtreden bağımsız
  const popularityMap: Record<string, number> = {};
  allRequests.forEach((r) => {
    const normalized = r.category_name.toLowerCase().trim();
    popularityMap[normalized] = (popularityMap[normalized] || 0) + 1;
  });

  return (
    <>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <Eyebrow variant="inline" className="mb-2">
          Admin / Kategori Talepleri
        </Eyebrow>
        <h1 className="font-display font-light text-3xl md:text-4xl text-ink tracking-[-0.02em] leading-tight">
          Kategori talepleri
        </h1>
        <p className="text-sm text-ink-72 mt-2">
          Kullanıcılardan gelen yeni kategori önerileri. Onayladığın talepleri
          aşağıdaki <span className="font-semibold text-ink">Kategoriye ekle</span>{' '}
          butonuyla doğrudan yayına alabilirsin. Yeni bir kategoriyi sıfırdan da
          ekleyebilirsin.
        </p>
      </div>

      {/* Sıfırdan yeni kategori ekleme */}
      <div className="mb-6">
        <YeniKategoriFormu />
      </div>

      {/* Status filtre chip'leri */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'pending', label: 'Bekleyen', accent: 'brandInk' },
          { key: 'reviewing', label: 'İnceleniyor', accent: 'brandAccent' },
          { key: 'approved', label: 'Onaylı', accent: 'moss' },
          { key: 'declined', label: 'Reddedilen', accent: 'ink-72' },
          { key: 'all', label: 'Tümü', accent: 'ink' },
        ].map((opt) => {
          const count = statusCounts[opt.key] ?? 0;
          const isActive = statusFilter === opt.key;
          return (
            <Link
              key={opt.key}
              href={
                opt.key === 'pending'
                  ? '/admin/kategori-talepleri'
                  : `/admin/kategori-talepleri?status=${opt.key}`
              }
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                isActive
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-card text-ink-72 border-line hover:border-ink-50 hover:text-ink'
              }`}
            >
              {opt.label}
              <span
                className={`tabular-nums ${
                  isActive ? 'text-paper/70' : 'text-ink-50'
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Liste */}
      {requests.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-10 text-center">
          <p className="font-display font-medium text-lg text-ink mb-1">
            Bu durumda talep yok.
          </p>
          <p className="text-sm text-ink-72">
            Filtreyi değiştirip diğer talepleri görebilirsin.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const userDisplayName =
              (req.user?.role === 'business' || req.user?.role === 'agency') &&
              req.user?.company_name
                ? req.user.company_name
                : req.user?.full_name || req.user?.email || 'Anonim';

            const eventLabel = req.event_context
              ? EVENT_CONTEXT_LABELS[req.event_context] || req.event_context
              : null;

            const normalized = req.category_name.toLowerCase().trim();
            const popularity = popularityMap[normalized] ?? 1;

            return (
              <div
                key={req.id}
                className="bg-card border border-line rounded-2xl p-5 md:p-6"
              >
                {/* Üst — kategori adı + popülarite + status */}
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h2 className="font-display font-semibold text-lg text-ink">
                        {req.category_name}
                      </h2>
                      {popularity > 1 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] bg-brand-ink/10 text-brand-ink border border-brand-ink/30"
                          title="Bu kategori için toplam talep sayısı"
                        >
                          {popularity}× istendi
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-ink-72 font-mono">
                      <span className="text-ink">{userDisplayName}</span>
                      {req.user?.email && (
                        <span className="text-ink-50 ml-2">
                          ({req.user.email})
                        </span>
                      )}
                      <span className="text-ink-50 mx-2">·</span>
                      {formatRelative(req.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] border ${
                      STATUS_STYLES[req.status]
                    }`}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>

                {/* Açıklama */}
                {req.description && (
                  <div className="bg-paper-2/50 border border-line rounded-xl p-3 mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                      Açıklama
                    </p>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {req.description}
                    </p>
                  </div>
                )}

                {/* Etkinlik bağlamı */}
                {eventLabel && (
                  <p className="text-[12px] text-ink-72 mb-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mr-2">
                      Bağlam
                    </span>
                    {eventLabel}
                  </p>
                )}

                {/* Reviewed bilgisi (varsa) */}
                {req.reviewed_at && (
                  <p className="text-[11px] text-ink-50 font-mono mb-3">
                    İncelendi: {formatDate(req.reviewed_at)}
                  </p>
                )}

                {/* Aksiyonlar */}
                <div className="pt-3 border-t border-line space-y-3">
                  <TalepAksiyonlari
                    requestId={req.id}
                    status={req.status}
                    categoryName={req.category_name}
                  />
                  {/* Onaylı/incelenen talebi doğrudan kategoriye çevir */}
                  {(req.status === 'approved' || req.status === 'reviewing') && (
                    <YeniKategoriFormu
                      initialName={req.category_name}
                      fromRequestId={req.id}
                      triggerLabel="Kategoriye ekle"
                      triggerVariant="inline"
                      closeOnSuccess
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}