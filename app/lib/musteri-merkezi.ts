import { cache } from 'react';
import { getZiyaretci } from './ziyaretci';
import { getCrewContext } from './org-context';

/**
 * MUSTERI IS MERKEZI KIMDE ACIK (Duzeltme 15-A, bulgu 128).
 *
 * `/etkinliklerim` musteri hesabinda is merkezidir (talepler, gelen teklifler,
 * rezervasyonlar tek listede); menude "Gelen teklifler" ve "Rezervasyonlar"
 * maddeleri yoktur. Olcut menudeki musteri grubuyla AYNI (`getPanelMenu`):
 * rol `client`, ya da kurulusu olmayan `business`.
 *
 * Duzeltme 16-B: kurumun KENDI hesabi da (rol `business` + kurum kurulusunun
 * sahibi) merkezi kullanir; kurumsal menude "Rezervasyonlar" ve "Gelen
 * teklifler" bu hesapta merkezin sekmeleridir. Ajans teklifinden (RFP) dogan
 * rezervasyonlar merkezde gorunur (`musteri-isleri.ts`); RFP'lerin kendisi
 * `/kurumsal/rfp`de kalir. Ajans panelinde ve kurum UYELERININ kurum grubunda
 * eski sayfalar ve menu maddeleri oldugu gibi durur (uyeler kendi rolleriyle
 * kisisel merkezi zaten gorur).
 *
 * Duzeltme 19-A: AJANSIN KENDI hesabi da (rol `agency` + ajans kurulusunun
 * sahibi) merkezi kullanir. Ajansin etkinliklerinde is sirasi farklidir
 * (ekip -> musteriye teklif -> onay); kartlar bu "ajans hattini" gosterir
 * (`musteri-isleri.ts`). Ajansin SATICI oldugu pazaryeri isleri "Islerim"de
 * kalir (`app/lib/satici-merkezi.ts`). Ajans UYELERI eski etkinlik listesini
 * gorur (uyenin rolu profesyoneldir; merkezi "Islerim"dir).
 *
 * Geri baglantilari ve yonlendirmeler bu tek karara bakar; boylece musteri
 * menusunde olmayan bir sayfaya dusmez. `cache()`: istek basina bir kez.
 */
export const musteriMerkeziAcik = cache(async (): Promise<boolean> => {
  const ziyaretci = await getZiyaretci();
  if (!ziyaretci.girisli) return false;
  if (ziyaretci.rol === 'client') return true;
  if (ziyaretci.rol === 'agency') {
    const { orgs } = await getCrewContext();
    return orgs.some((o) => o.accountType === 'agency' && o.role === 'owner');
  }
  if (ziyaretci.rol !== 'business') return false;
  const { orgs } = await getCrewContext();
  const kurumlar = orgs.filter((o) => o.accountType === 'business');
  // Kurulussuz isletme rolu ya da kurumun kendi hesabi (sahip).
  return kurumlar.length === 0 || kurumlar.some((o) => o.role === 'owner');
});

/**
 * Merkezi AJANS PANELINDEN acan hesabin kurulusu (rol `agency` + sahibi oldugu
 * ajans); degilse `null`. Sayfa bunu ajansa ozel ozet satirlari, not ve "Yeni
 * etkinlik"in kurulusa baglanmasi icin kullanir (Duzeltme 19-A).
 */
export const ajansPanelindeEtkinlikMerkezi = cache(
  async (): Promise<{ id: string; name: string } | null> => {
    const ziyaretci = await getZiyaretci();
    if (!ziyaretci.girisli || ziyaretci.rol !== 'agency') return null;
    const { orgs } = await getCrewContext();
    const ajans = orgs.find(
      (o) => o.accountType === 'agency' && o.role === 'owner'
    );
    return ajans ? { id: ajans.id, name: ajans.name } : null;
  }
);

/**
 * Merkezi KURUM PANELINDEN acan hesabin kurulusu (rol `business` + sahibi
 * oldugu kurum); degilse `null`. Sayfa bunu kuruma ozel notu ve "Yeni
 * etkinlik"in kurulusa baglanmasi icin kullanir.
 */
export const kurumPanelindeMerkez = cache(
  async (): Promise<{ id: string; name: string } | null> => {
    const ziyaretci = await getZiyaretci();
    if (!ziyaretci.girisli || ziyaretci.rol !== 'business') return null;
    const { orgs } = await getCrewContext();
    const kurum = orgs.find(
      (o) => o.accountType === 'business' && o.role === 'owner'
    );
    return kurum ? { id: kurum.id, name: kurum.name } : null;
  }
);

export const MERKEZ_YOLU = '/etkinliklerim';
export const MERKEZ_BEKLEYEN_YOLU = '/etkinliklerim?sekme=bekleyen';
export const MERKEZ_YAKLASAN_YOLU = '/etkinliklerim?sekme=yaklasan';
