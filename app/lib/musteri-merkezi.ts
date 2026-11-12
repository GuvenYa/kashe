import { cache } from 'react';
import { getZiyaretci } from './ziyaretci';
import { getCrewContext } from './org-context';

/**
 * MUSTERI IS MERKEZI KIMDE ACIK (Duzeltme 15-A, bulgu 128).
 *
 * `/etkinliklerim` musteri hesabinda is merkezidir (talepler, gelen teklifler,
 * rezervasyonlar tek listede); menude "Gelen teklifler" ve "Rezervasyonlar"
 * maddeleri yoktur. Olcut menudeki musteri grubuyla AYNI (`getPanelMenu`):
 * rol `client`, ya da kurulusu olmayan `business`. Ajans ve kurum panellerinde
 * eski sayfalar ve menu maddeleri oldugu gibi durur.
 *
 * Geri baglantilari ve yonlendirmeler bu tek karara bakar; boylece musteri
 * menusunde olmayan bir sayfaya dusmez. `cache()`: istek basina bir kez.
 */
export const musteriMerkeziAcik = cache(async (): Promise<boolean> => {
  const ziyaretci = await getZiyaretci();
  if (!ziyaretci.girisli) return false;
  if (ziyaretci.rol === 'client') return true;
  if (ziyaretci.rol !== 'business') return false;
  const { orgs } = await getCrewContext();
  return !orgs.some((o) => o.accountType === 'business');
});

export const MERKEZ_YOLU = '/etkinliklerim';
export const MERKEZ_BEKLEYEN_YOLU = '/etkinliklerim?sekme=bekleyen';
export const MERKEZ_YAKLASAN_YOLU = '/etkinliklerim?sekme=yaklasan';
