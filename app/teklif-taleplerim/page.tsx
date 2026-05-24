import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/giris?redirect=/teklif-taleplerim');

  // Kendi taleplerim + her birinin recipient'ları (teklif sayısı için)
  const { data: requests } = await supabase
    .from('quote_requests')
    .select(
      `
      id, status, recipient_count, created_at, response_deadline,
      service_categories (name_tr),
      turkish_cities (name),
      quote_request_recipients (id, status)
    `
    )
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  const list = requests || [];

  return (
    <div className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Teklif Taleplerim
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-terracotta not-italic italic font-medium">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all whitespace-nowrap"
          >
            <span className="text-base leading-none">+</span>
            Yeni talep
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="bg-white border border-line rounded-lg p-12 text-center">
            <p className="font-display text-xl text-ink mb-2">
              Henüz teklif talebin yok
            </p>
            <p className="text-ink-72 text-sm mb-6">
              Bir kez ihtiyacını anlat, birden fazla profesyonelden teklif al.
            </p>
            <Link
              href="/teklif-topla"
              className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
            >
              İlk talebini oluştur
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((req: any) => {
              const categoryName = req.service_categories?.name_tr;
              const cityName = req.turkish_cities?.name;
              const recipients = req.quote_request_recipients || [];
              const offerCount = recipients.filter(
                (r: any) => r.status === 'quoted'
              ).length;

              return (
                <Link
                  key={req.id}
                  href={`/teklif-taleplerim/${req.id}`}
                  className="block bg-white border border-line rounded-lg p-6 hover:border-terracotta hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
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
                        {offerCount === 1 ? 'teklif' : 'teklif'}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}