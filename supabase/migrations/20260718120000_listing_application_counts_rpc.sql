-- İlan listesi (DİLİM 2) — public başvuru sayısı için SECURITY DEFINER RPC.
--
-- Neden: applications RLS SELECT yalnız başvurana + ilan sahibine açık. /ilanlar
-- herkese açık liste; naive count her ziyaretçide 0 döner. Bu fonksiyon YALNIZCA
-- ilan başına başvuru SAYISINI döndürür (başvuru içeriği/kimliği DEĞİL) → gizlilik
-- güvenli, iş ilanı panolarındaki "X başvuru" gibi. Tek çağrı (id dizisi) → N+1 yok.
--
-- MANUEL uygulanır (Dashboard SQL Editor). `db push` KULLANMA. Idempotent
-- (CREATE OR REPLACE). Bu uygulanana kadar /ilanlar kartları sayıyı 0 gösterir
-- (sayfa RPC hatasını yutar).
BEGIN;

CREATE OR REPLACE FUNCTION public.listing_application_counts(listing_ids uuid[])
RETURNS TABLE(listing_id uuid, cnt integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT a.listing_id, count(*)::int AS cnt
  FROM public.applications a
  WHERE a.listing_id = ANY(listing_ids)
  GROUP BY a.listing_id;
$$;

-- Yalnız yürütme izni (aggregate döndürür); anon + giriş yapmış herkes çağırabilir.
REVOKE ALL ON FUNCTION public.listing_application_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.listing_application_counts(uuid[]) TO anon, authenticated;

COMMIT;
