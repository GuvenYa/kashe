import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { ProBulClient } from './pro-bul-client';

export const metadata = {
  title: 'Profesyonel Bul — Kashe',
  description:
    'Ne tür bir profesyonel aradığını anlat, yapay zekâ sana en uygun profesyonelleri önersin.',
};

export default async function ProBulPage() {
  const supabase = await createClient();

  const [categoriesRes, citiesRes] = await Promise.all([
    supabase
      .from('service_categories')
      .select('slug, name_tr')
      .eq('is_active', true)
      .order('name_tr'),
    supabase.from('turkish_cities').select('id, name').order('name'),
  ]);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Yapay Zekâ Asistanı
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              Sana en uygun{' '}
              <em className="text-terracotta not-italic italic font-medium">
                profesyoneli
              </em>{' '}
              bulalım.
            </h1>
            <p className="text-ink-72 mt-4 leading-relaxed">
              Hangi kategoride, nasıl bir profesyonel aradığını anlat. Yapay
              zekâ, yayındaki profiller arasından sana en uygun olanları
              gerekçesiyle önersin.
            </p>
          </div>

          <ProBulClient
            categories={categoriesRes.data ?? []}
            cities={citiesRes.data ?? []}
          />
        </div>
      </main>
    </>
  );
}