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
  /** `commercial.view` — gizli ic oran kartini gorur (P2). */
  canSeeRates: boolean;
  /** `commercial.manage` — oran ekler/kapatir (P2). */
  canManageRates: boolean;
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

    const [modul, gorebilir, yonetebilir, oranGorebilir, oranYonetir] =
      await Promise.all([
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
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'commercial.manage',
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
      canManageRates: oranYonetir.data === true,
    });
  }

  return { orgs };
}

/**
 * FAZ 6 / P2 — ekip baglami.
 *
 * `getTalentPoolContext`'ten AYRI tutulur (farkli kullanim, farkli kapi): burada
 * `talent_pool` modulu LISTEYI SUZMEZ, yalniz bilgi olarak doner — ekip kurulus
 * ekibi olabilir ama havuzdan uye ekleme modul + `talent.view` isteyebilir.
 * Listeye `crew.view` sahibi her aktif uyelik girer.
 */
export type CrewOrg = {
  id: string;
  name: string;
  /** `crew.view` — ekibi gorur (liste girişi bunu gerektirir). */
  canViewCrew: boolean;
  /** `crew.manage` — ekip kurar, uye ekler/cikarir, durum degistirir. */
  canManageCrew: boolean;
  /** `commercial.view` — gizli ic maliyet kartini gorur. */
  canSeeRates: boolean;
  /** `commercial.manage` — maliyet yazar. */
  canManageRates: boolean;
  /** `talent.view` — havuzdan uye eklemek icin gerekir. */
  canViewTalent: boolean;
  /** `talent_pool` modulu acik mi (havuzdan ekleme kapisi). */
  talentPoolEnabled: boolean;
  /** FAZ 7a: `proposals.view` — teklifleri gorur. */
  canViewProposals: boolean;
  /** FAZ 7a: `proposals.manage` — teklif acar, duzenler, gonderir. */
  canManageProposals: boolean;
};

export async function getCrewContext(): Promise<{ orgs: CrewOrg[] }> {
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
    console.error('[ekip] uyelik okuma', error);
    return { orgs: [] };
  }

  const orgs: CrewOrg[] = [];
  // Kurulus sayisi kucuk (bugun 1); bes yetki + bir modul RPC'si kurulus basina.
  for (const uyelik of (data ?? []) as unknown as UyelikSatiri[]) {
    const org = uyelik.organizations;
    if (!org) continue;

    const [
      gorebilir,
      yonetebilir,
      oranGorebilir,
      oranYonetir,
      havuzGorebilir,
      modul,
      teklifGorebilir,
      teklifYonetir,
    ] =
      await Promise.all([
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'crew.view',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'crew.manage',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'commercial.view',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'commercial.manage',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'talent.view',
        }),
        supabase.rpc('org_module_enabled', {
          p_org_id: org.id,
          p_module_key: 'talent_pool',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'proposals.view',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'proposals.manage',
        }),
      ]);

    if (gorebilir.error) console.error('[ekip] yetki kontrolu', gorebilir.error);
    if (gorebilir.data !== true) continue;

    orgs.push({
      id: org.id,
      name: org.display_name?.trim() || 'Kurulus',
      canViewCrew: true,
      canManageCrew: yonetebilir.data === true,
      canSeeRates: oranGorebilir.data === true,
      canManageRates: oranYonetir.data === true,
      canViewTalent: havuzGorebilir.data === true,
      talentPoolEnabled: modul.data === true,
      canViewProposals: teklifGorebilir.data === true,
      canManageProposals: teklifYonetir.data === true,
    });
  }

  return { orgs };
}

/**
 * TopNav icin ucuz kontrol: menude ilgili baglanti gorunsun mu.
 * `getCrewContext` kurulus basina sekiz RPC atar; global menude o maliyet
 * gereksiz — burada yalniz TEK izin sorulur (uyelik sorgusu + N RPC).
 */
async function tekIzinVarMi(izin: string, etiket: string): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (error) {
    console.error(`[${etiket}] menu uyelik okuma`, error);
    return false;
  }

  const idler = (data ?? []).map(
    (u) => (u as { organization_id: string }).organization_id
  );
  if (idler.length === 0) return false;

  const sonuclar = await Promise.all(
    idler.map((id) =>
      supabase.rpc('has_org_permission', {
        p_org_id: id,
        p_permission: izin,
      })
    )
  );
  return sonuclar.some((r) => r.data === true);
}

/** Menude "Ekipler" (FAZ 6/P2). */
export async function hasCrewAccess(): Promise<boolean> {
  return tekIzinVarMi('crew.view', 'ekip');
}

/** Menude "Teklifler" (FAZ 7a/P1). */
export async function hasProposalAccess(): Promise<boolean> {
  return tekIzinVarMi('proposals.view', 'teklif');
}
