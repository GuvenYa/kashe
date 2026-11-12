import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { IletisimButton } from './iletisim-button';
import { GuvenCipleri } from '@/app/components/guven-cipleri';
import { FiyatTakvimKarti } from '@/app/components/fiyat-takvim-karti';
import { RezervasyonButton } from './rezervasyon-button';
import { DavetButton } from './davet-button';
import FavoriteButton from '@/app/components/FavoriteButton';
import { SikayetButton } from '@/app/sikayet/sikayet-button';
import { YorumButton } from './yorum-button';
import { CategoryIcon } from '@/app/components/ui/category-icon';
import { getCategoryIcon } from '@/app/lib/category-icon';
import { ShareButton } from './share-button';
import { type OnBehalfBusiness } from '@/app/components/on-behalf-selector';
import { ProfileMediaHero, type HeroMedia } from './profile-media-hero';
import { formatPriceRange } from '@/app/lib/profile-helpers';
import {
  getCategoryFields,
  getModuleTitle,
  getQuickLabel,
  formatQuickValue,
  formatExperiencePeriod,
  MODULE_REGISTRY,
  type LeveledSkill,
  type ProfileExperience,
} from '@/app/lib/category-fields';
import { etkinlikTurleri } from '@/app/lib/etkinlik-turleri';
import { cizilebilirMetin, ozetCipleri } from '@/app/lib/ozet-cipleri';
import type { HizmetSecenegi } from '@/app/lib/teklif-secenekleri';
import { etiketle } from '@/app/lib/etkinlik-turu';
import { ProfilIslemSaglayici } from './profil-islem-baglami';
import {
  BOLUM_CAPA,
  BolumSeridi,
  type BolumCapasi,
} from './bolum-seridi';
import { MobilCtaCubugu } from './mobil-cta-cubugu';
import type {
  ServiceWithCategory,
  ServicePackage,
  PortfolioItem,
} from '@/app/lib/types';

type AttrRecord = Record<string, unknown>;

export type ProfessionalProfileProps = {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    role: string;
    approval_status: string | null;
    category_attributes: AttrRecord | null;
    service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
  };
  displayName: string;
  initials: string;
  categorySubtitle: string;
  /**
   * FAZ 4c/P3 etkinlik bagi (bulgu 84): `?etkinlik=` ile gelindiyse teklif
   * sohbete etkinlige BAGLI acilir (sunucu eylemi dogrular). Ajans dali bunu
   * tasiyordu; profesyonel dali (yeni tasarim) dusuruyordu.
   */
  etkinlikId?: string | null;
  cityName: string | undefined;
  /** Duzeltme 10-D: 81 il (il secici: kart + brief). */
  iller?: { id: number; name: string }[];
  averageRating: number;
  reviewCount: number;
  isBusyNow: boolean;
  /** D2 — guven cipleri ve fiyat/takvim karti icin gercek sinyaller. */
  guvenSinyalleri: {
    dogrulanmis: boolean;
    profilOnayli: boolean;
    tamamlanmisIs: number;
    ortalamaYanitSaati: number | null;
    tekrarTercih: boolean;
    premium: boolean;
    yuksekPuanli?: boolean;
    cokTercihEdilen?: boolean;
  };
  /** Musaitlik takvimi (profesyonelin isaretledigi dolu gunler). */
  blockedDates: string[];
  /** Onayli rezervasyon gunleri (otomatik dolu). */
  bookedDates: string[];
  /** Yayindaki en dusuk paket/hizmet fiyati; yoksa null. */
  enDusukFiyat: number | null;
  services: ServiceWithCategory[];
  packages: ServicePackage[];
  portfolioItems: PortfolioItem[];
  experiences: ProfileExperience[];
  representingAgency: { id: string; name: string; initials: string } | null;
  recentReviews: { id: string; rating: number; body: string | null; created_at: string; customer_id: string }[];
  /** Gerçek anlaşması (deal-confirmed) olan müşteri id'leri — yalnız bu kartlarda "Onaylı yorum". */
  verifiedCustomerIds: Set<string>;
  customerMap: Map<string, { id: string; full_name: string | null; avatar_url: string | null }>;
  replyMap: Map<string, { id: string; review_id: string; body: string; created_at: string; updated_at: string }>;
  reviewsHref: string;
  // etkileşim
  isLoggedIn: boolean;
  isOwnProfile: boolean;
  /**
   * Duzeltme 15-E: profesyonel taleplerini ajansi uzerinden aliyorsa ajans
   * (pazaryeri profil kimligi + ad); yoksa null.
   */
  ajansYonlendirme?: { ajansId: string; ajansAdi: string } | null;
  currentUserIsProfessional: boolean;
  currentUserRole: string | null;
  writableBusinesses: OnBehalfBusiness[];
  showFavoriteButton: boolean;
  initialFavorited: boolean;
  canReview: boolean;
  hasCompletedBooking: boolean;
  existingReview: { id: string; rating: number; body: string | null } | null;
  /** Duzeltme 01 (#28): `?yorum=1` ile gelindiyse modal acik baslar. */
  yorumModaliAcik?: boolean;
  /** FAZ 5/P3: ajans uyesine "Havuza ekle" karti; yetki yoksa sunucu HIC gondermez. */
  havuzSlot?: ReactNode;
  /** hijyen 04: "Kisa listeye ekle" bandi (alici kurulus uyesinde dolu). */
  kisaListeSlot?: ReactNode;
};

const EYEBROW =
  'font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink';
const CARD = 'bg-card border border-line rounded-2xl';
/** Veri olmayan ana bolumde tek satir (Duzeltme 11-D2). */
const BOS_SATIR = 'text-[14px] text-ink-72';

/**
 * BOLUM BASLIGI (Duzeltme 10-F6, bulgu 80)
 *
 * Tek kural: buyuk baslik (h2) = kategori slogani varsa O, yoksa bolumun
 * STANDART adi; kucuk ust etiket (eyebrow) YALNIZ slogan varken cizilir.
 * Oncesinde her bolum iki ad tasiyordu (eyebrow + uydurma ikinci baslik
 * "Calisma modelleri" / "One cikan isler" / "Teknik altyapi") ve slogani
 * olmayan profilde kullanici ayni bolumu iki kez okuyordu.
 */
function BolumBasligi({
  ad,
  slogan,
  altSatir,
}: {
  ad: string;
  slogan?: string | null;
  altSatir?: React.ReactNode;
}) {
  return (
    <>
      {slogan ? <div className={EYEBROW}>{ad}</div> : null}
      <h2
        className={`font-display text-[22px] font-bold text-ink ${
          slogan ? 'mt-1' : ''
        } ${altSatir ? 'mb-1' : 'mb-4'}`}
      >
        {slogan || ad}
      </h2>
      {altSatir ? <div className="mb-4">{altSatir}</div> : null}
    </>
  );
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { timeZone: KASHE_SAAT_DILIMI, month: 'long', year: 'numeric' });
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-px" aria-label={`${rating} yıldız`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? 'var(--color-brand-accent)' : '#D9D2C2'} aria-hidden="true">
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
        </svg>
      ))}
    </span>
  );
}

export async function ProfessionalProfile(props: ProfessionalProfileProps) {
  // FAZ 10b: etkinlik turu etiketleri `event_types` tablosundan (pasif
  // turler dahil — eski beyanin etiketi kaybolmasin).
  const turler = await etkinlikTurleri({ hepsi: true });
  const {
    profile, displayName, initials, categorySubtitle, cityName, iller = [],
    averageRating, reviewCount, isBusyNow, services, packages,
    guvenSinyalleri, blockedDates, bookedDates, enDusukFiyat,
    portfolioItems, experiences, representingAgency, recentReviews,
    verifiedCustomerIds, customerMap, replyMap, reviewsHref, isLoggedIn, isOwnProfile,
    ajansYonlendirme = null,
    currentUserIsProfessional, currentUserRole, writableBusinesses,
    etkinlikId = null,
    showFavoriteButton, initialFavorited, canReview, hasCompletedBooking,
    existingReview, yorumModaliAcik = false, havuzSlot, kisaListeSlot,
  } = props;

  const slug = profile.service_categories?.slug ?? null;
  /** Duzeltme 01 (#5): avatarsiz profilde kategori ikonu (yoksa bas harf). */
  const kategoriIkonu = getCategoryIcon(slug);
  const preset = getCategoryFields(slug);
  const attrs = (profile.category_attributes ?? {}) as AttrRecord;
  // Quick değerleri: çoklu-çip → string[], select/metin → string.
  // Gösterim formatQuickValue ile tekilleşir (" · " birleştirme burada yapılır).
  const quick = (attrs.quick as Record<string, unknown>) ?? {};
  const skills = (attrs.skills as LeveledSkill[]) ?? [];
  const logistics = (attrs.logistics as Record<string, boolean>) ?? {};
  const serviceRegion = attrs.service_region as string | undefined;
  /**
   * Modaldeki "Hangi hizmet ya da paket?" secenekleri — paketler ustte,
   * sonra hizmetler; ayni baslik bir kez.
   *
   * Duzeltme 11-B1: artik yalniz baslik degil fiyat ve icerik de tasinir
   * (modal secimin altinda kisa ozet cizer). Icerik `includes` jsonb'sinden
   * gelir: metin olmayan madde ATLANIR (bulgu 78 dersi).
   */
  const hizmetSecenekleri: HizmetSecenegi[] = [];
  for (const p2 of packages) {
    if (!p2.title || hizmetSecenekleri.some((x) => x.baslik === p2.title)) continue;
    hizmetSecenekleri.push({
      baslik: p2.title,
      tur: 'paket',
      fiyat:
        formatPriceRange(
          p2.price_min,
          p2.price_max,
          p2.price_on_request,
          'total',
          p2.price_starting
        ) || null,
      icerik: (Array.isArray(p2.includes) ? p2.includes : [])
        .map((madde) => cizilebilirMetin(madde))
        .filter((madde): madde is string => !!madde),
      kategoriSlug: slug,
    });
  }
  for (const s2 of services) {
    if (!s2.title || hizmetSecenekleri.some((x) => x.baslik === s2.title)) continue;
    hizmetSecenekleri.push({
      baslik: s2.title,
      tur: 'hizmet',
      fiyat:
        formatPriceRange(
          s2.price_min,
          s2.price_max,
          s2.price_on_request,
          s2.price_unit ?? 'total',
          s2.price_starting
        ) || null,
      icerik: [],
      kategoriSlug: slug,
    });
  }
  /** Duzeltme 10-D2: il secici tek ile kilitlenir mi? */
  const yalnizKendiSehri = serviceRegion === 'Yalnızca kendi şehri';
  const experienceLabel = attrs.experience_label as string | undefined;
  // Çalışma şekli — ORTAK alan; yoksa eski quick.calisma_sekli'den OKU (tek yön; anayasa: boşsa satır yok).
  const calismaSekli =
    (attrs.calisma_sekli as string | undefined) ??
    ((attrs.quick as Record<string, unknown> | undefined)?.calisma_sekli as
      | string
      | undefined);
  const taglines = (attrs.section_taglines as Record<string, string>) ?? {};
  const modulesData = (attrs.modules as Record<string, AttrRecord>) ?? {};
  /**
   * Ozet bandi (uzmanlik arketipi). `stats` bilerek `unknown`: jsonb'de hem
   * metin dizisi hem eski `{label,value}` nesneleri olabiliyor; cizim
   * `ozetCipleri` ile metne cevrilir (bulgu 78 — nesne React cocugu olarak
   * sayfayi istemcide cokertiyordu).
   */
  const summary = attrs.summary as
    | { title?: unknown; body?: unknown; stats?: unknown }
    | undefined;
  const ozetCipleriListesi = ozetCipleri(summary?.stats);
  const ozetBasligi = cizilebilirMetin(summary?.title);
  const ozetGovdesi = cizilebilirMetin(summary?.body);
  // Etkinlik türleri — ORTAK alan (category_attributes.etkinlik_turleri; ilanlar taksonomisi key'leri).
  const eventTypes = Array.isArray(attrs.etkinlik_turleri)
    ? (attrs.etkinlik_turleri as string[])
    : [];
  const archetype = preset?.archetype ?? 'produksiyon';

  // ---- Fiyat aralığı (yayındaki hizmetler; tümü talep-üzerine ise gizle) ----
  const priceable = services.filter((s) => !s.price_on_request && s.price_min !== null);
  let priceRange: string | null = null;
  if (priceable.length > 0) {
    const min = Math.min(...priceable.map((s) => s.price_min as number));
    const max = Math.max(...priceable.map((s) => (s.price_max ?? s.price_min) as number));
    // C4 — para birimi SONDA (formatPriceRange tek kaynak). Tek fiyat noktasi
    // "X TL'den baslar"; gercek aralik "min - max TL". Bicim app/lib/para.ts.
    priceRange =
      min === max
        ? formatPriceRange(min, min, false, 'total', true)
        : formatPriceRange(min, max, false);
  }

  // ---- Hero medyası ----
  const heroMedia: HeroMedia[] = portfolioItems.map((p) => ({
    id: p.id, type: p.media_type, url: p.media_url, caption: p.caption,
  }));

  // ---- quickInfo hücreleri — TEK-YER: yalnız quick{} kendi değerleri (modül-fallback YOK).
  //      Eşik: 2'den az dolu hücre → quick satırı hiç çizilmez.
  const quickCells = (preset?.quickInfo ?? [])
    .map((k) => ({
      key: k,
      label: getQuickLabel(preset, k),
      value: formatQuickValue(quick[k]),
    }))
    .filter((c) => {
      if (c.key === 'yeminli') return c.value === 'Evet'; // yalnız "Evet" gösterilir
      return c.value.length > 0;
    });
  const showQuick = quickCells.length >= 2;

  // ---- Lojistik satırları (logistics{} ∩ preset açıklamaları) ----
  const logisticsRows = (preset?.logisticsChecks ?? []).filter((c) => logistics[c.key]);

  // ---- Deneyim grupları (ÇİZİLEBİLİR satıra göre) / eğitim / ödül ----
  // preset grupları preset sırasıyla; preset'te karşılığı olmayan (veya null) group_key'li
  // kayıtlar tek "Diğer" grubu altında toplanır — yutulmaz. Toplam çizilebilir satır 0 ise
  // bölüm hiç render edilmez (aşağıda totalWorkRows ile).
  const workItems = experiences.filter((x) => x.kind === 'work');
  const workByGroup = new Map<string, ProfileExperience[]>();
  for (const e of workItems) {
    if (!e.group_key) continue;
    if (!workByGroup.has(e.group_key)) workByGroup.set(e.group_key, []);
    workByGroup.get(e.group_key)!.push(e);
  }
  const presetGroupKeys = new Set((preset?.experienceGroups ?? []).map((g) => g.key));
  const experienceGroupsToRender: {
    key: string;
    label: string;
    items: ProfileExperience[];
  }[] = (preset?.experienceGroups ?? [])
    .map((g) => ({ key: g.key, label: g.label, items: workByGroup.get(g.key) ?? [] }))
    .filter((g) => g.items.length > 0);
  const otherWork = workItems.filter(
    (w) => !w.group_key || !presetGroupKeys.has(w.group_key)
  );
  if (otherWork.length > 0) {
    experienceGroupsToRender.push({ key: '__other', label: 'Diğer', items: otherWork });
  }
  const totalWorkRows = experienceGroupsToRender.reduce((n, g) => n + g.items.length, 0);

  const educationRows = experiences.filter((x) => x.kind === 'education');
  const awardRows = experiences.filter((x) => x.kind === 'award');

  /**
   * ---- Kategori modulleri (Duzeltme 11-D1) ----
   *
   * Govde ONCE hesaplanir: bos donen modul hem karttan hem de "<Kategori adı>
   * bilgileri" basligindan dusr — baslik veri yoksa cizilmez.
   */
  const modulKartlari = (preset?.modules ?? [])
    .map((ref) => ({
      key: ref.key,
      title: getModuleTitle(ref),
      govde: modulGovdesi(
        ref.key,
        modulesData[ref.key] ?? null,
        preset?.labelOverrides
      ),
    }))
    .filter((m) => m.govde !== null);
  const kategoriBilgileriBasligi = `${
    profile.service_categories?.name_tr ?? 'Kategori'
  } bilgileri`;

  /**
   * ---- Bolum gezinti seridi (Duzeltme 11-D3) ----
   *
   * SABIT SIRA: Hakkimda -> Hizmetler -> <Kategori> bilgileri -> Deneyim ->
   * Yorumlar. Dort ana bolum her profilde var (D2); kategori bilgileri yalniz
   * dolu modulde. Egitim ve oduller seritte YOK (gorev karari).
   */
  const bolumCapalari: BolumCapasi[] = [
    { id: 'hakkimda', etiket: 'Hakkımda' },
    { id: 'hizmetler', etiket: 'Hizmetler' },
    ...(modulKartlari.length > 0
      ? [{ id: 'kategori-bilgileri', etiket: kategoriBilgileriBasligi }]
      : []),
    { id: 'deneyim', etiket: 'Deneyim' },
    { id: 'yorumlar', etiket: 'Yorumlar' },
  ];

  /**
   * ---- Bolum basliklari (Duzeltme 10-F6, bulgu 80) ----
   *
   * Kural: buyuk baslik = kategori slogani (`section_taglines`) VARSA o, yoksa
   * bolumun STANDART adi. Varsayilan ikinci basliklar ("Calisma modelleri",
   * "One cikan isler", "Teknik altyapi") KALKTI: slogan yokken bolum iki ad
   * tasiyordu (eyebrow + uydurma baslik) ve kullanici ayni bolumu iki kez
   * okuyordu. Eyebrow artik YALNIZ slogan varken cizilir (asagida).
   */
  const hakkimdaTagline = cizilebilirMetin(taglines.hakkimda);
  const servicesTagline = cizilebilirMetin(taglines.hizmetler);
  const experienceTagline = cizilebilirMetin(taglines.deneyim);
  const educationTagline = cizilebilirMetin(taglines.egitim);

  const showMediaHero =
    archetype !== 'uzmanlik' || preset?.portfolioGrid === true;

  // Medya hero — mobilde rail'de (badge'lerden sonra), masaüstünde main'de (üstte).
  // Aynı JSX iki sarmalayıcıda; görünürlük breakpoint ile ayrılır.
  const mediaHeroEl =
    showMediaHero && heroMedia.length > 0 ? (
      <ProfileMediaHero
        items={heroMedia}
        archetype={archetype}
        useCastLayout={preset?.portfolioGrid === true}
      />
    ) : null;

  // ---- CTA blok ----
  // İşlem yetkisi: kendi profili DEĞİL + (müşteri VEYA manager+ kurum üyesi).
  // Üyeliksiz professional ziyaretçi → yalnız bilgi kutusu (mevcut davranış korunur).
  // Pro-as-buyer: professional ziyaretçi de alıcı koltuğuna oturur → Teklif Al / Rezervasyon.
  const canTransact = !isOwnProfile;

  // Duzeltme 15-E (karar 1-A): talep ajansa gidecekse kartin ustunde yazar.
  const ajansNotu = ajansYonlendirme ? (
    <p className="mb-3 rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm text-ink-72">
      {isOwnProfile ? 'Taleplerin ' : 'Bu profesyonel taleplerini '}
      <Link
        href={`/p/${ajansYonlendirme.ajansId}`}
        className="kashe-tap font-semibold text-brand-ink hover:underline"
      >
        {ajansYonlendirme.ajansAdi}
      </Link>
      {isOwnProfile
        ? ' üzerinden geliyor; teklifi ajans veriyor (üyelik sayfandaki tercihin).'
        : ' üzerinden alıyor. Talebin ajansa iletilir, teklifi ajans verir.'}
    </p>
  ) : null;
  // "İlanıma Davet Et" MEVCUT davranışında kalır (plain professional'da gösterilmez).
  const canInvite =
    !isOwnProfile && (!currentUserIsProfessional || writableBusinesses.length > 0);

  // ── Aksiyon çubuğu: Davet / Favori / Paylaş / Şikayet — tek tutarlı dizi, eşit ağırlık
  //    (flex-1 hücreler + ayırıcı). Her bileşen kendi 'bare' varyantını render eder →
  //    hücrenin TAMAMI (ikon + etiket) tıklanabilir tetik. Sarmalayıcı hack / !important YOK.
  // KIMLIK ALT SATIRI — yalniz DOLU parcalar. Etkinlik turleri en cok uc
  // etiket (tamami sag sutundaki "Etkinlik turleri" blogunda).
  const kimlikAltSatiri = [
    categorySubtitle,
    cityName ?? null,
    reviewCount > 0
      ? `★ ${averageRating} (${reviewCount} değerlendirme)`
      : 'Yeni',
    eventTypes.length > 0
      ? eventTypes
          .slice(0, 3)
          .map((k) => etiketle(turler, k))
          .filter(Boolean)
          .join(', ') || null
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const actionBar = !isOwnProfile ? (
    // Hucreler en az 4 rem: kimlik satirinin sag grubunda (`shrink-0`) icerik
    // genisligine dusup etiketler ("Sikayet") ust uste biniyordu.
    <div className="flex items-stretch rounded-xl border border-line overflow-hidden bg-card divide-x divide-line [&>*]:min-w-16">
      {canInvite && (
        <DavetButton
          professionalId={profile.id}
          professionalName={displayName}
          isLoggedIn={isLoggedIn}
          currentUserIsProfessional={currentUserIsProfessional}
          isOwnProfile={isOwnProfile}
          writableBusinesses={writableBusinesses}
          variant="bare-icon"
        />
      )}
      {showFavoriteButton && (
        <FavoriteButton
          professionalId={profile.id}
          initialFavorited={initialFavorited}
          isLoggedIn={isLoggedIn}
          userRole={currentUserRole}
          variant="bare"
        />
      )}
      <ShareButton title={displayName} />
      <SikayetButton
        targetType="profile"
        targetId={profile.id}
        isLoggedIn={isLoggedIn}
        variant="bare"
      />
    </div>
  ) : null;

  // Birincil CTA'lar variant prop'uyla (MOCKUP): Teklif Al = brand-accent dolgu (primary-accent),
  // Rezervasyon = brand-ink outline (outline-ink). Sarmalayıcı override YOK.
  const ctaBlock = canTransact ? (
    <div className="flex flex-col gap-2.5">
      <IletisimButton
        professionalId={profile.id}
        professionalName={displayName}
        categorySlug={slug}
        isLoggedIn={isLoggedIn}
        currentUserIsProfessional={currentUserIsProfessional}
        isOwnProfile={isOwnProfile}
        writableBusinesses={writableBusinesses}
        variant="primary-accent"
      />
      <RezervasyonButton
        professionalId={profile.id}
        professionalName={displayName}
        isLoggedIn={isLoggedIn}
        currentUserIsProfessional={currentUserIsProfessional}
        isOwnProfile={isOwnProfile}
        writableBusinesses={writableBusinesses}
        variant="outline-ink"
      />
      {actionBar}
    </div>
  ) : (
    // D4 — sahibi kendi public sayfasına bakarken CTA yerine tek düzenle linki
    <Link
      href="/profil"
      className="block w-full text-center px-5 py-3 bg-transparent border-[1.5px] border-brand-ink text-brand-ink rounded-xl font-display font-semibold text-[15px] hover:bg-brand-ink/5 transition-colors"
    >
      Profilini düzenle →
    </Link>
  );

  return (
    // ProfilIslemSaglayici: fiyat/takvim karti ile mobil CTA cubugu ayni
    // Tarih/Sehir/Kisi durumunu paylasir. Sunucu govdesi `children` olarak
    // gecer; FONKSIYON prop gecirilmez.
    <ProfilIslemSaglayici
      varsayilanSehir={cityName ?? null}
      doluGunler={[...blockedDates, ...bookedDates]}
    >
      <div className="bg-paper min-h-screen pb-24 lg:pb-12">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
              '@type': 'Person',
              name: displayName,
              jobTitle: profile.service_categories?.name_tr ?? undefined,
              address: cityName ? { '@type': 'PostalAddress', addressLocality: cityName } : undefined,
              ...(reviewCount > 0
                ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: averageRating, reviewCount } }
                : {}),
            },
          }),
        }}
      />

      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8 md:py-10">
        {/* EKMEK KIRINTISI (D2) — "Kesfet'e don" yerine konum satiri:
            kullanici hangi kategoride oldugunu gorur ve iki ustteki yuzeye de
            donebilir. */}
        <nav
          aria-label="Konum"
          className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 flex items-center gap-1.5 flex-wrap mb-6"
        >
          <Link href="/kesfet" className="hover:text-brand-ink transition-colors">
            Keşfet
          </Link>
          {slug && profile.service_categories?.name_tr && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={`/kategori/${slug}`}
                className="hover:text-brand-ink transition-colors"
              >
                {profile.service_categories.name_tr}
              </Link>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="text-ink">{displayName}</span>
        </nav>

        {/* IZGARA TERSINE (D2-ek): icerik SOLDA, islem karti SAGDA.
            Eskiden 360 px sol ray kimligi ve kunyeyi tasiyordu; asil icerik
            (hero, paketler, hakkimda) sagda kaliyor ve ekranin solu dolu
            gorunurken icerik dar kaliyordu. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-7">
          {/* ═══════════ SOL — ICERIK ═══════════ */}
          <main className="min-w-0 flex flex-col gap-7">
            {/* MEDYA HERO — TEK render (eski `lg:hidden` kopyasi kalkti). */}
            {mediaHeroEl}

            {/* KIMLIK SATIRI (D2-ek) — avatar 72 px, ad, sagda ikon satiri.
                Eskiden iki ayri kimlik blogu vardi (mobil kucuk portre +
                masaustu dikey buyuk portre); ikisi ayni bilgiyi iki kez
                tasiyordu ve masaustu portresi sol rayin yarisini kapliyordu. */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4 min-w-0 flex-1 basis-80">
                {profile.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-[72px] h-[72px] rounded-2xl object-cover border border-line shrink-0"
                  />
                ) : kategoriIkonu ? (
                  /* Duzeltme 01 (#5): avatarsizda kategori ikonu; ikon
                     cizimleri koyu oldugu icin zemin ACIK. */
                  <div className="w-[72px] h-[72px] rounded-2xl bg-paper-2 border border-line flex items-center justify-center overflow-hidden shrink-0">
                    <CategoryIcon
                      src={kategoriIkonu}
                      name={profile.service_categories?.name_tr ?? displayName}
                      initials={initials}
                    />
                  </div>
                ) : (
                  <div className="w-[72px] h-[72px] rounded-2xl bg-brand-ink flex items-center justify-center text-paper font-display font-bold text-2xl shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-display text-3xl font-bold tracking-tight leading-tight text-ink flex items-center gap-2 flex-wrap break-words">
                    <span>{displayName}</span>
                    {guvenSinyalleri.dogrulanmis && (
                      <span
                        title="Doğrulanmış"
                        aria-label="Doğrulanmış"
                        className="shrink-0 inline-flex"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M12 2l2.4 1.8 3 -.2 .9 2.9 2.4 1.8 -1 2.9 1 2.9 -2.4 1.8 -.9 2.9 -3 -.2L12 22l-2.4-1.8-3 .2-.9-2.9L3.3 15.7l1-2.9-1-2.9 2.4-1.8.9-2.9 3 .2z"
                            fill="var(--color-moss)"
                          />
                          <path d="M8.5 12l2.2 2.2 4.3-4.4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </h1>
                  {/* Alt satir: kategori · sehir · puan · etkinlik turleri (en cok 3).
                      Puan yoksa "Yeni" — uydurma sayi yok. */}
                  <p className="text-sm text-ink-72 mt-1.5 break-words">
                    {kimlikAltSatiri}
                  </p>
                </div>
              </div>
              {actionBar && (
                <div className="shrink-0 flex flex-wrap">{actionBar}</div>
              )}
            </div>

            {/* GUVEN CIPLERI — her cip bir veriye dayanir (D2 kurali). */}
            <GuvenCipleri {...guvenSinyalleri} />

            {/* KART — `lg` ALTI kopyasi: kimligin hemen altinda, CTA'SIZ (dugmeler
                alt sabit cubukta). Degerler baglamdan: iki kopya ayni durumu
                paylasir, masaustu kopyasi sag sutunda (`hidden lg:block`). */}
            <div className="lg:hidden">
              {ajansNotu}
              <FiyatTakvimKarti
                enDusukFiyat={enDusukFiyat}
                blockedDates={blockedDates}
                bookedDates={bookedDates}
                iller={iller}
                saglayiciIli={cityName ?? null}
                yalnizKendiSehri={yalnizKendiSehri}
                hizmetSecenekleri={hizmetSecenekleri}
              />
            </div>

            {/* BOLUM GEZINTISI (Duzeltme 11-D3) — yalniz SAYFADA OLAN
                bolumlere capa; ust menunun altinda yapiskan. */}
            <BolumSeridi bolumler={bolumCapalari} />

            {/* uzmanlik özet bandı */}
            {archetype === 'uzmanlik' && !preset?.portfolioGrid && ozetGovdesi && (
              <div className="bg-brand-ink text-paper rounded-2xl p-7">
                {ozetBasligi && <h2 className="font-display text-2xl font-bold mb-2">{ozetBasligi}</h2>}
                <p className="text-paper/85 leading-relaxed">{ozetGovdesi}</p>
                {ozetCipleriListesi.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {ozetCipleriListesi.map((st, i) => (
                      <span key={i} className="inline-flex items-center bg-white/12 rounded-full px-3 py-1 text-sm font-semibold">
                        {st}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 1. Hakkımda + quickInfo — HER profilde (Duzeltme 11-D2) */}
            <section id="hakkimda" className={BOLUM_CAPA}>
              <BolumBasligi ad="Hakkımda" slogan={hakkimdaTagline} />
              {profile.bio ? (
                <p className="text-[14.5px] leading-[1.7] text-ink-72 whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <p className={BOS_SATIR}>Henüz tanıtım eklenmemiş.</p>
              )}
                {showQuick && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    {quickCells.map((c) => (
                      <div key={c.label} className="bg-card border border-line rounded-xl px-4 py-3.5">
                        <div className="text-xs text-ink-72">{c.label}</div>
                        {c.key === 'yeminli' ? (
                          <div className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-ink mt-1">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-moss)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4 12.5 9.5 18 20 6.5" /></svg>
                            Yeminli
                          </div>
                        ) : (
                          <div className="font-display text-[15px] font-semibold text-ink mt-1">{c.value}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </section>

            {/* 2. Hizmetler ve paketler — HER profilde (Duzeltme 11-D2):
                hizmeti olmayan profilde de kullanici teklif isteyebilecegini
                gorur. */}
            <section id="hizmetler" className={BOLUM_CAPA}>
              <BolumBasligi
                ad="Hizmetler ve paketler"
                slogan={servicesTagline}
              />
              {services.length === 0 && packages.length === 0 ? (
                <p className={BOS_SATIR}>
                  Henüz hizmet eklenmemiş; teklif isteyerek fiyat alabilirsin.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {packages.map((pkg) => {
                    const fiyat = formatPriceRange(pkg.price_min, pkg.price_max, pkg.price_on_request, 'total', pkg.price_starting);
                    return (
                    <OfferRow
                      key={`pkg-${pkg.id}`}
                      title={pkg.title}
                      description={pkg.description}
                      price={fiyat}
                      teklifDugmesi={
                        canTransact ? (
                          <>
                            <IletisimButton
                              professionalId={profile.id}
                              professionalName={displayName}
                              categorySlug={slug}
                              isLoggedIn={isLoggedIn}
                              currentUserIsProfessional={currentUserIsProfessional}
                              isOwnProfile={isOwnProfile}
                              writableBusinesses={writableBusinesses}
                              etkinlikId={etkinlikId}
                              variant="package"
                              packageContext={{ title: pkg.title, price: fiyat || null }}
                              iller={iller}
                              saglayiciIli={cityName ?? null}
                              yalnizKendiSehri={yalnizKendiSehri}
                              hizmetSecenekleri={hizmetSecenekleri}
                            />
                            {/* Duzeltme 11-B6 (bulgu 76 b): fiyati BELLI paketi
                                dogrudan rezerve etmeye gider — "talep uzerine"
                                pakette dugme YOK (tarih vermeden once fiyat
                                konusulmali). */}
                            {!pkg.price_on_request && pkg.price_min != null && (
                              <RezervasyonButton
                                professionalId={profile.id}
                                professionalName={displayName}
                                isLoggedIn={isLoggedIn}
                                currentUserIsProfessional={currentUserIsProfessional}
                                isOwnProfile={isOwnProfile}
                                writableBusinesses={writableBusinesses}
                                variant="secondary-sm"
                                secilenHizmet={pkg.title}
                                iller={iller}
                                saglayiciIli={cityName ?? null}
                                yalnizKendiSehri={yalnizKendiSehri}
                              />
                            )}
                          </>
                        ) : undefined
                      }
                    />
                    );
                  })}
                  {services.map((s) => {
                    const fiyat = formatPriceRange(s.price_min, s.price_max, s.price_on_request, s.price_unit ?? 'total', s.price_starting);
                    return (
                    <OfferRow
                      key={`svc-${s.id}`}
                      title={s.title}
                      description={s.description}
                      price={fiyat}
                      teklifDugmesi={
                        canTransact ? (
                          <IletisimButton
                            professionalId={profile.id}
                            professionalName={displayName}
                            categorySlug={slug}
                            isLoggedIn={isLoggedIn}
                            currentUserIsProfessional={currentUserIsProfessional}
                            isOwnProfile={isOwnProfile}
                            writableBusinesses={writableBusinesses}
                            etkinlikId={etkinlikId}
                            variant="package"
                            serviceContext={{ title: s.title, addons: [], estimatedTotal: null }}
                            iller={iller}
                            saglayiciIli={cityName ?? null}
                            yalnizKendiSehri={yalnizKendiSehri}
                            hizmetSecenekleri={hizmetSecenekleri}
                          />
                        ) : undefined
                      }
                    />
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. "<Kategori adı> bilgileri" — TEK baslik, modul adlari ALT
                BASLIK (Duzeltme 11-D1). Eskiden her modul kendi basligiyla
                ayri bolum gibi duruyordu ve kategoriye gore sayi degisince
                profil yapisi tanidik gelmiyordu. Cizilebilir modul yoksa
                bolum HIC cizilmez. */}
            {modulKartlari.length > 0 && (
              <section id="kategori-bilgileri" className={BOLUM_CAPA}>
                <BolumBasligi ad={kategoriBilgileriBasligi} />
                <div className="flex flex-col gap-3">
                  {modulKartlari.map((m) => (
                    <ModulKarti
                      key={m.key}
                      title={m.title}
                      moduleKey={m.key}
                      govde={m.govde}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 5. Deneyim (work) — çizilebilir gruplar; eşleşmeyenler "Diğer" altında; 0 satırda yok */}
            <section id="deneyim" className={BOLUM_CAPA}>
              <BolumBasligi ad="Deneyim" slogan={experienceTagline} />
              {totalWorkRows === 0 ? (
                <p className={BOS_SATIR}>Henüz deneyim eklenmemiş.</p>
              ) : (
                experienceGroupsToRender.map((g) => (
                  <div key={g.key} className="mb-5">
                    <div className={`${EYEBROW} opacity-75 mb-2`}>{g.label}</div>
                    <div className="bg-card border border-line rounded-2xl px-5">
                      {g.items.map((e, i, arr) => (
                        <ExperienceRow key={e.id} exp={e} last={i === arr.length - 1} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* 6. Eğitim & Sertifikalar */}
            {educationRows.length > 0 && (
              <section id="egitim" className={BOLUM_CAPA}>
                <BolumBasligi
                  ad="Eğitim ve sertifikalar"
                  slogan={educationTagline}
                />
                <div className="bg-card border border-line rounded-2xl px-5">
                  {educationRows.map((e, i) => (
                    <ExperienceRow key={e.id} exp={e} last={i === educationRows.length - 1} />
                  ))}
                </div>
              </section>
            )}

            {/* 8. Öne çıkanlar / Ödüller */}
            {awardRows.length > 0 && (
              <section id="oduller" className={BOLUM_CAPA}>
                <BolumBasligi ad="Öne çıkanlar ve ödüller" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {awardRows.map((a) => {
                    const aPeriod = formatExperiencePeriod(a);
                    return (
                      <div key={a.id} className={`${CARD} p-4`}>
                        <div className="font-display font-semibold text-ink">{a.title}</div>
                        {a.organization && <div className="text-sm text-ink-72 mt-0.5">{a.organization}</div>}
                        {aPeriod && <div className="text-xs text-ink-72 mt-1 font-mono">{aPeriod}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 6. Yorumlar — HER profilde (Duzeltme 11-D2) */}
            <section id="yorumlar" className={BOLUM_CAPA}>
              <BolumBasligi
                ad="Yorumlar"
                altSatir={
                  recentReviews.length > 0 ? (
                    <span className="text-sm text-ink-72">
                      {averageRating} ortalama · {reviewCount} yorum
                    </span>
                  ) : undefined
                }
              />
              {recentReviews.length === 0 ? (
                <p className={BOS_SATIR}>Henüz yorum yok.</p>
              ) : (
                <>
                <div className="flex flex-col gap-3">
                  {recentReviews.map((r) => {
                    const c = customerMap.get(r.customer_id) ?? null;
                    const reply = replyMap.get(r.id) ?? null;
                    const cName = c?.full_name ?? 'Müşteri';
                    const cInitials = cName.split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                    return (
                      <div key={r.id} className={`${CARD} p-5`}>
                        <div className="flex items-center gap-3">
                          {c?.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={c.avatar_url} alt={cName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className="w-10 h-10 rounded-full bg-brand-ink text-paper flex items-center justify-center font-display font-semibold text-[13px] shrink-0">{cInitials}</span>
                          )}
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-ink">{cName}</div>
                            <div className="text-[11.5px] text-ink-72">{formatReviewDate(r.created_at)}</div>
                          </div>
                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            <Stars rating={r.rating} size={13} />
                          </div>
                        </div>
                        {verifiedCustomerIds.has(r.customer_id) && (
                          <div className="flex items-center gap-1.5 mt-2.5 text-[11.5px] font-medium text-moss">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" /><polyline points="9 12 11 14 15 10" />
                            </svg>
                            Onaylı yorum
                          </div>
                        )}
                        {r.body && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-2.5 whitespace-pre-wrap">{r.body}</p>}
                        {reply && (
                          <div className="mt-3 pl-3.5 border-l-2 border-brand-ink/30">
                            <div className="text-[11.5px] font-semibold text-brand-ink mb-0.5">{displayName} yanıtladı</div>
                            <p className="text-[13px] text-ink-72 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {reviewCount > 3 && (
                  <Link href={reviewsHref} className="inline-block mt-4 text-sm font-display font-semibold text-brand-ink hover:text-brand-ink-deep transition-colors">
                    Tüm yorumları gör ({reviewCount}) →
                  </Link>
                )}
                </>
              )}
            </section>

            {/* Yorum bırakma (mevcut akış) */}
            <YorumButton
              professionalId={profile.id}
              professionalName={displayName}
              hasConversation={hasCompletedBooking}
              existingReview={existingReview}
              enabled={canReview}
              acikBaslat={yorumModaliAcik}
            />
          </main>

          {/* ═══════════ SAG SUTUN — islem karti ve kunye ═══════════ */}
          <aside className="lg:sticky lg:top-24 lg:self-start flex flex-col gap-4 order-last">
            {/* FIYAT / TAKVIM KARTI (D2) — fiyat, musaitlik ve on-doldurma.
                CTA'lar AYNI dugmeler (`IletisimButton` / `RezervasyonButton`);
                kart yalniz tarih/sehir/kisi bilgisini onlara tasir. Eylemler ve
                form alanlari degismedi. Mobilde primer dugmeler alt sabit barda
                kaldigi icin kart `lg`+ gosterilir. */}
            <div className="hidden lg:block">
              {/* Masaustu kopyasi (CTA'li). `lg` altinda kart kimligin altinda
                  CTA'siz; dugmeler alt sabit cubukta ve ayni degerleri BAGLAMDAN
                  okur — kart ile cubuk tek durum paylasir. */}
              {ajansNotu}
              <FiyatTakvimKarti
                enDusukFiyat={enDusukFiyat}
                blockedDates={blockedDates}
                bookedDates={bookedDates}
                iller={iller}
                saglayiciIli={cityName ?? null}
                yalnizKendiSehri={yalnizKendiSehri}
                hizmetSecenekleri={hizmetSecenekleri}
                cta={
                  canTransact
                    ? {
                        professionalId: profile.id,
                        professionalName: displayName,
                        categorySlug: slug,
                        isLoggedIn,
                        currentUserIsProfessional,
                        isOwnProfile,
                        writableBusinesses,
                        etkinlikId,
                      }
                    : undefined
                }
              />
              {/* Kendi profiline bakan sahip: kart yalniz fiyat + takvim; eski
                  "Profili duzenle" blogu altta durur. */}
              {!canTransact && <div className="mt-3">{ctaBlock}</div>}
            </div>

            {/* Meta kart */}
            <div className="bg-card border border-line rounded-2xl px-4 py-1.5">
              <MetaRow label="Şehir" value={cityName} />
              <MetaRow label="Hizmet bölgesi" value={serviceRegion} />
              <MetaRow label="Çalışma şekli" value={calismaSekli} />
              <MetaRow label="Fiyat aralığı" value={priceRange} />
              <MetaRow label="Deneyim" value={experienceLabel} />
              <MetaRow
                label="Müsaitlik"
                value={`Önümüzdeki 7 gün: ${isBusyNow ? 'yoğun' : 'müsait'}`}
                dot={isBusyNow ? 'amber' : 'green'}
                last
              />
            </div>

            {/* Lojistik */}
            {logisticsRows.length > 0 && (
              <div className="flex flex-col gap-1.5 px-0.5">
                {logisticsRows.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 text-[13px] text-ink-72">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                      <polyline points="4 12.5 9.5 18 20 6.5" />
                    </svg>
                    {c.label} — {c.description}
                  </div>
                ))}
              </div>
            )}

            {/* Yetenekler */}
            {skills.length > 0 && (
              <div>
                <div className={`${EYEBROW} mb-2.5`}>Yetenekler</div>
                <div className="flex flex-wrap gap-2">
                  {/* Ad ve seviye jsonb'den geliyor: metin olmayan ad ATLANIR,
                      seviye sayiya cevrilir (bulgu 78 ile ayni koruma). */}
                  {skills.map((s, i) => {
                    const ad = cizilebilirMetin(s?.name);
                    if (!ad) return null;
                    const seviye = Number(s?.level) || 0;
                    return (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-line rounded-full text-[12.5px] font-medium text-ink">
                      {ad}
                      {seviye > 0 && (
                        <span className="inline-flex gap-[3px]" aria-label={`Seviye ${Math.min(3, seviye)}/3`}>
                          {Array.from({ length: Math.min(3, seviye) }).map((_, j) => (
                            <span key={j} className="w-[5px] h-[5px] rounded-full bg-brand-accent" />
                          ))}
                        </span>
                      )}
                    </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Etkinlik türleri — ORTAK alan (dolu ise). Giriş tek yerde (kategori-bilgileri Genel). */}
            {eventTypes.length > 0 && (
              <div>
                <div className={`${EYEBROW} mb-2.5`}>Etkinlik türleri</div>
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map((k) => {
                    // Anahtar metin degilse (jsonb'de nesne) hic sorulmaz.
                    const label = etiketle(turler, cizilebilirMetin(k));
                    if (!label) return null;
                    return (
                      <span key={k} className="inline-flex items-center px-3 py-1.5 bg-card border border-line rounded-full text-[12.5px] font-medium text-ink">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ajans mini — Duzeltme 11-B5 (bulgu 76 d): kart artik iki yolu
                acikca yaziyor. Fahri "kimle anlasacagimi anlamadim" demisti:
                dogrudan bu kisiyle mi, ajans uzerinden mi? Baglanti ajans
                sayfasini bu uye SECILI ve teklif modali ACIK getirir. */}
            {representingAgency && (
              <div className="bg-card border border-line rounded-2xl px-4 py-3">
                <Link
                  href={`/p/${representingAgency.id}`}
                  className="flex items-center gap-3 group"
                >
                  <span className="w-9 h-9 rounded-full bg-brand-ink text-paper flex items-center justify-center font-display font-semibold text-[13px] shrink-0">
                    {representingAgency.initials}
                  </span>
                  <div>
                    <div className="text-[11.5px] text-ink-72">Üye olduğu ajans</div>
                    <div className="text-[13.5px] font-semibold text-ink group-hover:text-brand-ink transition-colors">
                      {representingAgency.name}
                    </div>
                  </div>
                </Link>
                {canTransact && (
                  <>
                    <p className="text-[12px] text-ink-72 mt-2.5 leading-snug">
                      Doğrudan teklif alabilir ya da {representingAgency.name}{' '}
                      üzerinden çalışabilirsin.
                    </p>
                    <Link
                      href={`/p/${representingAgency.id}?tercih=${profile.id}${
                        etkinlikId ? `&etkinlik=${etkinlikId}` : ''
                      }`}
                      className="inline-block mt-1.5 text-[12.5px] font-display font-semibold text-brand-ink hover:text-brand-ink-deep transition-colors"
                    >
                      {representingAgency.name} üzerinden teklif al →
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* FAZ 5/P3 — havuz karti (yalniz talent.manage olan ajans uyesinde dolu) */}
            {havuzSlot}

            {/* hijyen 04 — kisa liste banti (havuz bandiyla ayni yerde, AYRI
                bant: biri ajansin yetenek havuzu, oteki alicinin secki listesi). */}
            {kisaListeSlot}
          </aside>
        </div>
      </div>

      {/* MOBIL — alta sabit CTA cubugu (yalniz islem yetkisi varsa).
          Istemci bileseni: karttaki Tarih/Sehir/Kisi degerlerini baglamdan
          okuyup dugmelere on-doldurma verir. */}
      {canTransact && (
        <MobilCtaCubugu
          professionalId={profile.id}
          professionalName={displayName}
          categorySlug={slug}
          isLoggedIn={isLoggedIn}
          currentUserIsProfessional={currentUserIsProfessional}
          isOwnProfile={isOwnProfile}
          writableBusinesses={writableBusinesses}
          iller={iller}
          saglayiciIli={cityName ?? null}
          yalnizKendiSehri={yalnizKendiSehri}
          hizmetSecenekleri={hizmetSecenekleri}
          etkinlikId={etkinlikId}
        />
        )}
      </div>
    </ProfilIslemSaglayici>
  );
}

// ---- Alt bileşenler ----
function MetaRow({ label, value, dot, last }: { label: string; value: string | null | undefined; dot?: 'green' | 'amber'; last?: boolean }) {
  if (!value) return null;
  return (
    <div className={`flex items-center gap-2.5 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      {dot ? (
        <span className={`w-2 h-2 rounded-full shrink-0 mx-[3px] ${dot === 'green' ? 'bg-[#2E9E5B]' : 'bg-amber-500'}`} />
      ) : (
        <span className="w-[15px] shrink-0" />
      )}
      <span className="text-[13px] text-ink-72 w-[104px] shrink-0">{label}</span>
      <span className="text-[13.5px] font-semibold text-ink">{value}</span>
    </div>
  );
}

/**
 * Hizmet / paket satiri.
 *
 * Duzeltme 10-F1 (bulgu 79): kendi profili DEGILSE her satirda "Teklif al"
 * dugmesi var — kullanici hangi hizmeti istedigini satirdan secebiliyor
 * (eskiden yalniz karttaki genel "Teklif Al" vardi ve secim modalde yoktu).
 * Dar ekranda dugme ALTA gecer.
 */
function OfferRow({
  title,
  description,
  price,
  teklifDugmesi,
}: {
  title: string;
  description: string | null;
  price: string;
  teklifDugmesi?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-5 bg-card border border-line border-l-[3px] border-l-brand-ink rounded-xl px-5 py-4">
      <div className="min-w-0">
        <div className="font-display text-[15.5px] font-semibold text-ink">{title}</div>
        {description && <div className="text-[13px] text-ink-72 mt-1 leading-snug line-clamp-2">{description}</div>}
      </div>
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {price && <div className="font-display text-[15px] font-bold text-brand-ink whitespace-nowrap">{price}</div>}
        {teklifDugmesi}
      </div>
    </div>
  );
}

// ---- Etiket-üstte/değer-altta KV kutuları — TEK bileşen, iki kırılım ----
// md ve üzeri: mevcut kutu grid'i PİKSEL PİKSEL aynen.
// md altı: ince satır (rail meta anatomisi) — etiket sol/soluk, değer sağ/kalın,
//          satırlar arası hairline; uzun değer SAĞDA SARAR, asla kırpılmaz (truncate yok).
function KvChips({ entries, cols }: { entries: [string, string][]; cols: number }) {
  return (
    <>
      <div
        className="hidden md:grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {entries.map(([k, v]) => (
          <div key={k} className="bg-paper rounded-xl px-4 py-3">
            <div className="text-xs text-ink-72">{k}</div>
            <div className="text-[14.5px] font-semibold text-ink mt-1">{v}</div>
          </div>
        ))}
      </div>
      <div className="md:hidden bg-paper rounded-xl px-4">
        {entries.map(([k, v], i) => (
          <div
            key={k}
            className={`flex items-baseline justify-between gap-3 py-2.5 ${
              i === entries.length - 1 ? '' : 'border-b border-line'
            }`}
          >
            <span className="text-[13px] text-ink-72 shrink-0">{k}</span>
            <span className="text-[13.5px] font-semibold text-ink text-right min-w-0 break-words">
              {v}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function ExperienceRow({ exp, last }: { exp: ProfileExperience; last: boolean }) {
  const orgText = [exp.organization, exp.location].filter(Boolean).join(', ');
  const border = last ? '' : 'border-b border-line';
  const period = formatExperiencePeriod(exp);
  const metaLine = [period, orgText].filter(Boolean).join(' · ');
  return (
    <>
      {/* Mobil (md altı): dikey yığın — üst satır tarih · organizasyon, sonra başlık/alt başlık/açıklama */}
      <div className={`md:hidden py-3.5 ${border}`}>
        {metaLine && <div className="text-[12px] text-ink-72">{metaLine}</div>}
        <div className="text-[14.5px] font-bold text-ink mt-1">{exp.title}</div>
        {exp.subtitle && <div className="text-[13px] text-ink-72 mt-0.5">{exp.subtitle}</div>}
        {exp.description && <p className="text-[13px] text-ink-72 leading-relaxed mt-1.5">{exp.description}</p>}
      </div>
      {/* md ve üzeri: mevcut üç kolon aynen */}
      <div className={`hidden md:grid grid-cols-[92px_1fr_auto] gap-4 items-start py-3.5 ${border}`}>
        <div className="text-[12.5px] text-ink-72 pt-0.5">{period}</div>
        <div>
          <div className="text-[14.5px] font-bold text-ink">{exp.title}</div>
          {exp.subtitle && <div className="text-[13px] text-ink-72 mt-0.5">{exp.subtitle}</div>}
          {exp.description && <p className="text-[13px] text-ink-72 leading-relaxed mt-2 max-w-[520px]">{exp.description}</p>}
        </div>
        <div className="text-[13px] text-ink-72 text-right pt-0.5">{orgText}</div>
      </div>
    </>
  );
}

/**
 * ---- Modul GOVDESI — saf fonksiyon, bilesen DEGIL (Duzeltme 11-D1) ----
 *
 * Kategori modulleri artik TEK baslik ("<Kategori adı> bilgileri") altinda
 * toplaniyor; o baslik ancak CIZILEBILIR bir modul varsa yazilmali. Govde
 * uretimi bu yuzden kart kabugundan ayrildi: cagiran once govdeyi hesaplar,
 * bos donerse ne baslik ne kart cizilir — "veri yoksa hicbir sey" kurali
 * tek yerde kalir.
 */
function modulGovdesi(
  moduleKey: string,
  data: AttrRecord | null,
  labelOverrides?: Record<string, string>
): React.ReactNode | null {
  if (!data || Object.keys(data).length === 0) return null;

  /** Cip listesi — jsonb ogeleri metne cevrilir, cevrilemeyen ATLANIR. */
  const chips = (arr: unknown) => {
    const liste = Array.isArray(arr)
      ? arr.map(cizilebilirMetin).filter((v): v is string => !!v)
      : [];
    return liste.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {liste.map((c, i) => (
          <span key={i} className="px-3.5 py-1.5 bg-brand-ink/5 border border-brand-ink/15 rounded-full text-[12.5px] font-medium text-ink">{c}</span>
        ))}
      </div>
    ) : null;
  };

  // Etiket/değer kutuları — TEK bileşen (KvChips): md üstü kutu grid'i aynen, md altı ince satır.
  // null döndürme sözleşmesi korunur (boş-gövde denetimindeki `detailsEl || ...` için).
  const kv = (obj: unknown, cols = 3) => {
    if (!obj || typeof obj !== 'object') return null;
    // Degerler jsonb'den: metne cevrilemeyen (nesne / dizi) anahtar ATLANIR.
    const entries = Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => [k, cizilebilirMetin(v)] as const)
      .filter((e): e is readonly [string, string] => !!e[1])
      .map(([k, v]) => [k, v] as [string, string]);
    if (entries.length === 0) return null;
    return <KvChips entries={entries} cols={cols} />;
  };

  let body: React.ReactNode = null;
  if (moduleKey === 'repertuar') {
    const g = chips(data.genres);
    const hasNotes = typeof data.notes === 'string' && data.notes.trim().length > 0;
    body =
      g || hasNotes ? (
        <>
          {g}
          {hasNotes && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-3.5">{data.notes as string}</p>}
        </>
      ) : null;
  } else if (moduleKey === 'ekipman') {
    const hasItems = Array.isArray(data.items) && (data.items as unknown[]).length > 0;
    const hasVenue = typeof data.venue_requirements === 'string' && data.venue_requirements.trim().length > 0;
    body =
      hasItems || hasVenue ? (
        <>
          {hasItems && (
            <div className="flex flex-col gap-2 text-sm text-ink-72">
              {(data.items as unknown[])
                .map(cizilebilirMetin)
                .filter((v): v is string => !!v)
                .map((it, i) => (
                  <div key={i} className="flex gap-2.5"><span className="text-brand-ink font-bold shrink-0">—</span>{it}</div>
                ))}
            </div>
          )}
          {hasVenue && (
            <div className="mt-4 px-4 py-3 bg-paper rounded-lg text-[12.5px] text-ink-72 leading-relaxed">
              <span className="font-semibold text-ink">Mekan gereksinimleri: </span>{data.venue_requirements as string}
            </div>
          )}
        </>
      ) : null;
  } else if (moduleKey === 'performans') {
    const detailsEl = kv(data.details, 3);
    const hasExpect = typeof data.what_to_expect === 'string' && data.what_to_expect.trim().length > 0;
    const hasSetup = typeof data.setup_logistics === 'string' && data.setup_logistics.trim().length > 0;
    body =
      detailsEl || hasExpect || hasSetup ? (
        <>
          {detailsEl}
          {hasExpect && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-4">{data.what_to_expect as string}</p>}
          {hasSetup && (
            <div className="mt-3.5 border border-dashed border-brand-ink/25 rounded-lg px-4 py-3 text-[13px] text-ink-72 leading-relaxed">
              <span className="font-semibold text-ink">Kurulum &amp; lojistik notları: </span>{data.setup_logistics as string}
            </div>
          )}
        </>
      ) : null;
  } else if (moduleKey === 'fiziksel') {
    // Yaş aralığı (etiket override: model → "Görünüm yaş aralığı") + boy/beden/... — boş olanlar elenir.
    const yasLabel = labelOverrides?.['oynayabildigi_yas_araligi'] ?? 'Oynayabildiği yaş aralığı';
    const fz: Record<string, string> = {};
    const put = (label: string, v: unknown) => {
      if (typeof v === 'string' && v.trim()) fz[label] = v;
    };
    put(yasLabel, data.oynayabildigi_yas_araligi);
    put('Boy', data.height);
    put('Beden', data.size);
    put('Ayak', data.shoe);
    put('Saç', data.hair);
    put('Göz', data.eyes);
    body = kv(fz, 5);
  } else if (moduleKey === 'sosyal_erisim') {
    const platforms = Array.isArray(data.platforms) ? (data.platforms as { platform: string; followers_range: string }[]) : [];
    body = platforms.length > 0 ? (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {platforms.map((p, i) => (
            <div key={i} className="flex justify-between items-center px-4 py-3.5 bg-paper rounded-lg">
              <span className="text-[13.5px] font-semibold text-ink">{p.platform}</span>
              <span className="text-[13.5px] text-ink-72">{p.followers_range} takipçi</span>
            </div>
          ))}
        </div>
        <div className="text-[11.5px] text-ink-72/70 mt-2.5">Takipçi sayıları aralık olarak gösterilir; hesap bağlantıları profil üzerinden paylaşılmaz.</div>
      </>
    ) : null;
  } else if (moduleKey === 'diller_belgeler') {
    const pairs = Array.isArray(data.language_pairs) ? (data.language_pairs as unknown[]) : [];
    const docs = Array.isArray(data.documents) ? (data.documents as { name: string; date?: string }[]) : [];
    // Dil çifti kartları (mockup 1c anatomisi). Boş → başlık dahil hiçbir şey.
    body =
      pairs.length > 0 || docs.length > 0 ? (
        <>
          {pairs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              {pairs.map((p, i) => (
                <div key={i} className="px-4 py-3 bg-paper border border-line rounded-xl text-[13.5px] font-semibold text-ink text-center">{String(p)}</div>
              ))}
            </div>
          )}
          {docs.length > 0 && (
            <div className="flex flex-col gap-2">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[13.5px] text-ink-72">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-moss)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4 12.5 9.5 18 20 6.5" /></svg>
                  {d.name} — <span className="text-ink">Belge yüklendi{d.date ? ` · ${d.date}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null;
  } else if (moduleKey === 'uzmanlik_alanlari') {
    body = chips(data.areas);
  } else if (moduleKey === 'calisma_parametreleri') {
    const paramsEl = kv(data.params, 3);
    const hasNotes = typeof data.notes === 'string' && data.notes.trim().length > 0;
    body =
      paramsEl || hasNotes ? (
        <>{paramsEl}{hasNotes && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-3.5">{data.notes as string}</p>}</>
      ) : null;
  } else if (moduleKey === 'teknik_teslimat') {
    body = kv(data.delivery, 3);
  }

  return body ?? null;
}

/** Modul karti — modul adi ALT BASLIK, govde hazir gelir (Duzeltme 11-D1). */
function ModulKarti({
  title,
  moduleKey,
  govde,
}: {
  title: string;
  moduleKey: string;
  govde: React.ReactNode;
}) {
  const def = MODULE_REGISTRY[moduleKey as keyof typeof MODULE_REGISTRY];
  const isFiziksel = moduleKey === 'fiziksel';
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex justify-between items-baseline">
        <div className={EYEBROW}>{title}</div>
        {isFiziksel && def?.disclaimer && (
          <span className="text-[11.5px] text-ink-72/70">{def.disclaimer}</span>
        )}
      </div>
      <div className="mt-3">{govde}</div>
    </div>
  );
}
