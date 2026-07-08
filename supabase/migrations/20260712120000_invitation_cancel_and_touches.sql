-- =============================================================================
-- Kurumsal Ekip — Yazma Pass kapanış rötuşları: listing_invitations RLS (KALEM 2 +
-- K1 owner görünürlük bug'ı).
--
-- (a) UPDATE — davet iptali: bir ÜYENİN gönderdiği daveti kurum sahibi / diğer
--     manager de iptal edebilsin (yalnız inviter_id/professional_id değil).
--
-- (b) SELECT — K1 BUG: "Gönderilen davetler" bölümü ilan SAHİBİNE (kurum hesabı)
--     görünmüyordu. Neden: 20260711120000'daki "Business members see team listing
--     invitations" SELECT politikası yalnız is_business_member(creator_id) diyor;
--     is_business_member kurum HESABINI kapsamaz (no_self_business_membership →
--     kurumun kendi business_members satırı yok). Bir üye davet gönderince
--     (inviter_id=üye) sahip ne inviter ne professional ne de "member" → SELECT
--     bloklanıyor → sayfa fetch'i boş → bölüm gizli. Çözüm: SELECT'e l.creator_id =
--     auth.uid() dalı ekle (applications SELECT'indeki "Listing owners see..."
--     kalıbının aynısı). App koşulu (canDecide=isOwner||manager+) zaten doğruydu.
--
-- NOT (helper kapsamı): has_business_role + is_business_member kurum HESABINI
-- (creator_id = kurum profili) KAPSAMAZ — yalnız business_members satırlarına
-- bakar. Bu yüzden sahip için ayrı `l.creator_id = auth.uid()` dalı HER İKİ
-- politikada da ZORUNLU.
--
-- ⚠️ DRIFT: listing_invitations tablosu repo migration'larında YOK (Dashboard).
--    UPDATE'in canlı hali brief'ten, SELECT'in hali 20260711120000'dan alınıp
--    DROP+CREATE ile yeniden yazılır.
--
-- Dashboard'dan manuel apply (db push YOK). Idempotent + atomik (BEGIN/COMMIT).
--
-- -----------------------------------------------------------------------------
-- GERİ DÖNÜŞ İÇİN — değişen politikaların ÖNCEKİ halleri:
--   UPDATE "Inviter or invited update invitation"
--     USING/CHECK (inviter_id = auth.uid() OR professional_id = auth.uid())
--   SELECT "Business members see team listing invitations" (20260711120000)
--     USING (EXISTS(listings l WHERE l.id = listing_id
--                   AND is_business_member(l.creator_id)))
-- -----------------------------------------------------------------------------
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- (a) UPDATE — davet iptali sahip + manager+'a açılır
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Inviter or invited update invitation" ON listing_invitations;
CREATE POLICY "Inviter or invited update invitation"
  ON listing_invitations FOR UPDATE
  USING (
    inviter_id = auth.uid()
    OR professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_invitations.listing_id
        AND (
          l.creator_id = auth.uid()
          OR has_business_role(l.creator_id, 'manager')
        )
    )
  )
  WITH CHECK (
    inviter_id = auth.uid()
    OR professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_invitations.listing_id
        AND (
          l.creator_id = auth.uid()
          OR has_business_role(l.creator_id, 'manager')
        )
    )
  );

-- -----------------------------------------------------------------------------
-- (b) SELECT — K1 bug fix: ilan SAHİBİ (kurum hesabı) da üyenin gönderdiği daveti
--     görebilsin. is_business_member kurum hesabını kapsamadığından creator_id
--     dalı eklenir. Mevcut "Inviter and invited see invitations" politikasına
--     DOKUNULMAZ (o inviter/professional içindir); bu EK politika yeniden yazılır.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Business members see team listing invitations" ON listing_invitations;
CREATE POLICY "Business members see team listing invitations"
  ON listing_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_invitations.listing_id
        AND (
          l.creator_id = auth.uid()
          OR is_business_member(l.creator_id)
        )
    )
  );

COMMIT;
