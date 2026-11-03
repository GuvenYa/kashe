import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { createClient } from '@/app/lib/supabase-server';
import { EkibimPaneli } from './ekibim-paneli';
import { kurulusumunId, OWNER_SEED_HARIC } from '@/app/lib/uyelik';
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

  // FAZ 10a: uyeler ve davetler TEK TABLODAN. Rol satirin kendisinde
  // (`organization_memberships.role`), ikinci bir rol sorgusu YOK.
  const orgId = await kurulusumunId(supabase, user.id);

  // Kurulusun kendi hesabi (`owner_seed`) ekip listesinde GOSTERILMEZ:
  // eski `agency_members` tablosunda da yoktu.
  const { data: membersData, error: uyeHatasi } = orgId
    ? await supabase
        .from('organization_memberships')
        .select(
          `id, organization_id, user_id, role, status, joined_at, legacy_source,
           professional:profiles!organization_memberships_user_id_fkey (
             id, full_name, avatar_url, role, bio, primary_category_id,
             service_categories!profiles_primary_category_id_fkey (name_tr, emoji)
           )`
        )
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .or(OWNER_SEED_HARIC)
        .order('joined_at', { ascending: false })
    : { data: null, error: null };
  if (uyeHatasi) console.error('[ekibim] uyeler', uyeHatasi);

  const members = (membersData ??
    []) as unknown as AgencyMemberWithProfile[];

  // Davetler (tümü)
  const { data: invitationsData, error: davetHatasi } = orgId
    ? await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
    : { data: null, error: null };
  if (davetHatasi) console.error('[ekibim] davetler', davetHatasi);

  const invitations = (invitationsData ?? []) as unknown as AgencyInvitation[];

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
            altNot="Ajansın altındaki profesyonelleri yönet, yeni üyeler davet et, davet durumlarını takip et."
            sagAlan={
              <>
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
              </>
            }
          >
            <em className="not-italic font-medium text-brand-accent">
            Ekibim
            </em>
          </PanelBaslik>

          <EkibimPaneli
            members={members}
            invitations={invitations}
            currentUserId={user.id}
          />
        </div>
    </PanelKabugu>
  );
}