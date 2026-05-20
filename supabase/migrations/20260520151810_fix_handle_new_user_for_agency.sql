-- =============================================================================
-- handle_new_user trigger fonksiyonunu güncelle:
--   1. 'agency' rolünü kabul et (Faz 10 ile eklendi)
--   2. company_name ve phone metadata'dan oku, profile'a yaz
--
-- Ayrıca: mevcut Sunucu Ajans hesabını manuel düzelt (test verisi).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. handle_new_user fonksiyonunu güncelle
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_full_name TEXT;
  user_company_name TEXT;
  user_phone TEXT;
BEGIN
  -- raw_user_meta_data'dan değerleri al
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  user_company_name := NEW.raw_user_meta_data->>'company_name';
  user_phone := NEW.raw_user_meta_data->>'phone';

  -- Eski/yanlış rol değerlerini normalize et + agency desteği
  user_role := CASE
    WHEN user_role IN ('customer', 'müşteri', 'musteri')        THEN 'client'
    WHEN user_role IN ('corporate', 'kurumsal')                  THEN 'business'
    WHEN user_role IN ('pro', 'profesyonel')                     THEN 'professional'
    WHEN user_role IN ('ajans')                                  THEN 'agency'
    WHEN user_role IN ('professional', 'client', 'business', 'agency')
                                                                  THEN user_role
    ELSE 'client'  -- bilinmeyen değer gelirse default
  END;

  INSERT INTO public.profiles (id, email, full_name, role, company_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_role,
    user_company_name,  -- null olabilir
    user_phone           -- null olabilir
  );

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Mevcut Sunucu Ajans hesabını manuel düzelt
--    (Test ajans hesabı yanlış role='client' ile oluştu)
-- -----------------------------------------------------------------------------

UPDATE profiles
SET
  role = 'agency',
  company_name = 'Sunucu Ajans'
WHERE email = 'guvenyapicioglu@gmail.com'
AND role = 'client';