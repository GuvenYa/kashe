-- =============================================================================
-- FAZ 10d / 01 - bookings eski politikalari yalniz oturumlu kullaniciya (5 Kasim 2026)
-- Kaynak: docs/envanter/38-faz10-temizlik.md bolum 10d.
--   Eski uygulamadan kalan bes bookings politikasi rolsuz (TO public) tanimliydi: kosullari auth.uid() ile oldugu icin anonim
--   ziyaretci zaten 0 satir gorur / guncelleyemez, ama rol gereksiz genis. Kosullar DEGISMEZ, yalniz rol authenticated'a
--   daralir. Diger bookings politikalari (bookings_select_org, bookings_update_org, Business members read team bookings)
--   zaten authenticated. Kontrol: asama20 K11. Davranis: asama4 T6 / T23 (katilimci okur, yabanci ve anonim 0).
--   Geri alma: ayni bes ALTER POLICY ... TO public.
-- =============================================================================

ALTER POLICY "Assigned pros read team bookings" ON public.bookings TO authenticated;
ALTER POLICY "Bookings visible to participants" ON public.bookings TO authenticated;
ALTER POLICY "Customers read own bookings" ON public.bookings TO authenticated;
ALTER POLICY "Parties update own bookings" ON public.bookings TO authenticated;
ALTER POLICY "Professionals read own bookings" ON public.bookings TO authenticated;

DO $$
DECLARE n_pub int; n_auth int;
BEGIN
  SELECT count(*) INTO n_pub FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings' AND roles = '{public}';
  SELECT count(*) INTO n_auth FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings' AND roles = '{authenticated}'
     AND policyname IN ('Assigned pros read team bookings', 'Bookings visible to participants', 'Customers read own bookings',
                        'Parties update own bookings', 'Professionals read own bookings');
  IF n_pub <> 0 OR n_auth <> 5 THEN
    RAISE EXCEPTION 'FAZ 10d/01: bookings politika rolleri beklenmedik (public=%, authenticated=%/5)', n_pub, n_auth;
  END IF;
  RAISE NOTICE 'FAZ 10d/01: bookings 5 eski politika authenticated, public 0';
END $$;
