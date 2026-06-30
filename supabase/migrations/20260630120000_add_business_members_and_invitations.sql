-- =============================================================================
-- Kurumsal Ekip (Faz b-1): business (kurumsal müşteri) çoklu kullanıcı
--
-- agency_members/agency_invitations (20260520071330) AYNASI, business'e uyarlanmış.
--
-- KRİTİK FARK (agency = ROSTER vs business = PAYLAŞIMLI HESAP):
--   - agency_members: ajansa bağlı BAĞIMSIZ profesyoneller (vitrin); üye 'professional' olmalı,
--     üyeler herkese açık (public roster).
--   - business_members: bir KURUM hesabına bağlı EKİP üyeleri (paylaşımlı hesap); üye HERHANGİ
--     bir kullanıcı olabilir (erişim üyelikten gelir), üye listesi GİZLİ (sadece kurum + üyeler).
--
-- OWNER mekanizması (agency'den birebir): ayrı bir "owner" satırı YOKTUR. Kurum hesabının
-- KENDİSİ (profiles.role='business', profile.id) de-facto owner'dır ve her şeyi RLS'te
-- business_id = auth.uid() ile yönetir. business_members SADECE davet edilen ekip üyelerini
-- tutar; kurum kendisi tabloda değildir (no_self_business_membership bunu zorlar). Owner-bootstrap
-- trigger'ı YOKTUR (agency'de de yoktur). 'owner' enum değeri parite için bırakıldı.
--
-- İSİM BENZERSİZLİĞİ: agency migration'ıyla ŞEMA-GENELİNDE çakışan isimler business'e özel:
--   no_duplicate_pending_invitation → no_duplicate_pending_business_invitation (EXCLUDE→index, ZORUNLU)
--   no_self_membership             → no_self_business_membership            (CHECK)
--   POLICY "Invited user sees their invitations" → "...their business invitations"
--   POLICY "Status updates by authorized parties" → "Business invitation status updates ..."
-- (index/trigger/fonksiyon/ENUM/tablo isimleri zaten business_-önekli/benzersiz.)
--
-- Bu STEP 1 (üyelik altyapısı). Paylaşımlı VERİ görünürlüğü (listings/conversations/quote_*
-- RLS genişlemesi) ayrı STEP'tir — burada YOK. Ancak "üyeler kendi ekibini görebilir" için
-- is_business_member() yardımcı fonksiyonu burada (özyinelemesiz RLS için zorunlu) ve STEP 2'de
-- veri görünürlüğünde de yeniden kullanılır.
--
-- profiles.role CHECK 'business'i zaten içeriyor (20260520071330) → role CHECK'e DOKUNULMAZ.
-- Tekrar-güvenli (idempotent): ENUM DO-guard, IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUM types (agency aynası — ayrı enum, ileride bağımsız evrilebilsin)
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE business_member_role AS ENUM ('owner', 'manager', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE business_invitation_status AS ENUM (
    'pending', 'accepted', 'declined', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. business_members tablosu (agency_members aynası)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  member_role business_member_role NOT NULL DEFAULT 'member',

  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Bir kullanıcı aynı kuruma iki kez katılamaz
  UNIQUE (business_id, member_user_id),

  -- Sanity check: kurum kendisine üye olamaz (kurum = de-facto owner, satır değil)
  CONSTRAINT no_self_business_membership CHECK (business_id != member_user_id)
);

CREATE INDEX IF NOT EXISTS business_members_business_id_idx ON business_members(business_id);
CREATE INDEX IF NOT EXISTS business_members_member_user_id_idx ON business_members(member_user_id);
CREATE INDEX IF NOT EXISTS business_members_member_role_idx ON business_members(member_role);

-- Kurum olduğunu DB seviyesinde garanti et (agency'deki validate trigger'ın uyarlaması).
-- FARK: üye rolü SERBEST (agency'de professional zorunluydu) — sadece business_id kontrol edilir.
CREATE OR REPLACE FUNCTION validate_business_membership_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  owner_role TEXT;
BEGIN
  SELECT role INTO owner_role FROM profiles WHERE id = NEW.business_id;

  IF owner_role != 'business' THEN
    RAISE EXCEPTION 'business_id must reference a profile with role=business';
  END IF;

  -- member_user_id rolü serbest: erişim üyelikten gelir, üye herhangi bir kullanıcı olabilir.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_business_member_insert_validate_roles ON business_members;
CREATE TRIGGER on_business_member_insert_validate_roles
  BEFORE INSERT OR UPDATE ON business_members
  FOR EACH ROW
  EXECUTE FUNCTION validate_business_membership_roles();

-- -----------------------------------------------------------------------------
-- 3. business_invitations tablosu (agency_invitations aynası)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Davet edilen
  invited_email TEXT NOT NULL CHECK (
    invited_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  -- Eğer kullanıcı zaten Kashe'de kayıtlıysa profile id'si
  invited_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Davet eden (kurum hesabından kim çağırdı - şu an hep business_id ama gelecek için)
  invited_by_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Kabul edilirse hangi rol verilecek
  member_role business_member_role NOT NULL DEFAULT 'member',

  -- Davet süreci
  status business_invitation_status NOT NULL DEFAULT 'pending',
  invitation_message TEXT CHECK (
    invitation_message IS NULL OR char_length(invitation_message) <= 1000
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),

  -- Aynı email için aynı kurumda bekleyen davet birden fazla olamaz
  -- (cancelled/expired/declined sonrası yeni davet açılabilir)
  CONSTRAINT no_duplicate_pending_business_invitation EXCLUDE USING btree (
    business_id WITH =,
    invited_email WITH =
  ) WHERE (status = 'pending')
);

CREATE INDEX IF NOT EXISTS business_invitations_business_id_idx ON business_invitations(business_id);
CREATE INDEX IF NOT EXISTS business_invitations_invited_email_idx ON business_invitations(invited_email);
CREATE INDEX IF NOT EXISTS business_invitations_invited_user_id_idx ON business_invitations(invited_user_id)
  WHERE invited_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_invitations_status_idx ON business_invitations(status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS business_invitations_expires_at_idx ON business_invitations(expires_at)
  WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 4. is_business_member() yardımcı fonksiyon (SECURITY DEFINER — özyinelemesiz RLS)
--
-- agency "Agency members are public" (USING true) yapıyordu; business ekibi GİZLİ olduğundan
-- bunu kullanamayız. Üyenin kendi ekibini görmesi için RLS'in business_members'ı sorgulaması
-- gerekir → SECURITY DEFINER fonksiyon RLS'i baypas eder, özyineleme oluşmaz.
-- STEP 2 (paylaşımlı veri görünürlüğü: listings/conversations/quote_* RLS) de bunu kullanacak.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_business_member(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = p_business_id
      AND member_user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. RLS — business_members (agency kalıbı ama GİZLİ: public DEĞİL)
-- -----------------------------------------------------------------------------

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

-- Üyeler GİZLİ: kurum sahibi tüm ekibini, üyeler kendi ekibini görür (public DEĞİL)
DROP POLICY IF EXISTS "Business team visible to owner and members" ON business_members;
CREATE POLICY "Business team visible to owner and members"
  ON business_members FOR SELECT
  USING (
    business_id = auth.uid()
    OR is_business_member(business_id)
  );

-- Kurum kendi üyelerini ekleyebilir / kabul eden üye kendini ekleyebilir (accept akışı)
DROP POLICY IF EXISTS "Business adds members" ON business_members;
CREATE POLICY "Business adds members"
  ON business_members FOR INSERT
  WITH CHECK (
    business_id = auth.uid()
    OR member_user_id = auth.uid()
  );

-- Kurum veya üye üyeliği güncelleyebilir (rol değişikliği)
DROP POLICY IF EXISTS "Business or member updates" ON business_members;
CREATE POLICY "Business or member updates"
  ON business_members FOR UPDATE
  USING (business_id = auth.uid() OR member_user_id = auth.uid());

-- Kurum üyeyi çıkarabilir, üye kendi üyeliğinden ayrılabilir
DROP POLICY IF EXISTS "Business or member can remove" ON business_members;
CREATE POLICY "Business or member can remove"
  ON business_members FOR DELETE
  USING (business_id = auth.uid() OR member_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 6. RLS — business_invitations (agency_invitations kalıbı)
-- -----------------------------------------------------------------------------

ALTER TABLE business_invitations ENABLE ROW LEVEL SECURITY;

-- Kurum kendi davetlerini görür
DROP POLICY IF EXISTS "Business sees own invitations" ON business_invitations;
CREATE POLICY "Business sees own invitations"
  ON business_invitations FOR SELECT
  USING (business_id = auth.uid());

-- Davet edilen kullanıcı kendi davetlerini görür (email veya kayıtlıysa user_id ile)
DROP POLICY IF EXISTS "Invited user sees their business invitations" ON business_invitations;
CREATE POLICY "Invited user sees their business invitations"
  ON business_invitations FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Kurum davet oluşturur (role=business zorunlu)
DROP POLICY IF EXISTS "Businesses create invitations" ON business_invitations;
CREATE POLICY "Businesses create invitations"
  ON business_invitations FOR INSERT
  WITH CHECK (
    business_id = auth.uid()
    AND invited_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'business'
    )
  );

-- Kurum daveti iptal edebilir, davet edilen kabul/reddedebilir
DROP POLICY IF EXISTS "Business invitation status updates by authorized parties" ON business_invitations;
CREATE POLICY "Business invitation status updates by authorized parties"
  ON business_invitations FOR UPDATE
  USING (
    business_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 7. Trigger: Davet kabul edilince üye olarak ekle (agency aynası)
--    FARK: üye rolü kontrolü YOK (agency'de 'professional' zorunluydu) — üye serbest.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_business_invitation_accepted_add_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepter_id UUID;
BEGIN
  -- Sadece pending → accepted geçişinde çalış
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    NEW.responded_at := now();

    -- invited_user_id boşsa, email ile kayıtlı kullanıcıyı bul
    accepter_id := NEW.invited_user_id;
    IF accepter_id IS NULL THEN
      SELECT id INTO accepter_id FROM profiles WHERE email = NEW.invited_email LIMIT 1;
    END IF;

    -- Kullanıcı bulunamadıysa hata
    IF accepter_id IS NULL THEN
      RAISE EXCEPTION 'Cannot find user for invitation %', NEW.id;
    END IF;

    -- Üye olarak ekle (rol kontrolü YOK — herhangi bir kullanıcı kurum üyesi olabilir)
    INSERT INTO business_members (business_id, member_user_id, member_role)
    VALUES (NEW.business_id, accepter_id, NEW.member_role)
    ON CONFLICT (business_id, member_user_id) DO NOTHING;

    -- invited_user_id'yi de set et (kayıttan sonra accept eden için)
    NEW.invited_user_id := accepter_id;
  END IF;

  -- declined/cancelled/expired için responded_at set et
  IF OLD.status = 'pending' AND NEW.status IN ('declined', 'cancelled', 'expired') THEN
    NEW.responded_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_business_invitation_status_change ON business_invitations;
CREATE TRIGGER on_business_invitation_status_change
  BEFORE UPDATE ON business_invitations
  FOR EACH ROW
  EXECUTE FUNCTION on_business_invitation_accepted_add_member();

-- -----------------------------------------------------------------------------
-- 8. Trigger: Yeni davet → davet edilene bildirim (kayıtlıysa) (agency aynası)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_business_invitation_insert_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  business_name TEXT;
  recipient_id UUID;
BEGIN
  -- Davet edilen kullanıcı kayıtlı mı? (email ile bul, invited_user_id zaten varsa onu kullan)
  recipient_id := NEW.invited_user_id;
  IF recipient_id IS NULL THEN
    SELECT id INTO recipient_id FROM profiles WHERE email = NEW.invited_email LIMIT 1;
    IF recipient_id IS NOT NULL THEN
      NEW.invited_user_id := recipient_id;
    END IF;
  END IF;

  -- Sadece kayıtlı kullanıcılara in-app bildirim
  IF recipient_id IS NOT NULL THEN
    SELECT COALESCE(company_name, full_name, 'Bir kurum') INTO business_name
    FROM profiles WHERE id = NEW.business_id;

    INSERT INTO notifications (user_id, type, body, link)
    VALUES (
      recipient_id,
      'message',
      business_name || ' seni kurumsal ekibine davet etti',
      '/davetlerim'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_business_invitation_insert_notify ON business_invitations;
CREATE TRIGGER on_business_invitation_insert_notify
  BEFORE INSERT ON business_invitations
  FOR EACH ROW
  EXECUTE FUNCTION on_business_invitation_insert_notify();

-- -----------------------------------------------------------------------------
-- 9. Trigger: Üye eklenince kuruma bildirim (agency aynası)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_business_member_insert_notify_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_name TEXT;
BEGIN
  SELECT full_name INTO member_name FROM profiles WHERE id = NEW.member_user_id;

  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    NEW.business_id,
    'message',
    COALESCE(member_name, 'Bir kullanıcı') || ' kurumsal ekibine katıldı',
    '/profil/ekibim'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_business_member_insert_notify ON business_members;
CREATE TRIGGER on_business_member_insert_notify
  AFTER INSERT ON business_members
  FOR EACH ROW
  EXECUTE FUNCTION on_business_member_insert_notify_business();

-- -----------------------------------------------------------------------------
-- 10. Realtime (agency aynası) — tekrar-güvenli (zaten ekliyse yut)
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE business_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE business_invitations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE business_invitations REPLICA IDENTITY FULL;
ALTER TABLE business_members REPLICA IDENTITY FULL;
