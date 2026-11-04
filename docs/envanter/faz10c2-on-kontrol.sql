-- =============================================================================
-- FAZ 10c-2 on kontrol (SALT OKUNUR; uretimde ve dalda). 5 Kasim 2026.
-- 10c-2 / DB/04 tasarimindan once: bes tabloda `provider_id` NOT NULL olabilir mi, eski sahip sutunu (profile_id /
-- professional_id) ile tutarli mi? Hicbir sey yazmaz.
--   toplam            : satir sayisi
--   provider_null     : provider_id bos satir
--   sahip_saglayici_degil : eski sahip sutununun gosterdigi hesabin providers satiri yok (musteri / isletme sahibi)
--   uyusmaz           : provider_id dolu ama eski sahip sutunuyla ayni kimlik degil (FAZ 2a: kimlikler birebir ayni)
--   null_rol          : provider_id bos satirlarin sahip rolleri (rol=adet)
-- Beklenen (karar icin): uyusmaz 0. provider_null > 0 ise NOT NULL oncesi karar gerekir (silme / bos birakma).
-- =============================================================================

WITH t AS (
  SELECT 'services' AS tablo, s.provider_id, s.profile_id AS sahip FROM public.services s
  UNION ALL SELECT 'portfolio_items', x.provider_id, x.profile_id FROM public.portfolio_items x
  UNION ALL SELECT 'profile_experiences', x.provider_id, x.profile_id FROM public.profile_experiences x
  UNION ALL SELECT 'reviews', x.provider_id, x.professional_id FROM public.reviews x
  UNION ALL SELECT 'favorites', x.provider_id, x.professional_id FROM public.favorites x
)
SELECT a.tablo,
       count(t.tablo) AS toplam,
       count(t.tablo) FILTER (WHERE t.provider_id IS NULL) AS provider_null,
       count(t.tablo) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = t.sahip)) AS sahip_saglayici_degil,
       count(t.tablo) FILTER (WHERE t.provider_id IS NOT NULL AND t.provider_id <> t.sahip) AS uyusmaz,
       COALESCE((SELECT string_agg(r.role || '=' || r.n, ' ' ORDER BY r.role)
                   FROM (SELECT p.role, count(*) AS n FROM t t2 JOIN public.profiles p ON p.id = t2.sahip
                          WHERE t2.tablo = a.tablo AND t2.provider_id IS NULL GROUP BY p.role) r), '-') AS null_rol
  FROM (VALUES ('favorites'), ('portfolio_items'), ('profile_experiences'), ('reviews'), ('services')) AS a(tablo)
  LEFT JOIN t ON t.tablo = a.tablo
 GROUP BY a.tablo
 ORDER BY a.tablo;
