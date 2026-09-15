-- =============================================================================
-- !!! BU DOSYA BILEREK supabase/migrations/ DISINDA !!!
--
-- Kod deploy edilmeden (git push -> Vercel) supabase/migrations/ klasorune TASINMAZ.
-- `supabase db push` klasordeki bekleyen her dosyayi uygular; bu dosya erken giderse
-- eski kod calisirken authenticated rolu profiles'ta 7 sutunu kaybeder ve su yerler
-- 42501 ile kirilir: profil sayfalari (select('*')), mesaj sayfasi (embed'deki
-- phone/email), davetler, hos geldin e-postasi, askiya-alindi, admin paneli ve admin
-- onay e-postalari, bildirim e-postalari.
--
-- SIRA:   20260915100000_profiles_pii_adim2a_rpc.sql  (uretimde)
--      -> kod deploy (bu dosyayla ayni degisiklik setindeki uygulama duzeltmeleri)
--      -> bu dosya supabase/migrations/'a tasinir, db push
--
-- TASIMA KARARI GUVEN'INDIR. Bu dosyayi Claude tasimaz. Karar verildiginde:
--   git mv docs/envanter/bekleyen/20260915100100_profiles_pii_adim2b_authenticated_kisit.sql supabase/migrations/
-- =============================================================================
-- profiles: authenticated rol icin kisisel verileri kapat (adim 2b/2)
--
-- SORUN: "Profiles are viewable by everyone" politikasi qual = true; authenticated
--   rolunun profiles uzerinde tablo duzeyinde SELECT yetkisi var. RLS satir filtreler,
--   sutun filtreleyemez: hesap acan herkes PostgREST'ten tum kullanicilarin e-posta ve
--   telefonunu cekebilir. Adim 1 (20260914150000) ayni sorunu anon icin kapatti.
--
-- COZUM (bu dosya): authenticated'in tablo duzeyi SELECT'i kaldirilir, yerine adim 1'deki
--   23 sutunluk liste verilir. Liste app/lib/own-profile.ts PROFILE_OPEN_COLUMNS ile
--   birebir aynidir.
--
-- KAPATILAN 7 SUTUN: email, phone, kvkk_approved_at, approval_note, suspension_reason,
--   suspended_by, welcome_email_sent_at. Bunlar artik yalniz 2a'daki RPC'lerle okunur:
--   get_contact_info, get_own_private_profile, admin_profile_contacts,
--   admin_profile_ids_by_email, get_notification_email.
--
-- DOKUNULMAYAN: UPDATE/INSERT/DELETE tablo duzeyinde kalir (RLS + protect_profile_fields
--   tetikleyicisi zaten sinirliyor). service_role tam yetkisini korur. anon adim 1'de.
--
-- 42501 VEREN BICIMLER (15 Eylul PGlite olcumu, spec 3.4): kapali sutunu SECMEK,
--   onunla FILTRELEMEK, RETURNING'de istemek, * kullanmak ve bir politika ifadesinin
--   icinden okumak. count(*) ve kapali sutunu UPDATE etmek calisir.
--
-- DIKKAT — kalici kural: profiles'a yeni bir sutun eklenirse ayni migration'da
--   "GRANT SELECT (yeni_sutun) ON public.profiles TO anon, authenticated" yazilmali ve
--   sutun PROFILE_OPEN_COLUMNS'a eklenmelidir; hassas bir sutunsa GRANT verilmez,
--   2a'daki RPC'lere eklenir.
--
-- VERI DEGISTIRILMEZ. Idempotan: REVOKE/GRANT tekrarinda durum degismez.
-- Uretimde geri alma (tek satir):
--   GRANT SELECT ON public.profiles TO authenticated;
-- =============================================================================

BEGIN;

REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id,
  full_name,
  role,
  avatar_url,
  created_at,
  updated_at,
  bio,
  city_id,
  slug,
  is_published,
  primary_category_id,
  company_name,
  last_seen_at,
  is_admin,
  approval_status,
  approved_at,
  attributes,
  suspended_at,
  premium_tier,
  premium_until,
  views_count,
  default_allowed_applicant_roles,
  category_attributes
) ON public.profiles TO authenticated;

COMMIT;
