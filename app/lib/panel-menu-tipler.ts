/**
 * Panel menu TIPLERI — notr modul (hic import yok, 'use client' yok).
 *
 * NEDEN AYRI DOSYA: menu modelini kuran `app/lib/panel-menu.ts` bir SUNUCU
 * modulu (supabase-server okur); yan menu ise istemci bileseni. Tipler ortak
 * ama kod ortak OLMAMALI — tipler buradan import edilir, boylece istemci
 * paketine sunucu modulu hic girmez (CLAUDE.md: `*-data.ts` kalibi).
 */

/** Yan menudeki tek satir. `ikon` bir ADDIR; bilesen eslemesi yan menude. */
export type PanelMenuMaddesi = {
  href: string;
  etiket: string;
  /** `panel-yan-menu.tsx` icindeki IKONLAR sozlugunun anahtari. */
  ikon: string;
  /** Okunmamis sayisi (bildirim, mesaj). 0 ya da yoksa rozet cizilmez. */
  rozet?: number;
};

export type PanelMenuGrubu = {
  baslik: string;
  maddeler: PanelMenuMaddesi[];
};
