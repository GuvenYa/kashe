-- ADMİN EXCEL RAPORU — RLS-bypass sayım RPC'si.
--
-- Sorun: /admin/rapor rotası bookings/quotes'u admin oturumuyla DOĞRUDAN okuyordu.
-- Bu tablolarda admin'e bilinçli SELECT yok → RLS yalnız admin'in TARAF OLDUĞU
-- kayıtları döndürüyor → Özet + Aylık trend eksik sayıyordu (11→1, 26→3).
--
-- Çözüm: SECURITY DEFINER fonksiyon RLS'i baypas edip aylık gruplu doğru sayımı verir.
-- İç guard admin dışını reddeder (admin-preview migration'ındaki inline EXISTS kalıbı;
-- is_admin() drift fonksiyonuna YENİ bağımlılık yok).
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). `db push` KULLANMA.
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.admin_report_stats()
RETURNS TABLE(metric text, month text, cnt bigint)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- İç guard: yalnız admin. (auth.uid() SECURITY DEFINER içinde de JWT'den okunur.)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'admin yetkisi gerekli';
  END IF;

  RETURN QUERY
  SELECT 'bookings'::text AS metric,
         to_char(b.created_at, 'YYYY-MM') AS month,
         count(*)::bigint AS cnt
  FROM public.bookings b
  GROUP BY to_char(b.created_at, 'YYYY-MM')
  UNION ALL
  SELECT 'quotes'::text AS metric,
         to_char(q.created_at, 'YYYY-MM') AS month,
         count(*)::bigint AS cnt
  FROM public.quotes q
  GROUP BY to_char(q.created_at, 'YYYY-MM');
END;
$$;

-- Yalnız authenticated çağırabilir (guard zaten admin'e kısar); anon'a YOK.
REVOKE ALL ON FUNCTION public.admin_report_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_report_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_report_stats() TO authenticated;

-- =============================================================================
-- DOĞRULAMA (uygulama SONRASI SQL Editor'de çalıştır)
-- =============================================================================
-- Fonksiyon + güvenlik:
-- select proname, prosecdef, proconfig from pg_proc where proname='admin_report_stats';
-- Admin oturumuyla (SQL Editor admin rolüyle çalışır) toplamlar:
-- select metric, sum(cnt) as toplam from public.admin_report_stats() group by metric;
--   -- beklenen: bookings=gerçek toplam (ör. 11), quotes=gerçek toplam (ör. 26)
-- Aylık dağılım:
-- select * from public.admin_report_stats() order by metric, month;
