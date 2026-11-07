import { cache } from 'react';
import { getZiyaretci, type Ziyaretci } from './ziyaretci';
import { getCrewContext, type CrewOrg } from './org-context';
import { getUnreadNotificationCount } from '@/app/bildirimler/actions';
import type {
  BaslaticiMenusu,
  BaslaticiOzeti,
  PanelMenuBolumu,
  PanelMenuGrubu,
  PanelMenuMaddesi,
} from './panel-menu-tipler';

export type {
  BaslaticiMenusu,
  BaslaticiOzeti,
  PanelMenuBolumu,
  PanelMenuGrubu,
  PanelMenuMaddesi,
};

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

/**
 * Profesyonel / ajans (kurulussuz) satici grubu.
 *
 * Madde sirasi BOLUM sirasini izler (calisma -> yonetim); `oncelik` isaretli
 * maddeler kisa baslaticiya cikar.
 */
function saticiGrubu(): PanelMenuMaddesi[] {
  return [
    { href: '/profil', etiket: 'Merkez', ikon: 'gosterge', bolum: 'calisma' },
    {
      href: '/teklif-talepleri',
      etiket: 'Teklif talepleri',
      ikon: 'rfp',
      bolum: 'calisma',
      oncelik: true,
    },
    // Duzeltme 12-D (bulgu 119): sohbetlerde verilen tekliflerin tek listesi
    {
      href: '/tekliflerim',
      etiket: 'Verdiğim teklifler',
      ikon: 'teklif',
      bolum: 'calisma',
    },
    {
      href: '/rezervasyonlarim',
      etiket: 'Rezervasyonlar',
      ikon: 'rezervasyon',
      bolum: 'calisma',
      oncelik: true,
    },
    {
      href: '/takvimim',
      etiket: 'Takvim',
      ikon: 'takvim',
      bolum: 'calisma',
      oncelik: true,
    },
    {
      href: '/basvurularim',
      etiket: 'Başvurularım',
      ikon: 'basvuru',
      bolum: 'calisma',
    },
    {
      href: '/kazanclarim',
      etiket: 'Kazançlar',
      ikon: 'kazanc',
      bolum: 'yonetim',
    },
  ];
}

/** Musteri (client) grubu. */
function musteriGrubu(): PanelMenuMaddesi[] {
  return [
    { href: '/profil', etiket: 'Merkez', ikon: 'gosterge', bolum: 'calisma' },
    {
      href: '/etkinliklerim',
      etiket: 'Etkinlikler',
      ikon: 'etkinlik',
      bolum: 'calisma',
      oncelik: true,
    },
    {
      href: '/ilanlarim',
      etiket: 'İlanlarım',
      ikon: 'ilan',
      bolum: 'calisma',
    },
    {
      href: '/teklif-taleplerim',
      etiket: 'Gelen teklifler',
      ikon: 'teklif',
      bolum: 'calisma',
      oncelik: true,
    },
    {
      href: '/rezervasyonlarim',
      etiket: 'Rezervasyonlar',
      ikon: 'rezervasyon',
      bolum: 'calisma',
      oncelik: true,
    },
    {
      href: '/odemelerim',
      etiket: 'Ödemeler',
      ikon: 'odeme',
      bolum: 'yonetim',
    },
  ];
}

/**
 * Ajans kurulusu grubu.
 *
 * MADDE SIRASI BOLUM SIRASINI IZLER (calisma -> ekip -> yonetim; Duzeltme 02):
 * gunluk is ustte, kadro ortada, para/ayar altta. Yetki kosullari AYNEN
 * korunur — menu yetki kapisi degil, ama girilemeyecek madde de yazilmaz.
 *
 * "Ekip uyeleri" (`/profil/ekibim`) A7'den beri UYE YONETME yetkisine bakar
 * (`members.manage`), profil sahipligine degil: davetle katilan yonetici de
 * ekibini goruyor. Izleyici uyede madde CIKMAZ (yetki yok).
 */
function ajansGrubu(org: CrewOrg): PanelMenuMaddesi[] {
  const maddeler: PanelMenuMaddesi[] = [
    { href: '/ajans', etiket: 'Gösterge', ikon: 'gosterge', bolum: 'calisma' },
  ];

  // --- Calisma ---
  if (org.canViewEvents) {
    maddeler.push({
      href: '/etkinliklerim',
      etiket: 'Etkinlikler',
      ikon: 'etkinlik',
      bolum: 'calisma',
      oncelik: true,
    });
  }
  // Duzeltme 13-E (bulgu 122): sihirbaza menuden yol (Fahri adresi elle yazdi).
  if (org.canManageEvents) {
    maddeler.push({
      href: `/etkinlik-sihirbazi?kurulus=${org.id}`,
      etiket: 'Yeni etkinlik',
      ikon: 'ai',
      bolum: 'calisma',
    });
  }
  if (org.canViewProposals) {
    maddeler.push({
      href: '/ajans/rfp',
      etiket: "Gelen RFP'ler",
      ikon: 'rfp',
      bolum: 'calisma',
    });
    maddeler.push({
      href: '/ajans/teklifler',
      etiket: 'Teklifler',
      ikon: 'teklif',
      bolum: 'calisma',
      oncelik: true,
    });
  }
  maddeler.push({
    href: '/takvimim',
    etiket: 'Takvim',
    ikon: 'takvim',
    bolum: 'calisma',
  });

  // --- Ekip ve kaynaklar ---
  if (org.canViewCrew) {
    maddeler.push({
      href: '/ajans/ekipler',
      etiket: 'Ekipler',
      ikon: 'ekip',
      bolum: 'ekip',
      oncelik: true,
    });
  }
  if (org.canViewTalent && org.talentPoolEnabled) {
    maddeler.push({
      href: '/ajans/havuz',
      etiket: 'Yetenek havuzu',
      ikon: 'havuz',
      bolum: 'ekip',
    });
  }
  if (org.canManageMembers) {
    maddeler.push({
      href: `/profil/ekibim?kurulus=${org.id}`,
      etiket: 'Ekip üyeleri',
      ikon: 'havuz',
      bolum: 'ekip',
    });
  }
  // FAZ 8b: musteriler (CRM) — modul acik VE `crm.view`. Kurumsal grupta YOK:
  // CRM ajansa ozel (karar, 21 Ekim); `crmEnabled` hesap turunu de kontrol eder.
  if (org.crmEnabled && org.canViewCrm) {
    maddeler.push({
      href: `/ajans/musteriler?kurulus=${org.id}`,
      etiket: 'Müşteriler',
      ikon: 'musteri',
      bolum: 'ekip',
    });
  }
  // FAZ 8c: tedarikci defteri — modul acik VE `suppliers.view`. Kurumsal
  // grupta YOK: defter ajansa ozel (`suppliersEnabled` hesap turunu de bakar).
  if (org.suppliersEnabled && org.canViewSuppliers) {
    maddeler.push({
      href: `/ajans/tedarikciler?kurulus=${org.id}`,
      etiket: 'Tedarikçiler',
      ikon: 'tedarikci',
      bolum: 'ekip',
    });
  }

  // --- Yonetim ---
  // FAZ 8a: gorevler — `events.view` VE modul acik (ajansta varsayilan acik).
  if (org.tasksEnabled) {
    maddeler.push({
      href: `/kurulus/gorevler?kurulus=${org.id}`,
      etiket: 'Görevler',
      ikon: 'gorev',
      bolum: 'yonetim',
    });
  }
  if (org.canViewFinance) {
    maddeler.push({
      href: '/kazanclarim',
      etiket: 'Kazançlar',
      ikon: 'kazanc',
      bolum: 'yonetim',
    });
  }
  return maddeler;
}

/** Kurum (business) kurulusu grubu — bolum sirasi ajansla ayni kuralda. */
function kurumsalGrubu(org: CrewOrg): PanelMenuMaddesi[] {
  const maddeler: PanelMenuMaddesi[] = [
    { href: '/kurumsal', etiket: 'Gösterge', ikon: 'gosterge', bolum: 'calisma' },
  ];

  // --- Calisma ---
  if (org.canViewEvents) {
    maddeler.push({
      href: '/etkinliklerim',
      etiket: 'Etkinlikler',
      ikon: 'etkinlik',
      bolum: 'calisma',
      oncelik: true,
    });
    // Duzeltme 13-E: sihirbaza menuden yol
    if (org.canManageEvents) {
      maddeler.push({
        href: `/etkinlik-sihirbazi?kurulus=${org.id}`,
        etiket: 'Yeni etkinlik',
        ikon: 'ai',
        bolum: 'calisma',
      });
    }
    maddeler.push({
      href: '/kurumsal/rfp',
      etiket: 'Teklif talepleri',
      ikon: 'rfp',
      bolum: 'calisma',
      oncelik: true,
    });
    // FAZ 8c: alici kisa listesi — `supplier_search` modulu + `events.view`.
    // Ayri bir yetki anahtari YOK: kisa liste bir etkinlik hazirligi aracidir.
    if (org.shortlistEnabled) {
      maddeler.push({
        href: `/kurumsal/kisa-liste?kurulus=${org.id}`,
        etiket: 'Kısa liste',
        ikon: 'kisaliste',
        bolum: 'calisma',
      });
    }
  }
  maddeler.push({
    href: '/rezervasyonlarim',
    etiket: 'Rezervasyonlar',
    ikon: 'rezervasyon',
    bolum: 'calisma',
    oncelik: true,
  });
  maddeler.push({
    href: '/teklif-taleplerim',
    etiket: 'Gelen teklifler',
    ikon: 'teklif',
    bolum: 'calisma',
  });
  maddeler.push({
    href: '/ilanlarim',
    etiket: 'İlanlarım',
    ikon: 'ilan',
    bolum: 'calisma',
  });

  // --- Ekip ve kaynaklar ---
  // A7: sahiplik yerine `members.manage` (davetli yonetici de gorur).
  if (org.canManageMembers) {
    maddeler.push({
      href: `/profil/kurumsal-ekip?kurulus=${org.id}`,
      etiket: 'Ekip',
      ikon: 'havuz',
      bolum: 'ekip',
    });
  }

  // --- Yonetim ---
  // FAZ 8a: gorevler — modul kurumda KAPALI dogar, sahip/yonetici acar.
  if (org.tasksEnabled) {
    maddeler.push({
      href: `/kurulus/gorevler?kurulus=${org.id}`,
      etiket: 'Görevler',
      ikon: 'gorev',
      bolum: 'yonetim',
    });
  }
  maddeler.push({
    href: '/odemelerim',
    etiket: 'Ödemeler',
    ikon: 'odeme',
    bolum: 'yonetim',
  });
  // FAZ 8a: modul ac/kapat yuzeyi; ajansta karsiligi yok (varsayilan acik).
  if (org.canManageSettings) {
    maddeler.push({
      href: '/kurumsal/ayarlar',
      etiket: 'Ayarlar',
      ikon: 'ayar',
      bolum: 'yonetim',
    });
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
  // `uyeKurulus`: kullanici bu kurulusun SAHIBI degil, UYESI — olcut UYELIK
  // ROLU (`organization_memberships.role`), hesap turu degil: ajans rolundeki
  // bir kullanici baska bir ajansin satis uyesi de olabilir. Baslatici bu
  // kuruluslarin gostergesini "<Kurulus adi> paneli" satiri olarak ayrica
  // gosterir ve ust bardaki rol satiri uyelik rolunu buradan okur — karar TEK
  // YERDE, burada.
  for (const org of ajanslar) {
    gruplar.push({
      baslik: org.name,
      maddeler: ajansGrubu(org),
      uyeKurulus: org.role !== 'owner',
      uyelikRolu: org.role,
    });
  }
  for (const org of kurumlar) {
    gruplar.push({
      baslik: org.name,
      maddeler: kurumsalGrubu(org),
      uyeKurulus: org.role !== 'owner',
      uyelikRolu: org.role,
    });
  }

  // 3) Profil icerigi — yalniz profesyonel (kendi pazaryeri profilini yonetir).
  if (profesyonel) {
    // Katlanir grup (Duzeltme 02): alti madde tek isin parcasi; aktif sayfa
    // iceride degilse kapali durur.
    gruplar.push({
      baslik: 'Profil içeriği',
      maddeler: PROFIL_ICERIGI,
      katlanir: true,
    });
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

/** Baslaticida gosterilmeyen gruplar — ust barda zaten baska yerde duruyorlar. */
const BASLATICI_DISI_GRUPLAR = ['Pazaryeri', 'Hesap', 'Profil içeriği'];

/** Oncelikli madde ust siniri: menu kisa kalsin (karar, Duzeltme 02). */
const ONCELIK_SINIRI = 4;

/**
 * KISA BASLATICI (Duzeltme 02) — SAF fonksiyon.
 *
 * Eski duzlestirici yan menunun TUM maddelerini duz bir listeye
 * doktugu icin ajans sahibinde 16 satir + Admin + Cikis cikiyordu; kullanici
 * ne yapacagini bulamiyordu. Baslatici artik yalniz "Panel" + en cok kullanilan
 * maddeler + hesap satirlari verir; gerisi panel yan menusunde durur.
 *
 * Bildirimler ve Mesajlar BURADA YOK: ust barda zil ve "Mesajlar" zaten var
 * (mobil hamburger kendi rozetli satirlarini kendi ciziyor).
 */
export function baslaticiMenusu(
  gruplar: PanelMenuGrubu[],
  ozet: BaslaticiOzeti
): BaslaticiMenusu {
  const isGruplari = gruplar.filter(
    (g) => !BASLATICI_DISI_GRUPLAR.includes(g.baslik)
  );

  const panel = isGruplari[0]?.maddeler[0] ?? null;

  // SIRA: (1) kisinin KENDI yuzeylerinin oncelikleri — kendi grubu ve sahibi
  // oldugu kuruluslar, (2) UYESI oldugu her kurulusun gostergesi ("<Ad>
  // paneli" — uye icin o kurulusa giden tek yol), (3) yer kalirsa uye
  // kuruluslarin oncelikleri. Hepsi birlikte `ONCELIK_SINIRI` ile kesilir.
  const oncelikli: PanelMenuMaddesi[] = [];
  const gorulen = new Set<string>(panel ? [panel.href] : []);

  function ekle(madde: PanelMenuMaddesi) {
    // Ayni href birden cok kurulus grubunda cikabilir (Etkinlikler, Takvim).
    if (gorulen.has(madde.href)) return;
    gorulen.add(madde.href);
    oncelikli.push(madde);
  }

  for (const grup of isGruplari) {
    if (grup.uyeKurulus) continue;
    for (const madde of grup.maddeler) if (madde.oncelik) ekle(madde);
  }
  for (const grup of isGruplari) {
    if (!grup.uyeKurulus) continue;
    const gosterge = grup.maddeler[0];
    if (gosterge) ekle({ ...gosterge, etiket: `${grup.baslik} paneli` });
  }
  for (const grup of isGruplari) {
    if (!grup.uyeKurulus) continue;
    for (const madde of grup.maddeler) if (madde.oncelik) ekle(madde);
  }

  const hesap: PanelMenuMaddesi[] = [];
  const saticiRolu = ozet.rol === 'professional' || ozet.rol === 'agency';
  // "Profilim" yalniz HALKA ACIK sayfasi olan rollerde (profesyonel, ajans).
  if (saticiRolu && ozet.kullaniciId) {
    hesap.push({
      href: `/p/${ozet.kullaniciId}`,
      etiket: 'Profilim',
      ikon: 'profil',
    });
  }
  // `/profil/duzenle` rol kapisi TASIMIYOR (sayfa yalniz oturum ve profil
  // varligina bakar; form client/business icin kendi alanlarini ciziyor), bu
  // yuzden dort rolde de yazilir.
  hesap.push({
    href: '/profil/duzenle',
    etiket: 'Profili düzenle',
    ikon: 'profil',
  });
  if (saticiRolu) {
    hesap.push({ href: '/premium', etiket: 'Premium', ikon: 'premium' });
  }

  const uyeGrup = isGruplari.find((g) => g.uyeKurulus) ?? null;

  return {
    panel,
    oncelikli: oncelikli.slice(0, ONCELIK_SINIRI),
    hesap,
    uyelik: uyeGrup
      ? { ad: uyeGrup.baslik, rol: uyeGrup.uyelikRolu ?? null }
      : null,
  };
}
