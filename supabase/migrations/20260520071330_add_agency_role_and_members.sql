-- =============================================================================
-- Faz 10 Parça 1: Ajans (Agency) sistemi
--
-- Yeni rol: 'agency' — kendi profili olan ama altında birden çok profesyonel
-- barındırabilen kurumsal yapı.
--
-- Model:
--   - Ajansın kendisi profiles tablosunda role='agency' ile yaşar
--   - agency_members: M:N ilişki, hangi profesyoneller hangi ajanslara üye
--   - agency_invitations: davet sistemi, email tabanlı
--
-- Esnek model: bir profesyonel birden çok ajansa üye olabilir, hala bağımsız
-- çalışabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles.role CHECK constraint'ini güncelle
-- -----------------------------------------------------------------------------

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('professional', 'client', 'business', 'agency'));

-- -----------------------------------------------------------------------------
-- 2. ENUM types
-- -----------------------------------------------------------------------------

CREATE TYPE agency_member_role AS ENUM (
  'owner',    -- Ajans hesabını oluşturan, tam yetki (gerçek senaryoda ajans hesabı tek owner)
  'manager',  -- Davet edebilir, üye yönetebilir
  'member'    -- Sadece üyelik bilgisi
);

CREATE TYPE agency_invitation_status AS ENUM (
  'pending',
  'accepted',
  'declined',
  'cancelled',  -- Ajans davetiyi geri çekti
  'expired'     -- Süre doldu
);

-- -----------------------------------------------------------------------------
-- 3. agency_members tablosu
-- -----------------------------------------------------------------------------

CREATE TABLE agency_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  member_role agency_member_role NOT NULL DEFAULT 'member',

  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Bir profesyonel aynı ajansa iki kez katılamaz
  UNIQUE (agency_id, professional_id),

  -- Sanity check: ajans kendisine üye olamaz
  CONSTRAINT no_self_membership CHECK (agency_id != professional_id)
);

CREATE INDEX agency_members_agency_id_idx ON agency_members(agency_id);
CREATE INDEX agency_members_professional_id_idx ON agency_members(professional_id);
CREATE INDEX agency_members_member_role_idx ON agency_members(member_role);

-- Ajans olduğunu DB seviyesinde garanti et (profil role'ünü check eden trigger)
CREATE OR REPLACE FUNCTION validate_agency_membership_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  agency_role TEXT;
  professional_role TEXT;
BEGIN
  SELECT role INTO agency_role FROM profiles WHERE id = NEW.agency_id;
  SELECT role INTO professional_role FROM profiles WHERE id = NEW.professional_id;

  IF agency_role != 'agency' THEN
    RAISE EXCEPTION 'agency_id must reference a profile with role=agency';
  END IF;

  IF professional_role != 'professional' THEN
    RAISE EXCEPTION 'professional_id must reference a profile with role=professional';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agency_member_insert_validate_roles
  BEFORE INSERT OR UPDATE ON agency_members
  FOR EACH ROW
  EXECUTE FUNCTION validate_agency_membership_roles();

-- -----------------------------------------------------------------------------
-- 4. agency_invitations tablosu
-- -----------------------------------------------------------------------------

CREATE TABLE agency_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Davet edilen
  invited_email TEXT NOT NULL CHECK (
    invited_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  -- Eğer kullanıcı zaten Kashe'de kayıtlıysa profile id'si
  invited_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Davet eden (ajans hesabından kim çağırdı - şu an hep agency_id ama gelecek için)
  invited_by_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Kabul edilirse hangi rol verilecek
  member_role agency_member_role NOT NULL DEFAULT 'member',

  -- Davet süreci
  status agency_invitation_status NOT NULL DEFAULT 'pending',
  invitation_message TEXT CHECK (
    invitation_message IS NULL OR char_length(invitation_message) <= 1000
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),

  -- Aynı email için aynı ajansta bekleyen davet birden fazla olamaz
  -- (cancelled/expired/declined sonrası yeni davet açılabilir)
  CONSTRAINT no_duplicate_pending_invitation EXCLUDE USING btree (
    agency_id WITH =,
    invited_email WITH =
  ) WHERE (status = 'pending')
);

CREATE INDEX agency_invitations_agency_id_idx ON agency_invitations(agency_id);
CREATE INDEX agency_invitations_invited_email_idx ON agency_invitations(invited_email);
CREATE INDEX agency_invitations_invited_user_id_idx ON agency_invitations(invited_user_id)
  WHERE invited_user_id IS NOT NULL;
CREATE INDEX agency_invitations_status_idx ON agency_invitations(status)
  WHERE status = 'pending';
CREATE INDEX agency_invitations_expires_at_idx ON agency_invitations(expires_at)
  WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 5. RLS — agency_members
-- -----------------------------------------------------------------------------

ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;

-- Üyeleri herkes okuyabilir (public listing için — ajansın takımı kim)
CREATE POLICY "Agency members are public"
  ON agency_members FOR SELECT
  USING (true);

-- Ajans kendi üyelerini ekleyebilir (gerçek hayatta sadece davet ile kabul akışı sonrası)
CREATE POLICY "Agencies add members"
  ON agency_members FOR INSERT
  WITH CHECK (
    -- Ya ajansın kendisi ekliyor
    agency_id = auth.uid()
    -- Ya da kabul eden profesyonel ekliyor (invitation_accept akışı)
    OR professional_id = auth.uid()
  );

-- Ajans veya profesyonel üyeliği güncelleyebilir (rol değişikliği)
CREATE POLICY "Agency or member updates"
  ON agency_members FOR UPDATE
  USING (agency_id = auth.uid() OR professional_id = auth.uid());

-- Ajans üyeyi çıkarabilir, profesyonel kendi üyeliğinden ayrılabilir
CREATE POLICY "Agency or member can remove"
  ON agency_members FOR DELETE
  USING (agency_id = auth.uid() OR professional_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 6. RLS — agency_invitations
-- -----------------------------------------------------------------------------

ALTER TABLE agency_invitations ENABLE ROW LEVEL SECURITY;

-- Ajans kendi davetlerini görür
CREATE POLICY "Agency sees own invitations"
  ON agency_invitations FOR SELECT
  USING (agency_id = auth.uid());

-- Davet edilen kullanıcı kendi davetlerini görür (email veya kayıtlıysa user_id ile)
CREATE POLICY "Invited user sees their invitations"
  ON agency_invitations FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Ajans davet oluşturur
CREATE POLICY "Agencies create invitations"
  ON agency_invitations FOR INSERT
  WITH CHECK (
    agency_id = auth.uid()
    AND invited_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'agency'
    )
  );

-- Ajans daveti iptal edebilir, davet edilen kabul/reddedebilir
CREATE POLICY "Status updates by authorized parties"
  ON agency_invitations FOR UPDATE
  USING (
    agency_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 7. Trigger: Davet kabul edilince üye olarak ekle
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_agency_invitation_accepted_add_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepter_id UUID;
  accepter_role TEXT;
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

    -- Profesyonel mi kontrol et
    SELECT role INTO accepter_role FROM profiles WHERE id = accepter_id;
    IF accepter_role != 'professional' THEN
      RAISE EXCEPTION 'Only professionals can join agencies (found role: %)', accepter_role;
    END IF;

    -- Üye olarak ekle
    INSERT INTO agency_members (agency_id, professional_id, member_role)
    VALUES (NEW.agency_id, accepter_id, NEW.member_role)
    ON CONFLICT (agency_id, professional_id) DO NOTHING;

    -- invited_user_id'yi de set et (kayıttan sonra accept eden için)
    NEW.invited_user_id := accepter_id;
  END IF;

  -- declined/cancelled için responded_at set et
  IF OLD.status = 'pending' AND NEW.status IN ('declined', 'cancelled', 'expired') THEN
    NEW.responded_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agency_invitation_status_change
  BEFORE UPDATE ON agency_invitations
  FOR EACH ROW
  EXECUTE FUNCTION on_agency_invitation_accepted_add_member();

-- -----------------------------------------------------------------------------
-- 8. Trigger: Yeni davet → davet edilene bildirim (kayıtlıysa)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_agency_invitation_insert_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agency_name TEXT;
  recipient_id UUID;
BEGIN
  -- Davet edilen kullanıcı kayıtlı mı? (email ile bul, invited_user_id zaten varsa onu kullan)
  recipient_id := NEW.invited_user_id;
  IF recipient_id IS NULL THEN
    SELECT id INTO recipient_id FROM profiles WHERE email = NEW.invited_email LIMIT 1;
    IF recipient_id IS NOT NULL THEN
      -- Daveti güncelle (sessiz, recursion önle için trigger içinde UPDATE değil PREP yapıyoruz)
      NEW.invited_user_id := recipient_id;
    END IF;
  END IF;

  -- Sadece kayıtlı kullanıcılara in-app bildirim
  IF recipient_id IS NOT NULL THEN
    SELECT COALESCE(company_name, full_name, 'Bir ajans') INTO agency_name
    FROM profiles WHERE id = NEW.agency_id;

    INSERT INTO notifications (user_id, type, body, link)
    VALUES (
      recipient_id,
      'message',
      agency_name || ' seni ajansına davet etti',
      '/davetlerim'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE INSERT — invited_user_id'yi set etmek için
CREATE TRIGGER on_agency_invitation_insert_notify
  BEFORE INSERT ON agency_invitations
  FOR EACH ROW
  EXECUTE FUNCTION on_agency_invitation_insert_notify();

-- -----------------------------------------------------------------------------
-- 9. Trigger: Üye eklenince ajansa bildirim (kabul akışı sonrası ajansa haber ver)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_agency_member_insert_notify_agency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_name TEXT;
BEGIN
  SELECT full_name INTO member_name FROM profiles WHERE id = NEW.professional_id;

  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    NEW.agency_id,
    'message',
    COALESCE(member_name, 'Bir profesyonel') || ' ajansına katıldı',
    '/profil/ekibim'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agency_member_insert_notify
  AFTER INSERT ON agency_members
  FOR EACH ROW
  EXECUTE FUNCTION on_agency_member_insert_notify_agency();

-- -----------------------------------------------------------------------------
-- 10. Realtime
-- -----------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE agency_members;
ALTER PUBLICATION supabase_realtime ADD TABLE agency_invitations;

ALTER TABLE agency_invitations REPLICA IDENTITY FULL;
ALTER TABLE agency_members REPLICA IDENTITY FULL;