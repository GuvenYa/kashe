-- =============================================================================
-- GUVENLIK 04 - okuma tarafi: kim neyi gorebilir (bulgu 101-104)
--
-- Bulgu (6 Kasim 2026, Guvenlik 03 sonrasi tum SELECT politikasi + gorunum +
-- sutun yetkisi taramasi, yerel test veritabani, uretim semasi):
--   101. profiles: "Profiles are viewable by everyone" (USING true) yuzunden
--        girissiz ziyaretci dahil herkes TUM kullanicilari listeleyebiliyordu:
--        musteri ve kurumlarin adi soyadi, sirket adi, sehri, fotografi, son
--        gorulme zamani, askiya alinma / onay durumu, yonetici olup olmadigi.
--        (E-posta ve telefon zaten sutun yetkisiyle kapali.) Musteri profili
--        uygulamada yalniz iliski olan kisiye gosteriliyor.
--   102. profile_completeness gorunumu (tanimlayan yetkisiyle calisir) tum
--        kullanicilarin kimligini, rolunu ve telefon girip girmedigini girissiz
--        ziyaretciye aciyordu. Uygulama bu gorunumu kullanmiyor.
--   103. availability_blocks.note: yayindaki profesyonelin takvimine yazdigi
--        ozel not herkese aciktir; hicbir ekran notu okumuyor (yalniz sahibi
--        yaziyor).
--   104. quote_requests.budget_min / budget_max: musteri "butcemi paylasma"
--        dese de talebin gonderildigi profesyonel butceyi API'den okuyabiliyordu
--        (ekran gizliyor, veri aciktaydi).
--
-- Cozum:
--   101 -> politika degisir: profesyonel / ajans profilleri bugunku gibi herkese
--          acik; kendi profili; musteri / kurum profili yalniz iliski varsa
--          (fn_guv04_profil_gorunur). Herkese acik iliski: yayindaki /
--          sonuclanmis ilanin sahibi, yorum yazari. Oturumlu iliski: yonetici,
--          ortak kurulus, sohbet, mesaj, rezervasyon, teklif talebi, ilan
--          basvurusu / daveti, teklif (proposals) alicisi.
--   102 -> gorunum girissize ve uyelere kapanir.
--   103 -> note sutunu istemciye kapanir (diger sutunlar acik kalir).
--   104 -> butce sutunlari istemciye kapanir; butce teklif_talebi_butceleri RPC'si
--          ile okunur: talep sahibi, kurum uyesi, yonetici her zaman; alici
--          profesyonel yalniz share_budget acikken.
-- NOT: quote_requests ve availability_blocks artik SUTUN bazinda okunur; bu
-- tablolara yeni sutun eklenirse GRANT SELECT (yeni_sutun) ayrica yazilmalidir.
-- Kontrol: docs/envanter/asama28-guvenlik04-kontrol.sql (yapi),
-- asama28b-guvenlik04-davranis.sql (davranis, YALNIZ dal).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) profiles okuma (bulgu 101)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv04_profil_gorunur(p_hedef uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ben uuid := auth.uid();
  v_kimlik uuid[];
BEGIN
  IF p_hedef IS NULL THEN
    RETURN false;
  END IF;

  -- Herkese acik: yayindaki / sonuclanmis ilanin sahibi
  IF EXISTS (SELECT 1 FROM public.listings l
              WHERE l.creator_id = p_hedef
                AND l.status IN ('published', 'filled', 'closed')) THEN
    RETURN true;
  END IF;

  -- Herkese acik: yorum yazari (kamu profilindeki yorumlar)
  IF EXISTS (SELECT 1 FROM public.reviews r WHERE r.customer_id = p_hedef)
     OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.created_by = p_hedef) THEN
    RETURN true;
  END IF;

  IF v_ben IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(v_ben) THEN
    RETURN true;
  END IF;

  -- Bakanin kimlikleri: kendisi + aktif uyesi oldugu kuruluslarin profil kimligi
  SELECT array_agg(DISTINCT k.x) INTO v_kimlik
    FROM (
      SELECT v_ben AS x
      UNION ALL
      SELECT o.legacy_profile_id
        FROM public.organization_memberships om
        JOIN public.organizations o ON o.id = om.organization_id
       WHERE om.user_id = v_ben
         AND om.status = 'active'
         AND o.legacy_profile_id IS NOT NULL
    ) k;

  -- Kurulus: ayni kurulusun uyesi (bakan aktif); ya da bakanin uyeligi (davet
  -- dahil) olan kurulusun sahibi / profil kimligi
  IF EXISTS (SELECT 1
               FROM public.organization_memberships b
               JOIN public.organization_memberships h ON h.organization_id = b.organization_id
              WHERE b.user_id = v_ben AND b.status = 'active' AND h.user_id = p_hedef) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1
               FROM public.organization_memberships b
               JOIN public.organizations o ON o.id = b.organization_id
              WHERE b.user_id = v_ben
                AND (o.legacy_profile_id = p_hedef OR o.owner_user_id = p_hedef)) THEN
    RETURN true;
  END IF;

  -- Sohbet: karsi taraf (kimlik uzerinden) ya da atanan uye
  IF EXISTS (SELECT 1 FROM public.conversations c
              WHERE c.customer_id = p_hedef AND c.professional_id = ANY (v_kimlik))
     OR EXISTS (SELECT 1 FROM public.conversations c
              WHERE c.professional_id = p_hedef AND c.customer_id = ANY (v_kimlik))
     OR EXISTS (SELECT 1 FROM public.conversations c
                  JOIN public.conversation_assignees ca ON ca.conversation_id = c.id
              WHERE c.customer_id = p_hedef AND ca.professional_id = v_ben) THEN
    RETURN true;
  END IF;

  -- Mesaj yazari: bakanin taraf ya da atanan oldugu sohbette yazan
  IF EXISTS (SELECT 1
               FROM public.messages m
               JOIN public.conversations c ON c.id = m.conversation_id
              WHERE m.sender_id = p_hedef
                AND (c.customer_id = ANY (v_kimlik)
                     OR c.professional_id = ANY (v_kimlik)
                     OR EXISTS (SELECT 1 FROM public.conversation_assignees ca
                                 WHERE ca.conversation_id = c.id AND ca.professional_id = v_ben))) THEN
    RETURN true;
  END IF;

  -- Rezervasyon: musteri (bakan satici tarafinda)
  IF EXISTS (SELECT 1 FROM public.bookings b
              WHERE b.customer_id = p_hedef
                AND (b.professional_id = ANY (v_kimlik) OR b.seller_provider_id = ANY (v_kimlik))) THEN
    RETURN true;
  END IF;

  -- Teklif talebi: talep sahibi / olusturan (bakan alici)
  IF EXISTS (SELECT 1
               FROM public.quote_requests q
               JOIN public.quote_request_recipients r ON r.request_id = q.id
              WHERE (q.customer_id = p_hedef OR q.created_by = p_hedef)
                AND r.professional_id = ANY (v_kimlik)) THEN
    RETURN true;
  END IF;

  -- Ilan: basvurdugu ya da davet edildigi ilanin sahibi / davet eden
  IF EXISTS (SELECT 1
               FROM public.applications a
               JOIN public.listings l ON l.id = a.listing_id
              WHERE (l.creator_id = p_hedef OR l.created_by = p_hedef)
                AND a.applicant_id = ANY (v_kimlik)) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1
               FROM public.listing_invitations i
               JOIN public.listings l ON l.id = i.listing_id
              WHERE (i.inviter_id = p_hedef OR l.creator_id = p_hedef)
                AND i.professional_id = ANY (v_kimlik)) THEN
    RETURN true;
  END IF;

  -- Teklif (proposals): alici kullanici; bakan satici kurulusta teklif gorebilir
  IF EXISTS (SELECT 1 FROM public.proposals p
              WHERE p.buyer_user_id = p_hedef
                AND public.has_org_permission(p.seller_organization_id, 'proposals.view')) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.fn_guv04_profil_gorunur(uuid) IS
  'Guvenlik 04: musteri / kurum profili bakana gorunur mu (profiles okuma politikasi).';

-- Mesaj yazari iliskisi satir basina sorulur
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages (sender_id);

-- Politika ifadesi cagiranin yetkisiyle calisir: anon + authenticated EXECUTE ister.
REVOKE ALL ON FUNCTION public.fn_guv04_profil_gorunur(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_guv04_profil_gorunur(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS profiles_okuma_guv04 ON public.profiles;
CREATE POLICY profiles_okuma_guv04 ON public.profiles
  FOR SELECT
  USING (
    role IN ('professional', 'agency')
    OR id = auth.uid()
    OR public.fn_guv04_profil_gorunur(id)
  );

-- -----------------------------------------------------------------------------
-- 2) profile_completeness (bulgu 102)
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.profile_completeness FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) availability_blocks.note (bulgu 103)
-- -----------------------------------------------------------------------------
REVOKE SELECT ON public.availability_blocks FROM anon, authenticated;
GRANT SELECT (id, profile_id, blocked_date, created_at)
  ON public.availability_blocks TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) quote_requests butce (bulgu 104)
-- -----------------------------------------------------------------------------
REVOKE SELECT ON public.quote_requests FROM anon, authenticated;
GRANT SELECT (
  id, customer_id, category_id, city_id, brief_data, event_date, event_type,
  share_budget, response_deadline, recipient_count, status, created_at,
  attachment_path, attachment_name, attachment_type, created_by, event_id
) ON public.quote_requests TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.teklif_talebi_butceleri(p_talepler uuid[])
RETURNS TABLE (talep_id uuid, budget_min numeric, budget_max numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.budget_min, q.budget_max
    FROM public.quote_requests q
   WHERE auth.uid() IS NOT NULL
     AND cardinality(p_talepler) <= 500
     AND q.id = ANY (p_talepler)
     AND (
           q.customer_id = auth.uid()
        OR public.is_business_member(q.customer_id)
        OR public.is_admin(auth.uid())
        OR (q.share_budget
            AND EXISTS (SELECT 1 FROM public.quote_request_recipients r
                         WHERE r.request_id = q.id AND r.professional_id = auth.uid()))
     );
$$;

COMMENT ON FUNCTION public.teklif_talebi_butceleri(uuid[]) IS
  'Guvenlik 04: teklif talebi butcesi; alici yalniz share_budget acikken gorur.';

REVOKE ALL ON FUNCTION public.teklif_talebi_butceleri(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teklif_talebi_butceleri(uuid[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) Son dogrulama
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy
              WHERE polrelid = 'public.profiles'::regclass
                AND polcmd IN ('r', '*')
                AND pg_get_expr(polqual, polrelid) = 'true') THEN
    RAISE EXCEPTION 'Guvenlik 04: profiles uzerinde kosulsuz okuma politikasi kaldi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                  WHERE polrelid = 'public.profiles'::regclass AND polname = 'profiles_okuma_guv04') THEN
    RAISE EXCEPTION 'Guvenlik 04: profiles_okuma_guv04 yok';
  END IF;
  IF has_table_privilege('anon', 'public.profile_completeness', 'SELECT')
     OR has_table_privilege('authenticated', 'public.profile_completeness', 'SELECT') THEN
    RAISE EXCEPTION 'Guvenlik 04: profile_completeness hala okunabiliyor';
  END IF;
  IF has_column_privilege('anon', 'public.availability_blocks', 'note', 'SELECT')
     OR has_column_privilege('authenticated', 'public.availability_blocks', 'note', 'SELECT') THEN
    RAISE EXCEPTION 'Guvenlik 04: availability_blocks.note hala okunabiliyor';
  END IF;
  IF has_column_privilege('authenticated', 'public.quote_requests', 'budget_min', 'SELECT')
     OR has_column_privilege('authenticated', 'public.quote_requests', 'budget_max', 'SELECT')
     OR has_column_privilege('anon', 'public.quote_requests', 'budget_min', 'SELECT')
     OR has_column_privilege('anon', 'public.quote_requests', 'budget_max', 'SELECT') THEN
    RAISE EXCEPTION 'Guvenlik 04: quote_requests butcesi hala okunabiliyor';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.quote_requests', 'share_budget', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.availability_blocks', 'blocked_date', 'SELECT') THEN
    RAISE EXCEPTION 'Guvenlik 04: gerekli sutun yetkisi eksik';
  END IF;
END;
$$;
