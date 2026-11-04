import { Suspense } from 'react';
import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { orderCities } from '@/app/lib/city-order';
import { getCachedUser } from '@/app/lib/auth';
import { etkinlikTurleri } from '@/app/lib/etkinlik-turleri';
import { KasheAiClient } from './kashe-ai-client';

export const metadata = {
  title: 'Kashe AI — Etkinliğini ya da aradığın profesyoneli anlat',
  description:
    'Tek kutuya yaz: Kashe AI ne aradığını anlar, uygun profesyonelleri gösterir ya da etkinliğini planlamaya başlar.',
};

/**
 * KASHE AI — TEK GIRIS (Duzeltme 06-C, bulgu 65).
 *
 * Eskiden burada iki kart vardi ("Etkinlik Planlama Asistani" / "Profesyonel
 * Bulma") ve kullanici hangisinin isine yaradigini kestiremiyordu. Simdi tek
 * kutu var: NIYETI model cikarir (tek rol -> profesyonel listesi, cok rol ->
 * etkinlik plani). Eski iki asistan adresi buraya kalici yonlendirme ile
 * gelir (bkz. next.config.ts).
 *
 * Girissiz de calisir: hak kapisi sunucu tarafinda (`analyzeEventNeeds` ->
 * `girissizHakKullan`). Sayfa oturum durumunu yalniz "kalan hak notu" ve giris
 * baglantisi icin biliyor.
 */
export default async function KasheAiPage() {
  const supabase = await createClient();

  const [categoriesRes, citiesRes, turler, user] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('turkish_cities').select('id, name').order('name'),
    // FAZ 10b: tur listesi TEK KAYNAK katmanindan (bir saat onbellekli).
    etkinlikTurleri(),
    getCachedUser(),
  ]);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              <span className="w-5 h-px bg-brand-accent" aria-hidden="true" />
              Kashe AI
            </p>
            <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-tight">
              Etkinliğini ya da aradığın{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                profesyoneli
              </em>{' '}
              anlat.
            </h1>
            <p className="text-ink-72 mt-4 leading-relaxed max-w-xl">
              Tek kutuya yaz, gerisini Kashe AI çıkarsın: tek bir role mi
              ihtiyacın var, yoksa bir etkinliğin tamamını mı kurmak istiyorsun?
            </p>
          </div>

          <Suspense fallback={null}>
            <KasheAiClient
              kategoriler={(categoriesRes.data ?? []) as {
                id: number;
                slug: string;
                name_tr: string;
              }[]}
              sehirler={orderCities(citiesRes.data ?? [])}
              turler={turler.map((t) => ({ key: t.key, label: t.label }))}
              oturumVar={!!user}
            />
          </Suspense>
        </div>
      </main>
    </>
  );
}
