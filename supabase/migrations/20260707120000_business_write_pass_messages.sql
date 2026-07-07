-- =============================================================================
-- Kurumsal Ekip — Yazma Pass DİLİM 1: Mesaj Gönderme
--
-- manager/owner rolündeki kurum üyeleri kurum adına MESAJ gönderebilir + okundu
-- işaretleyebilir. member rolü aynen pasif kalır.
-- Attribution: messages.sender_id = üyenin KENDİ uuid'si (sender_id koşulu değişmez).
--
-- Bu migration DASHBOARD'dan manuel apply edilecek (db push YOK, remote geçmiş senkronsuz).
-- Idempotent (CREATE OR REPLACE + DROP POLICY IF EXISTS) + atomik (BEGIN/COMMIT).
--
-- -----------------------------------------------------------------------------
-- GERİ DÖNÜŞ İÇİN — politikaların ÖNCEKİ tam hali (initial_schema.sql):
--
--   CREATE POLICY messages_insert_participant ON public.messages FOR INSERT
--   WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
--      FROM public.conversations c
--     WHERE ((c.id = messages.conversation_id) AND ((c.customer_id = auth.uid())
--            OR (c.professional_id = auth.uid())))))));
--
--   CREATE POLICY messages_update_recipient ON public.messages FOR UPDATE
--   USING (((sender_id <> auth.uid()) AND (EXISTS ( SELECT 1
--      FROM public.conversations c
--     WHERE ((c.id = messages.conversation_id) AND ((c.customer_id = auth.uid())
--            OR (c.professional_id = auth.uid())))))));
-- -----------------------------------------------------------------------------
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- a) Rol eşikli üyelik helper'ı (SECURITY DEFINER — RLS baypas, özyinelemesiz)
--
-- ⚠️ Hiyerarşi ENUM sırasıyla KARŞILAŞTIRILMAZ (enum sırası owner,manager,member
--    yani yetkiyle TERS). Açık CASE ile sayısal ağırlık zorunlu: owner=3>manager=2>member=1.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_business_role(
  p_business_id uuid,
  p_min_role business_member_role
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.business_id = p_business_id
      AND bm.member_user_id = auth.uid()
      AND (CASE bm.member_role
             WHEN 'owner' THEN 3
             WHEN 'manager' THEN 2
             WHEN 'member' THEN 1
           END)
          >=
          (CASE p_min_role
             WHEN 'owner' THEN 3
             WHEN 'manager' THEN 2
             WHEN 'member' THEN 1
           END)
  );
$$;

-- -----------------------------------------------------------------------------
-- b) messages INSERT — manager+ kurum üyesi kurum adına mesaj gönderebilir
--    (sender_id = auth.uid() KORUNUR; sadece EXISTS'e üçüncü dal eklendi)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.customer_id = auth.uid()
          OR c.professional_id = auth.uid()
          OR has_business_role(c.customer_id, 'manager')
        )
    )
  );

-- -----------------------------------------------------------------------------
-- c) messages UPDATE (markRead) — manager+ kurum üyesi okundu işaretleyebilir
--    (sender_id <> auth.uid() KORUNUR; sadece EXISTS'e üçüncü dal eklendi)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_update_recipient ON public.messages;
CREATE POLICY messages_update_recipient ON public.messages FOR UPDATE
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.customer_id = auth.uid()
          OR c.professional_id = auth.uid()
          OR has_business_role(c.customer_id, 'manager')
        )
    )
  );

COMMIT;
