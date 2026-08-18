import { Suspense } from 'react';
import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { orderCities } from '@/app/lib/city-order';
import { applyDiscoverBase } from '@/app/lib/discover-base';
import { SihirbazClient, type SihirbazProfil } from './sihirbaz-client';

export const metadata = {
  title: 'Etkinlik Sihirbazı — Kashe',
  description:
    'Etkinlik türünü, şehrini ve ihtiyaçlarını seç; sana uyan profesyonelleri gör.',
};

/**
 * SAYAÇ VERİSİ — neden istemciye taşınıyor:
 * Her seçim değişiminde ayrı bir count sorgusu atmak yerine, Keşfet'in temel
 * filtrelerinden geçmiş profillerin YALNIZ sayaç için gereken üç alanı bir kez
 * çekilip istemciye veriliyor. Sonuç: sayaç ANINDA güncelleniyor (debounce yok),
 * sunucu action'ı gerekmiyor, RLS yüzeyi genişlemiyor.
 *
 * ÖLÇEK SINIRI: yayındaki profil sayısı birkaç bini aşarsa bu taşıma pahalılaşır;
 * o noktada sayaç sunucu tarafı bir RPC'ye taşınmalı. Bugün yayındaki profil sayısı
 * iki haneli, satır başına ~4 küçük alan → yük ihmal edilebilir.
 *
 * FİLTRE PARİTESİ: temel görünürlük koşulu `applyDiscoverBase` ile TEK KAYNAKTAN
 * geliyor (app/lib/discover-base). Keşfet de aynı fonksiyonu çağırıyor, dolayısıyla
 * iki taraf yapısal olarak ayrışamaz — yorum bağına gerek kalmadı.
 */
export default async function EtkinlikSihirbaziPage() {
  const supabase = await createClient();

  const [categoriesRes, citiesRes, profilesRes] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('turkish_cities').select('id, name').order('name'),
    applyDiscoverBase(
      supabase
        .from('profiles')
        .select('primary_category_id, city_id, role, category_attributes')
    ),
  ]);

  // Sayaç için gereken minimum şekle indir — category_attributes'ın tamamı taşınmaz.
  const profiller: SihirbazProfil[] = (profilesRes.data ?? []).map((p) => {
    const ca = (p.category_attributes ?? {}) as Record<string, unknown>;
    const et = ca.etkinlik_turleri;
    return {
      kategoriId: p.primary_category_id as number | null,
      sehirId: p.city_id as number | null,
      rol: p.role as string,
      etkinlikTurleri: Array.isArray(et)
        ? et.filter((v): v is string => typeof v === 'string')
        : [],
    };
  });

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          {/* useSearchParams istemci bileşende → Suspense sınırı zorunlu. */}
          <Suspense fallback={<div className="h-96" />}>
            <SihirbazClient
              kategoriler={(categoriesRes.data ?? []) as { id: number; slug: string; name_tr: string }[]}
              sehirler={orderCities((citiesRes.data ?? []) as { id: number; name: string }[])}
              profiller={profiller}
            />
          </Suspense>
        </div>
      </main>
    </>
  );
}
