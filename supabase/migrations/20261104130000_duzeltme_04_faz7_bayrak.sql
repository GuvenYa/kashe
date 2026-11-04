-- =============================================================================
-- Duzeltme 04 - FAZ 7 RPC bayragi: tanimsiz ayar NULL donuyordu (4 Kasim 2026, bulgu 62)
--   public.fn_faz7_rpc_flag() = current_setting('kashe.faz7_rpc', true) = '1'. Ayar o veritabani
--   oturumunda hic set edilmemisse current_setting(..., true) NULL doner ve NULL = '1' -> NULL.
--   Tetikleyicilerdeki "IF ... AND NOT public.fn_faz7_rpc_flag() THEN RAISE" kosulu NULL olur, RAISE
--   CALISMAZ. Sonuc: taze bir baglantida (PostgREST havuzu bosta kalan baglantilari kapatip yenisini
--   acar) satici kurulusta proposals.manage yetkisi olan bir uye, GONDERILMIS / ONAYLANMIS bir teklif
--   surumunun kalemlerini (fiyat, adet, aciklama; ekleme, silme) ve surumun tax_rate / valid_until /
--   notes alanlarini dogrudan PostgREST ile degistirebiliyordu (dondurma kilidi atlaniyordu; toplamlar
--   yeniden hesaplaniyordu). Ayni sekilde gonderilmis RFP'nin kalemleri. GRANT ile kapali alanlar
--   (status, current_version_id, proposals / proposal_versions INSERT) etkilenmedi.
--   Duzeltme: COALESCE(..., false). Imza, dil ve yetkiler ayni; tetikleyiciler ayni fonksiyonu cagirir.
-- Yan etki (bilerek): bayragi SET ETMEDEN gonderilmis surumlere dokunan bakim betikleri artik durur.
--   Hepsine set_config('kashe.faz7_rpc', '1', true) eklendi: asama4 T0/T99, Sahne 00 / 01a / 02a / 05.
--   pg_cron ve RPC'ler bayragi zaten kendileri set ediyor (proposals_expire_stale dahil).
-- Kontrol: docs/envanter/asama22-duzeltme-04-kontrol.sql (dal ve uretim, salt okunur). Test: asama4 T37.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_faz7_rpc_flag()
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('kashe.faz7_rpc', true) = '1', false) $$;
REVOKE ALL ON FUNCTION public.fn_faz7_rpc_flag() FROM PUBLIC, anon, authenticated;
