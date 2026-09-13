-- =============================================================================
-- FAZ -1 / 08 — Grup D surum farklari (iki tarafta da VAR, tanimi FARKLI)
--
-- KAYNAK: Bos veritabanina zincir testi (yerel PostgreSQL 16, 14 Eylul 2026).
--         44 dosyanin tamami kosturulup ortaya cikan sema, uretim dokumleriyle
--         (docs/envanter/uretim-dokum/*.csv) NESNE-NESNE karsilastirildi.
--         Iki taraf da Postgres tarafindan render edildigi icin (pg_get_functiondef,
--         pg_get_constraintdef, pg_policies) bicimsel yanlis pozitif YOKTUR.
--
-- 04-sema-uzlastirma.md ve 05-onarim-raporu.md "Grup D'ye dokunulmadi" demisti;
-- metin-bazli karsilastirma su GERCEK farklari kacirmisti:
--
--   Fonksiyon govdesi (2): handle_new_user, on_quote_accepted_create_booking
--   Politika          (4): is_assignee() atama katmani uretimde var, zincirde yok
--   Politika silme    (1): "Professionals apply to published listings" uretimde yok
--                          (06'daki "Pros and agencies apply..." onun yerini almis)
--   CHECK kisiti      (3): listings_description_check (>=10, zincirde >=30)
--                          listings_title_check       (>=3,  zincirde >=10)
--                          notifications_type_check   (5 tur, zincirde 3 tur)
--   Kisit silme       (1): listings.valid_event_date uretimde yok
--
-- Sonuc: bu dosya olmadan zincir "hatasiz" biter ama sema uretime ESIT DEGILDIR
-- (ornek: zincirle kurulan DB'de yeni client kullanicilar 'pending' kalir,
--  listing_invitation bildirimi CHECK ihlaliyle duser).
--
-- SIRA: 03 (is_assignee) ve 06 (politikalar) sonrasi; zincirin geri kalaninda
--       bu nesnelere dokunan dosya yoktur (grep ile dogrulandi).
--
-- KURALLAR (bu dosyalarin tamaminda gecerli):
--   * VERI DEGISTIRILMEZ — hicbir INSERT/UPDATE/DELETE yoktur, yalniz DDL.
--   * CATISMADA URETIM KAZANIR — tanimlar uretim dokumundan birebir alinmistir.
--   * IDEMPOTENT — uretimde kosturulunca hicbir sey degismez (kisitlar tanim
--     esitligi kontroluyle atlanir; CREATE OR REPLACE ve DROP+CREATE ayni sonucu verir).
--
-- UYGULAMA: Supabase Dashboard > SQL Editor. Terminale yapistirilmaz.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Fonksiyon govdeleri (2) — fonksiyon-govdeleri-*.csv, birebir
-- -----------------------------------------------------------------------------

-- handle_new_user: uretim surumu city_id, kvkk_approved_at, approval_status ve
-- approved_at alanlarini da yazar (client -> approved, digerleri -> pending).
-- Zincirdeki 20260520151810 surumu bunlari bilmez.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  user_full_name TEXT;
  user_company_name TEXT;
  user_phone TEXT;
  user_city_id INT;
  user_kvkk TIMESTAMPTZ;
  user_approval public.profile_approval_status;
  user_approved_at TIMESTAMPTZ;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  user_company_name := NEW.raw_user_meta_data->>'company_name';
  user_phone := NEW.raw_user_meta_data->>'phone';
  user_city_id := NULLIF(NEW.raw_user_meta_data->>'city_id', '')::INT;

  IF (NEW.raw_user_meta_data->>'kvkk_approved') = 'true' THEN
    user_kvkk := now();
  ELSE
    user_kvkk := NULL;
  END IF;

  -- Rol normalize
  user_role := CASE
    WHEN user_role IN ('customer', 'müşteri', 'musteri')        THEN 'client'
    WHEN user_role IN ('corporate', 'kurumsal')                  THEN 'business'
    WHEN user_role IN ('pro', 'profesyonel')                     THEN 'professional'
    WHEN user_role IN ('ajans')                                  THEN 'agency'
    WHEN user_role IN ('professional', 'client', 'business', 'agency')
                                                                  THEN user_role
    ELSE 'client'
  END;

  -- Onay durumu: client onaysız (approved), diğerleri pending
  IF user_role = 'client' THEN
    user_approval := 'approved';
    user_approved_at := now();
  ELSE
    user_approval := 'pending';
    user_approved_at := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, company_name, phone, city_id,
    kvkk_approved_at, approval_status, approved_at
  )
  VALUES (
    NEW.id, NEW.email, user_full_name, user_role, user_company_name,
    user_phone, user_city_id, user_kvkk, user_approval, user_approved_at
  );

  RETURN NEW;
END;
$function$;

-- on_quote_accepted_create_booking: uretim surumu start_time / end_time'i
-- conversations'tan bookings'e tasir (00'da eklenen sutunlar).
CREATE OR REPLACE FUNCTION public.on_quote_accepted_create_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  conv record;
begin
  if old.status = 'pending' and new.status = 'accepted' then
    new.responded_at := now();

    select customer_id, professional_id, event_date, event_type,
           location, guest_count, start_time, end_time
    into conv
    from conversations
    where id = new.conversation_id;

    insert into bookings (
      quote_id, conversation_id,
      customer_id, professional_id,
      event_date, event_type, location, guest_count,
      start_time, end_time,
      total_amount, platform_fee, currency,
      status
    ) values (
      new.id, new.conversation_id,
      conv.customer_id, conv.professional_id,
      conv.event_date, conv.event_type, conv.location, conv.guest_count,
      conv.start_time, conv.end_time,
      new.total_amount, 0, new.currency,
      'confirmed'
    );
  end if;

  if old.status = 'pending' and new.status in ('declined', 'withdrawn', 'expired') then
    new.responded_at := now();
  end if;

  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 2) Politikalar — politika-ifadeleri-*.csv, birebir
-- Dort politika uretimde is_assignee(conversation, uid) dalini icerir
-- (conversation_assignees uzerinden atanan ajans uyeleri). is_assignee 03'te kurulur.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT
  TO public
  USING (((auth.uid() = customer_id) OR (auth.uid() = professional_id) OR is_assignee(id, auth.uid())));

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.customer_id = auth.uid()) OR (c.professional_id = auth.uid()) OR is_assignee(c.id, auth.uid()))))));

DROP POLICY IF EXISTS "Quotes visible to conversation participants" ON public.quotes;
CREATE POLICY "Quotes visible to conversation participants" ON public.quotes
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = quotes.conversation_id) AND ((c.customer_id = auth.uid()) OR (c.professional_id = auth.uid()) OR is_assignee(c.id, auth.uid()))))));

DROP POLICY IF EXISTS "Professional creates quotes in their conversations" ON public.quotes;
CREATE POLICY "Professional creates quotes in their conversations" ON public.quotes
  FOR INSERT
  TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = quotes.conversation_id) AND (((c.professional_id = auth.uid()) AND (quotes.sender_id = auth.uid())) OR ((quotes.sender_id = c.professional_id) AND is_assignee(c.id, auth.uid())))))));

-- Uretimde yok: 20260519133753'teki eski INSERT politikasi. 06'daki
-- "Pros and agencies apply to published listings" onun yerini almistir.
DROP POLICY IF EXISTS "Professionals apply to published listings" ON public.applications;

-- -----------------------------------------------------------------------------
-- 3) Kisitlar — tum-kisitlar.csv, birebir
-- Tanim zaten uretimle ayniysa (uretimde kosturulunca) hicbir sey yapilmaz.
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'listings_description_check'
       AND conrelid = 'public.listings'::regclass
       AND pg_get_constraintdef(oid) = 'CHECK (((char_length(description) >= 10) AND (char_length(description) <= 5000)))'
  ) THEN
    ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_description_check;
    ALTER TABLE public.listings ADD CONSTRAINT listings_description_check CHECK (((char_length(description) >= 10) AND (char_length(description) <= 5000)));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'listings_title_check'
       AND conrelid = 'public.listings'::regclass
       AND pg_get_constraintdef(oid) = 'CHECK (((char_length(title) >= 3) AND (char_length(title) <= 200)))'
  ) THEN
    ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_title_check;
    ALTER TABLE public.listings ADD CONSTRAINT listings_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 200)));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notifications_type_check'
       AND conrelid = 'public.notifications'::regclass
       AND pg_get_constraintdef(oid) = 'CHECK ((type = ANY (ARRAY[''message''::text, ''review''::text, ''review_reply''::text, ''listing_invitation''::text, ''booking_request''::text])))'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['message'::text, 'review'::text, 'review_reply'::text, 'listing_invitation'::text, 'booking_request'::text])));
  END IF;
END $$;

-- Uretimde yok: 20260519133753'teki gecmis-tarih kisiti.
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS valid_event_date;

COMMIT;
