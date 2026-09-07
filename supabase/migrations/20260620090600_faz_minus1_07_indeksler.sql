-- =============================================================================
-- FAZ -1 / 07 — Indeksler (36)
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- GRUP A indeksleri (gercek eksik olanlar). indeksler.csv'deki pg_indexes.indexdef
-- ciktisindan BIREBIR alinmistir.
--
-- YAZILMAYANLAR:
--   * 35 adet *_pkey  — PRIMARY KEY kisitinin otomatik urettigi indeksler.
--     Dosya 01'deki CONSTRAINT ... PRIMARY KEY ifadeleriyle kendiliginden olusur.
--   * 18 adet *_key   — UNIQUE kisitinin otomatik urettigi indeksler.
--     Ayni sekilde dosya 01'de olusur.
--   * 1 adet indeks dosya 08'e alindi: dayandigi tablo zincirde bu
--     dosyadan SONRA olusuyor. Ayrinti icin 08'in basligina bak.
--
-- MUKERRER INDEKSLER SILINMEDI. 04-sema-uzlastirma.md bolum 5'te 9 gereksiz cift
-- tespit edildi, ama silme karari pg_stat_user_indexes olcumune baglidir ve AYRI
-- bir adimdir. Bu dosya yalniz EKSIK olanlari ekler.
--
-- CREATE INDEX IF NOT EXISTS ile idempotan.
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

-- admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_log USING btree (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log USING btree (created_at DESC);
-- agency_invitations
CREATE INDEX IF NOT EXISTS no_duplicate_pending_invitation ON public.agency_invitations USING btree (agency_id, invited_email) WHERE (status = 'pending'::agency_invitation_status);
-- availability_blocks
CREATE INDEX IF NOT EXISTS idx_availability_blocks_profile ON public.availability_blocks USING btree (profile_id, blocked_date);
-- blog_posts
CREATE INDEX IF NOT EXISTS blog_posts_slug_idx ON public.blog_posts USING btree (slug);
CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx ON public.blog_posts USING btree (status, published_at DESC);
-- bookings
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON public.bookings USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON public.bookings USING btree (event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_professional ON public.bookings USING btree (professional_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings USING btree (status);
-- category_requests
CREATE INDEX IF NOT EXISTS idx_category_requests_created ON public.category_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_category_requests_name_lower ON public.category_requests USING btree (lower(category_name));
CREATE INDEX IF NOT EXISTS idx_category_requests_status ON public.category_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_category_requests_user ON public.category_requests USING btree (user_id);
-- conversation_assignees
CREATE INDEX IF NOT EXISTS idx_conv_assignees_conversation ON public.conversation_assignees USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_assignees_professional ON public.conversation_assignees USING btree (professional_id);
-- conversations
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_pair ON public.conversations USING btree (customer_id, professional_id);
-- listing_invitations
CREATE INDEX IF NOT EXISTS listing_invitations_inviter_idx ON public.listing_invitations USING btree (inviter_id);
CREATE INDEX IF NOT EXISTS listing_invitations_listing_idx ON public.listing_invitations USING btree (listing_id);
CREATE INDEX IF NOT EXISTS listing_invitations_professional_idx ON public.listing_invitations USING btree (professional_id);
CREATE INDEX IF NOT EXISTS listing_invitations_status_idx ON public.listing_invitations USING btree (status) WHERE (status = 'pending'::listing_invitation_status);
CREATE INDEX IF NOT EXISTS no_duplicate_pending_listing_invite ON public.listing_invitations USING btree (listing_id, professional_id) WHERE (status = 'pending'::listing_invitation_status);
-- listings
CREATE INDEX IF NOT EXISTS idx_listings_featured_category ON public.listings USING btree (featured_category_until);
CREATE INDEX IF NOT EXISTS idx_listings_featured_home ON public.listings USING btree (featured_home_until);
-- message_violations
CREATE INDEX IF NOT EXISTS idx_message_violations_conv ON public.message_violations USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_violations_time ON public.message_violations USING btree (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_violations_user ON public.message_violations USING btree (user_id);
-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent_at ON public.notifications USING btree (email_sent_at);
-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles USING btree (is_admin) WHERE (is_admin = true);
CREATE INDEX IF NOT EXISTS idx_profiles_premium ON public.profiles USING btree (premium_tier, premium_until);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON public.profiles USING btree (suspended_at) WHERE (suspended_at IS NOT NULL);
-- push_subscriptions
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);
-- reports
CREATE UNIQUE INDEX IF NOT EXISTS reports_reporter_target_uniq ON public.reports USING btree (reporter_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON public.reports USING btree (status, created_at DESC);
-- service_addons
CREATE INDEX IF NOT EXISTS idx_service_addons_profile ON public.service_addons USING btree (profile_id);
CREATE INDEX IF NOT EXISTS idx_service_addons_service ON public.service_addons USING btree (service_id);

COMMIT;
