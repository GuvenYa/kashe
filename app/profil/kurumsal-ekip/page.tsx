import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
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

  // FAZ 8-U: kurulus rolleri. organization_memberships.id = eski uye satirinin
  // id'si (ayna ayni id ile yazar). RLS: organization_memberships_select_member.
  const kurulusRolleri: Record<string, string> = {};
  if (members.length > 0) {
    const { data: uyelikler, error: uyelikHatasi } = await supabase
      .from('organization_memberships')
      .select('id, role')
      .in(
        'id',
        members.map((m) => m.id)
      );
    if (uyelikHatasi) console.error('[kurumsal-ekip] kurulus rolleri', uyelikHatasi);
    for (const u of (uyelikler ?? []) as { id: string; role: string }[]) {
      kurulusRolleri[u.id] = u.role;
    }
  }

  // Davetler (tümü)
  const { data: invitationsData } = await supabase
    .from('business_invitations')
    .select('*')
    .eq('business_id', user.id)
    .order('created_at', { ascending: false });

  const invitations = (invitationsData ?? []) as BusinessInvitation[];

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-4xl">
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
              <em className="not-italic font-medium text-brand-accent">
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
            kurulusRolleri={kurulusRolleri}
          />
        </div>
    </PanelKabugu>
  );
}
