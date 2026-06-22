import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { EtkinlikPlanlaClient } from './etkinlik-planla-client';

export const metadata = {
  title: 'Etkinlik Planlama Asistanı — Kashe',
  description:
    'Etkinliğini anlat, yapay zekâ sana hangi profesyonellere ihtiyacın olduğunu önersin.',
};

export default async function EtkinlikPlanlaPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('service_categories')
    .select('slug, name_tr')
    .eq('is_active', true)
    .order('name_tr');

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
              Etkinliğini anlat,{' '}
              <em className="text-terracotta not-italic italic font-medium">
                gerisini bize bırak
              </em>
              .
            </h1>
            <p className="text-ink-72 mt-4 leading-relaxed">
              Nasıl bir etkinlik planladığını birkaç cümleyle yaz. Yapay zekâ
              sana hangi profesyonellere ihtiyacın olabileceğini, tahmini bir
              bütçeyle birlikte önersin.
            </p>
          </div>

          <EtkinlikPlanlaClient categories={categories ?? []} />
        </div>
      </main>
    </>
  );
}