import { cache } from 'react';
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
    legacy_profile_id: string | null;
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
      'organization_id, role, status, organizations(id, display_name, account_type, legacy_profile_id)'
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
  /** `organizations.account_type` (agency | business | ...). */
  accountType: string;
  /** FAZ 7b: `events.view` — kurulusun etkinlik/RFP yuzeyini gorur (kurum ve ajans). */
  canViewEvents: boolean;
  /** FAZ 7b: `events.manage` — RFP acar, duzenler, gonderir. */
  canManageEvents: boolean;
  /** D1a: `finance.view` — panel menusunde "Kazanclar" maddesinin kapisi. */
  canViewFinance: boolean;
  /** Uyelik rolu (`organization_memberships.role`) — etiket icin; yetki kaynagi DEGIL. */
  role: string;
  /** FAZ 8a: `tasks` modulu acik mi (ajansta varsayilan acik, kurumda sahip acar). */
  tasksEnabled: boolean;
  /** FAZ 8a: `settings.manage` — modul ac/kapat, ayarlar sayfasi. */
  canManageSettings: boolean;
  /** FAZ 8b: `crm` modulu acik mi (yalniz ajansta varsayilan acik). */
  crmEnabled: boolean;
  /** FAZ 8b: `crm.view` — kisi ve firsatlari gorur. */
  canViewCrm: boolean;
  /** FAZ 8b: `crm.manage` — kisi/firsat acar, duzenler, siler. */
  canManageCrm: boolean;
  /** FAZ 8c: `suppliers` modulu acik mi (defter AJANSA ozel). */
  suppliersEnabled: boolean;
  /** FAZ 8c: `suppliers.view` — tedarikci defterini gorur. */
  canViewSuppliers: boolean;
  /** FAZ 8c: `suppliers.manage` — tedarikci ve atama yazar. */
  canManageSuppliers: boolean;
  /**
   * FAZ 8c: `supplier_search` modulu — ALICI kisa listesi.
   * Hesap turu suzgeci YOK: business'ta varsayilan acik, ajans da
   * `org_module_set` ile acabilir (ajans da baska ajansa is verebilir).
   */
  shortlistEnabled: boolean;
  /**
   * FAZ 8a / D1b notu 2: kurulusun saglayici kaydi (`organizations.legacy_profile_id`).
   *
   * `rfp_invites.provider_id` PROFIL kimligini tasiyor; gosterge sayimini
   * kurulus kimligiyle suzmek mumkun degil, bu alan koprudur.
   */
  legacyProfileId: string | null;
};

/**
 * `cache()`: ayni render gecisinde (tek HTTP istegi) BIR KEZ calisir.
 *
 * NEDEN (D1a): fonksiyon kurulus basina on yetki + bir modul RPC'si atiyor ve
 * artik hem sayfa hem panel menusu (dolayisiyla ust bar) cagiriyor —
 * memoize edilmeseydi ayni sayfada iki tam tur donerdi. On uc sayfa bu
 * fonksiyonu cagiriyor; hepsi ayni turu paylasir.
 */
export const getCrewContext = cache(async (): Promise<{ orgs: CrewOrg[] }> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgs: [] };

  const { data, error } = await supabase
    .from('organization_memberships')
    .select(
      'organization_id, role, status, organizations(id, display_name, account_type, legacy_profile_id)'
    )
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) {
    console.error('[ekip] uyelik okuma', error);
    return { orgs: [] };
  }

  const orgs: CrewOrg[] = [];
  // Kurulus sayisi kucuk (bugun 1); on bes yetki + bes modul RPC'si kurulus basina.
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
      etkinlikGorebilir,
      etkinlikYonetir,
      finansGorebilir,
      ayarYonetir,
      gorevModulu,
      crmModulu,
      crmGorebilir,
      crmYonetir,
      tedarikciModulu,
      tedarikciGorebilir,
      tedarikciYonetir,
      kisaListeModulu,
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
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'events.view',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'events.manage',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'finance.view',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'settings.manage',
        }),
        supabase.rpc('org_module_enabled', {
          p_org_id: org.id,
          p_module_key: 'tasks',
        }),
        supabase.rpc('org_module_enabled', {
          p_org_id: org.id,
          p_module_key: 'crm',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'crm.view',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'crm.manage',
        }),
        supabase.rpc('org_module_enabled', {
          p_org_id: org.id,
          p_module_key: 'suppliers',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'suppliers.view',
        }),
        supabase.rpc('has_org_permission', {
          p_org_id: org.id,
          p_permission: 'suppliers.manage',
        }),
        supabase.rpc('org_module_enabled', {
          p_org_id: org.id,
          p_module_key: 'supplier_search',
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
      // FAZ 7a/P2 — teklif saticisi AJANS kurulusudur (19 bolum 2): kurum
      // (business) kurulusunun saglayici kaydi yok, proposal_create reddeder.
      // Yuzeyi tek noktadan kesiyoruz: liste, detay, yeni teklif, ekip paneli.
      canViewProposals:
        teklifGorebilir.data === true && org.account_type === 'agency',
      canManageProposals:
        teklifYonetir.data === true && org.account_type === 'agency',
      accountType: org.account_type,
      // FAZ 7b: RFP alici tarafi kurum VE ajans kurulusunda calisir (hesap turu
      // suzgeci YOK; teklif saticiligi ise yalniz ajans — yukaridaki iki alan).
      canViewEvents: etkinlikGorebilir.data === true,
      canManageEvents: etkinlikYonetir.data === true,
      canViewFinance: finansGorebilir.data === true,
      role: uyelik.role,
      tasksEnabled: gorevModulu.data === true,
      canManageSettings: ayarYonetir.data === true,
      // FAZ 8b: CRM AJANSA OZEL (karar, 21 Ekim). Modul business'ta kapali
      // dogsa da sahip teorik olarak acabilir; yuzeyi hesap turuyle de
      // kesiyoruz ki kurumsal menude "Musteriler" hic cikmasin.
      crmEnabled:
        crmModulu.data === true && org.account_type === 'agency',
      canViewCrm: crmGorebilir.data === true,
      canManageCrm: crmYonetir.data === true,
      // FAZ 8c: tedarikci defteri AJANSA OZEL. Modul business'ta kapali
      // dogsa da sahip teorik olarak acabilir; yuzeyi hesap turuyle de
      // kesiyoruz ki kurumsal menude "Tedarikciler" hic cikmasin.
      suppliersEnabled:
        tedarikciModulu.data === true && org.account_type === 'agency',
      canViewSuppliers: tedarikciGorebilir.data === true,
      canManageSuppliers: tedarikciYonetir.data === true,
      // Kisa liste hesap turu suzmez (ajans da alici olabilir).
      shortlistEnabled: kisaListeModulu.data === true,
      legacyProfileId: org.legacy_profile_id ?? null,
    });
  }

  return { orgs };
});

/**
 * TopNav icin ucuz kontrol: menude ilgili baglanti gorunsun mu.
 * `getCrewContext` kurulus basina sekiz RPC atar; global menude o maliyet
 * gereksiz — burada yalniz TEK izin sorulur (uyelik sorgusu + N RPC).
 */
async function tekIzinVarMi(
  izin: string,
  etiket: string,
  yalnizAjans = false
): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('organization_memberships')
    .select('organization_id, organizations(account_type)')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (error) {
    console.error(`[${etiket}] menu uyelik okuma`, error);
    return false;
  }

  // Ajans olmayan kuruluslar RPC'ye GITMEDEN elenir (teklif yuzeyi ajansa ozel).
  const idler = ((data ?? []) as unknown as {
    organization_id: string;
    organizations: { account_type: string } | null;
  }[])
    .filter(
      (u) => !yalnizAjans || u.organizations?.account_type === 'agency'
    )
    .map((u) => u.organization_id);
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

// `hasCrewAccess` KALDIRILDI (D1a): tek cagirani ust bardaki elle kurulan menu
// listesiydi; o liste artik `app/lib/panel-menu.ts`'ten uretiliyor ve "Ekipler"
// maddesinin kapisi `CrewOrg.canViewCrew`. Cagirilmayan bir yetki yardimcisi
// birakmak, olu bir mimari bag birakmaktir (CLAUDE.md commit disiplini notu).

/** Menude "RFP Talepleri" (FAZ 7b/P1) — `events.view` yetkili kurulus (kurum ve ajans). */
export async function hasRfpBuyerAccess(): Promise<boolean> {
  return tekIzinVarMi('events.view', 'rfp');
}

/** Menude "Teklifler" (FAZ 7a/P1) — yalniz AJANS kurulusu (P2/D). */
export async function hasProposalAccess(): Promise<boolean> {
  return tekIzinVarMi('proposals.view', 'teklif', true);
}
