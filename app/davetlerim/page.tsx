import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { createClient } from '@/app/lib/supabase-server';
import { DavetlerimListesi } from './davetlerim-listesi';
import { IlanDavetleriListesi, type IlanDaveti } from './ilan-davetleri-listesi';
import { KurumsalDavetlerListesi } from './kurumsal-davetler-listesi';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCachedUser } from '@/app/lib/auth';
import type { AgencyInvitationWithRelations } from '@/app/ajans/agency-data';
import type { BusinessInvitationWithRelations } from '@/app/kurumsal/business-data';

export const metadata = {
  title: 'Davetlerim — Kashe',
};

export default async function DavetlerimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/davetlerim');
  }

  // Mevcut kullanıcının email'i + suspension kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü — askıdaki kullanıcı davetleri göremez
  if (profile?.suspended_at) return <SuspendedNotice />;

  if (!profile) {
    redirect('/profil');
  }

  // Davetleri çek - hem invited_user_id ile hem email ile eşleşenler
  const { data: invitationsData } = await supabase
    .from('agency_invitations')
    .select(
      `
      *,
      agency:profiles!agency_invitations_agency_id_fkey (
        id, full_name, avatar_url, company_name, bio
      )
    `
    )
    .or(`invited_user_id.eq.${user.id},invited_email.eq.${profile.email}`)
    .order('created_at', { ascending: false });

  const invitations = (invitationsData ??
    []) as unknown as AgencyInvitationWithRelations[];

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

  // Kurumsal ekip davetleri (bu kullanıcıya gelenler — email veya invited_user_id ile)
  const { data: businessInvitesData } = await supabase
    .from('business_invitations')
    .select(
      `
      *,
      business:profiles!business_invitations_business_id_fkey (
        id, full_name, avatar_url, company_name, bio
      )
    `
    )
    .or(`invited_user_id.eq.${user.id},invited_email.eq.${profile.email}`)
    .order('created_at', { ascending: false });

  const businessInvitations = (businessInvitesData ??
    []) as unknown as BusinessInvitationWithRelations[];

  return (
    <>
      <TopNav />
      <main className="bg-paper min-h-screen px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/profil"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-terracotta mb-8 transition-colors"
          >
            <span>←</span> Profile dön
          </Link>

          <header className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Davetler
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-terracotta not-italic italic font-medium">
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