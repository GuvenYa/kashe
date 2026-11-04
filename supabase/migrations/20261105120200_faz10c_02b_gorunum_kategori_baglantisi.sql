-- =============================================================================
-- FAZ 10c-1 / 02b - v_providers_public.primary_category_id yeniden profiles'tan (ACIL; 5 Kasim 2026). 02'den sonra.
--   02 bu sutunu birincil rolden (service_roles.legacy_category_id) okutuyordu. Degerler ayni ama PostgREST gorunum
--   iliskisini KAYNAK sutunun yabanci anahtarindan cikarir: uygulama `service_categories!profiles_primary_category_id_fkey(...)`
--   ile gomuyor (Kesfet, ana sayfa, ...). Kaynak profiles.primary_category_id olmaktan cikinca iliski bulunamadi ve Kesfet
--   "Bir sorun olustu" verdi (dalda, 02 push'undan sonra). Duzeltme: sutun yine p.primary_category_id (kopya ters/ileri
--   aynayla saglayici tarafiyla esit; asama10 K2/K4 bunu olcer). Saglayici tarafina gecis, uygulamadaki gomme ipuclari
--   degistikten SONRA (10c-2 P2) yapilir. attributes / category_attributes saglayici tarafindan okunmaya devam eder
--   (jsonb, yabanci anahtar yok).
-- =============================================================================

CREATE OR REPLACE VIEW public.v_providers_public WITH (security_invoker = true) AS
 SELECT pr.id,
    p.role,
    pr.provider_type,
    pr.slug AS provider_slug,
    pr.display_name,
    p.full_name,
    p.company_name,
    p.avatar_url,
    COALESCE(pp.bio, op.about) AS bio,
    pr.city_id,
    p.primary_category_id,
    ps.role_id AS primary_role_id,
    pr.attributes,
    pr.category_attributes,
    p.premium_tier,
    p.premium_until,
    pr.is_published,
    pr.approval_status,
    pr.approved_at,
    pr.suspended_at,
    pr.is_published AND pr.approval_status = 'approved'::profile_approval_status AND pr.suspended_at IS NULL AS is_visible,
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
     JOIN public.profiles p ON p.id = pr.id
     LEFT JOIN public.professional_profiles pp ON pp.provider_id = pr.id
     LEFT JOIN public.organization_profiles op ON op.provider_id = pr.id
     LEFT JOIN public.provider_services ps ON ps.provider_id = pr.id AND ps.is_primary;

NOTIFY pgrst, 'reload schema';
