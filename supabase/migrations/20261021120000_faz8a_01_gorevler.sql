-- =============================================================================
-- FAZ 8a / DB 01 — Gorevler + aktivite gecmisi (Event OS ilk dilim)
-- Kaynak: docs/envanter/20-faz8-event-os-modulleri.md bolum 3
--
-- Nesneler:
--   enum task_status (todo, in_progress, blocked, done, cancelled)
--   tasks            — kurulusun gorevi; etkinlige bagli (event_id) ya da genel (NULL); uyeye ya da
--                      havuz kaydina atanir; kilometre tasi; bagimlilik; sort_order
--   activity_logs    — kullaniciya gorunen akis ("kim / ne / ne zaman"); INSERT yalniz tetikleyici
--                      (uygulamaya INSERT yok); SELECT events.view. internal.access_audit (erisim
--                      denetimi) ile AYRI kalir.
--   tetikleyiciler   — modul kapisi (tasks modulu kapaliysa INSERT 22023), kurulus sabit, atanan uye /
--                      havuz kaydi / ekip / bagimlilik ayni kurulus, completed_at, updated_at, silme yalniz
--                      todo/cancelled, aktivite + bildirim (atama ve blocked -> notifications tip 'task')
--   RLS              — SELECT events.view (admin dahil), INSERT/UPDATE/DELETE events.manage; dogrudan CRUD
--                      (FAZ 7'nin aksine RPC yok: ticari risk yok)
--   modul            — ajans kuruluslarinda 'tasks' VARSAYILAN ACIK (mevcutlara dolum + yeni ajansa
--                      tetikleyici, FAZ 5 talent_pool deseni); business kapali, sahip/yonetici acar:
--                      RPC org_module_set(org, key, enabled) (settings.manage; log_access)
--   bildirim         — notifications_type_check + 'task'; e-posta kuyrugu indeksi 'task' dahil
-- tasks.* yetki anahtari EKLENMEZ: gorev etkinlik operasyonudur (events.view okur, events.manage yazar).
-- Idempotan (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS). Sapkali harf yok; yorumlar ASCII;
-- kullaniciya giden metinler Turkce karakterli (hijyen_02 dersi).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Enum
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' AND t.typname = 'task_status') THEN
    CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. tasks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id                  uuid REFERENCES public.events(id) ON DELETE SET NULL,
  crew_id                   uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  title                     text NOT NULL,
  description               text,
  status                    public.task_status NOT NULL DEFAULT 'todo',
  assignee_user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_talent_record_id uuid REFERENCES public.organization_talent_records(id) ON DELETE SET NULL,
  due_at                    timestamptz,
  is_milestone              boolean NOT NULL DEFAULT false,
  depends_on_task_id        uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  sort_order                integer NOT NULL DEFAULT 0,
  created_by                uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_title_check       CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
  CONSTRAINT tasks_description_check CHECK (description IS NULL OR char_length(description) <= 4000),
  CONSTRAINT tasks_no_self_dep_check CHECK (depends_on_task_id IS NULL OR depends_on_task_id <> id)
);
COMMENT ON TABLE public.tasks IS
  'FAZ 8a: kurulus gorevi. event_id NULL = kurulus geneli. Atama: uye (assignee_user_id) ya da havuz kaydi (assignee_talent_record_id; ajans). Yazma dogrudan (RLS events.manage), kurallar tetikleyicide.';

CREATE INDEX IF NOT EXISTS tasks_org_status_idx   ON public.tasks (organization_id, status);
CREATE INDEX IF NOT EXISTS tasks_event_id_idx     ON public.tasks (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_assignee_open_idx ON public.tasks (assignee_user_id)
  WHERE assignee_user_id IS NOT NULL AND status NOT IN ('done', 'cancelled');
CREATE INDEX IF NOT EXISTS tasks_due_at_idx       ON public.tasks (organization_id, due_at) WHERE due_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. activity_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  action          text NOT NULL,
  diff            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_entity_type_check CHECK (entity_type IN ('task', 'event', 'proposal', 'rfp', 'booking', 'membership', 'crew')),
  CONSTRAINT activity_logs_action_check      CHECK (action IN ('created', 'updated', 'status_changed', 'assigned', 'deleted')),
  CONSTRAINT activity_logs_diff_check        CHECK (jsonb_typeof(diff) = 'object')
);
COMMENT ON TABLE public.activity_logs IS
  'FAZ 8a: kullaniciya gorunen aktivite akisi (kim/ne/ne zaman). INSERT yalniz tetikleyici/RPC; uygulamaya INSERT yok. internal.access_audit ile ayri.';

CREATE INDEX IF NOT EXISTS activity_logs_org_created_idx ON public.activity_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_entity_idx      ON public.activity_logs (entity_type, entity_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Tetikleyiciler — kurallar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz8a_task_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- modul kapisi: RLS yetkidir, modul kapisi burada (uygulama kapisi ile ayni kural)
    IF NOT public.org_module_enabled(NEW.organization_id, 'tasks') THEN
      RAISE EXCEPTION 'gorev modulu bu kurulusta kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSE
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'gorevin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;

  -- etkinlik ayni kurulusun olmali
  IF NEW.event_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.events WHERE id = NEW.event_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'etkinlik bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  -- ekip ayni kurulusun olmali
  IF NEW.crew_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.crews WHERE id = NEW.crew_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'ekip bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  -- atanan uye: kurulusun aktif uyesi
  IF NEW.assignee_user_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.organization_memberships om
        WHERE om.organization_id = NEW.organization_id AND om.user_id = NEW.assignee_user_id AND om.status = 'active') THEN
    RAISE EXCEPTION 'atanan kisi kurulusun aktif uyesi degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- atanan havuz kaydi: ayni kurulus
  IF NEW.assignee_talent_record_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.organization_talent_records WHERE id = NEW.assignee_talent_record_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'havuz kaydi bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  -- bagimlilik: ayni kurulus
  IF NEW.depends_on_task_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.tasks WHERE id = NEW.depends_on_task_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'bagli gorev bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  -- completed_at durumla birlikte
  IF NEW.status = 'done' THEN
    IF TG_OP = 'INSERT' OR OLD.status <> 'done' OR NEW.completed_at IS NULL THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8a_task_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Kademeli silme (kurulus silinirken RI tetikleyicisi) serbest; dogrudan silme yalniz todo/cancelled
  IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  IF OLD.status NOT IN ('todo', 'cancelled') THEN
    RAISE EXCEPTION 'yalniz yapilacak ya da iptal durumundaki gorev silinir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN OLD;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Tetikleyici — aktivite + bildirim
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz8a_task_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor  uuid := auth.uid();
  v_action text;
  v_diff   jsonb := '{}'::jsonb;
  v_link   text;
  v_row    public.tasks;
BEGIN
  -- kademeli silme: kurulus gidiyor, log yazilmaz
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_link := CASE WHEN v_row.event_id IS NOT NULL
                 THEN '/etkinliklerim/' || v_row.event_id::text || '?sekme=gorevler'
                 ELSE '/kurulus/gorevler?gorev=' || v_row.id::text END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := jsonb_build_object('title', NEW.title, 'status', NEW.status, 'event_id', NEW.event_id,
                                 'assignee_user_id', NEW.assignee_user_id,
                                 'assignee_talent_record_id', NEW.assignee_talent_record_id, 'due_at', NEW.due_at);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_diff := jsonb_build_object('title', OLD.title, 'status', OLD.status);
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := 'status_changed';
      v_diff := v_diff || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id
       OR NEW.assignee_talent_record_id IS DISTINCT FROM OLD.assignee_talent_record_id THEN
      v_action := COALESCE(v_action, 'assigned');
      v_diff := v_diff || jsonb_build_object(
        'assignee_user_id', jsonb_build_object('from', OLD.assignee_user_id, 'to', NEW.assignee_user_id),
        'assignee_talent_record_id', jsonb_build_object('from', OLD.assignee_talent_record_id, 'to', NEW.assignee_talent_record_id));
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      v_diff := v_diff || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title)); END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      v_diff := v_diff || jsonb_build_object('description', true); END IF;
    IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
      v_diff := v_diff || jsonb_build_object('due_at', jsonb_build_object('from', OLD.due_at, 'to', NEW.due_at)); END IF;
    IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      v_diff := v_diff || jsonb_build_object('event_id', jsonb_build_object('from', OLD.event_id, 'to', NEW.event_id)); END IF;
    IF NEW.is_milestone IS DISTINCT FROM OLD.is_milestone THEN
      v_diff := v_diff || jsonb_build_object('is_milestone', jsonb_build_object('from', OLD.is_milestone, 'to', NEW.is_milestone)); END IF;
    IF NEW.depends_on_task_id IS DISTINCT FROM OLD.depends_on_task_id THEN
      v_diff := v_diff || jsonb_build_object('depends_on_task_id', jsonb_build_object('from', OLD.depends_on_task_id, 'to', NEW.depends_on_task_id)); END IF;
    IF NEW.crew_id IS DISTINCT FROM OLD.crew_id THEN
      v_diff := v_diff || jsonb_build_object('crew_id', jsonb_build_object('from', OLD.crew_id, 'to', NEW.crew_id)); END IF;
    -- yalniz sort_order / updated_at degistiyse log yazilmaz
    IF v_diff = '{}'::jsonb THEN RETURN NEW; END IF;
    v_action := COALESCE(v_action, 'updated');
  END IF;

  INSERT INTO public.activity_logs (organization_id, actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_row.organization_id, v_actor, 'task', v_row.id, v_action, v_diff);

  -- bildirim: atama (uyeye; kendine atama haric)
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.assignee_user_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id)
     AND NEW.assignee_user_id IS DISTINCT FROM v_actor THEN
    INSERT INTO public.notifications (user_id, type, link, body)
    VALUES (NEW.assignee_user_id, 'task', v_link, 'Sana görev atandı: ' || NEW.title);
  END IF;
  -- bildirim: engellendi (olusturan ve atanan; islemi yapan haric)
  IF TG_OP = 'UPDATE' AND NEW.status = 'blocked' AND OLD.status <> 'blocked' THEN
    IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM v_actor THEN
      INSERT INTO public.notifications (user_id, type, link, body)
      VALUES (NEW.created_by, 'task', v_link, 'Görev engellendi: ' || NEW.title);
    END IF;
    IF NEW.assignee_user_id IS NOT NULL AND NEW.assignee_user_id IS DISTINCT FROM v_actor
       AND NEW.assignee_user_id IS DISTINCT FROM NEW.created_by THEN
      INSERT INTO public.notifications (user_id, type, link, body)
      VALUES (NEW.assignee_user_id, 'task', v_link, 'Görev engellendi: ' || NEW.title);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_faz8a_task_validate ON public.tasks;
CREATE TRIGGER trg_faz8a_task_validate
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8a_task_validate();

DROP TRIGGER IF EXISTS trg_faz8a_task_before_delete ON public.tasks;
CREATE TRIGGER trg_faz8a_task_before_delete
  BEFORE DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8a_task_before_delete();

DROP TRIGGER IF EXISTS trg_faz8a_task_activity ON public.tasks;
CREATE TRIGGER trg_faz8a_task_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8a_task_activity();

-- -----------------------------------------------------------------------------
-- 6. Bildirim tipi 'task' + e-posta kuyrugu indeksi
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'review', 'review_reply', 'listing_invitation', 'booking_request', 'rfp', 'proposal', 'task'));

DROP INDEX IF EXISTS public.notifications_email_pending_idx;
CREATE INDEX notifications_email_pending_idx ON public.notifications (created_at)
  WHERE email_notified_at IS NULL AND type IN ('rfp', 'proposal', 'task');

-- -----------------------------------------------------------------------------
-- 7. RLS + yetki
-- -----------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'events.view') OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, 'events.manage'));
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, 'events.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'events.manage'));
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, 'events.manage'));

DROP POLICY IF EXISTS activity_logs_select ON public.activity_logs;
CREATE POLICY activity_logs_select ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'events.view') OR public.is_admin(auth.uid()));

REVOKE ALL ON public.tasks, public.activity_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.tasks, public.activity_logs TO service_role;
REVOKE ALL ON SEQUENCE public.activity_logs_id_seq FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Modul: ajansta varsayilan acik; business sahibi/yoneticisi acar
-- -----------------------------------------------------------------------------
INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
SELECT o.id, 'tasks', true, now() FROM public.organizations o WHERE o.account_type = 'agency'
ON CONFLICT (organization_id, module_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_faz5_default_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.account_type = 'agency' THEN
    INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
    VALUES (NEW.id, 'talent_pool', true, now()), (NEW.id, 'tasks', true, now())
    ON CONFLICT (organization_id, module_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_module_set(p_org_id uuid, p_module_key text, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM internal.assert_org_permission(p_org_id, 'settings.manage', 'organization_modules', p_org_id);
  IF p_module_key NOT IN ('tasks', 'crm', 'suppliers') THEN
    RAISE EXCEPTION 'bu modul buradan acilamaz: %', p_module_key USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at, enabled_by)
  VALUES (p_org_id, p_module_key, p_enabled, CASE WHEN p_enabled THEN now() END, auth.uid())
  ON CONFLICT (organization_id, module_key) DO UPDATE
    SET is_enabled = EXCLUDED.is_enabled,
        enabled_at = CASE WHEN EXCLUDED.is_enabled THEN now() ELSE organization_modules.enabled_at END,
        enabled_by = auth.uid();
  PERFORM internal.log_access(p_org_id, 'write', 'organization_modules', p_org_id,
                              jsonb_build_object('op', 'module.set', 'module', p_module_key, 'enabled', p_enabled));
  RETURN p_enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.org_module_set(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_module_set(uuid, text, boolean) TO authenticated, service_role;
COMMENT ON FUNCTION public.org_module_set(uuid, text, boolean) IS
  'FAZ 8a: kurulus modulunu ac/kapat (settings.manage). Yalniz tasks/crm/suppliers; talent_pool FAZ 5 kurali ile kalir.';

COMMIT;
