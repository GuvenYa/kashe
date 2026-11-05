import Link from 'next/link';
import FavoriteButton from '@/app/components/FavoriteButton';
import { isVerified, isPremiumActive } from '@/app/lib/badges';
import { formatTL } from '@/app/lib/para';
import { gosterilecekAd } from '@/app/lib/kamu-adi';
import { CoverMedia } from './cover-media';
import { HavuzKisaYol } from './havuz-kisa-yol';
import { KisaListeKisaYol } from './kisa-liste-kisa-yol';

type Props = {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    company_name: string | null;
    role: string;
    created_at?: string | null;
    approval_status?: string | null;
    premium_tier?: string | null;
    premium_until?: string | null;
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
  };
  /** Kapak görseli: page.tsx'te çözülmüş (avatar → portföy ilk görsel → null=placeholder).
   *  Verilmezse (diğer sayfalar) profile.avatar_url'e düşer. */
  cover?: string | null;
  rating: { count: number; average: number } | null;
  /** Onaylı/tamamlanan iş sayısı (0/undefined → gizlenir). */
  jobsCount?: number;
  /** Favori kalbi icin (opsiyonel). */
  isFavorited?: boolean;
  isLoggedIn?: boolean;
  currentUserRole?: string | null;
  /** FAZ 4c/P3: etkinlikten gelen kesfet — profil linki `?etkinlik=` ile tasinir. */
  etkinlikId?: string | null;
  /** Kartin alt rozetindeki "... TL'den" fiyati buradan turetilir (D2): yayinda
   *  olan ve talep-uzerine OLMAYAN hizmetlerin en dusuk `price_min`. Fiyat yoksa
   *  rozet CIZILMEZ — uydurma "fiyat gorusulur" rozeti konmaz. */
  services?: {
    price_min: number | null;
    price_max: number | null;
    price_on_request: boolean;
  }[];
  isBusy?: boolean;
  /** FAZ 5/P3: havuz kisa yolu. Yetki/kurulus yoksa sunucu bu prop'u HIC gondermez. */
  havuz?: { orgId: string; durum: 'havuzda' | 'eklenebilir' };
  /** FAZ 8c: kisa liste kisa yolu. Ayni kural: yoksa prop hic gelmez. */
  kisaListe?: { orgId: string; durum: 'listede' | 'eklenebilir' };
  /**
   * Duzeltme 05-E: bireysel profesyonelin TAM adi gosterilsin mi?
   *
   * Varsayilan `false` — kesif yuzeylerinde ad "Ad S." olur. Karari SUNUCU
   * verir (`tamAdGorebilirMi`): karta yalniz sonuc gelir, kart kendi basina
   * rezervasyon sorgusu yapmaz.
   */
  tamAd?: boolean;
};

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

function VerifiedIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M12 2l2.4 1.8 3 -.2 .9 2.9 2.4 1.8 -1 2.9 1 2.9 -2.4 1.8 -.9 2.9 -3 -.2L12 22l-2.4-1.8-3 .2-.9-2.9L3.3 15.7l1-2.9-1-2.9 2.4-1.8.9-2.9 3 .2z"
        fill="var(--color-moss)"
      />
      <path
        d="M8.5 12l2.2 2.2 4.3-4.4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ★ puan (n) · X iş · şehir — açık (foto üzeri beyaz) / koyu (gövde) ton. */
function MetaRow({
  light,
  rating,
  jobsCount,
  cityName,
}: {
  light: boolean;
  rating: { count: number; average: number } | null;
  jobsCount: number;
  cityName: string | null | undefined;
}) {
  const hasRating = !!rating && rating.count > 0;
  return (
    <div
      className={`flex items-center gap-1.5 text-xs flex-wrap ${
        light ? 'text-white/90' : 'text-ink-72'
      }`}
    >
      {hasRating ? (
        <span className="inline-flex items-center gap-1">
          <StarIcon className={light ? 'text-[#F2C879]' : 'text-brand-accent'} />
          <span
            className={`font-display font-semibold ${
              light ? 'text-white' : 'text-ink'
            }`}
          >
            {rating!.average}
          </span>
          <span>({rating!.count})</span>
        </span>
      ) : (
        <span className="font-mono uppercase tracking-[0.12em] text-[11px]">
          Yeni
        </span>
      )}
      {jobsCount > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>{jobsCount} iş</span>
        </>
      )}
      {cityName && (
        <>
          <span aria-hidden="true">·</span>
          <span>{cityName}</span>
        </>
      )}
    </div>
  );
}

/** Foto üstü sol overlay: (ajansta) KURUMSAL rozeti + kategori chip'i (nokta + ad).
 *  Sağda kalp (4.5rem) ve varsa PREMİUM rozeti (+5rem) için yer bırakılır — üç rozet aynı
 *  satırda üst üste binmez (Sahne turu, 27 Ekim).
 *
 *  Duzeltme 05-B (bulgu 66 b): kategori adi KESILMEZ. Once `truncate max-w-[130px]`
 *  vardi ve "Tercüman" -> "Terc..." oluyordu. Simdi cip daraldiginda metin ikinci
 *  satira duser, rozetle birlikte sigmazsa cipin kendisi alt satira gecer
 *  (`flex-wrap`); `maxW` korundugu icin kart tasmaz. */
function TopChips({
  isAgency,
  categoryName,
  reserve = 'heart',
}: {
  isAgency: boolean;
  categoryName: string | null;
  /** Sağda ayrılan alan: 'heart' (kalp), 'heart-premium' (kalp + rozet), 'premium' (yalnız rozet; kompakt). */
  reserve?: 'heart' | 'heart-premium' | 'premium';
}) {
  const maxW =
    reserve === 'heart-premium'
      ? 'max-w-[calc(100%-9.5rem)]'
      : reserve === 'premium'
        ? 'max-w-[calc(100%-6rem)]'
        : 'max-w-[calc(100%-4.5rem)]';
  return (
    <div className={`absolute top-3 left-3 flex flex-wrap items-start gap-2 ${maxW}`}>
      {isAgency && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-[#0D1F4E] text-[#EAF0F8] px-2 py-1 rounded-md shrink-0">
          Kurumsal
        </span>
      )}
      {categoryName && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-paper/95 text-ink px-2 py-1 rounded-md inline-flex items-center gap-1.5 min-w-0 shadow-sm">
          {/* Nokta CYAN (`sky`): kategori bir BILGI etiketi, pembe aksan ise
              eylem/vurgu rengi. Ikisi ayni kartta karismasin. */}
          <span
            className="w-1.5 h-1.5 rounded-full bg-sky shrink-0"
            aria-hidden="true"
          />
          <span className="leading-snug">{categoryName}</span>
        </span>
      )}
    </div>
  );
}

export function ProfileCard({
  profile,
  cover,
  rating,
  jobsCount = 0,
  isFavorited = false,
  isLoggedIn = false,
  currentUserRole = null,
  etkinlikId = null,
  services,
  havuz,
  kisaListe,
  tamAd = false,
}: Props) {
  const isAgencyCard = profile.role === 'agency';

  // Kapak: prop verilmişse onu (null=placeholder dahil), verilmemişse avatar'a düş.
  const coverUrl = cover !== undefined ? cover : profile.avatar_url ?? null;

  /**
   * Duzeltme 05-E: BIREYSEL profesyonelin adi kartta "Ad S." olarak gorunur
   * (urun karari, bulgu 66 d). Kurulus kartlarinda ticari unvan
   * (`company_name`) oldugu gibi kalir. Kesfet / ana sayfa / kategori / favori
   * yuzeyleri kisaltmayi kullanir; tam ad gereken bir yuzey `tamAd` gonderir.
   */
  const displayName =
    (profile.role === 'business' || profile.role === 'agency') &&
    profile.company_name
      ? profile.company_name
      : gosterilecekAd(profile.role, profile.full_name, tamAd) || 'İsimsiz';

  const initials = (profile.full_name || profile.company_name || 'K')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const categoryName = profile.service_categories?.name_tr ?? null;
  const cityName = profile.turkish_cities?.name ?? null;

  const badgeInput = {
    approvalStatus: profile.approval_status,
    createdAt: profile.created_at,
    rating,
    premiumTier: (profile.premium_tier ?? null) as
      | 'none'
      | 'premium'
      | 'plus'
      | 'agency'
      | null,
    premiumUntil: profile.premium_until ?? null,
  };
  const verified = isVerified(badgeInput);
  const isPremium = isPremiumActive(
    badgeInput.premiumTier,
    badgeInput.premiumUntil
  );

  // ALT ROZET (D2): profesyonelde en dusuk baslangic fiyati, ajansta kurumsal
  // etiketi. Fiyat yalniz GERCEK veriden: talep-uzerine hizmetler ve bos
  // `price_min` degerleri atlanir; hicbiri yoksa rozet cizilmez.
  const enDusukFiyat = (() => {
    if (isAgencyCard) return null;
    const adaylar = (services ?? [])
      .filter((h) => !h.price_on_request && h.price_min != null)
      .map((h) => Number(h.price_min))
      .filter((n) => Number.isFinite(n) && n > 0);
    return adaylar.length > 0 ? Math.min(...adaylar) : null;
  })();
  const altRozet = isAgencyCard
    ? 'Kurumsal profil'
    : enDusukFiyat !== null
      ? `${formatTL(enDusukFiyat)}'den`
      : null;

  const showFavoriteButton =
    profile.role === 'professional' || profile.role === 'agency';

  const profileHref = etkinlikId
    ? `/p/${profile.id}?etkinlik=${etkinlikId}`
    : `/p/${profile.id}`;

  const PremiumBadge = isPremium ? (
    <span className="absolute top-3 right-14 font-mono text-[10px] uppercase tracking-[0.14em] bg-brand-accent text-paper px-2 py-1 rounded-md shadow-sm">
      Premium
    </span>
  ) : null;

  /**
   * ===================== VARSAYILAN (Kesfet / kategori / favori / benzer) =====================
   *
   * Duzeltme 09 (bulgu 66 a/c/e) — TEK KART DILI:
   *   - oran 4:5 HER YERDE (ana sayfa dahil); fotograf one cikar,
   *   - fotograf HEP GORUNUR: beyaz govde ve tam ekran hover paneli kalkti,
   *   - masaustunde hover/klavye odaginda ALT SERIT buyur: ayni serit altina
   *     tanitim (tek satir) + "Profili incele" eklenir; serit gradient oldugu
   *     icin fotograf ustte ve arkada gorunur kalir (ayri panel yok - dar
   *     kartta sabit yukseklikli panel dugmeyi kirpiyordu),
   *   - kart dugmesi "Profili incele" (gercek "Teklif Al" profil sayfasinda),
   *   - alinti, hizmet etiketi ve coklu metin KARTTAN KALKTI (profilde var).
   *
   * Katmanlar: fotograf -> ust cipler -> ALT SERIT (gradient; z yok, icindeki
   * dugme / kisa yol z-20) -> kart baglantisi (z-10) -> kalp (z-20).
   */
  return (
    <div className="relative group">
      <div
        className={`relative rounded-2xl overflow-hidden bg-card border transition-shadow duration-300 ${
          isPremium
            ? 'border-[#D9C179] ring-1 ring-[#D9C179]/40 group-hover:shadow-[0_16px_36px_-16px_rgba(138,109,31,0.35)]'
            : 'border-line group-hover:shadow-[0_16px_36px_-18px_rgba(20,61,49,0.35)]'
        }`}
      >
        {/* ---------- FOTOGRAF (4:5, her kirilimda ayni) ---------- */}
        <div className="relative aspect-[4/5]">
          <CoverMedia src={coverUrl} alt={displayName} initials={initials} />

          <TopChips
            isAgency={isAgencyCard}
            categoryName={categoryName}
            reserve={isPremium ? 'heart-premium' : 'heart'}
          />
          {PremiumBadge}

          {/* ALT SERIT — her zaman gorunur: ad + meta + alt rozet. Gradient
              seritin kendisinde: serit buyuyunce de metin okunur kalir.
              Masaustunde hover / klavye odaginda altina tanitim (tek satir) +
              "Profili incele" (+ varsa havuz / kisa liste kisa yolu) acilir. */}
          <div className="absolute inset-x-0 bottom-0 p-4 pt-14 bg-gradient-to-t from-black/85 via-black/45 to-transparent">
            <h3 className="font-display text-base text-white font-semibold leading-tight flex items-start gap-1.5">
              <span className="line-clamp-2">{displayName}</span>
              {verified && <VerifiedIcon size={15} />}
            </h3>
            <div className="mt-1">
              <MetaRow
                light
                rating={rating}
                jobsCount={jobsCount}
                cityName={cityName}
              />
            </div>
            {altRozet && (
              <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-white bg-white/15 border border-white/25 px-2 py-0.5 rounded-md backdrop-blur-sm">
                {altRozet}
              </span>
            )}

            {/* HOVER EKI — yalniz masaustu. Kapaliyken yukseklik 0 (tiklanamaz);
                hover / odakta acilir. Icerik sabit: tanitim + dugme (+ kisa yol). */}
            <div className="hidden md:block max-h-0 opacity-0 overflow-hidden transition-all duration-300 ease-out group-hover:max-h-48 group-hover:opacity-100 group-focus-within:max-h-48 group-focus-within:opacity-100">
              {profile.bio && (
                <p className="mt-2 text-xs text-white/80 leading-snug line-clamp-1">
                  {profile.bio}
                </p>
              )}
              <Link
                href={profileHref}
                prefetch={false}
                className="relative z-20 mt-2.5 block w-full text-center bg-paper text-ink rounded-lg py-2 font-display font-semibold text-sm hover:bg-paper-2 transition-colors"
              >
                Profili incele
              </Link>
              {havuz && (
                <div className="relative z-20 mt-2">
                  <HavuzKisaYol
                    providerId={profile.id}
                    orgId={havuz.orgId}
                    durum={havuz.durum}
                  />
                </div>
              )}
              {/* FAZ 8c: kisa liste kisa yolu. HAVUZ ONCELIKLI — ikisi yan yana
                  sigmadigi icin havuz varsa kisa liste kartta cizilmez,
                  `/p/[id]` panelinde kalir. */}
              {!havuz && kisaListe && (
                <div className="relative z-20 mt-2">
                  <KisaListeKisaYol
                    providerId={profile.id}
                    orgId={kisaListe.orgId}
                    durum={kisaListe.durum}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------- MOBIL INCE SATIR ---------- */}
        {/* Hover olmayan cihazda panel acilmaz; dugme (ve varsa kisa yol)
            fotografin ALTINDA ince bir seritte durur. Tanitim / alinti /
            etiket mobilde cizilmez. */}
        <div className="md:hidden flex items-center justify-between gap-2 p-3">
          <div className="relative z-20 min-w-0">
            {havuz ? (
              <HavuzKisaYol
                providerId={profile.id}
                orgId={havuz.orgId}
                durum={havuz.durum}
              />
            ) : kisaListe ? (
              <KisaListeKisaYol
                providerId={profile.id}
                orgId={kisaListe.orgId}
                durum={kisaListe.durum}
              />
            ) : null}
          </div>
          <Link
            href={profileHref}
            prefetch={false}
            className="relative z-20 shrink-0 bg-brand-ink text-paper rounded-lg px-4 py-2 font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
          >
            Profili incele
          </Link>
        </div>

        {/* Kart geneli tıklama → profil (stretched link, z-10; interaktifler z-20) */}
        <Link
          href={profileHref}
          prefetch={false}
          className="absolute inset-0 z-10"
          aria-label={displayName}
        />

        {/* Favori kalbi — üst-sağ, z-20 (mevcut favori işlevi korunur) */}
        {showFavoriteButton && (
          <div className="absolute top-3 right-3 z-20">
            <FavoriteButton
              professionalId={profile.id}
              initialFavorited={isFavorited}
              isLoggedIn={isLoggedIn}
              userRole={currentUserRole}
              variant="card"
            />
          </div>
        )}
      </div>
    </div>
  );
}
