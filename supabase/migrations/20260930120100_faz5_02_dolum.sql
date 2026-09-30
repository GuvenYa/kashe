-- =============================================================================
-- FAZ 5 / 02 — Dolum (tek sefer, idempotan):
--   a) talents.canonical_email / canonical_phone <- profiles (kapali sutunlar; 01'deki ayna bundan sonra tazeler)
--   b) agency_members -> organization_talent_records (+ roller provider_services'tan)
--
-- Karar (17 bolum 2, Guven 30 Eylul): aynalama tetikleyicisi YOK; bu dosya mevcut satirlari kopyalar, bundan
-- sonra Ekibim davet kabulu uygulamada (P1) havuz kaydini AYNI islemde yazar. asama13 K5 kaymayi izler.
--
-- Kural (2b): dolum updated_at'i oynatmaz — talents updated_at tetikleyicisi gecici olarak kapatilir, sonda
-- yeniden acildigi dogrulanir. records satirlari INSERT ile dogar (updated_at = created_at, dogal).
--
-- faz5_backfill_agency_members() fonksiyonu KALICIDIR (admin/servis; asama4 T17 ve gerekirse tekrar kosum icin).
-- Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Dolum fonksiyonu: agency_members -> havuz kaydi
--    Eslesme: organizations.legacy_profile_id = agency_id, talents.user_id = professional_id.
--    Eslesmeyen satir ATLANIR ve sayilir (FAZ 0/2a eksigi demektir; once o kapanir).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.faz5_backfill_agency_members(
  OUT kurulus_sayisi integer, OUT yeni_kayit integer, OUT yeni_rol integer, OUT atlanan integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE am record; v_rec uuid; v_talent uuid; v_org uuid; n int;
BEGIN
  kurulus_sayisi := 0; yeni_kayit := 0; yeni_rol := 0; atlanan := 0;

  FOR am IN
    SELECT a.id, a.agency_id, a.professional_id, a.joined_at
      FROM public.agency_members a
     ORDER BY a.joined_at, a.id
  LOOP
    SELECT o.id INTO v_org FROM public.organizations o WHERE o.legacy_profile_id = am.agency_id;
    SELECT t.id INTO v_talent FROM public.talents t WHERE t.user_id = am.professional_id AND t.claim_status <> 'merged';
    IF v_org IS NULL OR v_talent IS NULL THEN
      atlanan := atlanan + 1;
      RAISE NOTICE 'faz5 dolum: agency_members % atlandi (org=%, talent=%)', am.id, v_org, v_talent;
      CONTINUE;
    END IF;

    -- zaten dolum izi var mi?
    SELECT id INTO v_rec FROM public.organization_talent_records WHERE legacy_agency_member_id = am.id;
    IF v_rec IS NULL THEN
      -- ayni kurulusta ayni kisi baska yoldan eklenmis olabilir: izi ona yaz
      SELECT id INTO v_rec FROM public.organization_talent_records
       WHERE organization_id = v_org AND talent_id = v_talent AND legacy_agency_member_id IS NULL;
      IF v_rec IS NOT NULL THEN
        UPDATE public.organization_talent_records SET legacy_agency_member_id = am.id WHERE id = v_rec;
      ELSE
        INSERT INTO public.organization_talent_records
          (organization_id, talent_id, name, source, visibility, relationship_type, status,
           linked_at, legacy_agency_member_id, created_by, created_at, updated_at)
        SELECT v_org, v_talent, COALESCE(NULLIF(trim(p.full_name), ''), 'Kashe uyesi'),
               'marketplace_linked', 'private', 'regular_freelancer', 'active',
               am.joined_at, am.id, am.agency_id, am.joined_at, am.joined_at
          FROM public.profiles p WHERE p.id = am.professional_id
        RETURNING id INTO v_rec;
        yeni_kayit := yeni_kayit + 1;
      END IF;
    END IF;

    -- roller: profesyonelin provider_services satirlari (birincil korunur)
    INSERT INTO public.organization_talent_record_roles (record_id, role_id, is_primary)
    SELECT v_rec, ps.role_id, ps.is_primary
      FROM public.provider_services ps
     WHERE ps.provider_id = am.professional_id
       AND NOT EXISTS (SELECT 1 FROM public.organization_talent_record_roles x WHERE x.record_id = v_rec AND x.role_id = ps.role_id)
       AND (NOT ps.is_primary OR NOT EXISTS (SELECT 1 FROM public.organization_talent_record_roles y WHERE y.record_id = v_rec AND y.is_primary));
    GET DIAGNOSTICS n = ROW_COUNT;
    yeni_rol := yeni_rol + n;
  END LOOP;

  SELECT count(DISTINCT organization_id) INTO kurulus_sayisi
    FROM public.organization_talent_records WHERE legacy_agency_member_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.faz5_backfill_agency_members() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.faz5_backfill_agency_members() TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Dolum kosumu
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record; n_talent int; n_dis int;
BEGIN
  -- a) talents kimlik aynasi (updated_at oynamaz)
  ALTER TABLE public.talents DISABLE TRIGGER on_talents_updated;
  UPDATE public.talents t
     SET canonical_email = public.norm_email(p.email),
         canonical_phone = public.norm_phone(p.phone)
    FROM public.profiles p
   WHERE p.id = t.user_id
     AND (t.canonical_email IS DISTINCT FROM public.norm_email(p.email)
          OR t.canonical_phone IS DISTINCT FROM public.norm_phone(p.phone));
  GET DIAGNOSTICS n_talent = ROW_COUNT;
  ALTER TABLE public.talents ENABLE TRIGGER on_talents_updated;

  SELECT count(*) INTO n_dis FROM pg_trigger WHERE tgrelid = 'public.talents'::regclass AND tgenabled = 'D';
  IF n_dis > 0 THEN RAISE EXCEPTION 'talents uzerinde % tetikleyici kapali kaldi', n_dis; END IF;

  -- b) agency_members -> havuz
  SELECT * INTO r FROM public.faz5_backfill_agency_members();

  RAISE NOTICE 'FAZ 5 dolum: talents kimlik aynasi % satir; agency_members -> havuz: % kurulus, % yeni kayit, % yeni rol, % atlanan',
    n_talent, r.kurulus_sayisi, r.yeni_kayit, r.yeni_rol, r.atlanan;
END $$;

COMMIT;
