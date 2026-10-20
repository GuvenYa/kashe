-- =============================================================================
-- Hijyen 03 — Karsi taraf kurulus adi + eski bildirim metinleri
-- Kaynak: docs/envanter/21-canli-tarama-1.md P6 (K9/K10 kok nedeni), K14
--
-- 1) organizations_public GORUNUMU: FAZ 0'in `organizations_select_member` politikasi kurulus
--    satirini yalniz uye/sahip/admin'e acar; alici kurulus satici ajansin adini, satici ajans
--    alici kurulusun adini okuyamiyor (rezervasyon sayfasi "Kurulus", gosterge "—"). Ad zaten
--    pazaryerinde aciktir. Gorunum YALNIZ kimlik/ad sutunlarini tasir (abonelik, koltuk, ayar
--    sutunlari YOK) ve sahibinin (postgres) yetkisiyle calisir (security_invoker = false) —
--    `organizations` tablosunun sutun yetkisi GENISLETILMEZ.
--    Uygulama: `seller:organizations_public!proposals_seller_organization_id_fkey(display_name)`
--    (PostgREST gorunum iliskisini alt tablonun FK'sinden turetir).
-- 2) Eski bildirim satirlari: hijyen_02 oncesi uretilen ASCII metinler ("teklif gonderdi")
--    Turkce karaktere cevrilir (tek seferlik UPDATE; idempotan — eslesme kalmayinca 0 satir).
-- Tablo/sutun/enum degisikligi YOK. Idempotan.
-- =============================================================================
BEGIN;

CREATE OR REPLACE VIEW public.organizations_public AS
  SELECT o.id, o.slug, o.display_name, o.account_type, o.legacy_profile_id
    FROM public.organizations o;

ALTER VIEW public.organizations_public SET (security_invoker = false);
COMMENT ON VIEW public.organizations_public IS
  'Hijyen 03: kurulus kimligi (id, slug, ad, tur) — karsi tarafa acik. Abonelik/koltuk/ayar YOK. Uyelik gerektirmez.';

REVOKE ALL ON public.organizations_public FROM PUBLIC, anon;
GRANT SELECT ON public.organizations_public TO authenticated, service_role;

-- Eski bildirim metinleri (hijyen_02 oncesi; rfp/proposal tipleri)
UPDATE public.notifications
   SET body = replace(body, ' teklif gonderdi: ', ' teklif gönderdi: ')
 WHERE type IN ('rfp', 'proposal') AND body LIKE '% teklif gonderdi: %';
UPDATE public.notifications
   SET body = replace(body, 'Teklifin icin revizyon istendi: ', 'Teklifin için revizyon istendi: ')
 WHERE type IN ('rfp', 'proposal') AND body LIKE 'Teklifin icin revizyon istendi: %';
UPDATE public.notifications
   SET body = replace(body, 'Teklif talebi baska bir teklife verildi: ', 'Teklif talebi başka bir teklife verildi: ')
 WHERE type IN ('rfp', 'proposal') AND body LIKE 'Teklif talebi baska bir teklife verildi: %';

COMMIT;
