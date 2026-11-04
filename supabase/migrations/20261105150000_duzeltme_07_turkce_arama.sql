-- =============================================================================
-- Duzeltme 07 / DB - Turkce harf duyarsiz Kesfet aramasi (EKLEYEN; 5 Kasim 2026). Bulgu 71.
--   "fotograf" (Turkce harfsiz) aramasi "Fotografci" kategorisini ve fotograf profillerini bulmuyordu: ILIKE Turkce harfleri
--   (g/ğ, c/ç, s/ş, i/ı/İ, o/ö, u/ü) ve sapkali harfleri esit saymaz.
--   1) public.tr_katla(text): Turkce + sapkali harfleri ASCII karsiligina indirip kucuk harfe cevirir (IMMUTABLE). Uygulama
--      ayni katlamayi `app/lib/arama.ts` icinde yapar; iki taraf birebir ayni eslemeyi kullanir.
--   2) v_providers_public sonuna `arama_metni` sutunu: tr_katla(ad + sirket adi + baslik + tanitim + birincil kategori adi).
--      Mevcut sutunlar, sirasi ve kaynaklari 02b ile AYNI (primary_category_id yine profiles'tan - PostgREST gomme ipucu);
--      security_invoker korunur. Yeni sutun yalniz arama suzgecinde kullanilir, listeye secilmez. full_name zaten gorunumde
--      (API duzeyi ad gizleme 10c-2 sonrasi ayri karar) - yeni sutun ek bir alan acmaz.
--   Sapkali harfler dosyada U& kacis koduyla yazilir.
-- Kontrol: asama24. Test: asama4 T42.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tr_katla(p text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(p,
    U&'\00C7\00E7\011E\011F\0130\0131\00D6\00F6\015E\015F\00DC\00FC\00C2\00E2\00CE\00EE\00DB\00FB',
    'ccggiioossuuaaiiuu'))
$$;

REVOKE ALL ON FUNCTION public.tr_katla(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tr_katla(text) TO anon, authenticated;

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
    p.updated_at,
    public.tr_katla(concat_ws(' ', p.full_name, p.company_name, pp.headline, COALESCE(pp.bio, op.about),
      (SELECT c.name_tr FROM public.service_categories c WHERE c.id = p.primary_category_id))) AS arama_metni
   FROM public.providers pr
     JOIN public.profiles p ON p.id = pr.id
     LEFT JOIN public.professional_profiles pp ON pp.provider_id = pr.id
     LEFT JOIN public.organization_profiles op ON op.provider_id = pr.id
     LEFT JOIN public.provider_services ps ON ps.provider_id = pr.id AND ps.is_primary;

DO $$
BEGIN
  IF public.tr_katla(U&'\00C7a\011Fr\0131 I\015F\0131k \0130zmir \00D6z\00FCm \00C2\00EE\00FB') <> 'cagri isik izmir ozum aiu' THEN
    RAISE EXCEPTION 'Duzeltme 07: tr_katla beklenen sonucu vermedi: %',
      public.tr_katla(U&'\00C7a\011Fr\0131 I\015F\0131k \0130zmir \00D6z\00FCm \00C2\00EE\00FB');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
