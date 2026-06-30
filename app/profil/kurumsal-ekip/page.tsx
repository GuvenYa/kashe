import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { createClient } from '@/app/lib/supabase-server';
import { KurumsalEkipPaneli } from './kurumsal-ekip-paneli';
import type {
  BusinessMemberWithProfile,
  BusinessInvitation,
} from '@/app/kurumsal/business-data';

export const metadata = {
  title: 'Kurumsal Ekip — Kashe',
};

export default async function KurumsalEkipPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?redirect=/profil/kurumsal-ekip');
  }

  // Rol kontrolü — sadece kurum (business)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'business') {
    redirect('/profil');
  }

  // Üyeler + temel profil (üye herhangi bir kullanıcı — kategori/professional join YOK)
  const { data: membersData } = await supabase
    .from('business_members')
    .select(
      `
      *,
      member:profiles!business_members_member_user_id_fkey (
        id, full_name, avatar_url, company_name, role
      )
    `
    )
    .eq('business_id', user.id)
    .order('joined_at', { ascending: false });

  const members = (membersData ??
    []) as unknown as BusinessMemberWithProfile[];

  // Davetler (tümü)
  const { data: invitationsData } = await supabase
    .from('business_invitations')
    .select('*')
    .eq('business_id', user.id)
    .order('created_at', { ascending: false });

  const invitations = (invitationsData ?? []) as BusinessInvitation[];

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
              Yönetim
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-terracotta not-italic italic font-medium">
                Kurumsal Ekip
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Kurum hesabını birlikte yönetecek ekip üyelerini davet et, davet
              durumlarını takip et, rolleri ayarla.
            </p>
          </header>

          <KurumsalEkipPaneli
            members={members}
            invitations={invitations}
            currentUserId={user.id}
          />
        </div>
      </main>
    </>
  );
}
