/**
 * Panel menu TIPLERI — notr modul (hic import yok, 'use client' yok).
 *
 * NEDEN AYRI DOSYA: menu modelini kuran `app/lib/panel-menu.ts` bir SUNUCU
 * modulu (supabase-server okur); yan menu ise istemci bileseni. Tipler ortak
 * ama kod ortak OLMAMALI — tipler buradan import edilir, boylece istemci
 * paketine sunucu modulu hic girmez (CLAUDE.md: `*-data.ts` kalibi).
 */

/**
 * Yan menu bolumu (Duzeltme 02).
 *
 * Bir kurulus grubu 12 maddeye kadar cikiyordu ve hepsi art arda duruyordu.
 * Maddeler uc bolume ayrilir: gunluk is (`calisma`), kadro ve kaynaklar
 * (`ekip`), ayar/para isleri (`yonetim`).
 */
export type PanelMenuBolumu = 'calisma' | 'ekip' | 'yonetim';

/** Bolum basliklari — TEK KAYNAK (yan menu bunlari yazar). */
export const BOLUM_ETIKETLERI: Record<PanelMenuBolumu, string> = {
  calisma: 'Çalışma',
  ekip: 'Ekip ve kaynaklar',
  yonetim: 'Yönetim',
};

/** Bolum sirasi — yan menu bu sirayla cizer. */
export const BOLUM_SIRASI: PanelMenuBolumu[] = ['calisma', 'ekip', 'yonetim'];

/** Yan menudeki tek satir. `ikon` bir ADDIR; bilesen eslemesi yan menude. */
export type PanelMenuMaddesi = {
  href: string;
  etiket: string;
  /** `panel-yan-menu.tsx` icindeki IKONLAR sozlugunun anahtari. */
  ikon: string;
  /** Okunmamis sayisi (bildirim, mesaj). 0 ya da yoksa rozet cizilmez. */
  rozet?: number;
  /**
   * Yan menu bolumu (Duzeltme 02). Yoksa madde grup basliginin hemen altinda,
   * bolumlerden ONCE cizilir (Pazaryeri ve Hesap gruplari boyle).
   */
  bolum?: PanelMenuBolumu;
  /**
   * Kisa baslaticida (avatar menusu / mobil hamburger) gosterilir.
   * Isaret TEK YERDE: `app/lib/panel-menu.ts`.
   */
  oncelik?: boolean;
};

export type PanelMenuGrubu = {
  baslik: string;
  maddeler: PanelMenuMaddesi[];
  /**
   * Grup TEK PARCA katlanir (bolumsuz): grup basligi dugme olur.
   * "Profil icerigi" boyle — alti madde, hepsi ayni isin parcasi.
   */
  katlanir?: boolean;
  /**
   * Kullanicinin UYESI oldugu (sahibi OLMADIGI) kurulus grubu.
   *
   * Baslatici bu kuruluslarin gosterge maddesini "<Kurulus adi> paneli"
   * etiketiyle ayrica gosterir; ust bardaki rol satiri da uyelik rolunu
   * buradan okur. Karar `getPanelMenu` icinde verilir (tek kaynak).
   */
  uyeKurulus?: boolean;
  /** Uyelik rolu (`organization_memberships.role`) — yalniz `uyeKurulus` ise. */
  uyelikRolu?: string;
};

/**
 * KISA BASLATICI (Duzeltme 02) — ust bar avatar menusu ve mobil hamburgerin
 * okudugu model. Modeli kuran saf fonksiyon `app/lib/panel-menu.ts`
 * (`baslaticiMenusu`); tip burada durur ki istemci bileseni sunucu modulunu
 * import etmek zorunda kalmasin.
 */
export type BaslaticiMenusu = {
  /** Kisinin kendi gostergesi ("Panel" etiketiyle gosterilir). */
  panel: PanelMenuMaddesi | null;
  /** En cok kullanilan maddeler — en fazla dort. */
  oncelikli: PanelMenuMaddesi[];
  /** Hesap satirlari (Profilim / Profili duzenle / Premium). */
  hesap: PanelMenuMaddesi[];
  /** Ilk UYE oldugu kurulus — rol satiri icin (sahibi oldugu kurulus degil). */
  uyelik: { ad: string; rol: string | null } | null;
};

/** Baslaticinin ihtiyac duydugu ziyaretci ozeti (PII yok). */
export type BaslaticiOzeti = {
  /** `profiles.role` — hesap satirlarini secer. */
  rol: string | null;
  /** Kullanici kimligi — "Profilim" (`/p/<id>`) icin. */
  kullaniciId: string | null;
};
