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
 *
 * Duzeltme 16-A: ajansin KENDI hesabi da (rol `agency` + ajans kurulusunun
 * sahibi) merkezi kullanir. Pazaryerinden gelen talepler, sohbet teklifleri ve
 * rezervasyonlar ajans hesabina yazilir; ajans panelinde bunlarin tek bir yeri
 * yoktu (yalniz bildirimden gidiliyordu) ve Duzeltme 15-E ile ajansa daha cok
 * talep dusuyor. Ajans UYELERI (rol `professional`) zaten kendi merkezini
 * gorur; ajansin sohbetleri onlara acik degildir. Kurumsal RFP teklifleri
 * (`/ajans/teklifler`) ayri akistir, merkezde gorunmez.
 *
 * Geri baglantilari ve Merkez kutulari bu tek karara bakar. `cache()`: istek
 * basina bir kez.
 */
export const saticiMerkeziAcik = cache(async (): Promise<boolean> => {
  const ziyaretci = await getZiyaretci();
  if (!ziyaretci.girisli) return false;
  if (ziyaretci.rol === 'professional') return true;
  if (ziyaretci.rol !== 'agency') return false;
  return ajansHesabiMi(await getCrewContext());
});

/**
 * Ajans ROLUNDEKI kullanici icin: merkez acik mi. Kurulussuz ajans rolu (panel
 * yok, menude satici grubu) ya da ajans kurulusunun sahibi (ajansin kendi
 * hesabi). Menu ayni olcutu kullanir (`getPanelMenu`).
 */
function ajansHesabiMi(baglam: {
  orgs: { accountType: string; role: string }[];
}): boolean {
  const ajanslar = baglam.orgs.filter((o) => o.accountType === 'agency');
  return ajanslar.length === 0 || ajanslar.some((o) => o.role === 'owner');
}

/**
 * Merkezi AJANS PANELINDEN acan hesap mi (rol `agency` + sahibi oldugu ajans
 * kurulusu). Sayfa bunu ajansa ozel notu gostermek icin kullanir.
 */
export const ajansPanelindeMerkez = cache(async (): Promise<boolean> => {
  const ziyaretci = await getZiyaretci();
  if (!ziyaretci.girisli || ziyaretci.rol !== 'agency') return false;
  const { orgs } = await getCrewContext();
  return orgs.some((o) => o.accountType === 'agency' && o.role === 'owner');
});

export const ISLERIM_YOLU = '/islerim';
export const ISLERIM_BEKLEYEN_YOLU = '/islerim?sekme=bekleyen';
export const ISLERIM_ANLASILAN_YOLU = '/islerim?sekme=yaklasan';
