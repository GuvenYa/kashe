import { cache } from 'react';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext, type CrewOrg } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import { getRoleLabel } from '@/app/lib/profile-helpers';
import type { PanelMenuGrubu } from '@/app/lib/panel-menu-tipler';
import type { PanelHesap } from '@/app/components/panel/panel-yan-menu';

/**
 * PANEL KABUGU PROP'LARI — tek yerden (D1b-2).
 *
 * 20+ calisma sayfasi `PanelKabugu` kullaniyor; her biri menu + hesap karti +
 * yonetici bayragini kendi kurmak zorunda kalsaydi ayni dort satir 20 kez
 * yazilir ve zamanla kayardi.
 *
 * `cache()`: ayni istekte sayfa bir kez cagirir, ama ic cagrilari
 * (`panelMenusu`, `getCrewContext`) baska yerlerle paylasilir.
 */
export type PanelKabukProps = {
  menu: PanelMenuGrubu[];
  hesap: PanelHesap;
  yonetici: boolean;
};

/**
 * Hesap kartinin alt satiri:
 *  - tek kurulus baglami -> kurulus adi + hesap turu
 *  - cok kurulus         -> kisi adi ustte, "N kuruluş" altta (bir kurulusun
 *    adini secmek yanlis olurdu: kullanici o an hangisindeyse o gecerli)
 *  - kurulussuz          -> rol etiketi
 */
function hesapKarti(
  ad: string,
  avatarUrl: string | null,
  rol: string | null,
  orgs: CrewOrg[],
  secili: CrewOrg | null
): PanelHesap {
  if (secili) {
    return {
      ad: secili.name,
      altSatir:
        secili.accountType === 'agency' ? 'Ajans hesabı' : 'Kurumsal hesap',
      avatarUrl,
      rozet: secili.accountType === 'agency' ? 'Ajans' : 'Kurumsal',
    };
  }
  if (orgs.length > 1) {
    return {
      ad,
      altSatir: `${orgs.length} kuruluş`,
      avatarUrl,
    };
  }
  if (orgs.length === 1) {
    return {
      ad,
      altSatir: orgs[0].name,
      avatarUrl,
    };
  }
  return { ad, altSatir: getRoleLabel(rol ?? ''), avatarUrl };
}

/**
 * `orgId` verilirse hesap karti O kurulusu gosterir (kurulus sayfalari);
 * verilmezse kisinin kendi karti cikar (kisisel sayfalar).
 */
export const panelKabukProps = cache(
  async (orgId?: string | null): Promise<PanelKabukProps> => {
    const supabase = await createClient();
    const user = await getCachedUser();

    const [{ data: profil }, { orgs }, menu] = await Promise.all([
      user
        ? supabase
            .from('profiles')
            .select('full_name, company_name, role, avatar_url, is_admin')
            .eq('id', user.id)
            .single()
        : Promise.resolve({ data: null }),
      getCrewContext(),
      panelMenusu(),
    ]);

    const p = profil as {
      full_name: string | null;
      company_name: string | null;
      role: string | null;
      avatar_url: string | null;
      is_admin: boolean | null;
    } | null;

    const ad =
      (p?.role === 'business' || p?.role === 'agency'
        ? p?.company_name?.trim()
        : null) ||
      p?.full_name?.trim() ||
      'Kullanıcı';

    const secili = orgId ? (orgs.find((o) => o.id === orgId) ?? null) : null;

    return {
      menu,
      hesap: hesapKarti(ad, p?.avatar_url ?? null, p?.role ?? null, orgs, secili),
      yonetici: !!p?.is_admin,
    };
  }
);
