-- =============================================================================
-- FAZ -1 / 09 — Platform katmani (public semasi DISINDA kalan, zincirde hic olmayan nesneler)
--
-- KAYNAK: docs/envanter/asama2-parmak-izi.sql + asama2b-ayrinti.sql ciktilari
--         (uretim qydsooqmflrrwtgawhsv ve dal pkyauwyszvfvbzcgzrdb, 14 Eylul 2026).
--         public semasi 9 sinifta birebir esit cikti; farklar tamamen bu dosyanin konusu.
--
-- Bu nesneler uretime Dashboard'dan kuruldu, hicbir migration dosyasinda yok:
--
--   1) auth.users uzerindeki kayit tetikleyicisi (on_auth_user_created -> handle_new_user)
--      Olmadan: kayit olan kullanicinin profiles satiri olusmaz.
--   2) supabase_realtime yayinina Dashboard'dan eklenmis 4 tablo
--      (conversations, listing_invitations, messages, notifications)
--   3) 6 storage bucket + storage.objects uzerindeki 21 politika
--      Olmadan: avatar/portfolyo/ek dosya yukleme ve okuma calismaz.
--   4) Tablo, sequence, fonksiyon ve varsayilan ayricaliklar (GRANT)
--   5) pg_cron uzantisi (is tanimi haric, bkz. bolum 5)
--   6) listing_invitations REPLICA IDENTITY FULL
--      Uretim: anon/authenticated/service_role 37 tablo/view'da tam yetkili (arwdDxtm),
--      sequence'lerde rwU, ve postgres icin ALTER DEFAULT PRIVILEGES tanimli.
--      Dal (Eylul 2026'da acilan proje): varsayilan ayricaliklar farkli geldi —
--      anon/authenticated/service_role yalniz REFERENCES/TRIGGER/TRUNCATE/MAINTAIN aliyor,
--      SELECT/INSERT/UPDATE/DELETE YOK; sequence ve fonksiyon varsayilani hic yok.
--      Olmadan: RLS'e gelmeden GRANT katmaninda her sorgu "permission denied" ile duser.
--      NOT: Fonksiyon ayricaliklari bu dosyada fonksiyon bazinda verilir (bolum 4c);
--      toptan GRANT EXECUTE, migration'larla bilincli REVOKE edilmis fonksiyonlari
--      (admin_report_stats vb.) yeniden acardi.
--
-- ZAMAN DAMGASI: 20260727160000 — zincirin SONU (ondan onceki son dosya 20260727150000).
-- Bilincli: bu dosya fonksiyon bazinda GRANT verir ve tum tablolara yetki dagitir; nesnelerin
-- tamami ancak zincir sonunda vardir (business_member_role tipi 20260630'da, admin_report_stats
-- 20260715'te dogar). 202606200908xx konumunda denendi, "type business_member_role does not
-- exist" ile durdu. Diger faz_minus1 dosyalari (00-08) yerlerinde kalir.
--
-- KURALLAR:
--   * CATISMADA URETIM KAZANIR — tanimlar uretim ciktisindan birebir.
--   * IDEMPOTENT — uretimde kosturulunca hicbir sey degismez (kontroller pg_* kataloglariyla).
--   * VERI DEGISTIRILMEZ kuralinin TEK bilincli istisnasi: storage.buckets satirlari.
--     Bunlar uygulama verisi degil, bucket yapilandirmasidir; ON CONFLICT DO NOTHING ile
--     uretimdeki satirlara dokunulmaz.
--
-- UYGULAMA: Supabase Dashboard > SQL Editor. Terminale yapistirilmaz.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) auth.users kayit tetikleyicisi — uretim tanimi birebir
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Realtime yayini — Dashboard'dan eklenmis 4 tablo
-- Zincir 7 tabloyu ekliyor (quotes, listings, applications, agency_*, business_*).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations','listing_invitations','messages','notifications'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3a) Storage bucket'lari (6) — public bayragi, boyut siniri ve MIME listesi uretimden
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('application-attachments', 'application-attachments', false, 20971520,
   ARRAY['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('avatars', 'avatars', true, 2097152,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('blog', 'blog', true, NULL, NULL),
  ('message-attachments', 'message-attachments', false, 20971520,
   ARRAY['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('portfolio', 'portfolio', true, 52428800,
   ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']),
  ('quote-attachments', 'quote-attachments', false, 20971520, NULL)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3b) storage.objects politikalari (21) — pg_policies ciktisindan birebir
-- DROP IF EXISTS + CREATE ayni islemde: uretimde sonuc degismez.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Applicant and listing owner read application attachments" ON storage.objects;
CREATE POLICY "Applicant and listing owner read application attachments" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (((bucket_id = 'application-attachments'::text) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN listings l ON ((l.id = a.listing_id)))
  WHERE ((a.attachment_path = objects.name) AND ((a.applicant_id = auth.uid()) OR (l.creator_id = auth.uid())))))));

DROP POLICY IF EXISTS "Conversation parties read message attachments" ON storage.objects;
CREATE POLICY "Conversation parties read message attachments" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (((bucket_id = 'message-attachments'::text) AND (EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.attachment_path = objects.name) AND ((c.customer_id = auth.uid()) OR (c.professional_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM conversation_assignees ca
          WHERE ((ca.conversation_id = c.id) AND (ca.professional_id = auth.uid()))))))))));

DROP POLICY IF EXISTS "Customer and recipients read quote attachments" ON storage.objects;
CREATE POLICY "Customer and recipients read quote attachments" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (((bucket_id = 'quote-attachments'::text) AND (EXISTS ( SELECT 1
   FROM (quote_requests qr
     LEFT JOIN quote_request_recipients qrr ON ((qrr.request_id = qr.id)))
  WHERE ((qr.attachment_path = objects.name) AND ((qr.customer_id = auth.uid()) OR (qrr.professional_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users delete own application attachments" ON storage.objects;
CREATE POLICY "Users delete own application attachments" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (((bucket_id = 'application-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users delete own message attachments" ON storage.objects;
CREATE POLICY "Users delete own message attachments" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (((bucket_id = 'message-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users delete own quote attachments" ON storage.objects;
CREATE POLICY "Users delete own quote attachments" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (((bucket_id = 'quote-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users upload own application attachments" ON storage.objects;
CREATE POLICY "Users upload own application attachments" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (((bucket_id = 'application-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users upload own message attachments" ON storage.objects;
CREATE POLICY "Users upload own message attachments" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (((bucket_id = 'message-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users upload own quote attachments" ON storage.objects;
CREATE POLICY "Users upload own quote attachments" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (((bucket_id = 'quote-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
CREATE POLICY "avatars_read_all" ON storage.objects
  FOR SELECT
  TO public
  USING ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "blog_storage_admin_delete" ON storage.objects;
CREATE POLICY "blog_storage_admin_delete" ON storage.objects
  FOR DELETE
  TO public
  USING (((bucket_id = 'blog'::text) AND is_admin(auth.uid())));

DROP POLICY IF EXISTS "blog_storage_admin_update" ON storage.objects;
CREATE POLICY "blog_storage_admin_update" ON storage.objects
  FOR UPDATE
  TO public
  USING (((bucket_id = 'blog'::text) AND is_admin(auth.uid())));

DROP POLICY IF EXISTS "blog_storage_admin_write" ON storage.objects;
CREATE POLICY "blog_storage_admin_write" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (((bucket_id = 'blog'::text) AND is_admin(auth.uid())));

DROP POLICY IF EXISTS "blog_storage_public_read" ON storage.objects;
CREATE POLICY "blog_storage_public_read" ON storage.objects
  FOR SELECT
  TO public
  USING ((bucket_id = 'blog'::text));

DROP POLICY IF EXISTS "portfolio_delete_own" ON storage.objects;
CREATE POLICY "portfolio_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (((bucket_id = 'portfolio'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "portfolio_insert_own" ON storage.objects;
CREATE POLICY "portfolio_insert_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (((bucket_id = 'portfolio'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "portfolio_read_all" ON storage.objects;
CREATE POLICY "portfolio_read_all" ON storage.objects
  FOR SELECT
  TO public
  USING ((bucket_id = 'portfolio'::text));

DROP POLICY IF EXISTS "portfolio_update_own" ON storage.objects;
CREATE POLICY "portfolio_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (((bucket_id = 'portfolio'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- -----------------------------------------------------------------------------
-- 4a) Tablo/view ve sequence ayricaliklari — uretim durumu (37 nesnede ALL)
-- GRANT idempotandir; uretimde zaten verili oldugu icin etkisizdir.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4b) Varsayilan ayricaliklar — bundan sonra postgres'in olusturacagi nesneler icin
-- Uretim (N3): postgres r/S/f -> anon, authenticated, service_role tam yetki.
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4c) Fonksiyon ayricaliklari — fonksiyon bazinda, uretim proacl dokumunden (asama2c)
-- Uretimde 63 fonksiyon: PUBLIC + anon + authenticated + service_role EXECUTE
-- (uretim varsayilan ACL'inin sonucu). 6 fonksiyon migration'larla bilincli daraltilmis,
-- onlar asagida ayri. GRANT/REVOKE idempotan: uretimde durum degismez, dalda eksik tamamlanir.
-- Toptan 'GRANT EXECUTE ON ALL FUNCTIONS' kullanilmadi: daraltilmislari yeniden acardi.
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_booking_daily(p_days integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_booking_summary(p_days integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_funnel_client() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_funnel_professional() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_ops_application_response(p_days integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_ops_listing_to_first_app(p_days integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_ops_message_response(p_days integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_queue_counts() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_recent_actions(p_limit integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_retention_incomplete_pros() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_retention_listings_no_apps() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_retention_pros_no_apps() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_active_categories() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_active_users() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_categories() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_cities() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_quotes() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_registrations(p_days integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_supply_demand_category() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_supply_demand_city() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_top_favorited() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_top_rated() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_top_viewed() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_weekly_compare() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_weekly_trend() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_assignee_added_message() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_assignee_removed_message() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_remove_assignments_on_leave() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_business_role(p_business_id uuid, p_min_role business_member_role) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_business_role_on_request(p_request_id uuid, p_min_role business_member_role) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_profile_views(profile_id_param uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uid uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_assignee(conv_id uuid, uid uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_member(p_business_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_member_of_request(p_request_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_professional_or_agency(uid uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_new_message() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_new_review() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_quote_request_recipients(recipient_ids uuid[], notif_link text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_review_reply() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_agency_invitation_accepted_add_member() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_agency_invitation_insert_notify() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_agency_member_insert_notify_agency() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_application_insert_notify_owner() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_application_status_change_notify_applicant() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_business_invitation_accepted_add_member() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_business_invitation_insert_notify() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_business_member_insert_notify_business() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_quote_accepted_create_booking() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_quote_insert_notify_customer() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_quote_responded_notify_professional() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_quote_status_change_post_system_message() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_quote_request(req_id uuid, uid uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.protect_sensitive_profile_fields() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_blog_posts_updated_at() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_listing_published_at() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_review_updated_at() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_conversation_last_message_at() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_agency_membership_roles() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_business_membership_roles() TO PUBLIC, anon, authenticated, service_role;

-- Daraltilmis 6 fonksiyon — uretim proacl birebir:
GRANT EXECUTE ON FUNCTION public.admin_report_stats() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_report_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats_messages(p_days integer) TO PUBLIC, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_stats_messages(p_days integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.deal_confirmed_customer_ids(p_professional uuid, p_customers uuid[]) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.deal_confirmed_customer_ids(p_professional uuid, p_customers uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription_by_endpoint(target_endpoint text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.delete_push_subscription_by_endpoint(target_endpoint text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_push_subscriptions_for_user(target_user_id uuid) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_push_subscriptions_for_user(target_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_application_counts(listing_ids uuid[]) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.listing_application_counts(listing_ids uuid[]) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 5) pg_cron uzantisi — uretimde var (1.6.4), dalda yok
-- Uretimdeki tek is "send-message-notifications" (*/5 dk, net.http_post ile uretim Edge
-- Function'ina istek) BILEREK burada tanimlanmaz: URL ve anahtar uretim projesine aittir,
-- dalda Edge Function yoktur; dal bu isi calistirsa uretim fonksiyonunu tetiklerdi.
-- Is tanimi docs/envanter/06-bos-db-zincir-testi.md bolum 6'da (anahtar maskelenmis).
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------------------------------------
-- 6) Replica identity — uretimde 9 tabloda FULL, zincir 8'ini kuruyor
-- listing_invitations 01'de olusur; FULL ayari uretime Dashboard'dan verilmis.
-- -----------------------------------------------------------------------------
ALTER TABLE public.listing_invitations REPLICA IDENTITY FULL;

COMMIT;
