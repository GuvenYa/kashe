import { cache } from 'react';
import { getZiyaretci, type Ziyaretci } from './ziyaretci';
import { getCrewContext, type CrewOrg } from './org-context';
import { getUnreadNotificationCount } from '@/app/bildirimler/actions';
import type {
  PanelMenuGrubu,
  PanelMenuMaddesi,
} from './panel-menu-tipler';

export type { PanelMenuGrubu, PanelMenuMaddesi };

/**
 * PANEL MENUSU — girisli kullanicinin gezintisinin TEK KAYNAGI (D1a).
 *
 * Hem panel yan menusu hem ust bardaki hamburger listesi buradan uretilir;
 * daha once ikisi `top-nav.tsx` icinde elle kurulan 13 maddelik duz bir diziydi
 * ve rol/izin kurallari orada gomuluydu.
 *
 * KURAL: bir madde yalniz KULLANICININ O YUZEYE GIRME HAKKI VARSA yazilir —
 * menu yetki kapisi degildir, sayfalar kendi kontrolunu yine yapar; ama menude
 * acilmayacak bir madde gostermek de yanlis cagridir.
 *
 * Grup sirasi: kisinin kendi grubu -> her kurulus kendi grubuyla -> Pazaryeri ->
 * Hesap. "Cikis yap" ve "Siteye don" menu modelinde YOKTUR: yan menunun dibinde
 * sabit dururlar (iki yerde cikmasinlar).
 */
export type PanelMenuBaglami = {
  ziyaretci: Ziyaretci;
  orgs: CrewOrg[];
  /** Okunmamis bildirim — Hesap grubundaki rozet. */
  bildirimSayisi: number;
};

const PAZARYERI: PanelMenuMaddesi[] = [
  { href: '/kesfet', etiket: 'Keşfet', ikon: 'kesfet' },
  { href: '/ilanlar', etiket: 'İlanlar', ikon: 'ilan' },
  { href: '/kashe-ai', etiket: 'Kashe AI', ikon: 'ai' },
];

/** Profesyonelin profil icerigi — ayri grup (merkez sayfasindan ayrisir). */
const PROFIL_ICERIGI: PanelMenuMaddesi[] = [
  { href: '/profil/duzenle', etiket: 'Düzenle', ikon: 'profil' },
  { href: '/profil/hizmetlerim', etiket: 'Hizmetler', ikon: 'hizmet' },
  { href: '/profil/paketler', etiket: 'Paketler', ikon: 'paket' },
  { href: '/profil/portfoy', etiket: 'Portföy', ikon: 'portfoy' },
  { href: '/profil/deneyim', etiket: 'Deneyim', ikon: 'deneyim' },
  {
    href: '/profil/kategori-bilgileri',
    etiket: 'Kategori bilgileri',
    ikon: 'kategori',
  },
];

/** Profesyonel / ajans (kurulussuz) satici grubu. */
function saticiGrubu(): PanelMenuMaddesi[] {
  return [
    { href: '/profil', etiket: 'Merkez', ikon: 'gosterge' },
    { href: '/teklif-talepleri', etiket: 'Teklif talepleri', ikon: 'rfp' },
    { href: '/rezervasyonlarim', etiket: 'Rezervasyonlar', ikon: 'rezervasyon' },
    { href: '/takvimim', etiket: 'Takvim', ikon: 'takvim' },
    { href: '/kazanclarim', etiket: 'Kazançlar', ikon: 'kazanc' },
    { href: '/basvurularim', etiket: 'Başvurularım', ikon: 'basvuru' },
  ];
}

/** Musteri (client) grubu. */
function musteriGrubu(): PanelMenuMaddesi[] {
  return [
    { href: '/profil', etiket: 'Merkez', ikon: 'gosterge' },
    { href: '/etkinliklerim', etiket: 'Etkinlikler', ikon: 'etkinlik' },
    { href: '/ilanlarim', etiket: 'İlanlarım', ikon: 'ilan' },
    {
      href: '/teklif-taleplerim',
      etiket: 'Pro teklifleri',
      ikon: 'teklif',
    },
    { href: '/rezervasyonlarim', etiket: 'Rezervasyonlar', ikon: 'rezervasyon' },
    { href: '/odemelerim', etiket: 'Ödemeler', ikon: 'odeme' },
  ];
}

/**
 * Ajans kurulusu grubu.
 *
 * "Ekip uyeleri" (`/profil/ekibim`) yalniz kullanicinin KENDI ajans profilinde
 * durur: o sayfa `agency_members`'i profil sahipligiyle okur, kurulus uyeligiyle
 * degil — izleyici bir uyeye gosterilse bos ya da yetkisiz acilirdi.
 */
function ajansGrubu(org: CrewOrg, kendiAjansi: boolean): PanelMenuMaddesi[] {
  const maddeler: PanelMenuMaddesi[] = [
    { href: '/ajans', etiket: 'Gösterge', ikon: 'gosterge' },
  ];
  if (org.canViewEvents) {
    maddeler.push({
      href: '/etkinliklerim',
      etiket: 'Etkinlikler',
      ikon: 'etkinlik',
    });
  }
  if (org.canViewProposals) {
    maddeler.push({ href: '/ajans/rfp', etiket: "Gelen RFP'ler", ikon: 'rfp' });
    maddeler.push({
      href: '/ajans/teklifler',
      etiket: 'Teklifler',
      ikon: 'teklif',
    });
  }
  if (org.canViewTalent && org.talentPoolEnabled) {
    maddeler.push({
      href: '/ajans/havuz',
      etiket: 'Yetenek havuzu',
      ikon: 'havuz',
    });
  }
  if (org.canViewCrew) {
    maddeler.push({ href: '/ajans/ekipler', etiket: 'Ekipler', ikon: 'ekip' });
  }
  // FAZ 8b: musteriler (CRM) — modul acik VE `crm.view`. Kurumsal grupta YOK:
  // CRM ajansa ozel (karar, 21 Ekim); `crmEnabled` hesap turunu de kontrol eder.
  if (org.crmEnabled && org.canViewCrm) {
    maddeler.push({
      href: `/ajans/musteriler?kurulus=${org.id}`,
      etiket: 'Müşteriler',
      ikon: 'musteri',
    });
  }
  // FAZ 8a: gorevler — `events.view` VE modul acik (ajansta varsayilan acik).
  if (org.tasksEnabled) {
    maddeler.push({
      href: `/kurulus/gorevler?kurulus=${org.id}`,
      etiket: 'Görevler',
      ikon: 'gorev',
    });
  }
  if (kendiAjansi) {
    maddeler.push({
      href: '/profil/ekibim',
      etiket: 'Ekip üyeleri',
      ikon: 'havuz',
    });
  }
  maddeler.push({ href: '/takvimim', etiket: 'Takvim', ikon: 'takvim' });
  if (org.canViewFinance) {
    maddeler.push({
      href: '/kazanclarim',
      etiket: 'Kazançlar',
      ikon: 'kazanc',
    });
  }
  return maddeler;
}

/** Kurum (business) kurulusu grubu. */
function kurumsalGrubu(org: CrewOrg, kendiKurumu: boolean): PanelMenuMaddesi[] {
  const maddeler: PanelMenuMaddesi[] = [
    { href: '/kurumsal', etiket: 'Gösterge', ikon: 'gosterge' },
  ];
  if (org.canViewEvents) {
    maddeler.push({
      href: '/etkinliklerim',
      etiket: 'Etkinlikler',
      ikon: 'etkinlik',
    });
    maddeler.push({
      href: '/kurumsal/rfp',
      etiket: 'Teklif talepleri',
      ikon: 'rfp',
    });
  }
  maddeler.push({
    href: '/rezervasyonlarim',
    etiket: 'Rezervasyonlar',
    ikon: 'rezervasyon',
  });
  maddeler.push({ href: '/ilanlarim', etiket: 'İlanlarım', ikon: 'ilan' });
  maddeler.push({
    href: '/teklif-taleplerim',
    etiket: 'Pro teklifleri',
    ikon: 'teklif',
  });
  if (kendiKurumu) {
    maddeler.push({
      href: '/profil/kurumsal-ekip',
      etiket: 'Ekip',
      ikon: 'havuz',
    });
  }
  // FAZ 8a: gorevler — modul kurumda KAPALI dogar, sahip/yonetici acar.
  if (org.tasksEnabled) {
    maddeler.push({
      href: `/kurulus/gorevler?kurulus=${org.id}`,
      etiket: 'Görevler',
      ikon: 'gorev',
    });
  }
  maddeler.push({ href: '/odemelerim', etiket: 'Ödemeler', ikon: 'odeme' });
  // FAZ 8a: modul ac/kapat yuzeyi; ajansta karsiligi yok (varsayilan acik).
  if (org.canManageSettings) {
    maddeler.push({ href: '/kurumsal/ayarlar', etiket: 'Ayarlar', ikon: 'ayar' });
  }
  return maddeler;
}

/** Baglamdan menu kurar — SAF fonksiyon (sorgu atmaz, test edilebilir). */
export function getPanelMenu(baglam: PanelMenuBaglami): PanelMenuGrubu[] {
  const { ziyaretci, orgs, bildirimSayisi } = baglam;
  if (!ziyaretci.girisli) return [];

  const gruplar: PanelMenuGrubu[] = [];

  const ajanslar = orgs.filter((o) => o.accountType === 'agency');
  const kurumlar = orgs.filter((o) => o.accountType === 'business');
  const profesyonel = ziyaretci.rol === 'professional';
  const ajansRolu = ziyaretci.rol === 'agency';
  const musteri = ziyaretci.rol === 'client';
  const isletmeRolu = ziyaretci.rol === 'business';

  // 1) Kisinin kendi grubu.
  //
  // Ajans rolu + ajans kurulusu olan kullanicida AYRI satici grubu ACILMAZ:
  // kurulus grubu ayni yuzeyleri zaten tasiyor, iki "Merkez" satiri olurdu.
  // Kurulussuz ajans rolunde (panel yok) satici grubu gosterilir ki menu bos
  // kalmasin.
  if (profesyonel || (ajansRolu && ajanslar.length === 0)) {
    gruplar.push({ baslik: 'Profesyonel', maddeler: saticiGrubu() });
  }
  if (musteri || (isletmeRolu && kurumlar.length === 0)) {
    gruplar.push({
      baslik: musteri ? 'Müşteri' : 'İşletme',
      maddeler: musteriGrubu(),
    });
  }

  // 2) Her kurulus kendi grubuyla (grup basligi kurulus adi).
  for (const org of ajanslar) {
    gruplar.push({
      baslik: org.name,
      maddeler: ajansGrubu(org, ajansRolu),
    });
  }
  for (const org of kurumlar) {
    gruplar.push({
      baslik: org.name,
      maddeler: kurumsalGrubu(org, isletmeRolu),
    });
  }

  // 3) Profil icerigi — yalniz profesyonel (kendi pazaryeri profilini yonetir).
  if (profesyonel) {
    gruplar.push({ baslik: 'Profil içeriği', maddeler: PROFIL_ICERIGI });
  }

  // 4) Pazaryeri — herkese.
  gruplar.push({ baslik: 'Pazaryeri', maddeler: PAZARYERI });

  // 5) Hesap.
  const hesap: PanelMenuMaddesi[] = [
    {
      href: '/bildirimler',
      etiket: 'Bildirimler',
      ikon: 'bildirim',
      rozet: bildirimSayisi,
    },
    { href: '/mesajlar', etiket: 'Mesajlar', ikon: 'mesaj' },
  ];
  if (profesyonel || ajansRolu) {
    hesap.push({ href: '/premium', etiket: 'Premium', ikon: 'premium' });
  }
  gruplar.push({ baslik: 'Hesap', maddeler: hesap });

  return gruplar;
}

/**
 * Baglami kurup menuyu doner — sayfalarin cagirdigi hal.
 *
 * `cache()`: ayni istekte hem sayfa (panel kabugu) hem ust bar (hamburger
 * listesi) cagirabilir; sorgular bir kez gider.
 */
export const panelMenusu = cache(async (): Promise<PanelMenuGrubu[]> => {
  const ziyaretci = await getZiyaretci();
  if (!ziyaretci.girisli) return [];

  const [{ orgs }, bildirimSayisi] = await Promise.all([
    getCrewContext(),
    getUnreadNotificationCount(),
  ]);

  return getPanelMenu({ ziyaretci, orgs, bildirimSayisi });
});

/**
 * Hamburger / avatar menusu icin DUZ liste.
 *
 * Ust bar grup basligi gostermiyor; gruplari koruyup yalniz maddeleri verir ve
 * Pazaryeri ile Hesap'i ayirir (o iki grup ust barda zaten baska yerde duruyor).
 */
export function menuyuDuzlestir(gruplar: PanelMenuGrubu[]): {
  isler: PanelMenuMaddesi[];
  hesap: PanelMenuMaddesi[];
} {
  const isler: PanelMenuMaddesi[] = [];
  let hesap: PanelMenuMaddesi[] = [];
  const gorulen = new Set<string>();

  for (const grup of gruplar) {
    if (grup.baslik === 'Pazaryeri') continue;
    if (grup.baslik === 'Hesap') {
      hesap = grup.maddeler;
      continue;
    }
    for (const madde of grup.maddeler) {
      // Ayni href birden cok kurulus grubunda cikabilir (Etkinlikler, Takvim).
      if (gorulen.has(madde.href)) continue;
      gorulen.add(madde.href);
      isler.push(madde);
    }
  }

  return { isler, hesap };
}
