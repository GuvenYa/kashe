// Kategori ikonu yolu — public/icons/<slug>.png
// Tek kaynak: categories, profile-card, ilanlar buradan kullanır.
export function getCategoryIcon(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return `/icons/${slug}.png`;
}