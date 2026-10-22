-- =============================================================================
-- HIJYEN 04 / DB 01 — silinen kaydin bildirimi temizlenir
-- Kaynak: docs/envanter/20-faz8-event-os-modulleri.md bolum 4 (8b-P2 kalem 4) ve bolum 7.
--
-- Sorun: firsat (crm_leads) ya da genel gorev (tasks, event_id NULL) silinince ona isaret eden `notifications`
-- satiri kaliyor; baglanti artik olmayan kayda gidiyor ("Sana firsat atandi" -> bos pano).
-- Cozum: AYRI, kucuk AFTER DELETE tetikleyicileri (mevcut fn_faz8a/8b_*_activity fonksiyonlarina DOKUNULMAZ):
--   fn_hijyen04_lead_notif_cleanup  — type 'crm',  link = '/ajans/musteriler?firsat=<id>'
--   fn_hijyen04_task_notif_cleanup  — type 'task', link = '/kurulus/gorevler?gorev=<id>' (etkinlige bagli gorevin baglantisi
--                                     etkinlik sekmesine gider, kayit silinse de gecerli — ona dokunulmaz)
-- Okunmus/okunmamis ayrimi yok: hedefi olmayan bildirim listede durmasin. E-posta kuyrugu (email_notified_at NULL) da silinir —
-- silinen kayit icin e-posta gitmesi zaten yanlis olurdu.
-- Idempotan. Sapkali harf yok; yorumlar ASCII.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_hijyen04_lead_notif_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.notifications
   WHERE type = 'crm' AND link = '/ajans/musteriler?firsat=' || OLD.id::text;
  RETURN OLD;
END;
$$;
COMMENT ON FUNCTION public.fn_hijyen04_lead_notif_cleanup() IS
  'Hijyen 04: firsat silinince ona isaret eden crm bildirimleri silinir (baglanti olmayan kayda gitmesin).';

CREATE OR REPLACE FUNCTION public.fn_hijyen04_task_notif_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.notifications
   WHERE type = 'task' AND link = '/kurulus/gorevler?gorev=' || OLD.id::text;
  RETURN OLD;
END;
$$;
COMMENT ON FUNCTION public.fn_hijyen04_task_notif_cleanup() IS
  'Hijyen 04: genel gorev (etkinliksiz) silinince ona isaret eden task bildirimleri silinir.';

DROP TRIGGER IF EXISTS trg_hijyen04_lead_notif_cleanup ON public.crm_leads;
CREATE TRIGGER trg_hijyen04_lead_notif_cleanup
  AFTER DELETE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_hijyen04_lead_notif_cleanup();

DROP TRIGGER IF EXISTS trg_hijyen04_task_notif_cleanup ON public.tasks;
CREATE TRIGGER trg_hijyen04_task_notif_cleanup
  AFTER DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_hijyen04_task_notif_cleanup();

-- Dolum: bugune kadar sahipsiz kalmis bildirimler (hedef kayit yok)
DELETE FROM public.notifications n
 WHERE n.type = 'crm' AND n.link LIKE '/ajans/musteriler?firsat=%'
   AND NOT EXISTS (SELECT 1 FROM public.crm_leads l WHERE '/ajans/musteriler?firsat=' || l.id::text = n.link);
DELETE FROM public.notifications n
 WHERE n.type = 'task' AND n.link LIKE '/kurulus/gorevler?gorev=%'
   AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE '/kurulus/gorevler?gorev=' || t.id::text = n.link);

COMMIT;
