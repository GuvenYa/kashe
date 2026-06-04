import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { createClient } from '@/app/lib/supabase-server';
import { DavetlerimListesi } from './davetlerim-listesi';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import type { AgencyInvitationWithRelations } from '@/app/ajans/agency-data';

export const metadata = {
  title: 'Davetlerim — Kashe',
};

export default async function DavetlerimPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
              Ajans davetleri
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-terracotta not-italic italic font-medium">
                Davetlerim
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Sana gelen ajans davetlerini buradan görebilir, kabul veya
              reddedebilirsin.
            </p>
          </header>

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