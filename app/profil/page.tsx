import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Profilim — Kashe',
};

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, turkish_cities(name)')
    .eq('id', user.id)
    .single();

  const roleLabels: Record<string, string> = {
    professional: 'Profesyonel',
    client: 'Müşteri',
    business: 'Kurumsal',
  };

  const cityName = profile?.turkish_cities?.name as string | undefined;

  const initials = (profile?.full_name || '')
    .split(' ')
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between mb-12 gap-4">
            <div className="flex items-center gap-5">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'Avatar'}
                  className="w-20 h-20 rounded-full object-cover border-2 border-line"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-2xl">
                  {initials || '?'}
                </div>
              )}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Profilim
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
                  {profile?.full_name || 'Kullanıcı'}
                </h1>
              </div>
            </div>
            <Link
              href="/profil/duzenle"
              className="shrink-0 px-5 py-2.5 border border-ink text-ink rounded-lg font-display font-medium hover:bg-ink hover:text-paper transition-colors"
            >
              Düzenle
            </Link>
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

            {profile?.phone && (
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Telefon
                </p>
                <p className="text-ink text-lg">{profile.phone}</p>
              </div>
            )}

            {cityName && (
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Şehir
                </p>
                <p className="text-ink text-lg">{cityName}</p>
              </div>
            )}

            {profile?.bio && (
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Hakkımda
                </p>
                <p className="text-ink text-base leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}

            <div className="border-t border-line pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                Kullanıcı ID
              </p>
              <p className="text-ink text-sm font-mono break-all">{user.id}</p>
            </div>
          </div>

          <div className="mt-12 p-6 bg-terracotta/8 border border-terracotta/20 rounded-lg">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-2">
              Yakında
            </p>
            <p className="text-ink-72">
              Hizmet kalemleri, portföy galerisi ve daha fazlası burada olacak.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}