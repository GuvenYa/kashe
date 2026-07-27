import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { CategoryIcon } from '@/app/components/ui/category-icon';
import { getCategoryIcon } from '@/app/lib/category-icon';
import { getCategoryContent, CATEGORY_TAGLINE } from '@/app/lib/category-content';
import { getCategoryFields, type Archetype } from '@/app/lib/category-fields';
import { KategoriTalepCta } from '@/app/components/kategori-talep-cta';

export const metadata: Metadata = {
  title: 'Tüm Kategoriler | Kashe',
  description:
    'Kashe’deki tüm hizmet kategorilerini keşfet: sahne performansı, kamera ve podyum, prodüksiyon ve teknik ekip, uzmanlık ve organizasyon. Kategoriyi seç, profilleri karşılaştır, teklif al.',
};

type CategoryRow = {
  id: number;
  slug: string;
  name_tr: string;
  emoji: string | null;
};

/** Arketip → hub başlığı + tek cümlelik grup tanımı. */
const GROUPS: { key: Archetype | 'diger'; title: string; blurb: string }[] = [
  {
    key: 'sahne',
    title: 'Sahne & Performans',
    blurb: 'Etkinliğinde sahneye çıkan, kalabalığı taşıyan profesyoneller.',
  },
  {
    key: 'cast',
    title: 'Kamera & Podyum',
    blurb: 'Kadraja ve podyuma çıkan oyuncu, model ve etkinlik personeli.',
  },
  {
    key: 'produksiyon',
    title: 'Prodüksiyon & Teknik',
    blurb: 'Görüntüyü, sesi ve ışığı kuran, işi teslim eden ekipler.',
  },
  {
    key: 'uzmanlik',
    title: 'Uzmanlık & Organizasyon',
    blurb: 'Etkinliği planlayan, yöneten ve uzmanlık taşıyan profesyoneller.',
  },
  {
    key: 'diger',
    title: 'Diğer',
    blurb: 'Yeni eklenen ve hazırlanmakta olan kategoriler.',
  },
];

/** Kategori açıklamasının ilk cümlesi — kartta kısa tanıtım olarak kullanılır. */
function shortDescription(slug: string, nameTr: string): string {
  const content = getCategoryContent(slug);
  if (!content?.description) {
    return `${nameTr} kategorisindeki profesyonelleri incele, karşılaştır ve teklif al.`;
  }
  const first = content.description.split(/(?<=\.)\s/)[0] ?? content.description;
  return first.length > 190 ? `${first.slice(0, 187).trimEnd()}…` : first;
}

export default async function KategorilerPage() {
  const supabase = await createClient();

  const [{ data: categoriesData }, { data: { user } }] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr, emoji')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.auth.getUser(),
  ]);

  const categories = (categoriesData || []) as CategoryRow[];

  // Kategori başına yayında profesyonel sayısı (ana sayfa grid'iyle aynı sinyal)
  const countByCat: Record<number, number> = {};
  if (categories.length > 0) {
    const { data: rows } = await supabase
      .from('profiles')
      .select('primary_category_id')
      .eq('is_published', true)
      .in('role', ['professional', 'agency']);
    for (const r of rows || []) {
      if (r.primary_category_id) {
        countByCat[r.primary_category_id] =
          (countByCat[r.primary_category_id] || 0) + 1;
      }
    }
  }

  // Arketipe göre grupla — preset'i olmayan kategori (yeni/yetim) "Diğer"e düşer.
  const byGroup = new Map<string, CategoryRow[]>();
  for (const cat of categories) {
    const key = getCategoryFields(cat.slug)?.archetype ?? 'diger';
    const list = byGroup.get(key) ?? [];
    list.push(cat);
    byGroup.set(key, list);
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-20">
          {/* Başlık */}
          <div className="max-w-2xl mb-12 md:mb-16">
            <Eyebrow variant="inline" className="mb-4">
              Tüm kategoriler
            </Eyebrow>
            <h1 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
              Hangi <em>yeteneği</em> arıyorsun?
            </h1>
            <p className="text-ink-72 mt-5 leading-relaxed">
              {categories.length} kategoride profesyonelleri incele, hizmet
              kapsamlarını karşılaştır ve doğrudan teklif al.
            </p>
          </div>

          {/* Gruplar */}
          <div className="space-y-14">
            {GROUPS.map((group) => {
              const items = byGroup.get(group.key) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={group.key}>
                  <div className="mb-5 max-w-2xl">
                    <h2 className="font-display font-medium text-2xl text-ink">
                      {group.title}
                    </h2>
                    <p className="text-sm text-ink-72 mt-1">{group.blurb}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {items.map((cat) => {
                      const iconUrl = getCategoryIcon(cat.slug);
                      const initials = cat.name_tr
                        .split(' ')
                        .map((s) => s[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();
                      const count = countByCat[cat.id] || 0;

                      return (
                        <Link
                          key={cat.id}
                          href={`/kategori/${cat.slug}`}
                          className="group bg-card border border-line rounded-2xl p-5 flex gap-4 transition-all duration-300 hover:border-brand-ink hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-18px_rgba(26,18,14,0.22)]"
                        >
                          <div className="w-14 h-14 shrink-0 flex items-center justify-center rounded-xl bg-paper-2 overflow-hidden">
                            {iconUrl ? (
                              <CategoryIcon
                                src={iconUrl}
                                name={cat.name_tr}
                                initials={initials}
                              />
                            ) : (
                              <span className="font-display font-medium text-brand-ink text-lg">
                                {initials}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-display font-medium text-[17px] text-ink leading-tight">
                                {cat.name_tr}
                              </h3>
                              {count === 0 && (
                                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-50 bg-paper-2 border border-line px-1.5 py-0.5 rounded">
                                  Yakında
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] text-ink-72 leading-relaxed mt-1.5 line-clamp-3">
                              {shortDescription(cat.slug, cat.name_tr)}
                            </p>
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink inline-flex items-center gap-1 mt-2.5 transition-transform duration-200 group-hover:translate-x-1">
                              Keşfet
                              <span aria-hidden="true">→</span>
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Kapanış */}
          <div className="mt-16 pt-10 border-t border-line flex flex-col items-center gap-5 text-center">
            <p className="font-display text-lg text-ink">{CATEGORY_TAGLINE}</p>
            <KategoriTalepCta
              isLoggedIn={!!user}
              variant="inline"
              existingSlugs={categories.map((c) => c.slug)}
            />
          </div>
        </div>
      </main>
    </>
  );
}
