// Ana sayfa kayan şerit (showcase) — profil seçimi.
//
// Bugün: premium aktifler başa (tierWeight), sonra son güncellenenler → ilk MARQUEE_COUNT.
// İleride "öne çıkan/premium üye showcase"e evrilecek; seçim mantığı TEK yerde dursun diye
// render'dan ayrı tutuldu (createQuoteRequest'teki selectQuoteRecipients gibi temiz ayrım).

import { createClient } from "@/app/lib/supabase-server";

/** Şeritte gösterilecek profil sayısı (over-fetch 24 → ilk N). */
export const MARQUEE_COUNT = 10;

export type MarqueeProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  category: string | null;
  categorySlug: string | null;
};

/** Premium ağırlığı: agency=3, plus=2, premium=1; yok/süresi geçmiş=0. */
function tierWeight(tier: string | null, until: string | null): number {
  if (!tier || tier === "none") return 0;
  if (until && new Date(until).getTime() <= Date.now()) return 0;
  if (tier === "agency") return 3;
  if (tier === "plus") return 2;
  if (tier === "premium") return 1;
  return 0;
}

/**
 * Şerit profillerini döndürür (yayında prof/ajans, premium öncelikli, son güncellenen fallback).
 *
 * Genişletme noktası: ileride is_featured kolonu eklenir ya da premium ağırlığı artırılırsa
 * SADECE buradaki sıralama/seçim değişir — render (category-marquee.tsx) aynı kalır.
 */
export async function getMarqueeProfiles(): Promise<MarqueeProfile[]> {
  const supabase = await createClient();

  // Over-fetch (premium önceliklendirme için geniş havuz), sonra ilk MARQUEE_COUNT
  const { data } = await supabase
    .from("profiles")
    .select(
      `
      id, full_name, avatar_url, company_name, role, premium_tier, premium_until,
      service_categories!profiles_primary_category_id_fkey(name_tr, slug)
    `
    )
    .eq("is_published", true)
    .in("role", ["professional", "agency"])
    .order("updated_at", { ascending: false })
    .limit(24);

  const raw = (data || []) as unknown as Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
    premium_tier: string | null;
    premium_until: string | null;
    service_categories: { name_tr: string; slug: string } | null;
  }>;

  // Premium aktifler başa (stable sort updated_at sırasını korur)
  // ileride: featured öncelik / premium ağırlık artışı buraya
  return [...raw]
    .sort(
      (a, b) =>
        tierWeight(b.premium_tier, b.premium_until) -
        tierWeight(a.premium_tier, a.premium_until)
    )
    .slice(0, MARQUEE_COUNT)
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      company_name: p.company_name,
      role: p.role,
      category: p.service_categories?.name_tr ?? null,
      categorySlug: p.service_categories?.slug ?? null,
    }));
}
