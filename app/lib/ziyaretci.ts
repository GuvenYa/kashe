import { cache } from 'react';
import { createClient } from './supabase-server';
import { getCachedUser } from './auth';
import { hasProposalAccess, hasRfpBuyerAccess } from './org-context';

/**
 * ZIYARETCI — vitrin sayfalarinin CTA'larini role gore secmesi icin tek kaynak.
 *
 * Neden: girisli kullaniciya "uye ol / hesap ac" gostermek kirik baglanti degil,
 * YANLIS CAGRI. (/uye-ol zaten proxy ile /profil'e donuyor.) Her vitrin CTA'si
 * burada hesaplanan dort alana bakar ve kullanicinin halihazirda sahip oldugu
 * yuzeye baglanir.
 *
 * `cache()`: ayni render gecisinde (tek HTTP istegi) bir kez calisir — sayfa,
 * bolumler ve One cikanlar ayni veriyi paylasir, tekrar sorgu gitmez.
 *
 * Girissiz ziyaretcide HICBIR sorgu atilmaz (en sik durum).
 */
export type Ziyaretci = {
  girisli: boolean;
  /** profiles.role: professional | client | agency | business | null */
  rol: string | null;
  /** proposals.view yetkili ajans kurulusu (Ajans paneli). */
  ajansPaneli: boolean;
  /** events.view yetkili kurulus (RFP / kurumsal panel). */
  kurumsalPanel: boolean;
};

/**
 * Girissiz varsayilan. Vitrin bolumleri bunu varsayilan prop olarak kullanir —
 * boylece ana sayfa disinda (prop gecmeden) kullanildiklarinda da girissiz
 * metni gosterirler.
 */
export const ZIYARETCI_GIRISSIZ: Ziyaretci = {
  girisli: false,
  rol: null,
  ajansPaneli: false,
  kurumsalPanel: false,
};

export const getZiyaretci = cache(async (): Promise<Ziyaretci> => {
  const user = await getCachedUser();
  if (!user) return ZIYARETCI_GIRISSIZ;

  const supabase = await createClient();
  const [{ data: profil }, ajansPaneli, kurumsalPanel] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    hasProposalAccess(),
    hasRfpBuyerAccess(),
  ]);

  return {
    girisli: true,
    rol: profil?.role ?? null,
    ajansPaneli,
    kurumsalPanel,
  };
});

/** Satici koltugu: kendi profilini yoneten roller (profesyonel ve ajans). */
export function saticiRol(z: Ziyaretci): boolean {
  return z.rol === 'professional' || z.rol === 'agency';
}
