import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
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

  // FAZ 8-U: kurulus rolleri. organization_memberships.id = eski uye satirinin
  // id'si (ayna ayni id ile yazar), bu yuzden dogrudan uye idleriyle sorgulanir.
  // RLS: organization_memberships_select_member.
  const kurulusRolleri: Record<string, string> = {};
  if (members.length > 0) {
    const { data: uyelikler, error: uyelikHatasi } = await supabase
      .from('organization_memberships')
      .select('id, role')
      .in(
        'id',
        members.map((m) => m.id)
      );
    if (uyelikHatasi) console.error('[ekibim] kurulus rolleri', uyelikHatasi);
    for (const u of (uyelikler ?? []) as { id: string; role: string }[]) {
      kurulusRolleri[u.id] = u.role;
    }
  }

  // Davetler (tümü)
  const { data: invitationsData } = await supabase
    .from('agency_invitations')
    .select('*')
    .eq('agency_id', user.id)
    .order('created_at', { ascending: false });

  const invitations = (invitationsData ?? []) as AgencyInvitation[];

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
                Ekibim
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Ajansın altındaki profesyonelleri yönet, yeni üyeler davet et,
              davet durumlarını takip et.
            </p>
            {/* FAZ 5: ekip uyeleri havuzda da gorunur (harici kisilerle tek liste) */}
            <p className="mt-3 text-sm text-ink-72">
              Ekibin havuzda:{' '}
              <Link
                href="/ajans/havuz"
                className="text-brand-ink hover:underline font-medium"
              >
                Yetenek havuzu →
              </Link>
            </p>
          </header>

          <EkibimPaneli
            members={members}
            invitations={invitations}
            currentUserId={user.id}
            kurulusRolleri={kurulusRolleri}
          />
        </div>
    </PanelKabugu>
  );
}