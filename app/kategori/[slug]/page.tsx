import { createClient } from '@/app/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { ProfileCard } from '@/app/kesfet/profile-card';
import { EmptyState } from '@/app/components/EmptyState';
import { getFavoritedIds } from '@/app/favoriler/actions';
import { getCategoryIcon } from '@/app/lib/category-icon';
import { isBusy as computeBusy, busyWindowKeys } from '@/app/lib/badges';
import {
  getCategoryContent,
  USE_CASES,
  CATEGORY_TAGLINE,
} from '@/app/lib/category-content';

type Props = {
  params: Promise<{ slug: string }>;
};

type CategoryRow = {
  id: number;
  slug: string;
  name_tr: string;
  emoji: string | null;
  description: string | null;
  seo_title: string | null;
};

type PublishedProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city_id: number | null;
  primary_category_id: number | null;
  company_name: string | null;
  role: string;
  created_at: string | null;
  approval_status: string | null;
  premium_tier: string | null;
  premium_until: string | null;
  attributes: Record<string, string | string[]> | null;
  turkish_cities: { name: string } | null;
  service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
};

type ServicePriceInfo = {
  price_min: number | null;
  price_max: number | null;
  price_on_request: boolean;
};

// Kategori adına göre dinamik SSS üret. Platform işleyişine dair sorular —
// kategoriden bağımsız aynı, sadece kategori adı değişir.
function getCategoryFaq(categoryName: string): { q: string; a: string }[] {
  const lower = categoryName.toLocaleLowerCase('tr');
  return [
    {
      q: `Kashe'de nasıl ${categoryName.toLocaleLowerCase('tr')} bulurum?`,
      a: `Kategori sayfasından şehir, fiyat ve puana göre filtreleyerek ${lower} profesyonellerini karşılaştırabilirsin. Beğendiğin profilden doğrudan teklif alabilir, rezervasyon talebi gönderebilir ya da mesajla iletişime geçebilirsin.`,
    },
    {
      q: `${categoryName} için nasıl teklif alırım?`,
      a: `İki yolu var: Beğendiğin bir profile girip "Teklif Al" diyebilir, ya da "Teklif Topla" ile ihtiyacını anlatıp ${lower} kategorisindeki birden fazla profesyonelden teklif toplayabilirsin. Teklif almak ücretsizdir.`,
    },
    {
      q: `Fiyatlar neye göre belirleniyor?`,
      a: `Fiyatlar profesyonelin deneyimine, hizmet kapsamına, etkinlik tarihine ve süresine göre değişir. Profil kartlarında başlangıç fiyatını veya fiyat aralığını görebilir, net fiyat için teklif alabilirsin. Bazı profesyoneller hazır paketler de sunar.`,
    },
    {
      q: `Ödeme nasıl yapılıyor, güvenli mi?`,
      a: `Kashe bir aracı platformdur; iletişim, teklif ve rezervasyon süreçlerini tek yerde toplar. Anlaşma detaylarını profesyonelle netleştirir, işlemini platform üzerinden güvenle takip edebilirsin. Tamamlanan işler için karşılıklı değerlendirme yapılır.`,
    },
    {
      q: `Profesyonellerin güvenilirliğini nasıl anlarım?`,
      a: `Her profilde doğrulama rozetleri, gerçek müşteri yorumları, puanlar ve portföy bulunur. Tamamlanmış işlerden gelen değerlendirmeleri inceleyerek doğru ${lower} profesyoneline güvenle karar verebilirsin.`,
    },
  ];
}

async function getCategory(slug: string): Promise<CategoryRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_categories')
    .select('id, slug, name_tr, emoji, description, seo_title')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  return (data as CategoryRow) ?? null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: 'Kategori bulunamadı — Kashe' };

  // Editöryel içerik varsa onu kullan; yoksa mevcut fallback AYNEN kalır
  const content = getCategoryContent(slug);
  const title =
    content?.seoTitle || category.seo_title || `${category.name_tr} — Kashe`;
  return {
    title,
    description:
      content?.seoDescription ??
      category.description ??
      `${category.name_tr} kategorisinde doğrulanmış profesyonelleri Kashe'de keşfedin.`,
  };
}

export default async function KategoriPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const category = await getCategory(slug);
  if (!category) {
    notFound();
  }

  // Kategoriye özel editöryel içerik (yalnızca dolu kategorilerde; yoksa null → generic)
  const content = getCategoryContent(slug);

  // Bu kategorideki yayında profiller
  const { data: profilesData } = await supabase
    .from('profiles')
    .select(
      `
      id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, attributes, created_at, approval_status, premium_tier, premium_until,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
    `
    )
    .eq('is_published', true)
    .in('role', ['professional', 'agency'])
    .eq('primary_category_id', category.id)
    .order('updated_at', { ascending: false });

  const profiles = (profilesData || []) as unknown as PublishedProfile[];

  // Premium profiller üstte — keşfetle aynı mantık (stable sort sırayı korur)
  const tierWeight = (tier: string | null, until: string | null): number => {
    if (!tier || tier === 'none') return 0;
    if (until && new Date(until).getTime() <= Date.now()) return 0;
    if (tier === 'agency') return 3;
    if (tier === 'plus') return 2;
    if (tier === 'premium') return 1;
    return 0;
  };
  profiles.sort(
    (a, b) =>
      tierWeight(b.premium_tier, b.premium_until) -
      tierWeight(a.premium_tier, a.premium_until)
  );
  const profileIds = profiles.map((p) => p.id);

  // Fiyat + puan verisi (kart için)
  const servicesByProfile: Record<string, ServicePriceInfo[]> = {};
  const ratingsByProfile: Record<string, { count: number; average: number }> = {};

  if (profileIds.length > 0) {
    const [{ data: servicesData }, { data: ratingsData }] = await Promise.all([
      supabase
        .from('services')
        .select('profile_id, price_min, price_max, price_on_request')
        .eq('is_active', true)
        .in('profile_id', profileIds),
      supabase
        .from('professional_rating_summary')
        .select('professional_id, review_count, average_rating')
        .in('professional_id', profileIds),
    ]);

    (servicesData || []).forEach((svc) => {
      if (!servicesByProfile[svc.profile_id]) servicesByProfile[svc.profile_id] = [];
      servicesByProfile[svc.profile_id].push({
        price_min: svc.price_min,
        price_max: svc.price_max,
        price_on_request: svc.price_on_request,
      });
    });

    (ratingsData || []).forEach((r) => {
      ratingsByProfile[r.professional_id] = {
        count: r.review_count,
        average: r.average_rating,
      };
    });
  }

  // ---- MÜSAİTLİK (Sıra 3): önümüzdeki 7 gün dolu mu? (Keşfet ile aynı mantık) ----
  const busyByProfile: Record<string, boolean> = {};
  if (profileIds.length > 0) {
    const windowKeys = busyWindowKeys();
    const windowStart = windowKeys[0];
    const windowEnd = windowKeys[windowKeys.length - 1];

    const blockedByProfile: Record<string, Set<string>> = {};
    const addDay = (pid: string, day: string) => {
      if (!blockedByProfile[pid]) blockedByProfile[pid] = new Set();
      blockedByProfile[pid].add(day);
    };

    const [{ data: blocksData }, { data: bookingsData }] = await Promise.all([
      supabase
        .from('availability_blocks')
        .select('profile_id, blocked_date')
        .in('profile_id', profileIds)
        .gte('blocked_date', windowStart)
        .lte('blocked_date', windowEnd),
      supabase
        .from('bookings')
        .select('professional_id, event_date, status')
        .in('professional_id', profileIds)
        .in('status', ['confirmed', 'completed'])
        .gte('event_date', windowStart)
        .lte('event_date', windowEnd),
    ]);

    (blocksData || []).forEach((b) => {
      if (b.blocked_date) addDay(b.profile_id, b.blocked_date as string);
    });
    (bookingsData || []).forEach((bk) => {
      if (bk.event_date) addDay(bk.professional_id, bk.event_date as string);
    });

    for (const pid of profileIds) {
      busyByProfile[pid] = computeBusy(blockedByProfile[pid] ?? new Set());
    }

    // Yoğun olanları dibe at (premium bile olsa müsait olanların altında).
    profiles.sort((a, b) => {
      const ba = busyByProfile[a.id] ? 1 : 0;
      const bb = busyByProfile[b.id] ? 1 : 0;
      return ba - bb;
    });
  }

  // Kullanıcı durumu (favori + rol)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;
  let favoritedIds = new Set<string>();

  if (user) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    currentUserRole = currentProfile?.role ?? null;
    if (currentUserRole === 'client') {
      favoritedIds = await getFavoritedIds();
    }
  }

  const isLoggedIn = !!user;
  const iconUrl = getCategoryIcon(category.slug);
  const faq = getCategoryFaq(category.name_tr);

  // FAQPage JSON-LD — Google zengin sonuç için
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <>
      <TopNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="min-h-screen bg-paper">
        {/* HERO */}
        <section className="border-b border-line bg-card">
          <div className="max-w-5xl mx-auto px-6 md:px-12 py-14 md:py-20">
            <Link
              href="/kesfet"
              className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-8"
            >
              ← Tüm kategoriler
            </Link>

            <div className="flex items-start gap-5 flex-wrap">
              {iconUrl && (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "#EAF0F8" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={iconUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-contain p-2"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
                  Kategori
                </p>
                <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
                  {content?.heroHeadline ?? category.name_tr}
                </h1>
                {(content?.description ?? category.description) && (
                  <p className="text-ink-72 text-lg mt-4 max-w-2xl leading-relaxed">
                    {content?.description ?? category.description}
                  </p>
                )}
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mt-5">
                  {profiles.length} profesyonel
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ALT HİZMETLER — yalnızca editöryel içeriği olan kategorilerde */}
        {content?.subServices && content.subServices.length > 0 && (
          <section className="border-b border-line">
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-14 md:py-16">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
                Alt hizmetler
              </p>
              <h2 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight mb-8">
                {category.name_tr}{' '}
                <em className="text-terracotta not-italic italic font-medium">
                  alanları
                </em>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {content.subServices.map((sub) => (
                  <div
                    key={sub.name}
                    className="bg-card border border-line rounded-2xl p-5 hover:border-terracotta transition-colors"
                  >
                    <p className="font-display font-semibold text-ink leading-snug mb-1.5">
                      {sub.name}
                    </p>
                    <p className="text-sm text-ink-72 leading-relaxed">
                      {sub.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* PROFİLLER */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
          {profiles.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Bu kategoride henüz profil yok"
              description="Bu alanda yetenekler kayıt sürecinde. Çok yakında burası dolacak. Diğer kategorilere göz atabilirsin."
              action={{ label: 'Tüm kategorileri keşfet', href: '/kesfet' }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
                <h2 className="font-display text-2xl text-ink">
                  {category.name_tr}{' '}
                  <span className="text-ink-72">profesyonelleri</span>
                </h2>
                <Link
                  href={`/kesfet?kategori=${category.id}`}
                  className="font-mono text-xs uppercase tracking-[0.14em] text-terracotta hover:underline"
                >
                  Filtrele ve ara →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr">
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    services={servicesByProfile[profile.id] || []}
                    rating={ratingsByProfile[profile.id] || null}
                    isFavorited={favoritedIds.has(profile.id)}
                    isLoggedIn={isLoggedIn}
                    currentUserRole={currentUserRole}
                    isBusy={busyByProfile[profile.id] ?? false}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* KİMLER KULLANIR? — yalnızca editöryel içeriği olan kategorilerde */}
        {content && (
          <section className="border-t border-line bg-card">
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-14 md:py-16">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
                {CATEGORY_TAGLINE}
              </p>
              <h2 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight mb-8">
                Kimler{' '}
                <em className="text-terracotta not-italic italic font-medium">
                  kullanır
                </em>
                ?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {USE_CASES.map((uc) => (
                  <div
                    key={uc.role}
                    className="bg-paper border border-line rounded-2xl p-6"
                  >
                    <p className="font-display font-semibold text-lg text-ink mb-2">
                      {uc.role}
                    </p>
                    <p className="text-sm text-ink-72 leading-relaxed">
                      {uc.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Kashe AI önerisi */}
          <section className="border-t border-line px-6 md:px-12 py-10">
            <div className="max-w-7xl mx-auto">
              <Link
                href="/pro-bul"
                className="kashe-tap group flex items-center gap-4 bg-card border border-line rounded-2xl p-5 md:p-6 hover:border-terracotta transition"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-terracotta/10 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terracotta">
                    <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-1">
                    Kashe AI
                  </p>
                  <p className="font-display font-semibold text-ink leading-snug">
                    Sana en uygun {category.name_tr.toLocaleLowerCase('tr')}{' '}
                    profesyonelini bulalım
                  </p>
                  <p className="text-sm text-ink-72 mt-0.5 leading-relaxed">
                    Nasıl biri aradığını anlat, yapay zekâ gerekçesiyle önersin.
                  </p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-72 group-hover:text-terracotta transition">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </section>

          {/* SSS */}
          <section className="border-t border-line">
          <div className="max-w-3xl mx-auto px-6 md:px-12 py-14 md:py-16">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
              Sık sorulan sorular
            </p>
            <h2 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight mb-8">
              {category.name_tr} hakkında{' '}
              <em className="text-terracotta not-italic italic font-medium">
                merak edilenler
              </em>
            </h2>
            <div className="space-y-3">
              {faq.map((item, i) => (
                <details
                  key={i}
                  className="group bg-card border border-line rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer px-5 py-4 list-none">
                    <span className="font-display font-medium text-ink text-lg">
                      {item.q}
                    </span>
                    <span
                      className="shrink-0 text-terracotta transition-transform duration-200 group-open:rotate-45"
                      aria-hidden="true"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-ink-72 leading-relaxed">{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — ilan aç / teklif topla */}
        <section className="border-t border-line bg-card">
          <div className="max-w-5xl mx-auto px-6 md:px-12 py-14 text-center">
            <h2 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              Aradığını{' '}
              <em className="text-terracotta not-italic italic font-medium">
                bulamadın mı
              </em>
              ?
            </h2>
            <p className="text-ink-72 mt-3 max-w-xl mx-auto">
              İhtiyacını anlat, {category.name_tr.toLocaleLowerCase('tr')}{' '}
              kategorisindeki profesyoneller sana özel teklif göndersin.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
              <Link
                href="/teklif-topla"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
              >
                Teklif topla
              </Link>
              <Link
                href="/ilanlar/yeni"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-transparent border border-ink text-ink rounded-lg font-display font-semibold text-sm hover:bg-ink hover:text-paper transition-all"
              >
                İlan aç
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
