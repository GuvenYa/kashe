-- =============================================================================
-- profiles: anonim rol icin kisisel verileri kapat (adim 1/2)
--
-- SORUN (04-sema-uzlastirma'da not edilmisti, FAZ -1 disinda birakilmisti):
--   "Profiles are viewable by everyone" politikasi qual = true ve anon rolunun
--   profiles uzerinde tablo duzeyinde SELECT yetkisi var. Sonuc: giris yapmamis
--   herhangi biri PostgREST'ten profiles?select=email,phone ile TUM kullanicilarin
--   e-posta ve telefonunu cekebilir. Uygulama bu sutunlari anonim sayfalarda hic
--   secmiyor (14 Eylul kod taramasi: email/phone yalniz mesajlar/[id] sayfasinda,
--   o da giris gerektiriyor); yani sizinti uygulama uzerinden degil, API uzerinden.
--
-- COZUM (bu dosya): anon'un tablo duzeyindeki SELECT'i kaldirilir, yerine acik bir
--   SUTUN LISTESI verilir. RLS satir filtreler, sutun filtreleyemez; sutun kisiti
--   PostgreSQL'in kendi sutun-duzeyi GRANT'iyla yapilir. Anonim sayfaların (kesfet,
--   kategori, /p/[id], ana sayfa, sitemap) sectigi 19 sutunun tamami listede.
--
-- KAPATILAN 7 SUTUN: email, phone, kvkk_approved_at, approval_note,
--   suspension_reason, suspended_by, welcome_email_sent_at.
--
-- KAPSAM DISI (adim 2, uygulama degisikligi gerektirir): authenticated rolu hala
--   herkesin email/phone'unu okuyabilir. Adim 2 = ayni sutun listesi authenticated
--   icin + iletisim bilgisini anlasma sonrasi veren SECURITY DEFINER RPC +
--   profiles.email okuyan 4 davet politikasinin auth.email()'e cevrilmesi +
--   mesajlar/[id], lib/admin.ts, profil sayfalarinda uygulama duzeltmesi.
--
-- DIKKAT — kalici kural: profiles'a yeni bir sutun eklenirse ve anonim sayfalar onu
--   secerse, ayni migration'da "GRANT SELECT (yeni_sutun) ON public.profiles TO anon"
--   yazilmalidir; aksi halde o sayfa anonim ziyaretcide "permission denied" alir.
--   09_platform_katmani'ndaki "GRANT ALL ON ALL TABLES" bu dosyadan ONCE calisir;
--   sira bozulmadigi surece (20260727160000 < 20260914150000) sorun yoktur.
--
-- Idempotan: REVOKE/GRANT tekrarinda durum degismez. Uretimde geri alma:
--   GRANT SELECT ON public.profiles TO anon;
-- =============================================================================

BEGIN;

REVOKE SELECT ON public.profiles FROM anon;

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
) ON public.profiles TO anon;

COMMIT;
