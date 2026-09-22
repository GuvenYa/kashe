-- =============================================================================
-- FAZ 4c / 01 — Etkinlik onayi: create_event_from_spec RPC'si + eski akislara event_id bagi
--
-- Kaynak: 06-eventspec-sozlesmesi.md bolum 4 ("Onay"), 04-goc-plani.md FAZ 4 madde 25-26,
--         16-faz4c-yeni-talep-akisi.md (kararlar: sihirbaz yeniden yazilir, genisletilmis cikarim, onay RPC ile,
--         event_id sutunlari + on dolu yonlendirme).
--
-- NE YAPAR (yalniz sema; VERI YAZMAZ):
--   quote_requests.event_id, listings.event_id   NULL olabilir, FK events ON DELETE SET NULL (eski akislarin mantigi
--                                                degismez; yalniz etkinlikten baslayan talep/ilan baglanir).
--   create_event_from_spec(p_version_id)          TEK ISLEMDE: gecerli (is_current + valid) EventSpec surumunden
--                                                events (status confirmed) + event_requirements (slug -> service_roles.id)
--                                                yazar. Sahiplik: brief sahibi / kurulus events.manage / admin.
--                                                Gecersiz tur, sehir veya rol slug'i -> islem yok, hata (atomik).
--                                                Ayni surumden ikinci etkinlik -> unique_violation (idempotan koruma).
--                                                Surum satirina DOKUNMAZ (ekle-yalniz ilkesi; onay = events satiri).
--
-- Idempotan. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Eski akislara bag
-- -----------------------------------------------------------------------------
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.listings       ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS quote_requests_event_id_idx ON public.quote_requests (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS listings_event_id_idx       ON public.listings (event_id) WHERE event_id IS NOT NULL;
COMMENT ON COLUMN public.quote_requests.event_id IS 'FAZ 4c: talebin bagli oldugu onaylanmis etkinlik (etkinlik sayfasindan baslatilan talep). Eski akista NULL.';
COMMENT ON COLUMN public.listings.event_id       IS 'FAZ 4c: ilanin bagli oldugu onaylanmis etkinlik. Eski akista NULL.';

-- Ayni surumden tek etkinlik (idempotan onay)
CREATE UNIQUE INDEX IF NOT EXISTS events_spec_version_id_key ON public.events (spec_version_id) WHERE spec_version_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Onay RPC'si
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_event_from_spec(p_version_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v        record;
  b        record;
  spec     jsonb;
  v_event  uuid;
  v_type   text;
  v_city   integer;
  v_slug   text;
  v_bad    text;
BEGIN
  SELECT id, brief_id, spec_jsonb, is_current, validation_status
    INTO v FROM public.event_spec_versions WHERE id = p_version_id;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'surum bulunamadi' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id, created_by_user_id, organization_id INTO b FROM public.event_briefs WHERE id = v.brief_id;
  IF NOT public.can_access_event_scope(b.created_by_user_id, b.organization_id, 'events.manage') THEN
    RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT v.is_current THEN
    RAISE EXCEPTION 'yalniz gecerli (is_current) surum onaylanabilir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v.validation_status <> 'valid' THEN
    RAISE EXCEPTION 'surum valid degil (%)', v.validation_status USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events e WHERE e.spec_version_id = p_version_id) THEN
    RAISE EXCEPTION 'bu surumden zaten etkinlik olusturuldu' USING ERRCODE = 'unique_violation';
  END IF;

  spec   := v.spec_jsonb;
  v_type := spec->>'event_type';
  IF v_type IS NULL OR NOT EXISTS (SELECT 1 FROM public.event_types t WHERE t.key = v_type AND t.is_active) THEN
    RAISE EXCEPTION 'event_type eksik veya gecersiz: %', COALESCE(v_type, '(bos)') USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_city := NULLIF(spec->>'city_id', '')::integer;
  IF v_city IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.turkish_cities c WHERE c.id = v_city) THEN
    RAISE EXCEPTION 'city_id gecersiz: %', v_city USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_typeof(COALESCE(spec->'suggested_roles', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'suggested_roles dizi degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- roller: hepsi aktif service_roles slug'i olmali (insert'ten ONCE; atomiklik zaten islemle saglanir, mesaj netligi icin)
  SELECT r->>'slug' INTO v_bad
    FROM jsonb_array_elements(COALESCE(spec->'suggested_roles', '[]'::jsonb)) AS r
   WHERE NOT EXISTS (SELECT 1 FROM public.service_roles sr WHERE sr.slug = r->>'slug' AND sr.is_active)
   LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'rol slug gecersiz veya pasif: %', COALESCE(v_bad, '(bos)') USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.events
    (brief_id, spec_version_id, organization_id, owner_user_id, title, event_type,
     start_date, end_date, start_time, end_time, is_date_flexible, city_id, district, venue_status,
     participant_count, budget_min, budget_max, urgency, extra, status, confirmed_at)
  VALUES
    (b.id, v.id, b.organization_id, auth.uid(), NULLIF(spec->>'title', ''), v_type,
     NULLIF(spec->>'start_date', '')::date, NULLIF(spec->>'end_date', '')::date,
     NULLIF(spec->>'start_time', '')::time, NULLIF(spec->>'end_time', '')::time,
     COALESCE((spec->>'is_date_flexible')::boolean, false), v_city, NULLIF(spec->>'district', ''),
     COALESCE(NULLIF(spec->>'venue_status', '')::public.event_venue_status, 'searching'),
     NULLIF(spec->>'participant_count', '')::integer,
     NULLIF(spec->>'budget_min', '')::numeric, NULLIF(spec->>'budget_max', '')::numeric,
     COALESCE(NULLIF(spec->>'urgency', '')::public.event_urgency, 'normal'),
     COALESCE(spec->'extra', '{}'::jsonb), 'confirmed', now())
  RETURNING id INTO v_event;

  -- gereksinimler: ayni slug iki kez gelirse ilki alinir (UNIQUE event+rol)
  INSERT INTO public.event_requirements (event_id, role_id, quantity, is_required, sort_order)
  SELECT v_event, sr.id,
         GREATEST(COALESCE(NULLIF(t.r->>'quantity', '')::integer, 1), 1),
         COALESCE((t.r->>'is_required')::boolean, true),
         t.ord::integer
    FROM (
      SELECT DISTINCT ON (r->>'slug') r, ord
        FROM jsonb_array_elements(COALESCE(spec->'suggested_roles', '[]'::jsonb)) WITH ORDINALITY AS x(r, ord)
       ORDER BY r->>'slug', ord
    ) t
    JOIN public.service_roles sr ON sr.slug = t.r->>'slug'
   ORDER BY t.ord;

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_from_spec(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_event_from_spec(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.create_event_from_spec(uuid) IS 'FAZ 4c: gecerli EventSpec surumunden events + event_requirements (atomik). Sahiplik: brief sahibi / kurulus events.manage / admin.';

COMMIT;
