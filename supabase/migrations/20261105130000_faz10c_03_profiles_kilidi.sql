-- =============================================================================
-- FAZ 10c-1 / 03 - profiles tasinmis alan kilidi (KISITLAYAN; 5 Kasim 2026). 01 + 02 + 02b ve uygulama P1 URETIMDE iken.
-- Kaynak: docs/envanter/38-faz10-temizlik.md bolum 10c (kararlar bolum 4: madde 2, 6).
--   Saglayici hesabinda (providers satiri olan) pazaryeri alanlarinin TEK yazma yeri saglayici tarafidir:
--   providers (city_id, is_published, attributes, category_attributes, onay / askiya alma, views_count),
--   professional_profiles.bio / organization_profiles.about, birincil kategori provider_set_primary_category RPC'si.
--   profiles'taki ayni 13 alan ters aynayla dolan KOPYADIR; bu dosya kopyayi kilitler:
--   1) protect_profiles_moved_fields: saglayici hesabinda bu alanlara kullanici VE admin yazimi sessizce eski degerde
--      kalir (FAZ 2a deseni; hata yok, ayni satirdaki hesap alanlari - full_name, phone, avatar_url, premium - yazilir).
--      Yalniz ayna / RPC (kashe.sync_bypass = 'on') yazar. Saglayici OLMAYAN hesap (musteri, isletme) etkilenmez.
--   2) Ileri ayna (fn_sync_profile_to_provider) daralir: yalniz providers.display_name (full_name / company_name) ve
--      talents.full_name; ensure_provider_for_profile (kayitta / rol degisiminde ilk satir) aynen.
--      Tetikleyici yalniz role, full_name, company_name degisiminde calisir.
--   3) fn_faz2b_sync_primary_role duser: birincil rol RPC'de turetilir (recompute_provider_services); yeni saglayici
--      trg_faz2b_sync_new_provider ile turetilir (degismez).
--   Veri degismez. Basta ve sonda kayma 0 dogrulanir (fn_faz10c_ayna_kaymasi).
--   Geri alma: 02'deki fn_sync_profile_to_provider govdesi + eski tetikleyici sutun listesi, fn_faz2b_sync_primary_role
--   (20260920180100_faz2b_02) ve DROP TRIGGER trg_faz10c_protect_moved_fields.
-- Kontrol: asama20 K9 (+ K8b kayma 0), asama10 (ESIT). Test: asama4 T39 (T38 eski yol bolumu 03 sonrasi kilidi sinar).
-- =============================================================================

DO $$
DECLARE n bigint;
BEGIN
  IF to_regprocedure('public.provider_set_primary_category(integer)') IS NULL THEN
    RAISE EXCEPTION 'FAZ 10c-1/03: provider_set_primary_category yok - once 01 + 02 kosmali';
  END IF;
  SELECT COALESCE(sum(satir), 0) INTO n FROM public.fn_faz10c_ayna_kaymasi();
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAZ 10c-1/03: profiles ile providers arasinda kayma var (%): % - kilitten once esitlenmeli',
      n, (SELECT string_agg(alan || '=' || satir, ' ') FROM public.fn_faz10c_ayna_kaymasi() WHERE satir > 0);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) Kilit: saglayici hesabinda profiles tasinmis alanlari yalniz ayna yazar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profiles_moved_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('kashe.sync_bypass', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = OLD.id) THEN
    RETURN NEW;   -- musteri / isletme: alanlar profiles'ta kalir
  END IF;

  NEW.city_id             := OLD.city_id;
  NEW.bio                 := OLD.bio;
  NEW.primary_category_id := OLD.primary_category_id;
  NEW.attributes          := OLD.attributes;
  NEW.category_attributes := OLD.category_attributes;
  NEW.views_count         := OLD.views_count;
  NEW.is_published        := OLD.is_published;
  NEW.approval_status     := OLD.approval_status;
  NEW.approval_note       := OLD.approval_note;
  NEW.approved_at         := OLD.approved_at;
  NEW.suspended_at        := OLD.suspended_at;
  NEW.suspension_reason   := OLD.suspension_reason;
  NEW.suspended_by        := OLD.suspended_by;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profiles_moved_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_faz10c_protect_moved_fields ON public.profiles;
CREATE TRIGGER trg_faz10c_protect_moved_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_moved_fields();

-- -----------------------------------------------------------------------------
-- 2) Ileri ayna daralir: ad (display_name) + talents.full_name
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prov uuid;
  v_name text;
  v_onceki text;
BEGIN
  IF NEW.role NOT IN ('professional', 'agency') THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_prov := public.ensure_provider_for_profile(NEW.id);

    IF TG_OP = 'UPDATE' AND v_prov IS NOT NULL THEN
      v_name := CASE WHEN NEW.role = 'professional'
                     THEN NULLIF(NEW.full_name, '')
                     ELSE COALESCE(NULLIF(NEW.company_name, ''), NULLIF(NEW.full_name, '')) END;

      v_onceki := current_setting('kashe.sync_bypass', true);
      PERFORM set_config('kashe.sync_bypass', 'on', true);
      UPDATE public.providers pr
         SET display_name = v_name
       WHERE pr.id = v_prov
         AND pr.display_name IS DISTINCT FROM v_name;
      PERFORM set_config('kashe.sync_bypass', COALESCE(NULLIF(v_onceki, ''), 'off'), true);

      IF NEW.role = 'professional' THEN
        UPDATE public.talents t SET full_name = NULLIF(NEW.full_name, '')
         WHERE t.user_id = NEW.id AND t.full_name IS DISTINCT FROM NULLIF(NEW.full_name, '');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('kashe.sync_bypass', COALESCE(NULLIF(v_onceki, ''), 'off'), true);
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, NEW.id, SQLERRM);
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_sync_profile_to_provider() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_faz2_sync_profile_to_provider ON public.profiles;
CREATE TRIGGER trg_faz2_sync_profile_to_provider
  AFTER INSERT OR UPDATE OF role, full_name, company_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_to_provider();

-- -----------------------------------------------------------------------------
-- 3) Birincil rol aynasi duser (RPC turetir; profiles yazimi artik kilitli)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_faz2b_sync_primary_role ON public.profiles;
DROP FUNCTION IF EXISTS public.fn_faz2b_sync_primary_role();

-- -----------------------------------------------------------------------------
-- 4) Dogrulama
-- -----------------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_faz10c_protect_moved_fields'
                    AND tgrelid = 'public.profiles'::regclass AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'FAZ 10c-1/03: kilit tetikleyicisi yok';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_faz2b_sync_primary_role') THEN
    RAISE EXCEPTION 'FAZ 10c-1/03: trg_faz2b_sync_primary_role hala var';
  END IF;
  SELECT COALESCE(sum(satir), 0) INTO n FROM public.fn_faz10c_ayna_kaymasi();
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAZ 10c-1/03: sonda kayma %', n;
  END IF;
  RAISE NOTICE 'FAZ 10c-1/03: profiles tasinmis alan kilidi kuruldu, ileri ayna daraldi, kayma yok';
END $$;

NOTIFY pgrst, 'reload schema';
