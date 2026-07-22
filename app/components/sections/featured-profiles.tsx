import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { Eyebrow } from "@/app/components/ui/eyebrow";
import { ProfileCard } from "@/app/kesfet/profile-card";

// Üst filtre çıtası için popüler kategoriler (slug'larla)
const TOP_CATEGORIES = [
  { slug: "fotografci", label: "Fotoğrafçı" },
  { slug: "dj", label: "DJ" },
  { slug: "muzisyen", label: "Müzisyen" },
  { slug: "sunucu", label: "Sunucu" },
];

type FeaturedProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  approval_status: string | null;
  premium_tier: string | null;
  premium_until: string | null;
  created_at: string | null;
  city: string | null;
  category: string | null;
  categorySlug: string | null;
  rating: number | null;
  reviewCount: number;
};

export async function FeaturedProfiles() {
  const supabase = await createClient();

  // Kategorileri çek — filtre çıtası için slug → id eşlemesi
  const { data: categoriesData } = await supabase
    .from("service_categories")
    .select("id, slug")
    .eq("is_active", true);
  const slugToId: Record<string, number> = {};
  (categoriesData || []).forEach((c) => {
    slugToId[c.slug] = c.id;
  });

  // Daha geniş havuz çek (premium önceliklendirme için), sonra 6'ya indir
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      `
      id, full_name, avatar_url, company_name, role, created_at, premium_tier, premium_until, approval_status,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, slug)
    `
    )
    .eq("is_published", true)
    .in("role", ["professional", "agency"])
    .order("updated_at", { ascending: false })
    .limit(24);

  const rawList = (profiles || []) as unknown as Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
    created_at: string | null;
    premium_tier: string | null;
    premium_until: string | null;
    approval_status: string | null;
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; slug: string } | null;
  }>;

  // Premium profilleri öne al (stable sort updated_at sırasını korur), ilk 6'yı göster
  const tierWeight = (tier: string | null, until: string | null): number => {
    if (!tier || tier === "none") return 0;
    if (until && new Date(until).getTime() <= Date.now()) return 0;
    if (tier === "agency") return 3;
    if (tier === "plus") return 2;
    if (tier === "premium") return 1;
    return 0;
  };
  const list = [...rawList]
    .sort(
      (a, b) =>
        tierWeight(b.premium_tier, b.premium_until) -
        tierWeight(a.premium_tier, a.premium_until)
    )
    .slice(0, 6);

  if (list.length === 0) return null; // Boş ise bölüm hiç görünmesin

  const ids = list.map((p) => p.id);

  // Ratings
  const { data: ratingsData } = await supabase
    .from("professional_rating_summary")
    .select("professional_id, review_count, average_rating")
    .in("professional_id", ids);

  const ratingsByProfile: Record<string, { count: number; average: number }> = {};
  (ratingsData || []).forEach((r) => {
    ratingsByProfile[r.professional_id] = {
      count: r.review_count,
      average: r.average_rating,
    };
  });

  // NOT: fiyat (services) sorgusu kaldırıldı — kompakt foto-hero kartında fiyat yok.
  // Kapak için Keşfet fallback zinciri (avatar → placeholder); portföy fallback'i bu
  // bölümün sorgusunu ağırlaştırmamak için ATLANDI (ProfileCard cover verilmezse avatar'a düşer).

  const featured: FeaturedProfile[] = list.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    company_name: p.company_name,
    role: p.role,
    approval_status: p.approval_status,
    premium_tier: p.premium_tier,
    premium_until: p.premium_until,
    created_at: p.created_at,
    city: p.turkish_cities?.name ?? null,
    category: p.service_categories?.name_tr ?? null,
    categorySlug: p.service_categories?.slug ?? null,
    rating: ratingsByProfile[p.id]?.average ?? null,
    reviewCount: ratingsByProfile[p.id]?.count ?? 0,
  }));

  return (
    <section className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Header */}
        <div className="mb-10 md:mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <Eyebrow variant="inline" className="mb-4">
              Öne çıkanlar
            </Eyebrow>
            <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
              Bu hafta <em>en çok tercih edilenler</em>.
            </h2>
          </div>
          <Link
            href="/kesfet"
            className="kashe-tap shrink-0 font-mono text-xs uppercase tracking-[0.16em] text-brand-ink hover:underline inline-flex items-center gap-1.5 self-start md:self-auto"
          >
            Tümünü keşfet →
          </Link>
        </div>

        {/* Kategori filtre çıtası */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/kesfet"
            className="kashe-tap px-4 py-2 rounded-full text-xs font-mono uppercase tracking-[0.14em] bg-ink text-paper border border-ink hover:bg-ink-2 transition-colors"
          >
            Tümü
          </Link>
          {TOP_CATEGORIES.map((c) => {
            const catId = slugToId[c.slug];
            if (!catId) return null;
            return (
              <Link
                key={c.slug}
                href={`/kesfet?kategori=${catId}`}
                className="kashe-tap px-4 py-2 rounded-full text-xs font-mono uppercase tracking-[0.14em] bg-transparent text-ink-72 border border-line hover:border-ink hover:text-ink transition-colors"
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {/* Profil kartları — kompakt foto-hero (Keşfet ile aynı görsel dil); kolon yapısı korundu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map((p) => (
            <ProfileCard
              key={p.id}
              variant="compact"
              profile={{
                id: p.id,
                full_name: p.full_name,
                avatar_url: p.avatar_url,
                bio: null,
                company_name: p.company_name,
                role: p.role,
                approval_status: p.approval_status,
                premium_tier: p.premium_tier,
                premium_until: p.premium_until,
                created_at: p.created_at,
                attributes: null,
                turkish_cities: p.city ? { name: p.city } : null,
                service_categories: p.category
                  ? { name_tr: p.category, emoji: null, slug: p.categorySlug ?? '' }
                  : null,
              }}
              rating={
                p.reviewCount > 0 && p.rating !== null
                  ? { count: p.reviewCount, average: p.rating }
                  : null
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
