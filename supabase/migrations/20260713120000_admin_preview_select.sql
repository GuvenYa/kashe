-- ADMIN ÖNİZLEME — additive SELECT policy'leri (yayında OLMAYAN profil içeriği)
--
-- Sorun: admin, yayında olmayan bir profili /p/[id]'de önizleyebiliyor (sayfa,
-- profiles'ın admin-read'i ile yükleniyor; üstte "Önizleme" bandı çıkıyor) ama
-- içerik tabloları "sahibi VEYA yayında" SELECT RLS'ine takıldığından admin'e boş
-- dönüyor → iskelet sayfa. Bu migration bu içerik tablolarına ADDITIVE bir admin
-- SELECT policy ekler. Mevcut sahip/yayında policy'lerine DOKUNMAZ (permissive
-- policy'ler OR'lanır → yayın davranışı, sahiplik ve halkın gördüğü hiç değişmez).
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). `db push` KULLANMA.
-- Idempotent + taze-DB güvenli: her tablo to_regclass ile guard'lı;
-- DROP POLICY IF EXISTS + CREATE. Tekrar çalıştırılabilir.
--
-- Admin gate KONVANSİYONU: bu repoda RLS için is_admin() SQL fonksiyonu YOK; admin
-- kontrolü policy'lerde inline EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid()
-- AND p.is_admin=true) ile yapılır (kaynak: 20260716120000_testimonials.sql).
--
-- KAPSAM DIŞI (bilerek):
--   • YAZMA (INSERT/UPDATE/DELETE) policy'lerine DOKUNULMAZ — yalnız SELECT.
--   • bookings / quotes'a admin SELECT AÇILMAZ (ticari veri; önizleme için gereksiz).
--     Sonuç: deal/repeat rozetleri önizlemede eşik altı kalıp ÇİZİLMEZ — kabul edilen
--     davranış (over-claim yok).
--   • reviews / review_replies zaten "USING (true)" ile herkese açık → admin okur,
--     dokunmaya gerek yok. professional_rating_summary bunların view'ı → otomatik açık.
--   • profiles admin-read hâlihazırda çalışıyor (admin paneli + önizleme bandı kanıt) →
--     dokunulmaz.

BEGIN;

DO $$
BEGIN
  -- portfolio_items — initial_schema: read_own + read_published (admin kapalı)
  IF to_regclass('public.portfolio_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS portfolio_admin_read ON public.portfolio_items;
    CREATE POLICY portfolio_admin_read ON public.portfolio_items
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;

  -- services — initial_schema: read_own + read_published(is_active) (admin kapalı)
  IF to_regclass('public.services') IS NOT NULL THEN
    DROP POLICY IF EXISTS services_admin_read ON public.services;
    CREATE POLICY services_admin_read ON public.services
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;

  -- service_addons — services altında nested okunur (drift: policy migration'da yok)
  IF to_regclass('public.service_addons') IS NOT NULL THEN
    DROP POLICY IF EXISTS service_addons_admin_read ON public.service_addons;
    CREATE POLICY service_addons_admin_read ON public.service_addons
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;

  -- service_packages — Paketler bölümü (drift: Dashboard'da kurulmuş, policy migration'da yok)
  IF to_regclass('public.service_packages') IS NOT NULL THEN
    DROP POLICY IF EXISTS service_packages_admin_read ON public.service_packages;
    CREATE POLICY service_packages_admin_read ON public.service_packages
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;

  -- profile_experiences — 20260711 redesign: read_own + read_published (admin kapalı)
  IF to_regclass('public.profile_experiences') IS NOT NULL THEN
    DROP POLICY IF EXISTS profile_experiences_admin_read ON public.profile_experiences;
    CREATE POLICY profile_experiences_admin_read ON public.profile_experiences
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;

  -- availability_blocks — Müsaitlik takvimi (drift: policy migration'da yok)
  IF to_regclass('public.availability_blocks') IS NOT NULL THEN
    DROP POLICY IF EXISTS availability_blocks_admin_read ON public.availability_blocks;
    CREATE POLICY availability_blocks_admin_read ON public.availability_blocks
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;

  -- agency_members — rail'deki "temsil eden ajans" mini kartı (drift: policy migration'da yok)
  IF to_regclass('public.agency_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS agency_members_admin_read ON public.agency_members;
    CREATE POLICY agency_members_admin_read ON public.agency_members
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- DOĞRULAMA (uygulama SONRASI SQL Editor'de çalıştır)
-- =============================================================================
-- 1) Admin policy'lerinin oluştuğunu gör (7 satır beklenir; mevcut tablolar kadar):
-- select tablename, policyname, cmd from pg_policies
--   where policyname like '%admin_read%' order by tablename;
--
-- 2) bookings/quotes'a admin SELECT EKLENMEDİĞİNİ doğrula (0 satır dönmeli):
-- select tablename, policyname from pg_policies
--   where tablename in ('bookings','quotes') and policyname ilike '%admin%';
--
-- 3) Önizleme testi: admin oturumuyla yayında-OLMAYAN bir profilin /p/[id] sayfasında
--    Portföy / Hizmetler / Paketler / Deneyim / Müsaitlik bölümlerinin DOLU geldiğini,
--    deal/repeat rozetlerinin ise ÇIKMADIĞINI gör.
