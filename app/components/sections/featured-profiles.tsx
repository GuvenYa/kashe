import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { Eyebrow } from "@/app/components/ui/eyebrow";
import { ProfileCard } from "@/app/kesfet/profile-card";
import { getFavoritedIds } from "@/app/favoriler/actions";
import { getZiyaretci } from "@/app/lib/ziyaretci";
import {
  PROVIDER_LISTING_COLUMNS,
  type ProviderListing,
} from "@/app/lib/types";

// Üst filtre çıtası için popüler kategoriler (slug'larla)
const TOP_CATEGORIES = [
  { slug: "fotografci", label: "Fotoğrafçı" },
  { slug: "dj", label: "DJ" },
  { slug: "muzisyen", label: "Müzisyen" },
  { slug: "sunucu", label: "Sunucu" },
];

/** Ana sayfada gösterilen kart sayısı (4 sütun x 4 satır); ilk 8'i her
 *  ekranda, 9-16 yalnız lg+. */
const HOME_LIMIT = 16;
const MOBIL_LIMIT = 8;

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

  // Daha geniş havuz çek (premium önceliklendirme için), sonra 16'ya indir.
  // FAZ 2c: one cikanlar saglayici gorunumunden; filtre ve siralama ayni.
  // Sutun listesi Kesfet ile AYNI (PROVIDER_LISTING_COLUMNS) — standart kart
  // tanitim metnini ve etiketlerini bu alanlardan okuyor.
  const { data: profiles } = await supabase
    .from("v_providers_public")
    .select(
      `
      ${PROVIDER_LISTING_COLUMNS},
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
    `
    )
    .eq("is_published", true)
    .in("role", ["professional", "agency"])
    .order("updated_at", { ascending: false })
    .limit(48);

  const rawList = (profiles || []) as unknown as ProviderListing[];

  // Premium profilleri öne al (stable sort updated_at sırasını korur), ilk 16
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
    .slice(0, HOME_LIMIT);

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

  // Favori kalbi yalniz client rolunde dolu gelir (Kesfet ile ayni kalip).
  const ziyaretci = await getZiyaretci();
  let favoritedIds = new Set<string>();
  if (ziyaretci.rol === "client") {
    favoritedIds = await getFavoritedIds();
  }

  // NOT: kapak zinciri Kesfet'teki portföy fallback'ini KULLANMAZ (ek sorgu
  // olurdu); avatar yoksa kart placeholder'a düşer. İş sayısı (bookings) da bu
  // bölümde sorgulanmaz — jobsCount 0.

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
            prefetch={false}
            className="kashe-tap shrink-0 font-mono text-xs uppercase tracking-[0.16em] text-brand-ink hover:underline inline-flex items-center gap-1.5 self-start md:self-auto"
          >
            Tümünü keşfet →
          </Link>
        </div>

        {/* Kategori filtre çıtası */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/kesfet"
            prefetch={false}
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
                prefetch={false}
                className="kashe-tap px-4 py-2 rounded-full text-xs font-mono uppercase tracking-[0.14em] bg-transparent text-ink-72 border border-line hover:border-ink hover:text-ink transition-colors"
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {/* Profil kartları — Keşfet ile AYNI standart kart: masaüstünde hover
            paneli (tanıtım + etiketler + Teklif Al), mobilde açık gövde.
            4 sütun x 4 satır; `yogun` ile foto alanı aspect-[4/3]'e daralır.
            9-16. kartlar yalnız lg+ (telefon/tablette 8 kart yeterli). */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {list.map((p, i) => (
            <div
              key={p.id}
              className={i >= MOBIL_LIMIT ? "hidden lg:block" : undefined}
            >
              <ProfileCard
                profile={p}
                yogun
                cover={p.avatar_url ?? null}
                rating={ratingsByProfile[p.id] || null}
                isFavorited={favoritedIds.has(p.id)}
                isLoggedIn={ziyaretci.girisli}
                currentUserRole={ziyaretci.rol}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
