import { cache } from 'react';
import { getZiyaretci } from './ziyaretci';
import { getCrewContext } from './org-context';

/**
 * PROFESYONEL IS MERKEZI KIMDE ACIK (Duzeltme 15-B, bulgu 129).
 *
 * `/islerim` profesyonelin is merkezidir (gelen talepler, verdigi teklifler,
 * rezervasyonlar tek listede); menude "Teklif talepleri", "Verdigim teklifler"
 * ve "Rezervasyonlar" maddeleri yoktur. Olcut menudeki satici grubuyla AYNI
 * (`getPanelMenu`): rol `professional`, ya da ajans kurulusu olmayan `agency`.
 * Ajans panelinde eski sayfalar ve menu maddeleri oldugu gibi durur.
 *
 * Geri baglantilari ve Merkez kutulari bu tek karara bakar. `cache()`: istek
 * basina bir kez.
 */
export const saticiMerkeziAcik = cache(async (): Promise<boolean> => {
  const ziyaretci = await getZiyaretci();
  if (!ziyaretci.girisli) return false;
  if (ziyaretci.rol === 'professional') return true;
  if (ziyaretci.rol !== 'agency') return false;
  const { orgs } = await getCrewContext();
  return !orgs.some((o) => o.accountType === 'agency');
});

export const ISLERIM_YOLU = '/islerim';
export const ISLERIM_BEKLEYEN_YOLU = '/islerim?sekme=bekleyen';
export const ISLERIM_ANLASILAN_YOLU = '/islerim?sekme=yaklasan';
