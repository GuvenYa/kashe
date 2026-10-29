import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { createClient } from '@/app/lib/supabase-server';
import { DavetlerimListesi } from './davetlerim-listesi';
import { IlanDavetleriListesi, type IlanDaveti } from './ilan-davetleri-listesi';
import { KurumsalDavetlerListesi } from './kurumsal-davetler-listesi';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCachedUser } from '@/app/lib/auth';
import type {
  AgencyInvitation,
  AgencyInvitationWithRelations,
} from '@/app/ajans/agency-data';
import type {
  BusinessInvitation,
  BusinessInvitationWithRelations,
} from '@/app/kurumsal/business-data';

export const metadata = {
  title: 'Davetlerim — Kashe',
};

export default async function DavetlerimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/davetlerim');
  }

  // Rol + suspension kontrolü. E-posta oturumdan gelir: profiles.email authenticated
  // rolüne kapalı (PII adım 2b); uygulama e-posta değiştirmediği için ikisi aynı.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü — askıdaki kullanıcı davetleri göremez
  if (profile?.suspended_at) return <SuspendedNotice />;

  if (!profile) {
    redirect('/profil');
  }

  // FAZ 10a: davetler TEK TABLODAN (`organization_invitations`). RLS zaten
  // davetliye gore suzuyor; `.or(...)` filtresi okunurluk icin kalir.
  //
  // DAVET EDEN KURULUSUN KIMLIGI IKI ADIMDA: davet satiri kurulusa bagli ama
  // kurulus adi `organizations_public` gorunumunde, avatar `profiles`'ta —
  // gorunum uzerinden embed denemek yerine iki kucuk `in()` sorgusu.
  const { data: tumDavetler, error: davetHatasi } = await supabase
    .from('organization_invitations')
    .select('*')
    .or(`invited_user_id.eq.${user.id},invited_email.eq.${user.email}`)
    .order('created_at', { ascending: false });
  if (davetHatasi) console.error('[davetlerim] davetler', davetHatasi);

  const davetSatirlari = (tumDavetler ?? []) as unknown as (
    | AgencyInvitation
    | BusinessInvitation
  )[];

  const kurulusIdleri = [
    ...new Set(davetSatirlari.map((d) => d.organization_id)),
  ];

  type KurulusKimligi = {
    id: string;
    display_name: string | null;
    account_type: string;
    legacy_profile_id: string | null;
  };
  let kuruluslar: KurulusKimligi[] = [];
  if (kurulusIdleri.length > 0) {
    const { data: kurulusData, error: kurulusHatasi } = await supabase
      .from('organizations_public')
      .select('id, display_name, account_type, legacy_profile_id')
      .in('id', kurulusIdleri);
    if (kurulusHatasi) console.error('[davetlerim] kuruluslar', kurulusHatasi);
    kuruluslar = (kurulusData ?? []) as unknown as KurulusKimligi[];
  }

  const legacyIdler = kuruluslar
    .map((k) => k.legacy_profile_id)
    .filter((v): v is string => !!v);
  const avatarlar = new Map<string, string | null>();
  if (legacyIdler.length > 0) {
    const { data: profilData } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', legacyIdler);
    for (const p of (profilData ?? []) as {
      id: string;
      avatar_url: string | null;
    }[]) {
      avatarlar.set(p.id, p.avatar_url);
    }
  }

  const kurulusHaritasi = new Map(kuruluslar.map((k) => [k.id, k]));

  /** Davet + davet eden kurulusun kimligi (id = PAZARYERI profil kimligi). */
  function kurulusKarti(organizationId: string) {
    const k = kurulusHaritasi.get(organizationId);
    if (!k || !k.legacy_profile_id) return null;
    return {
      id: k.legacy_profile_id,
      display_name: k.display_name,
      avatar_url: avatarlar.get(k.legacy_profile_id) ?? null,
    };
  }

  const invitations: AgencyInvitationWithRelations[] = davetSatirlari
    .filter(
      (d) => kurulusHaritasi.get(d.organization_id)?.account_type === 'agency'
    )
    .map((d) => ({
      ...(d as AgencyInvitation),
      agency: kurulusKarti(d.organization_id),
    }));

  // İlan davetleri (müşteri → profesyonel, bu kullanıcıya gelenler)
  const { data: listingInvitesData } = await supabase
    .from('listing_invitations')
    .select(
      `
      id, status, invitation_message, created_at,
      listing:listings!listing_invitations_listing_id_fkey (
        id, title, creator_id,
        creator:profiles!listings_creator_id_fkey ( id, full_name, company_name, avatar_url )
      ),
      inviter:profiles!listing_invitations_inviter_id_fkey ( id, full_name, company_name, avatar_url )
    `
    )
    .eq('professional_id', user.id)
    .order('created_at', { ascending: false });

  const listingInvitations = (listingInvitesData ??
    []) as unknown as IlanDaveti[];

  // Kurumsal ekip davetleri — ayni satir kumesinden hesap turuyle ayrilir.
  const businessInvitations: BusinessInvitationWithRelations[] = davetSatirlari
    .filter(
      (d) => kurulusHaritasi.get(d.organization_id)?.account_type === 'business'
    )
    .map((d) => ({
      ...(d as BusinessInvitation),
      business: kurulusKarti(d.organization_id),
    }));

  return (
    <>
      <TopNav />
      <main className="bg-paper min-h-screen px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/profil"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-brand-ink mb-8 transition-colors"
          >
            <span>←</span> Profile dön
          </Link>

          <header className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Davetler
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-brand-ink not-italic italic font-medium">
                Davetlerim
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Sana gelen ilan, ajans ve kurumsal ekip davetlerini buradan
              görebilir, kabul veya reddedebilirsin.
            </p>
          </header>

          {/* İLAN DAVETLERİ (müşteri → profesyonel/ajans) */}
          {listingInvitations.length > 0 && (
            <div className="mb-12">
              <IlanDavetleriListesi invitations={listingInvitations} />
            </div>
          )}

          {/* KURUMSAL EKİP DAVETLERİ — gate yok, her rol kabul edebilir */}
          {businessInvitations.length > 0 && (
            <div className="mb-12">
              <div className="mb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
                  Kurumsal ekip davetleri
                </p>
              </div>
              <KurumsalDavetlerListesi invitations={businessInvitations} />
            </div>
          )}

          {/* AJANS DAVETLERİ */}
          <div className="mb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
              Ajans davetleri
            </p>
          </div>

          {profile.role !== 'professional' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg px-4 py-3 mb-6">
              Ajans davetlerini kabul edebilmek için <strong>profesyonel</strong>{' '}
              hesap gerek. Mevcut hesabın <strong>{profile.role}</strong> rolünde.
            </div>
          )}

          <DavetlerimListesi
            invitations={invitations}
            canAccept={profile.role === 'professional'}
          />
        </div>
      </main>
    </>
  );
}