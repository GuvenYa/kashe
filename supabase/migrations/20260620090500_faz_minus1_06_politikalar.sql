-- =============================================================================
-- FAZ -1 / 06 — Politikalar (56)
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- GRUP A politikalari. qual ve with_check ifadeleri
-- politika-ifadeleri-*.csv'den (pg_policies dokumu) BIREBIR alinmistir.
--
-- WITH CHECK KURALI: with_check bos olan politikalarda WITH CHECK YAZILMAZ.
--   PostgreSQL, UPDATE'te WITH CHECK verilmemisse USING ifadesini kullanir;
--   bos bir WITH CHECK yazmak bu davranisi bozardi.
--
-- roles alani dokumdeki degeriyle yazilir (cogunlukla {public} veya {authenticated}).
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

-- ---------------------------------------------------------------------------
-- admin_audit_log
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins insert audit log" ON public.admin_audit_log;
CREATE POLICY "Admins insert audit log"
  ON public.admin_audit_log
  FOR INSERT
  TO public
  WITH CHECK (((admin_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));

DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Pros and agencies apply to published listings" ON public.applications;
CREATE POLICY "Pros and agencies apply to published listings"
  ON public.applications
  FOR INSERT
  TO public
  WITH CHECK (((applicant_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['professional'::text, 'agency'::text]))))) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = applications.listing_id) AND (l.status = 'published'::listing_status))))));

-- ---------------------------------------------------------------------------
-- availability_blocks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "availability_delete_own" ON public.availability_blocks;
CREATE POLICY "availability_delete_own"
  ON public.availability_blocks
  FOR DELETE
  TO public
  USING ((auth.uid() = profile_id));

DROP POLICY IF EXISTS "availability_insert_own" ON public.availability_blocks;
CREATE POLICY "availability_insert_own"
  ON public.availability_blocks
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = profile_id));

DROP POLICY IF EXISTS "availability_read_own" ON public.availability_blocks;
CREATE POLICY "availability_read_own"
  ON public.availability_blocks
  FOR SELECT
  TO public
  USING ((auth.uid() = profile_id));

DROP POLICY IF EXISTS "availability_read_published" ON public.availability_blocks;
CREATE POLICY "availability_read_published"
  ON public.availability_blocks
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = availability_blocks.profile_id) AND (profiles.is_published = true)))));

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "blog_admin_delete" ON public.blog_posts;
CREATE POLICY "blog_admin_delete"
  ON public.blog_posts
  FOR DELETE
  TO public
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "blog_admin_insert" ON public.blog_posts;
CREATE POLICY "blog_admin_insert"
  ON public.blog_posts
  FOR INSERT
  TO public
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "blog_admin_read" ON public.blog_posts;
CREATE POLICY "blog_admin_read"
  ON public.blog_posts
  FOR SELECT
  TO public
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "blog_admin_update" ON public.blog_posts;
CREATE POLICY "blog_admin_update"
  ON public.blog_posts
  FOR UPDATE
  TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "blog_public_read" ON public.blog_posts;
CREATE POLICY "blog_public_read"
  ON public.blog_posts
  FOR SELECT
  TO public
  USING ((status = 'published'::text));

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Assigned pros read team bookings" ON public.bookings;
CREATE POLICY "Assigned pros read team bookings"
  ON public.bookings
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM agency_members am
  WHERE ((am.agency_id = bookings.professional_id) AND (am.professional_id = auth.uid())))));

DROP POLICY IF EXISTS "Customers read own bookings" ON public.bookings;
CREATE POLICY "Customers read own bookings"
  ON public.bookings
  FOR SELECT
  TO public
  USING ((auth.uid() = customer_id));

DROP POLICY IF EXISTS "Parties update own bookings" ON public.bookings;
CREATE POLICY "Parties update own bookings"
  ON public.bookings
  FOR UPDATE
  TO public
  USING (((auth.uid() = customer_id) OR (auth.uid() = professional_id)));

DROP POLICY IF EXISTS "Professionals read own bookings" ON public.bookings;
CREATE POLICY "Professionals read own bookings"
  ON public.bookings
  FOR SELECT
  TO public
  USING ((auth.uid() = professional_id));

-- ---------------------------------------------------------------------------
-- category_requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update category requests" ON public.category_requests;
CREATE POLICY "Admins can update category requests"
  ON public.category_requests
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Admins can view all category requests" ON public.category_requests;
CREATE POLICY "Admins can view all category requests"
  ON public.category_requests
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Users can insert own category requests" ON public.category_requests;
CREATE POLICY "Users can insert own category requests"
  ON public.category_requests
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can read own category requests" ON public.category_requests;
CREATE POLICY "Users can read own category requests"
  ON public.category_requests
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- conversation_assignees
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conv_assignees_delete" ON public.conversation_assignees;
CREATE POLICY "conv_assignees_delete"
  ON public.conversation_assignees
  FOR DELETE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_assignees.conversation_id) AND (c.professional_id = auth.uid())))));

DROP POLICY IF EXISTS "conv_assignees_insert" ON public.conversation_assignees;
CREATE POLICY "conv_assignees_insert"
  ON public.conversation_assignees
  FOR INSERT
  TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_assignees.conversation_id) AND (c.professional_id = auth.uid())))));

DROP POLICY IF EXISTS "conv_assignees_select" ON public.conversation_assignees;
CREATE POLICY "conv_assignees_select"
  ON public.conversation_assignees
  FOR SELECT
  TO public
  USING (((professional_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_assignees.conversation_id) AND (c.professional_id = auth.uid()))))));

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_update_owner" ON public.conversations;
CREATE POLICY "conversations_update_owner"
  ON public.conversations
  FOR UPDATE
  TO public
  USING (((auth.uid() = customer_id) OR (auth.uid() = professional_id)))
  WITH CHECK (((auth.uid() = customer_id) OR (auth.uid() = professional_id)));

DROP POLICY IF EXISTS "Professionals create conversations as professional" ON public.conversations;
CREATE POLICY "Professionals create conversations as professional"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (((auth.uid() = professional_id) AND is_professional_or_agency(auth.uid())));

-- ---------------------------------------------------------------------------
-- listing_invitations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Inviter and invited see invitations" ON public.listing_invitations;
CREATE POLICY "Inviter and invited see invitations"
  ON public.listing_invitations
  FOR SELECT
  TO public
  USING (((inviter_id = auth.uid()) OR (professional_id = auth.uid())));

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read all listings" ON public.listings;
CREATE POLICY "Admins can read all listings"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update any listing" ON public.listings;
CREATE POLICY "Admins can update any listing"
  ON public.listings
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- message_violations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own violations" ON public.message_violations;
CREATE POLICY "Users can insert own violations"
  ON public.message_violations
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- quote_request_recipients
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins see all recipients" ON public.quote_request_recipients;
CREATE POLICY "Admins see all recipients"
  ON public.quote_request_recipients
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers see recipients of own requests" ON public.quote_request_recipients;
CREATE POLICY "Customers see recipients of own requests"
  ON public.quote_request_recipients
  FOR SELECT
  TO authenticated
  USING (owns_quote_request(request_id, auth.uid()));

DROP POLICY IF EXISTS "Recipients see own recipient rows" ON public.quote_request_recipients;
CREATE POLICY "Recipients see own recipient rows"
  ON public.quote_request_recipients
  FOR SELECT
  TO authenticated
  USING ((professional_id = auth.uid()));

DROP POLICY IF EXISTS "Recipients update own status" ON public.quote_request_recipients;
CREATE POLICY "Recipients update own status"
  ON public.quote_request_recipients
  FOR UPDATE
  TO authenticated
  USING ((professional_id = auth.uid()))
  WITH CHECK ((professional_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- quote_requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins see all quote requests" ON public.quote_requests;
CREATE POLICY "Admins see all quote requests"
  ON public.quote_requests
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers see own quote requests" ON public.quote_requests;
CREATE POLICY "Customers see own quote requests"
  ON public.quote_requests
  FOR SELECT
  TO authenticated
  USING ((customer_id = auth.uid()));

DROP POLICY IF EXISTS "Recipients see quote requests sent to them" ON public.quote_requests;
CREATE POLICY "Recipients see quote requests sent to them"
  ON public.quote_requests
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM quote_request_recipients r
  WHERE ((r.request_id = quote_requests.id) AND (r.professional_id = auth.uid())))));

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reports_delete_admin" ON public.reports;
CREATE POLICY "reports_delete_admin"
  ON public.reports
  FOR DELETE
  TO public
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own"
  ON public.reports
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = reporter_id));

DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin"
  ON public.reports
  FOR SELECT
  TO public
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own"
  ON public.reports
  FOR SELECT
  TO public
  USING ((auth.uid() = reporter_id));

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin"
  ON public.reports
  FOR UPDATE
  TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- service_addons
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_addons_delete_own" ON public.service_addons;
CREATE POLICY "service_addons_delete_own"
  ON public.service_addons
  FOR DELETE
  TO authenticated
  USING ((profile_id = auth.uid()));

DROP POLICY IF EXISTS "service_addons_insert_own" ON public.service_addons;
CREATE POLICY "service_addons_insert_own"
  ON public.service_addons
  FOR INSERT
  TO authenticated
  WITH CHECK ((profile_id = auth.uid()));

DROP POLICY IF EXISTS "service_addons_read_all" ON public.service_addons;
CREATE POLICY "service_addons_read_all"
  ON public.service_addons
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "service_addons_update_own" ON public.service_addons;
CREATE POLICY "service_addons_update_own"
  ON public.service_addons
  FOR UPDATE
  TO authenticated
  USING ((profile_id = auth.uid()))
  WITH CHECK ((profile_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- service_categories
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_categories_insert_admin" ON public.service_categories;
CREATE POLICY "service_categories_insert_admin"
  ON public.service_categories
  FOR INSERT
  TO public
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "service_categories_update_admin" ON public.service_categories;
CREATE POLICY "service_categories_update_admin"
  ON public.service_categories
  FOR UPDATE
  TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- service_packages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "packages_delete_own" ON public.service_packages;
CREATE POLICY "packages_delete_own"
  ON public.service_packages
  FOR DELETE
  TO public
  USING ((auth.uid() = profile_id));

DROP POLICY IF EXISTS "packages_insert_own" ON public.service_packages;
CREATE POLICY "packages_insert_own"
  ON public.service_packages
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = profile_id));

DROP POLICY IF EXISTS "packages_read_own" ON public.service_packages;
CREATE POLICY "packages_read_own"
  ON public.service_packages
  FOR SELECT
  TO public
  USING ((auth.uid() = profile_id));

DROP POLICY IF EXISTS "packages_read_published" ON public.service_packages;
CREATE POLICY "packages_read_published"
  ON public.service_packages
  FOR SELECT
  TO public
  USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = service_packages.profile_id) AND (profiles.is_published = true))))));

DROP POLICY IF EXISTS "packages_update_own" ON public.service_packages;
CREATE POLICY "packages_update_own"
  ON public.service_packages
  FOR UPDATE
  TO public
  USING ((auth.uid() = profile_id));

COMMIT;
