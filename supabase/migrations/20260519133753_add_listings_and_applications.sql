-- =============================================================================
-- Faz 9 Parça 1: Listings (İlanlar) + Applications (Başvurular)
--
-- Hibrit pazaryeri modelinin "ilan modeli" tarafı.
-- Müşteri/business ilan açar, profesyoneller başvurur.
--
-- Tablolar:
--   listings — ilanlar (creator: customer/business)
--   applications — başvurular (applicant: professional)
--
-- 2 ENUM, 6 RLS policy seti, 4 trigger, Realtime publication.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUM types
-- -----------------------------------------------------------------------------

CREATE TYPE listing_status AS ENUM (
  'draft',      -- Taslak, henüz yayınlanmadı
  'published',  -- Yayında, başvuru kabul ediyor
  'closed',     -- Sahibi kapattı (başvuru kabul etmiyor ama hala görünür)
  'filled',     -- Profesyonel seçildi, iş kapandı
  'cancelled'   -- İptal edildi
);

CREATE TYPE application_status AS ENUM (
  'pending',      -- Yeni başvuru, ilan sahibi henüz cevap vermedi
  'shortlisted',  -- Kısa listede
  'accepted',     -- Kabul edildi (iş bu profesyonele verildi)
  'rejected',     -- Reddedildi
  'withdrawn'     -- Profesyonel kendi başvurusunu geri çekti
);

-- -----------------------------------------------------------------------------
-- 2. listings tablosu
-- -----------------------------------------------------------------------------

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,

  -- İçerik
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 30 AND 5000),
  requirements TEXT CHECK (requirements IS NULL OR char_length(requirements) <= 2000),

  -- Etkinlik detayları
  event_date DATE,
  event_type TEXT CHECK (
    event_type IS NULL OR
    event_type IN ('wedding', 'engagement', 'birthday', 'baby_shower',
                   'graduation', 'circumcision', 'corporate', 'other')
  ),
  location TEXT CHECK (location IS NULL OR char_length(location) <= 200),
  city_id INTEGER REFERENCES turkish_cities(id) ON DELETE SET NULL,
  guest_count INTEGER CHECK (guest_count IS NULL OR (guest_count >= 0 AND guest_count <= 100000)),

  -- Bütçe (opsiyonel - boş bırakılabilir, "open budget")
  budget_min DECIMAL(10, 2) CHECK (budget_min IS NULL OR budget_min >= 0),
  budget_max DECIMAL(10, 2) CHECK (budget_max IS NULL OR budget_max >= 0),
  currency TEXT NOT NULL DEFAULT 'TRY' CHECK (currency IN ('TRY')),

  -- Süreç
  status listing_status NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  views_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,

  -- Bütçe tutarlılığı
  CONSTRAINT valid_budget_range CHECK (
    budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max
  ),
  -- Etkinlik tarihi gelecekte olmalı (NULL olabilir)
  CONSTRAINT valid_event_date CHECK (
    event_date IS NULL OR event_date >= CURRENT_DATE - interval '1 day'
  ),
  -- expires_at gelecekte olmalı
  CONSTRAINT valid_expires_at CHECK (
    expires_at IS NULL OR expires_at > created_at
  )
);

CREATE INDEX listings_creator_id_idx ON listings(creator_id);
CREATE INDEX listings_category_id_idx ON listings(category_id);
CREATE INDEX listings_city_id_idx ON listings(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX listings_status_idx ON listings(status) WHERE status = 'published';
CREATE INDEX listings_published_at_idx ON listings(published_at DESC) WHERE status = 'published';
CREATE INDEX listings_expires_at_idx ON listings(expires_at) WHERE status = 'published' AND expires_at IS NOT NULL;
CREATE INDEX listings_event_date_idx ON listings(event_date) WHERE event_date IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. applications tablosu
-- -----------------------------------------------------------------------------

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  cover_message TEXT NOT NULL CHECK (char_length(cover_message) BETWEEN 20 AND 2000),
  proposed_amount DECIMAL(10, 2) CHECK (proposed_amount IS NULL OR proposed_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TRY',

  status application_status NOT NULL DEFAULT 'pending',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,

  -- Bir profesyonel bir ilana sadece bir kez başvurabilir
  UNIQUE (listing_id, applicant_id)
);

CREATE INDEX applications_listing_id_idx ON applications(listing_id);
CREATE INDEX applications_applicant_id_idx ON applications(applicant_id);
CREATE INDEX applications_status_idx ON applications(status);
CREATE INDEX applications_created_at_idx ON applications(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. RLS — listings
-- -----------------------------------------------------------------------------

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Yayınlanan ilanları herkes okuyabilir (giriş yapmamış kullanıcılar dahil)
CREATE POLICY "Published listings are public"
  ON listings FOR SELECT
  USING (status = 'published');

-- Kullanıcı kendi tüm ilanlarını görür (draft dahil)
CREATE POLICY "Users see their own listings"
  ON listings FOR SELECT
  USING (creator_id = auth.uid());

-- Müşteri/business kendi ilanını oluşturur
CREATE POLICY "Customers and businesses create listings"
  ON listings FOR INSERT
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('client', 'business')
    )
  );

-- Sahibi kendi ilanını güncelleyebilir
CREATE POLICY "Users update their own listings"
  ON listings FOR UPDATE
  USING (creator_id = auth.uid());

-- Sahibi kendi ilanını silebilir (sadece draft veya cancelled)
CREATE POLICY "Users delete their own draft listings"
  ON listings FOR DELETE
  USING (creator_id = auth.uid() AND status IN ('draft', 'cancelled'));

-- -----------------------------------------------------------------------------
-- 5. RLS — applications
-- -----------------------------------------------------------------------------

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Profesyonel kendi başvurularını görür
CREATE POLICY "Professionals see their own applications"
  ON applications FOR SELECT
  USING (applicant_id = auth.uid());

-- İlan sahibi kendi ilanlarına gelen başvuruları görür
CREATE POLICY "Listing owners see applications to their listings"
  ON applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = applications.listing_id
      AND l.creator_id = auth.uid()
    )
  );

-- Profesyonel published ilanlara başvurabilir
CREATE POLICY "Professionals apply to published listings"
  ON applications FOR INSERT
  WITH CHECK (
    applicant_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'professional'
    )
    AND EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = applications.listing_id
      AND l.status = 'published'
    )
  );

-- Hem ilan sahibi (status değiştirir) hem applicant (withdraw eder) güncelleyebilir
CREATE POLICY "Authorized parties update applications"
  ON applications FOR UPDATE
  USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = applications.listing_id
      AND l.creator_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 6. updated_at trigger fonksiyonu (zaten varsa atlanır)
-- -----------------------------------------------------------------------------

-- Aynı pattern profilelerde de var; reuse edilebilen generic versiyonu kullan
CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER applications_set_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 7. Trigger: published_at otomatik set
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_listing_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- İlan ilk kez published'a geçiyorsa published_at'i şimdiye set et
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    NEW.published_at := now();
  END IF;

  -- expires_at boşsa ve published olduysa, 30 gün otomatik süre koy
  IF NEW.status = 'published' AND NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '30 days';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_listing_publish_set_metadata
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION set_listing_published_at();

-- -----------------------------------------------------------------------------
-- 8. Trigger: Yeni başvuru → ilan sahibine bildirim
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_application_insert_notify_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  applicant_name TEXT;
  listing_title TEXT;
BEGIN
  SELECT l.creator_id, l.title INTO owner_id, listing_title
  FROM listings l WHERE l.id = NEW.listing_id;

  SELECT p.full_name INTO applicant_name
  FROM profiles p WHERE p.id = NEW.applicant_id;

  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    owner_id,
    'message',
    COALESCE(applicant_name, 'Bir profesyonel') || ' ilanına başvurdu: ' ||
      COALESCE(LEFT(listing_title, 60), 'İlan'),
    '/ilanlar/' || NEW.listing_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_application_insert_notify_owner
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION on_application_insert_notify_owner();

-- -----------------------------------------------------------------------------
-- 9. Trigger: Application status değişince applicant'a bildirim
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_application_status_change_notify_applicant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_body TEXT;
  listing_title TEXT;
BEGIN
  -- Status değişimi olmadıysa atla
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Sadece bu status'lerde bildirim at
  IF NEW.status NOT IN ('shortlisted', 'accepted', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Profesyonel kendi başvurusunu withdraw ediyorsa kendine bildirim atma
  -- (zaten withdraw yukarıdaki listede yok ama defensive)

  SELECT l.title INTO listing_title
  FROM listings l WHERE l.id = NEW.listing_id;

  notif_body := 'Başvurun ' ||
    CASE NEW.status
      WHEN 'shortlisted' THEN 'kısa listeye alındı: '
      WHEN 'accepted' THEN 'kabul edildi 🎉: '
      WHEN 'rejected' THEN 'reddedildi: '
    END ||
    COALESCE(LEFT(listing_title, 60), 'İlan');

  NEW.responded_at := now();

  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    NEW.applicant_id,
    'message',
    notif_body,
    '/basvurularim'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_application_status_change_notify_applicant
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION on_application_status_change_notify_applicant();

-- -----------------------------------------------------------------------------
-- 10. Realtime: listings + applications publication'a ekle
-- -----------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE listings;
ALTER PUBLICATION supabase_realtime ADD TABLE applications;

-- Realtime UPDATE event'lerinde tüm satır bilgisi gelsin (status değişimi için)
ALTER TABLE applications REPLICA IDENTITY FULL;