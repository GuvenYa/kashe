-- =============================================================================
-- FAZ 2c / 01 — v_providers_public: pazaryeri okuma yolunun SOZLESMESI
--
-- Kaynak: 04-goc-plani.md FAZ 2 madde 18 ("okuma yollari tek tek providers'a gecirilir");
--         11-faz2 bolum 2 (cift alan doneminin bitis kriteri); 14-faz2c-okuma-yolu.md (karar: gorunum sozlesmesi).
--
-- NE YAPAR (yalniz gorunum; veri yazmaz, tablo degistirmez):
--   Uygulamanin pazaryeri sayfalari (kesfet, kategori, /p/[id], sitemap, sihirbaz sayaci, pro-bul, teklif-topla,
--   favoriler) bugun profiles'tan okudugu sutun kumesini AYNI ADLARLA sunar; kaynak artik yeni tablolardir:
--     providers            -> id, provider_type, provider_slug, display_name, city_id, is_published, approval_status,
--                             approved_at, suspended_at, is_verified, verification_level, trust_score
--     professional_profiles-> bio (professional), headline, experience_years, pricing_mode, price_min/max, price_unit
--     organization_profiles-> bio (organization: about)
--     provider_services    -> primary_role_id (is_primary satiri)
--     profiles (kimlik)    -> role, full_name, company_name, avatar_url, attributes, category_attributes,
--                             primary_category_id, premium_tier, premium_until, last_seen_at, created_at, updated_at
--   is_visible = is_published AND approval_status = 'approved' AND suspended_at IS NULL (01 bolum 2).
--   Uygulama `.from('profiles')` yerine `.from('v_providers_public')` der; embed'ler ayni kalir
--   (`turkish_cities(name)` providers.city_id FK'si, `service_categories!profiles_primary_category_id_fkey` profiles FK'si
--   uzerinden — PostgREST gorunum iliskilerini taban tablo FK'lerinden cikarir; onizlemede dogrulanir).
--   FAZ 10'da profiles'tan pazaryeri sutunlari dusurulunce yalniz bu gorunum yeniden baglanir; uygulama degismez.
--
-- YETKI: security_invoker — RLS ve sutun yetkileri cagirana gore (profiles: herkese okunur politikasi; kapali
--   sutunlar gorunumde YOK). GRANT SELECT anon, authenticated, service_role.
--
-- Idempotan. Sapkali harf yok.
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_providers_public
WITH (security_invoker = true) AS
SELECT pr.id,
       p.role,
       pr.provider_type,
       pr.slug                    AS provider_slug,
       pr.display_name,
       p.full_name,
       p.company_name,
       p.avatar_url,
       COALESCE(pp.bio, op.about) AS bio,
       pr.city_id,
       p.primary_category_id,
       ps.role_id                 AS primary_role_id,
       p.attributes,
       p.category_attributes,
       p.premium_tier,
       p.premium_until,
       pr.is_published,
       pr.approval_status,
       pr.approved_at,
       pr.suspended_at,
       (pr.is_published AND pr.approval_status = 'approved' AND pr.suspended_at IS NULL) AS is_visible,
       pr.is_verified,
       pr.verification_level,
       pr.trust_score,
       pp.headline,
       pp.experience_years,
       pp.pricing_mode,
       pp.price_min,
       pp.price_max,
       pp.price_unit,
       p.last_seen_at,
       p.created_at,
       p.updated_at
  FROM public.providers pr
  JOIN public.profiles p                    ON p.id = pr.id
  LEFT JOIN public.professional_profiles pp ON pp.provider_id = pr.id
  LEFT JOIN public.organization_profiles op ON op.provider_id = pr.id
  LEFT JOIN public.provider_services ps     ON ps.provider_id = pr.id AND ps.is_primary;

COMMENT ON VIEW public.v_providers_public IS
  'FAZ 2c: pazaryeri okuma sozlesmesi. profiles pazaryeri sutunlari ile ayni adlar; kaynak providers / alt profiller / provider_services. security_invoker.';

GRANT SELECT ON public.v_providers_public TO anon, authenticated, service_role;

COMMIT;
