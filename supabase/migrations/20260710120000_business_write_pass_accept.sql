-- =============================================================================
-- Kurumsal Ekip — Yazma Pass DİLİM 3a: Teklif + Başvuru Kabul/Red (manager+)
--
-- manager+ üyeler KURUM ADINA teklif kabul/red + ilan başvurusu
-- kabul/red/shortlist yapabilir. Eşik = manager (owner+manager).
-- Rol helper'ı has_business_role(business_id, min_role) DİLİM 1'de kuruldu.
--
-- Dashboard'dan manuel apply (db push YOK). Idempotent + atomik (BEGIN/COMMIT).
--
-- -----------------------------------------------------------------------------
-- GERİ DÖNÜŞ İÇİN — değişen politikaların ÖNCEKİ halleri:
--
--   quotes UPDATE "Quote status updates by authorized parties"
--     USING (EXISTS(SELECT 1 FROM conversations c WHERE c.id = quotes.conversation_id
--            AND (c.customer_id = auth.uid() OR c.professional_id = auth.uid())))
--   applications UPDATE "Authorized parties update applications"
--     USING (applicant_id = auth.uid()
--            OR EXISTS(SELECT 1 FROM listings l WHERE l.id = applications.listing_id
--                      AND l.creator_id = auth.uid()))
--
--   applications SELECT — manager görünürlüğü ÖNCE YOKTU (bkz. NOT aşağıda).
-- -----------------------------------------------------------------------------
--
-- ⚠️ KEŞİF BULGUSU (brief migration listesinde yoktu ama ZORUNLU):
--    Dilim 2 read-pass (20260701120000) applications SELECT'e business-member
--    dalı EKLEMEMİŞTİ (listings/conversations/quotes vb. var, applications yok).
--    Bu yüzden manager, kurum ilanına gelen başvuruları GÖREMİYORDU → kabul/red
--    imkânsızdı (T3 çalışmaz). Aşağıya manager+ SELECT politikası eklendi.
--    Eşik manager (üye görünürlüğü değişmez — member bugünkü gibi başvuru görmez).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- a) quotes UPDATE — manager+ kurum konuşmasındaki teklifi accept/decline edebilir
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Quote status updates by authorized parties" ON quotes;
CREATE POLICY "Quote status updates by authorized parties"
  ON quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = quotes.conversation_id
        AND (
          c.customer_id = auth.uid()
          OR c.professional_id = auth.uid()
          -- NOT: iyzico gercek odeme baglaninca (Phase 2) bu esik owner'a
          -- cekilecek mi? Fahri ile karar.
          OR has_business_role(c.customer_id, 'manager')
        )
    )
  );

-- -----------------------------------------------------------------------------
-- b) applications UPDATE — manager+ kurum ilanına gelen başvuruyu yönetebilir
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized parties update applications" ON applications;
CREATE POLICY "Authorized parties update applications"
  ON applications FOR UPDATE
  USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = applications.listing_id
        AND (
          l.creator_id = auth.uid()
          OR has_business_role(l.creator_id, 'manager')
        )
    )
  );

-- -----------------------------------------------------------------------------
-- c) applications SELECT — manager+ kurum ilanına gelen başvuruları GÖREBİLİR
--    (keşif gap'i; b'deki UPDATE'in çalışabilmesi için manager önce görmeli)
--    Mevcut "Professionals see..." + "Listing owners see..." politikalarına
--    DOKUNULMAZ; bu EK bir SELECT politikası.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Business managers see team applications" ON applications;
CREATE POLICY "Business managers see team applications"
  ON applications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = applications.listing_id
        AND has_business_role(l.creator_id, 'manager')
    )
  );

COMMIT;
