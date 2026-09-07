-- =============================================================================
-- FAZ -1 / 03 — Kalan yetki fonksiyonlari (3)
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- GRUP A'da olan yetki fonksiyonlari.
--
-- ATLANANLAR (GRUP D — repoda da uretimde de var, kural 4 geregi dokunulmadi):
--   has_business_role, is_business_member, has_business_role_on_request, is_business_member_of_request
--
-- GOVDE: fonksiyon-govdeleri-*.csv
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

-- is_assignee
CREATE OR REPLACE FUNCTION public.is_assignee(conv_id uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.conversation_assignees ca
    where ca.conversation_id = conv_id and ca.professional_id = uid
  );
$function$;

-- is_professional_or_agency
CREATE OR REPLACE FUNCTION public.is_professional_or_agency(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('professional', 'agency')
  );
$function$;

-- owns_quote_request
CREATE OR REPLACE FUNCTION public.owns_quote_request(req_id uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.quote_requests
    where id = req_id and customer_id = uid
  );
$function$;

COMMIT;
