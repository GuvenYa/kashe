-- =============================================================================
-- FAZ 8a / DB 02 — Etkinlik kurulus atfi dolumu (TEK SEFERLIK; Guven karariyla uygulanir)
-- Sorun: FAZ 8 (7b-P1-ek "Bu etkinlik kimin adina?") oncesi ajans/kurum sahiplerinin actigi etkinliklerde
-- organization_id NULL (kisisel). Ajans/kurumsal gosterge, gorevler (tasks.event_id ayni kurulus) ve RFP
-- (yalniz kurulus etkinligi) bu etkinlikleri gormez.
-- Kural: organization_id NULL olan ve sahibi TAM BIR kurulusun owner_user_id'si olan etkinlik o kurulusa
-- atfedilir. Sonuc: kurulusun events.view yetkili uyeleri bu etkinlikleri artik gorur (etkinlik kurulusundur —
-- tasarim geregi). Musteri (client) kullanicilarinin etkinlikleri degismez (kuruluslari yok).
-- Idempotan (ikinci kosuda 0 satir). Kontrol: asama18 K18 oncesi N, sonrasi 0.
-- =============================================================================
BEGIN;

UPDATE public.events e
   SET organization_id = o.id
  FROM public.organizations o
 WHERE e.organization_id IS NULL
   AND o.owner_user_id = e.owner_user_id
   AND (SELECT count(*) FROM public.organizations o2 WHERE o2.owner_user_id = e.owner_user_id) = 1;

COMMIT;
