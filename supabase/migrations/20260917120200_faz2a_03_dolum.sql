-- =============================================================================
-- FAZ 2a / 03 — DOLUM: mevcut professional ve agency profilleri -> talents / providers /
--                professional_profiles / organization_profiles (id = profil id)
--
-- DIKKAT — BU DOSYA VERI YAZAR (FAZ 0 dolum karariyla ayni: ayri, idempotan dosya; dal ve uretim
--   ayni dosyayi kosar; bos dalda sifir satir). Eski tablolara DOKUNMAZ (yalniz okur).
--
-- ESLEME (ensure_provider_for_profile icinde):
--   professional -> talents(id=profil, user_id=profil, claimed, origin marketplace_signup),
--                   providers(id=profil, professional, talent_id=profil), professional_profiles(bio)
--   agency       -> providers(id=profil, organization, organization_id = FAZ 0 kurulusu),
--                   organization_profiles(about = bio)
--   business/client -> saglayici degil, satir yok
--   slug: profil slug'i gecerli ve bos degilse o, yoksa 'p-' || uuid (tiresiz)
--   onay/askiya alma/is_published alanlari profilden birebir kopyalanir
--
-- DOGRULAMA: docs/envanter/asama7-faz2-tutarlilik.sql (salt okunur; dal ve uretim)
-- GERI ALMA: yalniz yeni tablolardan silme:
--   DELETE FROM public.professional_profiles; DELETE FROM public.organization_profiles;
--   DELETE FROM public.providers; DELETE FROM public.talents;
-- =============================================================================

BEGIN;

DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.profiles p
     WHERE p.role IN ('professional', 'agency')
       AND NOT EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = p.id)
     ORDER BY p.created_at
  LOOP
    BEGIN
      PERFORM public.ensure_provider_for_profile(r.id);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_org_sync_error('faz2a_03_dolum.providers', 'BACKFILL', r.id, SQLERRM);
    END;
  END LOOP;
  RAISE NOTICE 'faz2a dolum: % saglayici olusturuldu', n;
END $$;

-- Var olan saglayicilarda alt profil eksikse tamamla (guvence; ensure zaten yapar)
INSERT INTO public.professional_profiles (provider_id, bio)
SELECT pr.id, p.bio
  FROM public.providers pr JOIN public.profiles p ON p.id = pr.id
 WHERE pr.provider_type = 'professional'
   AND NOT EXISTS (SELECT 1 FROM public.professional_profiles pp WHERE pp.provider_id = pr.id)
ON CONFLICT (provider_id) DO NOTHING;

INSERT INTO public.organization_profiles (provider_id, about)
SELECT pr.id, p.bio
  FROM public.providers pr JOIN public.profiles p ON p.id = pr.id
 WHERE pr.provider_type = 'organization'
   AND NOT EXISTS (SELECT 1 FROM public.organization_profiles op WHERE op.provider_id = pr.id)
ON CONFLICT (provider_id) DO NOTHING;

COMMIT;
