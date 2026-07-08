-- =============================================================================
-- Kurumsal Ekip — Yazma Pass DİLİM 3b: Owner-rol aksiyonları + kurum-adına
-- yorum + Davet Et (manager+)
--
-- PAKET 1 (owner-rol): ilan silme + close/cancel + kurum-adına yorum →
--   has_business_role(..., 'owner') VEYA kurum hesabının kendisi. manager YAPAMAZ.
-- PAKET 2 (manager+): Davet Et (kurum ilanına pro davet).
-- (Promotion owner-rol dalları action katmanında; RLS listings UPDATE zaten
--  manager+'a açık — dilim 2 — o yüzden burada promotion için RLS değişmez.)
--
-- Rol helper'ları: has_business_role(business_id, min_role) + is_business_member
-- (DİLİM 1 / okuma-pass) canlıda. Dashboard'dan manuel apply (db push YOK).
-- Idempotent (DROP IF EXISTS + CREATE) + atomik (BEGIN/COMMIT).
--
-- -----------------------------------------------------------------------------
-- GERİ DÖNÜŞ İÇİN — değişen politikaların ÖNCEKİ halleri:
--
--   reviews INSERT "Customers can create reviews for their conversations"
--     WITH CHECK ((auth.uid() = customer_id) AND EXISTS(conversations c
--       WHERE c.id = reviews.conversation_id AND c.customer_id = auth.uid()
--       AND c.professional_id = reviews.professional_id))
--   reviews UPDATE "Customers can update their own reviews"
--     USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id)
--   reviews DELETE "Customers can delete their own reviews"
--     USING (auth.uid() = customer_id)
--   listings DELETE "Users delete their own draft listings"
--     USING (creator_id = auth.uid() AND status IN ('draft','cancelled'))
--
--   listing_invitations (DRIFT — repo migration'larında yok, canlıdaki halleri):
--     INSERT "Inviter creates invitations to own published listing"
--       WITH CHECK ((inviter_id = auth.uid())
--         AND EXISTS(listings l WHERE l.id=listing_id AND l.creator_id=auth.uid()
--           AND l.status='published')
--         AND EXISTS(profiles p WHERE p.id=professional_id
--           AND p.role IN ('professional','agency')))
--     SELECT "Inviter and invited see invitations"
--       USING (inviter_id=auth.uid() OR professional_id=auth.uid())
--     UPDATE "Inviter or invited update invitation"
--       USING/CHECK (inviter_id=auth.uid() OR professional_id=auth.uid())
-- -----------------------------------------------------------------------------
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- a) reviews.created_by — yazan üye izi (her yazımda auth.uid(); kurum adına
--    yazımda customer_id=kurum, created_by=üye → ayrışır)
-- -----------------------------------------------------------------------------
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

-- -----------------------------------------------------------------------------
-- b) reviews RLS — kurum hesabı VEYA owner-rol üye kurum adına yorum yazabilir.
--    DİKKAT: INSERT'te conv koşulu c.customer_id = auth.uid() → reviews.customer_id
--    (kurum adına yazımda konuşma müşterisi KURUM'dur).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can create reviews for their conversations" ON reviews;
CREATE POLICY "Customers can create reviews for their conversations"
  ON reviews FOR INSERT
  WITH CHECK (
    (
      auth.uid() = customer_id
      OR has_business_role(customer_id, 'owner')
    )
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = reviews.conversation_id
        AND c.customer_id = reviews.customer_id
        AND c.professional_id = reviews.professional_id
    )
  );

DROP POLICY IF EXISTS "Customers can update their own reviews" ON reviews;
CREATE POLICY "Customers can update their own reviews"
  ON reviews FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR has_business_role(customer_id, 'owner')
  )
  WITH CHECK (
    auth.uid() = customer_id
    OR has_business_role(customer_id, 'owner')
  );

DROP POLICY IF EXISTS "Customers can delete their own reviews" ON reviews;
CREATE POLICY "Customers can delete their own reviews"
  ON reviews FOR DELETE
  USING (
    auth.uid() = customer_id
    OR has_business_role(customer_id, 'owner')
  );

-- -----------------------------------------------------------------------------
-- c) listings DELETE — owner-rol üye kurum ilanını silebilir (draft/cancelled).
--    Status koşulu AYNEN korunur.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users delete their own draft listings" ON listings;
CREATE POLICY "Users delete their own draft listings"
  ON listings FOR DELETE
  USING (
    (
      creator_id = auth.uid()
      OR has_business_role(creator_id, 'owner')
    )
    AND status IN ('draft', 'cancelled')
  );

-- -----------------------------------------------------------------------------
-- d) listing_invitations INSERT — manager+ üye kurum ilanına pro davet edebilir.
--    inviter_id = auth.uid() ve profil-rol koşulu AYNEN korunur; yalnız listing
--    EXISTS'ine owner/creator VEYA manager+ üye dalı eklenir.
--    (DRIFT tablo — canlıdaki hali brief'ten birebir yeniden yazılıyor.)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Inviter creates invitations to own published listing" ON listing_invitations;
CREATE POLICY "Inviter creates invitations to own published listing"
  ON listing_invitations FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_invitations.listing_id
        AND l.status = 'published'
        AND (
          l.creator_id = auth.uid()
          OR has_business_role(l.creator_id, 'manager')
        )
    )
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = listing_invitations.professional_id
        AND p.role IN ('professional', 'agency')
    )
  );

-- -----------------------------------------------------------------------------
-- e) listing_invitations SELECT — boşluk kapatma: üye davet edince kurum sahibi
--    ve diğer üyeler de daveti görebilir (is_business_member — tüm üyeler).
--    Mevcut "Inviter and invited see invitations" politikasına DOKUNULMAZ; ek.
--
--    ⚠️ BİLİNEN SINIRLAMA: UPDATE (iptal) politikası inviter_id=auth.uid() /
--    professional_id=auth.uid() ekseninde KALIR (dokunulmadı). Yani kurum sahibi,
--    bir ÜYENİN gönderdiği daveti İPTAL EDEMEZ — yalnız gönderen üye iptal eder.
--    (cancelListingInvitation action'ı da inviter_id kapısında.) Ayrı iş.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Business members see team listing invitations" ON listing_invitations;
CREATE POLICY "Business members see team listing invitations"
  ON listing_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_invitations.listing_id
        AND is_business_member(l.creator_id)
    )
  );

COMMIT;
