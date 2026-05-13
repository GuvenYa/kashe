import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { PublishToggle } from './publish-toggle';
import {
  isProfessional,
  isClient,
  isBusiness,
  getRoleLabel,
  getMissingPublishFields,
  canPublish,
  getCompletenessPercent,
} from '@/app/lib/profile-helpers';
import type { Profile } from '@/app/lib/types';

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

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      '*, turkish_cities(name), service_categories!profiles_primary_category_id_fkey(name_tr, emoji)'
    )
    .eq('id', user.id)
    .single();

  if (!profileData) {
    redirect('/giris');
  }

  const profile = profileData as Profile & {
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; emoji: string | null } | null;
  };

  const cityName = profile.turkish_cities?.name;
  const categoryLabel = profile.service_categories
    ? `${profile.service_categories.emoji || ''} ${profile.service_categories.name_tr}`.trim()
    : null;

  const isPro = isProfessional(profile);
  const isClientUser = isClient(profile);
  const isBusinessUser = isBusiness(profile);

  const missingFields = getMissingPublishFields(profile);
  const canPub = canPublish(profile);
  const completeness = getCompletenessPercent(profile);

  const initials = (profile.full_name || '')
    .split(' ')
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Display name: business kullanıcı için company_name öncelikli
  const displayName =
    isBusinessUser && profile.company_name
      ? profile.company_name
      : profile.full_name || 'Kullanıcı';

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          {/* HEADER */}
          <div className="flex items-start justify-between mb-12 gap-4">
            <div className="flex items-center gap-5">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-line"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-2xl">
                  {initials || '?'}
                </div>
              )}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  {getRoleLabel(profile.role)}
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
                  {displayName}
                </h1>
                {isBusinessUser && profile.company_name && profile.full_name && (
                  <p className="text-ink-72 text-sm mt-1">
                    İletişim: {profile.full_name}
                  </p>
                )}
                {isPro && categoryLabel && (
                  <p className="text-ink-72 text-sm mt-1">{categoryLabel}</p>
                )}
              </div>
            </div>
            <Link
              href="/profil/duzenle"
              className="shrink-0 px-5 py-2.5 border border-ink text-ink rounded-lg font-display font-medium hover:bg-ink hover:text-paper transition-colors"
            >
              Düzenle
            </Link>
          </div>

          {/* PUBLISH TOGGLE — sadece Pro & Business için */}
          {(isPro || isBusinessUser) && (
            <div className="mb-8">
              <PublishToggle
                isPublished={profile.is_published}
                canPublish={canPub}
                missingFields={missingFields}
              />
            </div>
          )}

          {/* COMPLETENESS BAR — sadece tamlık %100 değilse göster */}
          {completeness < 100 && (
            <div className="mb-8 bg-white border border-line rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                  Profil tamlığı
                </p>
                <p className="font-display font-semibold text-ink text-sm">
                  %{completeness}
                </p>
              </div>
              <div className="w-full h-2 bg-paper rounded-full overflow-hidden">
                <div
                  className="h-full bg-terracotta transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          )}

          {/* INFO CARD */}
          <div className="bg-white border border-line rounded-lg p-8 space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                Email
              </p>
              <p className="text-ink text-lg">{user.email}</p>
            </div>

            {profile.phone && (
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

            {profile.bio && (
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Hakkımda
                </p>
                <p className="text-ink text-base leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>

          {/* ROLE-SPECIFIC SECTIONS */}

          {/* PROFESYONEL: Hizmetler placeholder */}
          {isPro && (
            <div className="mt-8 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl text-ink">Hizmetlerim</h2>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta">
                  Yakında
                </span>
              </div>
              <p className="text-ink-72">
                Sunduğun hizmetleri, fiyat aralıklarını ve süreleri burada
                ekleyeceksin. Müşteriler keşfet sayfasından bu bilgilerle seni
                bulacak.
              </p>
            </div>
          )}

          {/* PROFESYONEL: Portföy placeholder */}
          {isPro && (
            <div className="mt-6 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl text-ink">Portföy</h2>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta">
                  Yakında
                </span>
              </div>
              <p className="text-ink-72">
                Önceki işlerinden fotoğraflar, videolar ekleyebileceksin.
              </p>
            </div>
          )}

          {/* KURUMSAL: İhtiyaçlar placeholder */}
          {isBusinessUser && (
            <div className="mt-8 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl text-ink">
                  İlanlarım & Etkinliklerim
                </h2>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta">
                  Yakında
                </span>
              </div>
              <p className="text-ink-72">
                Düzenleyeceğin etkinlikleri ilan olarak yayınla, profesyoneller
                seninle iletişime geçsin.
              </p>
            </div>
          )}

          {/* MÜŞTERİ: Geçmiş aramalar / favoriler placeholder */}
          {isClientUser && (
            <div className="mt-8 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl text-ink">Favorilerim</h2>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta">
                  Yakında
                </span>
              </div>
              <p className="text-ink-72">
                Beğendiğin profesyonelleri favorilerine ekle, daha sonra kolayca
                bulabilesin.
              </p>
            </div>
          )}

          {/* USER ID — küçük detay olarak en altta */}
          <div className="mt-12 pt-8 border-t border-line">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72/60 mb-1">
              Kullanıcı ID
            </p>
            <p className="text-ink-72/60 text-xs font-mono break-all">
              {profile.id}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}