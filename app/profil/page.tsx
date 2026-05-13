import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Profilim — Kashe',
};

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware zaten redirect ediyor ama defansif olalım
  if (!user) {
    redirect('/giris');
  }

  // Profile bilgisini çek
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const roleLabels: Record<string, string> = {
    professional: 'Profesyonel',
    client: 'Müşteri',
    business: 'Kurumsal',
  };

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Profilim
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              Merhaba,{' '}
              <em className="text-terracotta not-italic italic font-medium">
                {profile?.full_name || 'kullanıcı'}
              </em>
              .
            </h1>
          </div>

          <div className="bg-white border border-line rounded-lg p-8 space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                Email
              </p>
              <p className="text-ink text-lg">{user.email}</p>
            </div>

            <div className="border-t border-line pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                Hesap türü
              </p>
              <p className="text-ink text-lg">
                {roleLabels[profile?.role] || profile?.role || 'Belirtilmemiş'}
              </p>
            </div>

            <div className="border-t border-line pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                Kullanıcı ID
              </p>
              <p className="text-ink text-sm font-mono break-all">{user.id}</p>
            </div>
          </div>

          <div className="mt-12 p-6 bg-terracotta-08 border border-terracotta/20 rounded-lg">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-2">
              Yakında
            </p>
            <p className="text-ink-72">
              Profil düzenleme, portföy yükleme, müsaitlik takvimi ve daha
              fazlası burada olacak.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}