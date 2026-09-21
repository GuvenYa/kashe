import type { PremiumTier } from './badges';

// PremiumTier'in tek kaynagi app/lib/badges.ts'tir (5 dosya oradan import ediyor);
// profil tipleri tek dosyadan okunsun diye burada yalnizca yeniden disa aktarilir.
// Ikinci bir tanim YAZILMAZ — iki tanim zamanla ayrisir.
export type { PremiumTier };

// Auth user role
export type UserRole = 'professional' | 'client' | 'business' | 'agency';

// Database tables
//
// profiles iki erisim katmanina ayrilir (PII adim 2, 15 Eylul):
//   ProfileOpen    — anon ve authenticated'a ACIK 23 sutun; app/lib/own-profile.ts
//                    PROFILE_OPEN_COLUMN_LIST ile birebir (derleme zamani kilitli).
//   ProfilePrivate — yalniz get_own_private_profile() / admin_profile_contacts()
//                    RPC'leriyle gelen KAPALI 7 sutun.
// Nullability veritabaniyla birebirdir (docs/envanter/10-faz2-onkosul-tipler.md bolum 3).
// Amac: FAZ 2'de alan providers'a tasindiginda derleyici her kullanimi gostersin.

export type ProfileApprovalStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revision';

/** default_allowed_applicant_roles degerleri (CHECK: <@ {professional,agency}, >= 1). */
export type ApplicantRole = 'professional' | 'agency';

/** profiles: anon ve authenticated rollerine ACIK 23 sutun. */
export type ProfileOpen = {
  id: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  bio: string | null;
  city_id: number | null;
  slug: string | null;
  is_published: boolean;
  primary_category_id: number | null;
  company_name: string | null;
  last_seen_at: string | null;
  is_admin: boolean;
  approval_status: ProfileApprovalStatus;
  approved_at: string | null;
  attributes: Record<string, string | string[]>;
  suspended_at: string | null;
  premium_tier: PremiumTier;
  premium_until: string | null;
  views_count: number;
  default_allowed_applicant_roles: ApplicantRole[];
  category_attributes: Record<string, unknown>;
};

/** profiles: KAPALI 7 sutun. Istemciye yalniz RPC ile gelir; hepsi null olabilir. */
export type ProfilePrivate = {
  email: string | null;
  phone: string | null;
  kvkk_approved_at: string | null;
  approval_note: string | null;
  suspension_reason: string | null;
  suspended_by: string | null;
  welcome_email_sent_at: string | null;
};

/** Oturum sahibinin tam profili — fetchOwnProfile ciktisi. */
export type Profile = ProfileOpen & ProfilePrivate;

// Ortak embed sekilleri
export type CityEmbed = { turkish_cities: { name: string } | null };
export type CategoryEmbed = {
  service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
};

/** Kart/liste basligi icin en kucuk profil sekli. */
export type ProfileCard = Pick<
  ProfileOpen,
  'id' | 'full_name' | 'avatar_url' | 'company_name' | 'role'
>;

// ProfileListing ve ProfilePublic FAZ 2c/P2'de SILINDI: pazaryeri listesi ve detay
// sayfasi artik ProviderListing / ProviderPage okuyor (v_providers_public).
// ProfileOpen / ProfilePrivate / ProfileCard duruyor — kimlik ve oturum sahibi okumalari
// (own-profile.ts, marquee) hala profiles'tan gelir.

// ===== FAZ 2c — pazaryeri okuma sozlesmesi: v_providers_public =====
//
// Gorunum: supabase/migrations/20260921120000_faz2c_01_v_providers_public.sql (33 sutun).
// Kaynaklar: providers / professional_profiles / organization_profiles / provider_services
// + profiles (kimlik sutunlari). Nullability gorunumun KAYNAK TABLOLARINDAN alinmistir:
// alt profil tablolari LEFT JOIN ile bagli oldugu icin onlardan gelen her sutun nullable.
// Kapali sutunlar (email, phone, ...) gorunumde YOKTUR.

export type ProviderType = 'professional' | 'organization';
export type VerificationLevel = 'none' | 'email' | 'document' | 'full';
export type PricingMode = 'fixed' | 'range' | 'on_request';
export type ProviderPriceUnit = 'per_job' | 'per_hour' | 'per_half_day' | 'per_day';

export type ProviderPublic = {
  id: string;
  role: UserRole;
  provider_type: ProviderType;
  provider_slug: string;
  display_name: string | null;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city_id: number | null;
  primary_category_id: number | null;
  primary_role_id: number | null;
  attributes: Record<string, string | string[]>;
  category_attributes: Record<string, unknown>;
  premium_tier: PremiumTier;
  premium_until: string | null;
  is_published: boolean;
  approval_status: ProfileApprovalStatus;
  approved_at: string | null;
  suspended_at: string | null;
  is_visible: boolean;
  is_verified: boolean;
  verification_level: VerificationLevel;
  trust_score: number | null;
  headline: string | null;
  experience_years: number | null;
  pricing_mode: PricingMode | null;
  price_min: number | null;
  price_max: number | null;
  price_unit: ProviderPriceUnit | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Liste sorgularinin sectigi sutunlar — bugunku ProfileListing alan kumesiyle AYNI adlar,
 * AYNI sira (uretilen select dizesi degismesin diye).
 *
 * `satisfies readonly (keyof ProviderPublic)[]`: gorunumden bir sutun duserse (ProviderPublic
 * guncellenince) buradaki ad gecersiz olur ve derleme kirilir — own-profile.ts'teki sutun
 * kilidinin ayni kalibi. Liste ile tip tek kaynaktan yurur.
 */
export const PROVIDER_LISTING_COLUMN_LIST = [
  'id',
  'full_name',
  'avatar_url',
  'bio',
  'city_id',
  'primary_category_id',
  'company_name',
  'role',
  'attributes',
  'category_attributes',
  'created_at',
  'approval_status',
  'premium_tier',
  'premium_until',
] as const satisfies readonly (keyof ProviderPublic)[];

/** Sorgularda kullanilan sutun dizesi — liste ile tek kaynaktan uretilir. */
export const PROVIDER_LISTING_COLUMNS = PROVIDER_LISTING_COLUMN_LIST.join(', ');

/** Kesfet ve kategori/[slug] listeleri (v_providers_public + embed'ler). */
export type ProviderListing = Pick<
  ProviderPublic,
  (typeof PROVIDER_LISTING_COLUMN_LIST)[number]
> &
  CityEmbed &
  CategoryEmbed;

/** Saglayici detay sayfasi (/p/[id]) — liste alanlari + yayin/son gorulme. */
export type ProviderPage = ProviderListing &
  Pick<ProviderPublic, 'is_published' | 'last_seen_at'>;

/**
 * Saglayici kart basligi (en kucuk sekil).
 * Musteri/yorumcu kartlari icin ProfileCard kullanilir — onlar profiles'ta kalir.
 */
export type ProviderCard = Pick<
  ProviderPublic,
  'id' | 'full_name' | 'avatar_url' | 'company_name' | 'role'
>;
export type ServiceCategory = {
  id: number;
  slug: string;
  name_tr: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
};

export type TurkishCity = {
  id: number;
  plate_no: number;
  name: string;
};

/** §11 — Hizmet fiyat birimi (paketlerde yok). */
export type PriceUnit = 'total' | 'hourly' | 'half_day' | 'full_day';

export type Service = {
  id: string;
  profile_id: string;
  category_id: number;
  title: string;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  price_on_request: boolean;
  duration_hours: number | null;
  // §11 fiyat modu — opsiyonel (eski veriyle uyum; select('*') ile dolu gelir)
  price_unit?: PriceUnit;
  price_starting?: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PortfolioItem = {
  id: string;
  profile_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  sort_order: number;
  created_at: string;
};

// Composite types (joined)
export type ProfileWithCity = Profile & CityEmbed;

export type ServiceWithCategory = Service & {
  service_categories: { name_tr: string; emoji: string | null } | null;
  service_addons?: ServiceAddon[];
};

export type ServiceAddon = {
  id: string;
  service_id: string;
  profile_id: string;
  title: string;
  description: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
};
// ===== MESSAGING =====

export type Conversation = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  last_message_at: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  // Faz 8: Quote system
  message_type: 'text' | 'quote' | 'system' | 'file';
  attachment_path: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  quote_id: string | null;
};

// Konuşma listesi için: karşı tarafın bilgileriyle birlikte
export type ConversationWithOther = Conversation & {
  other_user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  };
  last_message: {
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  unread_count: number;
};
export type Review = {
  id: string;
  conversation_id: string;
  customer_id: string;
  professional_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewReply = {
  id: string;
  review_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ProfessionalRatingSummary = {
  professional_id: string;
  review_count: number;
  average_rating: number;
};
export type ServicePackage = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  includes: string[];
  price_min: number | null;
  price_max: number | null;
  price_on_request: boolean;
  // §11 — paketlerde yalnızca "başlangıç" bayrağı (birim YOK)
  price_starting?: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};
export type BlogPostStatus = 'draft' | 'published';

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  author_id: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ReportTargetType = 'listing' | 'profile' | 'review';
export type ReportReason =
  | 'spam'
  | 'inappropriate'
  | 'fake'
  | 'harassment'
  | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  admin_note: string | null;
  created_at: string;
};