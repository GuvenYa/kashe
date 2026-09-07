-- =============================================================================
-- FAZ -1 / 05 — Tetikleyiciler (6)
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- GRUP A tetikleyicileri. Tanimlar tetikleyiciler.csv'deki pg_get_triggerdef
-- ciktisindan BIREBIR alinmistir.
--
-- BAGIMLILIK: protect_profile_fields -> protect_sensitive_profile_fields (04)
--             -> is_admin (02). Bu dosya 02 ve 04'ten SONRA kosmali.
--
-- YAZILMAYAN: messages_update_conversation.
--   Repoda var, uretimde YOK. 04-sema-uzlastirma.md bolum 3'te olu kod olarak
--   isaretlendi; uretimde yalniz on_message_insert_update_conversation calisiyor.
--
-- CREATE TRIGGER IF NOT EXISTS PostgreSQL'de yoktur; idempotanlik
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER ile saglanir.
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

-- trg_remove_assignments_on_leave (agency_members)
DROP TRIGGER IF EXISTS trg_remove_assignments_on_leave ON public.agency_members;
CREATE TRIGGER trg_remove_assignments_on_leave AFTER DELETE ON public.agency_members FOR EACH ROW EXECUTE FUNCTION fn_remove_assignments_on_leave();

-- trg_blog_posts_updated_at (blog_posts)
DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION set_blog_posts_updated_at();

-- trg_assignee_added (conversation_assignees)
DROP TRIGGER IF EXISTS trg_assignee_added ON public.conversation_assignees;
CREATE TRIGGER trg_assignee_added AFTER INSERT ON public.conversation_assignees FOR EACH ROW EXECUTE FUNCTION fn_assignee_added_message();

-- trg_assignee_removed (conversation_assignees)
DROP TRIGGER IF EXISTS trg_assignee_removed ON public.conversation_assignees;
CREATE TRIGGER trg_assignee_removed AFTER DELETE ON public.conversation_assignees FOR EACH ROW EXECUTE FUNCTION fn_assignee_removed_message();

-- protect_profile_fields (profiles)
DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_sensitive_profile_fields();

-- set_packages_updated_at (service_packages)
DROP TRIGGER IF EXISTS set_packages_updated_at ON public.service_packages;
CREATE TRIGGER set_packages_updated_at BEFORE UPDATE ON public.service_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
