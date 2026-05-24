import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { formatQuoteAmount, formatExpiresIn } from '@/app/mesajlar/quotes-data';

export const metadata = {
  title: 'Teklif Karşılaştır — Kashe',
};

export default async function TeklifKarsilastirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/giris');

  // Talep + sahiplik kontrolü
  const { data: request } = await supabase
    .from('quote_requests')
    .select(
      `
      id, customer_id, status, recipient_count, brief_data, created_at,
      response_deadline, share_budget, budget_min, budget_max,
      service_categories (name_tr),
      turkish_cities (name)
    `
    )
    .eq('id', id)
    .single();

  if (!request) notFound();
  if (request.customer_id !== user.id) redirect('/teklif-taleplerim');

  // Bu talebe teklif veren recipient'lar (quoted)
  const { data: quotedRecipients, error: recError } = await supabase
    .from('quote_request_recipients')
    .select(
      `
      id, conversation_id, responded_at,
      professional:profiles!quote_request_recipients_professional_id_fkey (
        id, full_name, company_name, avatar_url, role, slug
      )
    `
    )
    .eq('request_id', id)
    .eq('status', 'quoted');

  console.log('[teklif-detay] recipients:', quotedRecipients?.length, 'error:', recError);

  const recipients = quotedRecipients || [];

  // Her recipient'ın conversation'ındaki en güncel quote'u çek
  const conversationIds = recipients
    .map((r: any) => r.conversation_id)
    .filter(Boolean);

  let quotesByConv: Record<string, any> = {};
  if (conversationIds.length > 0) {
    const { data: quotes } = await supabase
      .from('quotes')
      .select(
        'id, conversation_id, total_amount, currency, services_description, expires_at, status, created_at'
      )
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    // Her conversation için en güncel quote (ilk gelen, desc sıralı)
    (quotes || []).forEach((q: any) => {
      if (!quotesByConv[q.conversation_id]) {
        quotesByConv[q.conversation_id] = q;
      }
    });
  }

  // Profesyonel puanlarını ayrı sorguyla çek (nested join satır eliyordu)
  const proIds = recipients
    .map((r: any) => r.professional?.id)
    .filter(Boolean);
  let ratingByPro: Record<string, { avg: number; count: number }> = {};
  if (proIds.length > 0) {
    const { data: ratings } = await supabase
      .from('professional_rating_summary')
      .select('professional_id, average_rating, total_reviews')
      .in('professional_id', proIds);
    (ratings || []).forEach((r: any) => {
      ratingByPro[r.professional_id] = {
        avg: Number(r.average_rating),
        count: r.total_reviews,
      };
    });
  }

  const categoryName = (request.service_categories as any)?.name_tr;
  const cityName = (request.turkish_cities as any)?.name;

  // Teklifleri fiyata göre sırala (düşükten yükseğe)
  const offers = recipients
    .map((r: any) => ({
      recipient: r,
      quote: r.conversation_id ? quotesByConv[r.conversation_id] : null,
    }))
    .filter((o) => o.quote)
    .sort((a, b) => Number(a.quote.total_amount) - Number(b.quote.total_amount));

  const cheapest = offers.length > 0 ? offers[0].quote.total_amount : null;

  return (
    <div className="bg-paper min-h-screen">
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
        
        <Link
          href="/teklif-taleplerim"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-terracotta mb-8 transition-colors"
        >
          <span>←</span> Taleplerim
        </Link>

        <header className="mb-8">
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
          </div>
          <h1 className="font-display text-3xl text-ink leading-tight">
            Gelen teklifler{' '}
            <span className="text-ink-72">({offers.length})</span>
          </h1>
          <p className="mt-2 text-ink-72 text-sm">
            {request.recipient_count} profesyonele gönderildi, {offers.length}{' '}
            teklif geldi. En uygun teklifi seç, mesajlaşmaya devam et.
          </p>
        </header>

        {offers.length === 0 ? (
          <div className="bg-white border border-line rounded-lg p-12 text-center">
            <p className="font-display text-xl text-ink mb-2">
              Henüz teklif gelmedi
            </p>
            <p className="text-ink-72 text-sm">
              Profesyoneller talebini inceliyor. Teklif geldiğinde burada
              karşılaştırabilirsin.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map(({ recipient, quote }) => {
              const pro = recipient.professional;
              const proName =
                pro?.company_name || pro?.full_name || 'Profesyonel';
              const isCheapest = quote.total_amount === cheapest;
              const expired = new Date(quote.expires_at) < new Date();

              return (
                <div
                  key={recipient.id}
                  className={`bg-white border rounded-lg p-6 ${
                    isCheapest ? 'border-moss' : 'border-line'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Sol: profesyonel */}
                    <div className="flex items-start gap-3 min-w-0">
                      {pro?.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pro.avatar_url}
                          alt={proName}
                          className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center text-terracotta font-display font-semibold shrink-0">
                          {proName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-lg text-ink">
                            {proName}
                          </h3>
                          {isCheapest && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-moss bg-moss/10 px-1.5 py-0.5 rounded">
                              En uygun
                            </span>
                          )}
                        </div>
                        {pro?.id && ratingByPro[pro.id] && ratingByPro[pro.id].count > 0 && (
                          <p className="text-xs text-ink-72 mt-0.5">
                            ★ {ratingByPro[pro.id].avg.toFixed(1)} (
                            {ratingByPro[pro.id].count} değerlendirme)
                          </p>
                        )}
                        {pro?.slug && (
                            <a
                          
                            href={`/p/${pro.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:text-ink transition-colors"
                          >
                            Profili gör →
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Sağ: fiyat */}
                    <div className="text-right shrink-0">
                      <p className="font-display text-2xl text-ink leading-none">
                        {formatQuoteAmount(
                          Number(quote.total_amount),
                          quote.currency
                        )}
                      </p>
                      <p
                        className={`font-mono text-[10px] uppercase tracking-[0.14em] mt-1 ${
                          expired ? 'text-ember' : 'text-ink-72'
                        }`}
                      >
                        {expired ? 'Süresi doldu' : formatExpiresIn(quote.expires_at)}
                      </p>
                    </div>
                  </div>

                  {/* Hizmet açıklaması */}
                  {quote.services_description && (
                    <p className="text-sm text-ink-72 mt-4 line-clamp-3 whitespace-pre-wrap">
                      {quote.services_description}
                    </p>
                  )}

                  {/* Aksiyon */}
                  <div className="mt-4 pt-4 border-t border-line">
                    <Link
                      href={`/mesajlar/${recipient.conversation_id}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:bg-ink/90 transition"
                    >
                      Teklifi incele &amp; mesajlaş →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}