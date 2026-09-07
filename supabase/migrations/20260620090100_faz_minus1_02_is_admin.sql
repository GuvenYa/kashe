-- =============================================================================
-- FAZ -1 / 02 — is_admin()
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- TEK FONKSIYON, TEK BASINA — bagimlilik zincirinin kokunde.
--
--   is_admin()  ->  protect_sensitive_profile_fields()  ->  protect_profile_fields tetikleyicisi
--
-- protect_sensitive_profile_fields govdesinin ILK satiri:
--     if public.is_admin(auth.uid()) then return new; end if;
-- Bu yuzden is_admin, 04'ten ve 05'ten ONCE olusturulmalidir.
--
-- GOVDE: fonksiyon-govdeleri-*.csv (pg_get_functiondef ciktisi, uretimden birebir)
--
-- KURALLAR (bu dosyalarin tamaminda gecerli):
--   * VERI DEGISTIRILMEZ — hicbir INSERT/UPDATE/DELETE yoktur, yalniz DDL.
--   * CATISMADA URETIM KAZANIR — govdeler uretim dokumundan birebir alinmistir.
--   * IDEMPOTENT — dosya iki kez kosturulsa da hata vermez.
--   * GRUP D'ye (repoda da uretimde de ayni olan nesneler) DOKUNULMAZ.
--
-- UYGULAMA: Supabase Dashboard > SQL Editor. Terminale yapistirilmaz.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select is_admin from public.profiles where id = uid),
    false
  );
$function$;

COMMIT;
