import { createClient } from '@/app/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import {
  formatPriceRange,
  formatDuration,
  getRoleLabel,
} from '@/app/lib/profile-helpers';
import type { ServiceWithCategory, PortfolioItem } from '@/app/lib/types';

type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city_id: number | null;
  primary_category_id: number | null;
  company_name: string | null;
  role: string;
  is_published: boolean;
  phone: string | null;
  email: string;
  turkish_cities: { name: string } | null;
  service_categories: { name_tr: string; emoji: string | null } | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('full_name, company_name, role, is_published')
    .eq('id', id)
    .single();

  if (!data || !data.is_published) {
    return { title: 'Profil bulunamadı — Kashe' };
  }

  const name =
    data.role === 'business' && data.company_name
      ? data.company_name
      : data.full_name || 'Profil';

  return {
    title: `${name} — Kashe`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      `
      id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, is_published, phone, email,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji)
    `
    )
    .eq('id', id)
    .single();

  if (!profileData) {
    notFound();
  }

  const profile = profileData as unknown as PublicProfile;

  if (!profile.is_published) {
    notFound();
  }

  // Hizmetler + Portföy paralel
  const [{ data: servicesData }, { data: portfolioData }] = await Promise.all([
    supabase
      .from('services')
      .select('*, service_categories(name_tr, emoji)')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('portfolio_items')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false }),
  ]);

  const services = (servicesData || []) as ServiceWithCategory[];
  const portfolioItems = (portfolioData || []) as PortfolioItem[];

  const displayName =
    profile.role === 'business' && profile.company_name
      ? profile.company_name
      : profile.full_name || 'İsimsiz';

  const initials = (profile.full_name || profile.company_name || 'K')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const categoryLabel = profile.service_categories
    ? `${profile.service_categories.emoji || ''} ${profile.service_categories.name_tr}`.trim()
    : null;

  const cityName = profile.turkish_cities?.name;

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/kesfet"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-6"
          >
            ← Keşfet'e dön
          </Link>

          {/* HEADER */}
          <div className="bg-white border border-line rounded-lg p-8 mb-6">
            <div className="flex items-start gap-6 flex-wrap">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-28 h-28 rounded-full object-cover border-2 border-line shrink-0"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-4xl shrink-0">
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  {getRoleLabel(profile.role)}
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
                  {displayName}
                </h1>
                {categoryLabel && (
                  <p className="text-ink-72 mt-1.5">{categoryLabel}</p>
                )}
                {cityName && (
                  <p className="text-sm text-ink-72 mt-2 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 12.25C7 12.25 11.375 8.4375 11.375 5.6875C11.375 3.27258 9.41492 1.3125 7 1.3125C4.58508 1.3125 2.625 3.27258 2.625 5.6875C2.625 8.4375 7 12.25 7 12.25Z" stroke="currentColor" strokeWidth="1" />
                      <circle cx="7" cy="5.6875" r="1.3125" stroke="currentColor" strokeWidth="1" />
                    </svg>
                    {cityName}
                  </p>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-ink mt-6 leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </div>

          {/* PORTFÖY GALERİ */}
          {portfolioItems.length > 0 && (
            <div className="bg-white border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">Portföy</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="aspect-square bg-paper rounded-lg overflow-hidden border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.media_url}
                        alt={item.caption || 'Portfolio'}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    {item.caption && (
                      <p className="text-xs text-ink-72 leading-relaxed line-clamp-2">
                        {item.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HİZMETLER */}
          {services.length > 0 && (
            <div className="bg-white border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">
                Sunulan hizmetler
              </h2>
              <div className="space-y-5">
                {services.map((service) => {
                  const priceLabel = formatPriceRange(
                    service.price_min,
                    service.price_max,
                    service.price_on_request
                  );
                  const durationLabel = formatDuration(service.duration_hours);
                  const catLabel = service.service_categories
                    ? `${service.service_categories.emoji || ''} ${service.service_categories.name_tr}`.trim()
                    : '';
                  return (
                    <div key={service.id} className="border-l-2 border-terracotta pl-5 py-1">
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
                        {catLabel}
                      </p>
                      <h3 className="font-display text-lg text-ink mb-1">
                        {service.title}
                      </h3>
                      <p className="text-sm text-ink-72 mb-2">
                        {[durationLabel, priceLabel].filter(Boolean).join(' · ')}
                      </p>
                      {service.description && (
                        <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap">
                          {service.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* İLETİŞİM */}
          <div className="bg-terracotta/8 border border-terracotta/20 rounded-lg p-6 md:p-8">
            <h2 className="font-display text-xl text-ink mb-2">
              İletişime geçmek ister misin?
            </h2>
            <p className="text-ink-72 text-sm mb-4">
              Müşteri-profesyonel mesajlaşma yakında. Şimdilik iletişim bilgilerini görebilirsin.
            </p>
            <div className="space-y-2">
              {profile.phone && (
                <p className="text-ink">
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mr-2">
                    Telefon
                  </span>
                  {profile.phone}
                </p>
              )}
              <p className="text-ink">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mr-2">
                  Email
                </span>
                {profile.email}
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}