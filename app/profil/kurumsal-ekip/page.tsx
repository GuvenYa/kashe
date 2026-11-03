import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { createClient } from '@/app/lib/supabase-server';
import { KurumsalEkipPaneli } from './kurumsal-ekip-paneli';
import { kurulusumunId, OWNER_SEED_HARIC } from '@/app/lib/uyelik';
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

  // FAZ 10a: uyeler ve davetler TEK TABLODAN; rol satirin kendisinde
  // (ikinci bir rol sorgusu YOK). Uye herhangi bir kullanici — kategori/
  // professional join YOK.
  const orgId = await kurulusumunId(supabase, user.id);

  // Kurulusun kendi hesabi (owner_seed) listede GOSTERILMEZ.
  const { data: membersData, error: uyeHatasi } = orgId
    ? await supabase
        .from('organization_memberships')
        .select(
          `id, organization_id, user_id, role, status, joined_at, legacy_source,
           member:profiles!organization_memberships_user_id_fkey (
             id, full_name, avatar_url, company_name, role
           )`
        )
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .or(OWNER_SEED_HARIC)
        .order('joined_at', { ascending: false })
    : { data: null, error: null };
  if (uyeHatasi) console.error('[kurumsal-ekip] uyeler', uyeHatasi);

  const members = (membersData ??
    []) as unknown as BusinessMemberWithProfile[];

  // Davetler (tümü)
  const { data: invitationsData, error: davetHatasi } = orgId
    ? await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
    : { data: null, error: null };
  if (davetHatasi) console.error('[kurumsal-ekip] davetler', davetHatasi);

  const invitations = (invitationsData ??
    []) as unknown as BusinessInvitation[];

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

          <PanelBaslik
            eyebrow="Yönetim"
            altNot="Kurum hesabını birlikte yönetecek ekip üyelerini davet et, davet durumlarını takip et, rolleri ayarla."
          >
            <em className="not-italic font-medium text-brand-accent">
            Kurumsal Ekip
            </em>
          </PanelBaslik>

          <KurumsalEkipPaneli
            members={members}
            invitations={invitations}
            currentUserId={user.id}
          />
        </div>
    </PanelKabugu>
  );
}
