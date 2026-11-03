-- =============================================================================
-- FAZ 10b on kontrol (SALT OKUNUR; dalda ve URETIMDE, `supabase db push`'tan ONCE)
-- `20261104120000_faz10b_01_etkinlik_turu_fk.sql` anahtar disi deger gorurse durur. Bu sorgu o degerleri onceden gosterir.
-- Beklenen: 4 satir, `anahtar_disi_deger` hepsinde BOS (NULL) ve `anahtar_disi_satir` 0. Bos degilse push YAPILMAZ;
-- degerleri yapistir, veri duzeltmesi ayri dosya olarak yazilir.
-- =============================================================================
SELECT t.tablo, t.dolu_satir, t.anahtar_disi_satir, t.anahtar_disi_deger
  FROM (
    SELECT 'conversations' AS tablo,
           count(*) FILTER (WHERE event_type IS NOT NULL) AS dolu_satir,
           count(*) FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types)) AS anahtar_disi_satir,
           string_agg(DISTINCT event_type, ', ') FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types)) AS anahtar_disi_deger
      FROM public.conversations
    UNION ALL
    SELECT 'listings',
           count(*) FILTER (WHERE event_type IS NOT NULL),
           count(*) FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types)),
           string_agg(DISTINCT event_type, ', ') FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types))
      FROM public.listings
    UNION ALL
    SELECT 'bookings',
           count(*) FILTER (WHERE event_type IS NOT NULL),
           count(*) FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types)),
           string_agg(DISTINCT event_type, ', ') FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types))
      FROM public.bookings
    UNION ALL
    SELECT 'quote_requests',
           count(*) FILTER (WHERE event_type IS NOT NULL),
           count(*) FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types)),
           string_agg(DISTINCT event_type, ', ') FILTER (WHERE event_type IS NOT NULL AND event_type NOT IN (SELECT key FROM public.event_types))
      FROM public.quote_requests
  ) t
 ORDER BY t.tablo;
