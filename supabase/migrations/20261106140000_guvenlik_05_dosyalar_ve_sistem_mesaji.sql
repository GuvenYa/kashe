-- =============================================================================
-- GUVENLIK 05 - dosyalar ve sistem mesaji (bulgu 91, 105-107)
--
-- Bulgu (6 Kasim 2026, Guvenlik 04 sonrasi dosya deposu taramasi; dal ve
-- uretimde girissiz salt okuma listeleme denemesi):
--   105. avatars / portfolio / blog kovalarinda "herkes okur" politikasi
--        girissiz ziyaretciye kovayi LISTELEME izni veriyordu: tum kullanici
--        kimlikleri (klasor adlari) ve dosya adlari cikiyordu; Guvenlik 04 ile
--        gizlenen musterilerin kimligi ve fotografi da buradan bulunabiliyordu
--        (uretimde 6 avatar klasoru listelendi, biri gizli profil). Kamu
--        dosyalari zaten herkese acik baglantiyla sunuluyor; listeleme gereksiz.
--   106. Kurum ekibi (ve ilan basvurularinda kurum yoneticisi) sohbet / teklif
--        talebi / basvuru satirlarini gorebiliyor ama eklerini acamiyordu
--        (dosya kurali yalniz dogrudan taraflari tanimiyordu; ekibin kendi
--        yukledigi dosya bile acilmiyordu).
--   91.  Sohbet taraflari mesaji message_type = 'system' ile ekleyebiliyordu
--        ("Teklif onaylandi" gibi sahte sistem satiri).
--   107. 'quote' turlu mesaj baska bir sohbetin teklifini gosterebiliyor ya da
--        ayni teklif ikinci kez eklenebiliyordu (dusuk).
--
-- Cozum:
--   105 -> kamu kovalarinda okuma (listeleme) yalniz kendi klasorune; blog
--          yalniz yoneticiye. Kamu baglantilari degismez.
--   106 -> ek okuma kurallari tablo okuma kurallariyla ayni: sohbet = taraf,
--          atanan uye, kurum uyesi; teklif talebi = musteri, alici, kurum
--          uyesi; basvuru = basvuran, ilan sahibi, kurum yoneticisi.
--   91  -> istemci 'system' satiri ekleyemez; uygulamanin dort sistem satiri
--          sistem_mesaji_ekle RPC'si ile, durum dogrulanarak yazilir (metin
--          sunucuda sabit). Veritabani tetikleyicileri (teklif onay / ret,
--          ekip atamasi) etkilenmez.
--   107 -> 'quote' satiri yalniz ayni sohbetin teklifini, bir kez gosterir.
-- Sistem (auth.uid() bos) ve tanimlayan yetkisiyle calisan fonksiyonlar serbest.
-- Kontrol: docs/envanter/asama29-guvenlik05-kontrol.sql (yapi),
-- asama29b-guvenlik05-davranis.sql (davranis, YALNIZ dal).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Kamu kovalarinda listeleme (bulgu 105)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
DROP POLICY IF EXISTS "avatars_okuma_kendi_guv05" ON storage.objects;
CREATE POLICY "avatars_okuma_kendi_guv05" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "portfolio_read_all" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_okuma_kendi_guv05" ON storage.objects;
CREATE POLICY "portfolio_okuma_kendi_guv05" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "blog_storage_public_read" ON storage.objects;
DROP POLICY IF EXISTS "blog_okuma_yonetici_guv05" ON storage.objects;
CREATE POLICY "blog_okuma_yonetici_guv05" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'blog' AND public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- 2) Ek okuma = tablo okuma (bulgu 106)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Applicant and listing owner read application attachments" ON storage.objects;
DROP POLICY IF EXISTS "basvuru_eki_okuma_guv05" ON storage.objects;
CREATE POLICY "basvuru_eki_okuma_guv05" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-attachments'
    AND EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.listings l ON l.id = a.listing_id
       WHERE a.attachment_path = objects.name
         AND (a.applicant_id = auth.uid()
              OR l.creator_id = auth.uid()
              OR public.has_business_role(l.creator_id, 'manager'::public.business_member_role))
    )
  );

DROP POLICY IF EXISTS "Conversation parties read message attachments" ON storage.objects;
DROP POLICY IF EXISTS "mesaj_eki_okuma_guv05" ON storage.objects;
CREATE POLICY "mesaj_eki_okuma_guv05" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
       WHERE m.attachment_path = objects.name
         AND (c.customer_id = auth.uid()
              OR c.professional_id = auth.uid()
              OR public.is_assignee(c.id, auth.uid())
              OR public.is_business_member(c.customer_id))
    )
  );

DROP POLICY IF EXISTS "Customer and recipients read quote attachments" ON storage.objects;
DROP POLICY IF EXISTS "talep_eki_okuma_guv05" ON storage.objects;
CREATE POLICY "talep_eki_okuma_guv05" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'quote-attachments'
    AND EXISTS (
      SELECT 1
        FROM public.quote_requests qr
       WHERE qr.attachment_path = objects.name
         AND (qr.customer_id = auth.uid()
              OR public.is_business_member(qr.customer_id)
              OR EXISTS (SELECT 1 FROM public.quote_request_recipients r
                          WHERE r.request_id = qr.id AND r.professional_id = auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 3) Sistem satiri RPC'si (bulgu 91)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sistem_mesaji_ekle(
  p_sohbet uuid,
  p_tur text,
  p_kayit uuid DEFAULT NULL,
  p_metin text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ben uuid := auth.uid();
  v_sohbet public.conversations%ROWTYPE;
  v_govde text;
  v_zaman timestamptz;
  v_id uuid;
  b record;
BEGIN
  IF v_ben IS NULL THEN
    RAISE EXCEPTION 'Oturum gerekli' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sohbet FROM public.conversations WHERE id = p_sohbet;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sohbet bulunamadi' USING ERRCODE = '42501';
  END IF;

  -- Mesaj ekleme kuraliyla ayni: taraf ya da musteri kurumunun yoneticisi
  IF NOT (v_sohbet.customer_id = v_ben
          OR v_sohbet.professional_id = v_ben
          OR public.has_business_role(v_sohbet.customer_id, 'manager'::public.business_member_role)) THEN
    RAISE EXCEPTION 'Bu sohbete yazma yetkin yok' USING ERRCODE = '42501';
  END IF;

  IF p_tur = 'basvuru_kabul' THEN
    -- Ilan sahibi (ya da kurum yoneticisi) kabul ettigi basvurunun sohbetine
    IF NOT EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.listings l ON l.id = a.listing_id
       WHERE a.id = p_kayit
         AND a.status = 'accepted'
         AND l.creator_id = v_sohbet.customer_id
         AND a.applicant_id = v_sohbet.professional_id
         AND (l.creator_id = v_ben
              OR public.has_business_role(l.creator_id, 'manager'::public.business_member_role))
    ) THEN
      RAISE EXCEPTION 'Kabul edilmis basvuru bulunamadi' USING ERRCODE = '42501';
    END IF;
    v_govde := 'Başvurun kabul edildi. Detayları buradan konuşabilirsiniz.';
    v_zaman := NULL;

  ELSIF p_tur IN ('rezervasyon_iptal', 'rezervasyon_tamam') THEN
    SELECT id, status, customer_id, professional_id, cancelled_by, cancelled_at, completed_at
      INTO b
      FROM public.bookings
     WHERE id = p_kayit AND conversation_id = p_sohbet;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rezervasyon bulunamadi' USING ERRCODE = '42501';
    END IF;

    IF p_tur = 'rezervasyon_iptal' THEN
      IF b.status <> 'cancelled' OR b.cancelled_by IS DISTINCT FROM v_ben
         OR NOT (v_ben = b.customer_id OR v_ben = b.professional_id) THEN
        RAISE EXCEPTION 'Iptal kaydi dogrulanamadi' USING ERRCODE = '42501';
      END IF;
      v_govde := CASE WHEN v_ben = b.customer_id
                      THEN 'Müşteri rezervasyonu iptal etti'
                      ELSE 'Profesyonel rezervasyonu iptal etti' END;
      v_zaman := b.cancelled_at;
    ELSE
      IF b.status <> 'completed' OR b.professional_id IS DISTINCT FROM v_ben THEN
        RAISE EXCEPTION 'Tamamlama kaydi dogrulanamadi' USING ERRCODE = '42501';
      END IF;
      v_govde := 'Profesyonel işi tamamlandı olarak işaretledi';
      v_zaman := b.completed_at;
    END IF;

  ELSIF p_tur = 'rezervasyon_talebi' THEN
    -- Musteri tarafinin rezervasyon talebi notu (tarih / saat / yer kendi verisi)
    IF NOT (v_sohbet.customer_id = v_ben
            OR public.has_business_role(v_sohbet.customer_id, 'manager'::public.business_member_role)) THEN
      RAISE EXCEPTION 'Rezervasyon talebini yalniz musteri tarafi yazar' USING ERRCODE = '42501';
    END IF;
    IF p_metin IS NULL
       OR left(p_metin, length('📅 Rezervasyon talebi — Tarih: ')) <> '📅 Rezervasyon talebi — Tarih: '
       OR length(p_metin) > 500 THEN
      RAISE EXCEPTION 'Gecersiz rezervasyon talebi metni' USING ERRCODE = '22023';
    END IF;
    v_govde := p_metin;
    v_zaman := NULL;

  ELSE
    RAISE EXCEPTION 'Bilinmeyen sistem mesaji turu' USING ERRCODE = '22023';
  END IF;

  -- Ayni olay icin ikinci satir yazilmaz
  IF v_zaman IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.messages m
        WHERE m.conversation_id = p_sohbet
          AND m.message_type = 'system'
          AND m.body = v_govde
          AND m.created_at >= v_zaman - interval '1 minute') THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body, message_type)
  VALUES (p_sohbet, v_ben, v_govde, 'system')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.sistem_mesaji_ekle(uuid, text, uuid, text) IS
  'Guvenlik 05: uygulamanin sistem satirlari (basvuru kabulu, rezervasyon iptali / tamamlama / talebi) durum dogrulanarak yazilir.';

REVOKE ALL ON FUNCTION public.sistem_mesaji_ekle(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sistem_mesaji_ekle(uuid, text, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) Istemci mesaj ekleme turleri (bulgu 91, 107)
-- Cagiranin yetkisiyle calisir (SECURITY INVOKER): current_user dogrudan
-- istekte anon / authenticated, tanimlayan yetkili fonksiyonda (RPC,
-- tetikleyici) fonksiyon sahibidir.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv05_mesaj_turu()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF NEW.message_type = 'system' THEN
    RAISE EXCEPTION 'Sistem mesaji dogrudan eklenemez' USING ERRCODE = '42501';
  END IF;

  IF NEW.message_type = 'quote' THEN
    IF NOT EXISTS (SELECT 1 FROM public.quotes q
                    WHERE q.id = NEW.quote_id AND q.conversation_id = NEW.conversation_id) THEN
      RAISE EXCEPTION 'Teklif bu sohbete ait degil' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.messages m
                WHERE m.quote_id = NEW.quote_id AND m.message_type = 'quote') THEN
      RAISE EXCEPTION 'Bu teklif zaten mesajda' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv05_mesaj_turu ON public.messages;
CREATE TRIGGER trg_guv05_mesaj_turu
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv05_mesaj_turu();

-- -----------------------------------------------------------------------------
-- 5) Son dogrulama
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy
              WHERE polrelid = 'storage.objects'::regclass
                AND polcmd IN ('r', '*')
                AND pg_get_expr(polqual, polrelid) IN ('(bucket_id = ''avatars''::text)',
                                                       '(bucket_id = ''portfolio''::text)',
                                                       '(bucket_id = ''blog''::text)')) THEN
    RAISE EXCEPTION 'Guvenlik 05: kamu kovasinda kosulsuz okuma politikasi kaldi';
  END IF;
  IF (SELECT count(*) FROM pg_policy
       WHERE polrelid = 'storage.objects'::regclass AND polname LIKE '%\_guv05') <> 6 THEN
    RAISE EXCEPTION 'Guvenlik 05: dosya politikalari eksik';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.messages'::regclass AND tgname = 'trg_guv05_mesaj_turu') THEN
    RAISE EXCEPTION 'Guvenlik 05: mesaj turu tetikleyicisi yok';
  END IF;
  IF has_function_privilege('anon', 'public.sistem_mesaji_ekle(uuid, text, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Guvenlik 05: sistem_mesaji_ekle girissize acik';
  END IF;
END;
$$;
