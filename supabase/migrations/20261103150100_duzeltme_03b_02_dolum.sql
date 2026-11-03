-- =============================================================================
-- Duzeltme 03-B / 02 — DOLUM (veri degistirir; 01 dosyasindan sonra)
--   D1) Onaylanmis dogrudan teklifler: musteri e-postasi bir Kashe hesabiyla eslesiyorsa
--       proposals.buyer_user_id dolar; o tekliflerin rezervasyonlarinda customer_id bossa dolar
--       (03-B/01 kurali gecmise uygulanir; yalniz birebir e-posta esi, satici kurulusun kendi
--       hesabi haric). Uretimde eslesmeyen satir degismez.
--   D2) Suresi gecmis bekleyen sohbet teklifleri bir kez 'expired' yapilir (gunluk is 00:20'de
--       devam eder). 7 gunden eski olanlar SISTEM MESAJI YAZILMADAN kapanir: sistem mesaji
--       conversations.last_message_at'i guncelliyor, aylar once olmus sohbetler gelen kutusunun
--       tepesine cikmasin (tetikleyici gecici kapatilir, ayni blokta acilir ve dogrulanir).
--       Son 7 gun icindekiler normal yoldan (mesajli) kapanir.
-- Idempotan: ikinci kosuda 0 satir.
-- =============================================================================

DO $$
DECLARE n_teklif integer := 0; n_rez integer := 0;
BEGIN
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  WITH esle AS (
    SELECT p.id AS proposal_id, pf.id AS user_id
      FROM public.proposals p
      JOIN public.profiles pf ON lower(pf.email) = p.client_email
      LEFT JOIN public.organizations o ON o.id = p.seller_organization_id
     WHERE p.status = 'approved' AND p.rfp_id IS NULL AND p.buyer_user_id IS NULL
       AND p.client_email IS NOT NULL AND pf.id IS DISTINCT FROM o.legacy_profile_id
  ), guncelle AS (
    UPDATE public.proposals p SET buyer_user_id = e.user_id FROM esle e WHERE p.id = e.proposal_id RETURNING p.id
  )
  SELECT count(*) INTO n_teklif FROM guncelle;

  WITH hedef AS (
    SELECT b.id, p.buyer_user_id
      FROM public.bookings b
      JOIN public.proposal_versions v ON v.id = b.proposal_version_id
      JOIN public.proposals p ON p.id = v.proposal_id
     WHERE b.customer_id IS NULL AND p.buyer_user_id IS NOT NULL AND p.rfp_id IS NULL
  ), guncelle AS (
    UPDATE public.bookings b SET customer_id = h.buyer_user_id FROM hedef h WHERE b.id = h.id RETURNING b.id
  )
  SELECT count(*) INTO n_rez FROM guncelle;
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RAISE NOTICE 'Duzeltme 03-B dolum: % teklif musteri hesabina baglandi, % rezervasyonda customer_id dolduruldu', n_teklif, n_rez;
END $$;

DO $$
DECLARE n_eski integer := 0; n_yeni integer := 0;
BEGIN
  ALTER TABLE public.quotes DISABLE TRIGGER on_quote_status_change_post_system_message;
  UPDATE public.quotes SET status = 'expired' WHERE status = 'pending' AND expires_at < now() - interval '7 days';
  GET DIAGNOSTICS n_eski = ROW_COUNT;
  ALTER TABLE public.quotes ENABLE TRIGGER on_quote_status_change_post_system_message;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_quote_status_change_post_system_message' AND tgrelid = 'public.quotes'::regclass AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'sistem mesaji tetikleyicisi kapali kaldi';
  END IF;
  n_yeni := public.quotes_expire_stale();
  RAISE NOTICE 'Duzeltme 03-B dolum: % eski sohbet teklifi sessizce, % yeni teklif mesajla kapandi (expired)', n_eski, n_yeni;
END $$;
