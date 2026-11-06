-- =============================================================================
-- GUVENLIK 07 - sohbet kanali ve kendi dosyasi (bulgu 109, 110e)
--
--   109. Sohbetin "cevrimici / yaziyor" kanali (`messages:<sohbet>`) herkese
--        acik kanaldi: sohbet kimligini bilen herkes (girissiz dahil) katilip
--        karsi tarafin durumunu gorebilir, sahte "yaziyor" gonderebilirdi.
--        Uygulama kanali artik ozel (`private: true`) aciyor; ozel kanala
--        katilma ve yayin (broadcast / presence) yalniz sohbeti gorebilen
--        kisiye: taraf, atanan uye, kurum uyesi (mesaj okuma kuraliyla ayni).
--        Yeni mesajlarin canli akisi (postgres_changes) zaten mesaj satir
--        kuralina bagli, degismedi.
--   110e. Ozel kovalarda (mesaj / teklif talebi / basvuru eki) yukleyen kisi,
--        henuz bir satira baglanmamis KENDI dosyasini goremiyordu; bu yuzden
--        basarisiz gonderimden sonraki temizlik (dosyayi silme) sessizce
--        dusuyor, dosya sahipsiz kaliyordu. Yukleyen kendi klasorunu okur.
-- Kontrol: docs/envanter/asama30-guvenlik07-kontrol.sql (yapi + bilgi).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sohbet kanali (bulgu 109)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv07_sohbet_kanali(p_konu text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ben uuid := auth.uid();
  v_sohbet uuid;
BEGIN
  IF v_ben IS NULL OR p_konu IS NULL
     OR p_konu !~ '^messages:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_sohbet := substr(p_konu, length('messages:') + 1)::uuid;

  RETURN EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = v_sohbet
       AND (c.customer_id = v_ben
            OR c.professional_id = v_ben
            OR public.is_assignee(c.id, v_ben)
            OR public.is_business_member(c.customer_id))
  );
END;
$$;

COMMENT ON FUNCTION public.fn_guv07_sohbet_kanali(text) IS
  'Guvenlik 07: ozel sohbet kanalina (messages:<sohbet>) katilabilir / yayin yapabilir mi.';

REVOKE ALL ON FUNCTION public.fn_guv07_sohbet_kanali(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_guv07_sohbet_kanali(text) TO authenticated;

DROP POLICY IF EXISTS "sohbet_kanali_okuma_guv07" ON realtime.messages;
CREATE POLICY "sohbet_kanali_okuma_guv07" ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.fn_guv07_sohbet_kanali((SELECT realtime.topic()))
  );

DROP POLICY IF EXISTS "sohbet_kanali_yazma_guv07" ON realtime.messages;
CREATE POLICY "sohbet_kanali_yazma_guv07" ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.fn_guv07_sohbet_kanali((SELECT realtime.topic()))
  );

-- -----------------------------------------------------------------------------
-- 2) Ozel kovalarda kendi klasoru (bulgu 110e)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "kendi_eki_okuma_guv07" ON storage.objects;
CREATE POLICY "kendi_eki_okuma_guv07" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('message-attachments', 'quote-attachments', 'application-attachments')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 3) Son dogrulama
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policy
       WHERE polrelid = 'realtime.messages'::regclass
         AND polname IN ('sohbet_kanali_okuma_guv07', 'sohbet_kanali_yazma_guv07')) <> 2 THEN
    RAISE EXCEPTION 'Guvenlik 07: sohbet kanali kurallari eksik';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                  WHERE polrelid = 'storage.objects'::regclass AND polname = 'kendi_eki_okuma_guv07') THEN
    RAISE EXCEPTION 'Guvenlik 07: kendi eki kurali yok';
  END IF;
  IF has_function_privilege('anon', 'public.fn_guv07_sohbet_kanali(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Guvenlik 07: kanal fonksiyonu girissize acik';
  END IF;
END;
$$;
