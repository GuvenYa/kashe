import { createClient } from '@/app/lib/supabase-server';

/**
 * FAZ 5 — yetenek havuzu icin kurulus baglami.
 *
 * Yetki FAZ 0 anahtarlarindan gelir (`has_org_permission`): `talent.view` okur,
 * `talent.manage` yazar, `commercial.view` ic orani gorur (oran karti P2).
 * Modul kapisi: `org_module_enabled(org, 'talent_pool')` — yalniz `agency` kuruluslarinda acik.
 *
 * Listeye yalniz MODULU ACIK ve `talent.view` sahibi kuruluslar girer; bos liste
 * "yetenek havuzu ajans hesaplari icindir" mesajina karsilik gelir.
 */

export type TalentPoolOrg = {
  id: string;
  name: string;
  canView: boolean;
  canManage: boolean;
  /** Ic oran karti P2'de; bayrak simdiden tasinir. */
  canSeeRates: boolean;
};

type UyelikSatiri = {
  organization_id: string;
  role: string;
  status: string;
  organizations: {
    id: string;
    display_name: string | null;
    account_type: string;
  } | null;
};

export async function getTalentPoolContext(): Promise<{
  orgs: TalentPoolOrg[];
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgs: [] };

  const { data, error } = await supabase
    .from('organization_memberships')
    .select(
      'organization_id, role, status, organizations(id, display_name, account_type)'
    )
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) {
    console.error('[havuz] uyelik okuma', error);
    return { orgs: [] };
  }

  const orgs: TalentPoolOrg[] = [];
  // Kurulus sayisi kucuk (bugun 1); uc yetki + bir modul RPC'si kurulus basina.
  for (const uyelik of (data ?? []) as unknown as UyelikSatiri[]) {
    const org = uyelik.organizations;
    if (!org) continue;

    const [modul, gorebilir, yonetebilir, oranGorebilir] = await Promise.all([
      supabase.rpc('org_module_enabled', {
        p_org_id: org.id,
        p_module_key: 'talent_pool',
      }),
      supabase.rpc('has_org_permission', {
        p_org_id: org.id,
        p_permission: 'talent.view',
      }),
      supabase.rpc('has_org_permission', {
        p_org_id: org.id,
        p_permission: 'talent.manage',
      }),
      supabase.rpc('has_org_permission', {
        p_org_id: org.id,
        p_permission: 'commercial.view',
      }),
    ]);

    if (modul.error) console.error('[havuz] modul kontrolu', modul.error);
    if (gorebilir.error) console.error('[havuz] yetki kontrolu', gorebilir.error);

    if (modul.data !== true || gorebilir.data !== true) continue;

    orgs.push({
      id: org.id,
      name: org.display_name?.trim() || 'Kurulus',
      canView: true,
      canManage: yonetebilir.data === true,
      canSeeRates: oranGorebilir.data === true,
    });
  }

  return { orgs };
}
