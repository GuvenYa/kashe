import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Keşfet — Kashe',
};

export default async function KesfetPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris');
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Keşfet
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              Profesyonelleri{' '}
              <em className="text-terracotta not-italic italic font-medium">
                keşfet
              </em>
              .
            </h1>
            <p className="text-ink-72 text-lg mt-4 max-w-2xl">
              Etkinliğin için doğru profesyoneli burada bulacaksın.
            </p>
          </div>

          <div className="p-12 bg-white border border-line rounded-lg text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
              Yakında
            </p>
            <p className="font-display text-2xl text-ink mb-3">
              Profesyonel listesi geliştiriliyor.
            </p>
            <p className="text-ink-72 max-w-md mx-auto">
              İlk profesyoneller onboarding sürecinde. Birkaç gün içinde burada
              listelemeye başlayacağız.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}