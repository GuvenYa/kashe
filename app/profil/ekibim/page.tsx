import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { createClient } from '@/app/lib/supabase-server';
import { EkibimPaneli } from './ekibim-paneli';
import type {
  AgencyMemberWithProfile,
  AgencyInvitation,
} from '@/app/ajans/agency-data';

export const metadata = {
  title: 'Ekibim — Kashe',
};

export default async function EkibimPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?redirect=/profil/ekibim');
  }

  // Rol kontrolü — sadece ajans
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'agency') {
    redirect('/profil');
  }

  // Üyeler + profesyonel detayları
  const { data: membersData } = await supabase
    .from('agency_members')
    .select(
      `
      *,
      professional:profiles!agency_members_professional_id_fkey (
        id, full_name, avatar_url, role, bio, primary_category_id,
        service_categories!profiles_primary_category_id_fkey (name_tr, emoji)
      )
    `
    )
    .eq('agency_id', user.id)
    .order('joined_at', { ascending: false });

  const members = (membersData ??
    []) as unknown as AgencyMemberWithProfile[];

  // Davetler (tümü)
  const { data: invitationsData } = await supabase
    .from('agency_invitations')
    .select('*')
    .eq('agency_id', user.id)
    .order('created_at', { ascending: false });

  const invitations = (invitationsData ?? []) as AgencyInvitation[];

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
              Yönetim
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-brand-ink not-italic italic font-medium">
                Ekibim
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Ajansın altındaki profesyonelleri yönet, yeni üyeler davet et,
              davet durumlarını takip et.
            </p>
          </header>

          <EkibimPaneli
            members={members}
            invitations={invitations}
            currentUserId={user.id}
          />
        </div>
      </main>
    </>
  );
}