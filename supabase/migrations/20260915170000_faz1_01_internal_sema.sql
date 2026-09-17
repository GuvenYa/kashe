-- =============================================================================
-- FAZ 1 / 01 — internal semasi iskeleti: sema, erisim kilidi, denetim tablosu, erisim kalibi
--
-- Kaynak: docs/architecture/02-guvenlik-modeli.md bolum 1-3 ("politikayla degil, insaatla guvenli"),
--         01-veri-modeli.md bolum 8, 04-goc-plani.md "FAZ 1", CLAUDE.md degismez kural 1.
-- Plan ve kararlar: docs/envanter/09-faz1-internal-sema.md
--
-- NE YAPAR (yalniz ekleme, veri yok):
--   1) internal semasi. PostgREST'e ACILMAZ (Dashboard > API > Exposed schemas listesine eklenmez;
--      T10 ve asama6 bunu authenticator rolunun pgrst.db_schemas ayarindan dogrular).
--      anon / authenticated / service_role icin sema uzerinde USAGE YOK -> icindeki hicbir nesneye
--      hicbir GRANT ile ulasilamaz. 09_platform_katmani'nin ALTER DEFAULT PRIVILEGES'i yalniz
--      public semasi icindir; internal icin ayrica REVOKE varsayilanlari yazilir.
--   2) internal.access_audit: her internal erisimi buraya duser (02 bolum 3). Yalniz ekleme
--      (append-only): UPDATE/DELETE hicbir role verilmez. organization_id ve actor_user_id'de
--      FK YOK — kurulus/profil silinse de denetim kaydi kalir.
--   3) Erisim kalibi (internal semasinda, istemciden cagrilamaz):
--        internal.request_ip()                         istek IP'si (PostgREST request.headers)
--        internal.log_access(org, action, tablo, id, detail)  denetim satiri yazar
--        internal.assert_org_permission(org, izin, tablo, id) has_org_permission degilse
--                                                       'yetkisiz erisim' (42501) firlatir
--   4) Ilk somut RPC — kalibin ornegi ve kullanimi:
--        public.internal_audit_recent(p_org_id, p_limit)  kurulusun denetim kayitlarini
--        settings.manage yetkisiyle dondurur; okuma da denetime yazilir.
--      KARAR (15 Eylul, Guven): uygulamanin cagiracagi RPC'ler public semasinda `internal_` onekiyle
--      durur (02'deki `internal_api.` yerine); ek API ayari gerekmez. Guvenlik siniri sema adi degil,
--      SECURITY DEFINER + has_org_permission + denetimdir.
--      KARAR: service_role da internal'a dogrudan erisemez (uygulamada service-role istemcisi yok;
--      gerekirse ileride tek GRANT ile acilir).
--
-- NOT — reddedilen denemeler denetime YAZILMAZ: RAISE ayni islemi geri aldigi icin (PostgREST
--   hata -> rollback) 'denied' satiri kalici olamaz. Reddetme, 42501 hatasinin kendisiyle gorunur.
--
-- KALICI KURAL: internal'a eklenen her tablo icin ayni migration'da RLS acilir, REVOKE ALL yazilir,
--   erisim yalniz public.internal_* SECURITY DEFINER fonksiyonuyla verilir ve fonksiyon
--   internal.assert_org_permission + internal.log_access cagirir.
--
-- Idempotan: IF NOT EXISTS / CREATE OR REPLACE. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Sema ve erisim kilidi
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS internal AUTHORIZATION postgres;

COMMENT ON SCHEMA internal IS
  'Ic maliyet, marj, ozel not (FAZ 1). PostgREST''e ACILMAZ. anon/authenticated/service_role USAGE almaz; erisim yalniz public.internal_* SECURITY DEFINER fonksiyonlariyla (uyelik + rol kontrolu + denetim).';

REVOKE ALL ON SCHEMA internal FROM PUBLIC;
REVOKE ALL ON SCHEMA internal FROM anon, authenticated, service_role;

-- Bu semada ileride olusacak nesneler icin varsayilan yetki: hic
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA internal REVOKE ALL ON TABLES    FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA internal REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA internal REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) Denetim tablosu — append-only
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal.access_audit (
  id              bigserial PRIMARY KEY,
  organization_id uuid,                                  -- FK yok: kurulus silinse de kayit kalir
  actor_user_id   uuid,                                  -- auth.uid(); FK yok
  actor_role      text,                                  -- JWT role claim (authenticated / service_role)
  action          text NOT NULL,                         -- 'read' | 'write'
  target_table    text NOT NULL,                         -- internal.* tablo adi (sema oneki olmadan)
  target_id       uuid,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip              text,                                  -- x-forwarded-for / x-real-ip
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_audit_action_check CHECK (action IN ('read', 'write'))
);

CREATE INDEX IF NOT EXISTS access_audit_org_created_idx   ON internal.access_audit (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_audit_actor_created_idx ON internal.access_audit (actor_user_id, created_at DESC);

ALTER TABLE internal.access_audit ENABLE ROW LEVEL SECURITY;   -- politika yok: sahibi disinda kimse okuyamaz
REVOKE ALL ON internal.access_audit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE internal.access_audit_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Erisim kalibi (internal semasinda; istemci USAGE'i olmadigi icin cagiramaz)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internal.request_ip()
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = internal, public
AS $$
DECLARE
  h jsonb;
BEGIN
  h := NULLIF(current_setting('request.headers', true), '')::jsonb;
  RETURN COALESCE(split_part(h ->> 'x-forwarded-for', ',', 1), h ->> 'x-real-ip');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION internal.log_access(
  p_org_id uuid, p_action text, p_target_table text, p_target_id uuid DEFAULT NULL, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER
SET search_path = internal, public
AS $$
  INSERT INTO internal.access_audit (organization_id, actor_user_id, actor_role, action, target_table, target_id, detail, ip)
  VALUES (
    p_org_id,
    auth.uid(),
    COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
             NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    p_action, p_target_table, p_target_id, COALESCE(p_detail, '{}'::jsonb), internal.request_ip())
  RETURNING id
$$;

CREATE OR REPLACE FUNCTION internal.assert_org_permission(
  p_org_id uuid, p_permission text, p_target_table text, p_target_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = internal, public
AS $$
BEGIN
  IF p_org_id IS NULL OR NOT public.has_org_permission(p_org_id, p_permission) THEN
    RAISE EXCEPTION 'yetkisiz erisim: % icin % gerekir', p_target_table, p_permission
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION internal.request_ip()                                   FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION internal.log_access(uuid, text, text, uuid, jsonb)      FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION internal.assert_org_permission(uuid, text, text, uuid)  FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) Ilk RPC — kalibin uygulanmis hali. Yeni internal_* fonksiyonlari bu sirayi izler:
--    assert_org_permission -> log_access -> sorgu.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_audit_recent(p_org_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id bigint, actor_user_id uuid, actor_role text, action text, target_table text,
  target_id uuid, detail jsonb, ip text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'settings.manage', 'access_audit');
  PERFORM internal.log_access(p_org_id, 'read', 'access_audit', NULL, jsonb_build_object('limit', v_limit));

  RETURN QUERY
    SELECT a.id, a.actor_user_id, a.actor_role, a.action, a.target_table, a.target_id, a.detail, a.ip, a.created_at
      FROM internal.access_audit a
     WHERE a.organization_id = p_org_id
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_audit_recent(uuid, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_audit_recent(uuid, integer) TO authenticated;

COMMIT;
