-- =============================================================================
-- profiles PII adim 2a — davet politikalari + iletisim RPC'leri (yalniz EKLEME)
--
-- KAYNAK: docs/envanter/07-profiles-pii.md bolum 3.1 (15 Eylul kararlariyla genisletildi)
-- VERI  : docs/envanter/uretim-dokum/politika-ifadeleri-*.csv (4 davet politikasinin
--         uretim tanimi: cmd, roller {public}, qual; with_check bos)
--
-- NEDEN: Adim 2b (docs/envanter/bekleyen/20260915100100_...) authenticated rolunun
--   profiles uzerindeki tablo duzeyi SELECT'ini kaldirip adim 1'deki 23 sutunluk listeye
--   indirir. Sonrasinda 7 sutun (email, phone, kvkk_approved_at, approval_note,
--   suspension_reason, suspended_by, welcome_email_sent_at) o rol icin ne secilebilir,
--   ne filtrelenebilir, ne RETURNING'de istenebilir, ne de bir politika ifadesinin
--   icinden okunabilir — dordu de 42501 (15 Eylul PGlite olcumu, spec 3.4).
--   Bu dosya 2b'den ONCE gereken her seyi EKLER. Eski kodu bozmaz; kod deploy'undan
--   once uretime gidebilir.
--
-- ICERIK:
--   1) 4 davet politikasi: (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
--      yerine auth.email() (JWT email claim'i; handle_new_user profiles.email'e ayni
--      degeri kopyalar, uygulama e-posta degistirmez). Tanimin geri kalani uretimle
--      birebir: PERMISSIVE, TO public, WITH CHECK yok.
--   2) get_contact_info(uuid)           karsi tarafin email/phone'u: sahibi, admin ya da
--                                       onayli/tamamlanmis rezervasyonun tarafi
--   3) get_own_private_profile()        oturum sahibinin kapali 7 sutunu (argumansiz)
--   4) admin_profile_contacts(uuid[])   admin: verilen profillerin kapali 7 sutunu
--   5) admin_profile_ids_by_email(text) admin: e-postaya gore arama (kullanici/profil listesi)
--   6) get_notification_email(uuid)     bildirim adresi: cagiran ile hedef ayni konusmada
--
-- YETKI: Hepsi SECURITY DEFINER + SET search_path = public. Kontrol fonksiyonun ICINDE,
--   iliski uzerinden yapilir (kural 9: cagirani degil iliskiyi dogrula). Admin
--   fonksiyonlari admin olmayana insufficient_privilege (42501) doner.
--   REVOKE ALL ... FROM PUBLIC, anon + GRANT EXECUTE ... TO authenticated, service_role.
--   anon ayrica kaldirilir: Supabase varsayilan yetkileri yeni fonksiyona anon'u acikca
--   ekler, PUBLIC'ten REVOKE tek basina yetmez.
--
-- VERI DEGISTIRILMEZ — hicbir INSERT/UPDATE/DELETE yok.
-- IDEMPOTENT — DROP POLICY IF EXISTS + CREATE POLICY; CREATE OR REPLACE FUNCTION;
--   REVOKE/GRANT tekrari durumu degistirmez.
--
-- URETIM SIRASI (spec 3.1 madde 5): bu dosya -> kod deploy (git push -> Vercel) -> 2b.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Davet politikalari: profiles.email yerine auth.email()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Invited user sees their invitations" ON public.agency_invitations;
CREATE POLICY "Invited user sees their invitations"
  ON public.agency_invitations
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((invited_user_id = auth.uid()) OR (invited_email = auth.email()));

DROP POLICY IF EXISTS "Status updates by authorized parties" ON public.agency_invitations;
CREATE POLICY "Status updates by authorized parties"
  ON public.agency_invitations
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((agency_id = auth.uid()) OR (invited_user_id = auth.uid()) OR (invited_email = auth.email()));

DROP POLICY IF EXISTS "Invited user sees their business invitations" ON public.business_invitations;
CREATE POLICY "Invited user sees their business invitations"
  ON public.business_invitations
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((invited_user_id = auth.uid()) OR (invited_email = auth.email()));

DROP POLICY IF EXISTS "Business invitation status updates by authorized parties" ON public.business_invitations;
CREATE POLICY "Business invitation status updates by authorized parties"
  ON public.business_invitations
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((business_id = auth.uid()) OR (invited_user_id = auth.uid()) OR (invited_email = auth.email()));

-- -----------------------------------------------------------------------------
-- 2) get_contact_info — uygulamanin contactUnlocked kuralinin veritabani karsiligi
-- Iletisim bilgisi yalniz (a) sahibine, (b) admine, (c) onayli/tamamlanmis bir
-- rezervasyonun karsi tarafina (ve o konusmada atanana / kurum ekip uyesine) acilir.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_info(p_profile_id uuid)
RETURNS TABLE (email text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select p.email, p.phone
  from public.profiles p
  where p.id = p_profile_id
    and (
      p_profile_id = auth.uid()
      or public.is_admin(auth.uid())
      or exists (
        select 1 from public.bookings b
        join public.conversations c on c.id = b.conversation_id
        where b.status in ('confirmed', 'completed')
          and (c.customer_id = p_profile_id or c.professional_id = p_profile_id)
          and (
            c.customer_id = auth.uid()
            or c.professional_id = auth.uid()
            or public.is_assignee(c.id, auth.uid())
            or public.is_business_member(c.customer_id)
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_contact_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_info(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) get_own_private_profile — oturum sahibinin kapali 7 sutunu
-- Argumansiz: yalniz auth.uid()'nin satiri doner, baskasinin satirina yol yoktur.
-- Profil sayfalari (phone, approval_note), askiya-alindi (suspension_reason) ve
-- auth rotalari (welcome_email_sent_at) bununla okur.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_own_private_profile()
RETURNS TABLE (
  email text,
  phone text,
  kvkk_approved_at timestamptz,
  approval_note text,
  suspension_reason text,
  suspended_by uuid,
  welcome_email_sent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select p.email, p.phone, p.kvkk_approved_at, p.approval_note,
         p.suspension_reason, p.suspended_by, p.welcome_email_sent_at
  from public.profiles p
  where p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_own_private_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_private_profile() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) admin_profile_contacts — admin: verilen profillerin kapali 7 sutunu
-- Admin listeleri (kullanicilar, dashboard, profiller, sikayetler, rapor, ilanlar,
-- kategori-talepleri, yorumlar) ve onay/revizyon e-postalari bununla okur.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_profile_contacts(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  email text,
  phone text,
  kvkk_approved_at timestamptz,
  approval_note text,
  suspension_reason text,
  suspended_by uuid,
  welcome_email_sent_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin_profile_contacts: yalniz admin cagirabilir'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.email, p.phone, p.kvkk_approved_at, p.approval_note,
           p.suspension_reason, p.suspended_by, p.welcome_email_sent_at
    from public.profiles p
    where p.id = any (p_ids);
end;
$$;

REVOKE ALL ON FUNCTION public.admin_profile_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_profile_contacts(uuid[]) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) admin_profile_ids_by_email — admin: e-postaya gore arama
-- Admin kullanici ve profil aramasi "email.ilike" filtresini dogrudan kuramaz (2b
-- sonrasi 42501). Bu fonksiyon eslesen id'leri verir; sayfa ".or(..., id.in.(...))"
-- ile birlestirir, boylece sayfalama ve sayim ayni sorguda kalir.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_profile_ids_by_email(p_query text)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin_profile_ids_by_email: yalniz admin cagirabilir'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id
    from public.profiles p
    where p.email ilike '%' || p_query || '%';
end;
$$;

REVOKE ALL ON FUNCTION public.admin_profile_ids_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_profile_ids_by_email(text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6) get_notification_email — bildirim e-postasi adresi
-- app/lib/email/send-email.ts getUserEmail bugun karsi tarafin adresini profiles'tan
-- gonderenin oturumuyla okuyor (mesaj, teklif ve rezervasyon e-postalari; 6 cagri).
-- 2b sonrasi o okuma 42501 ile sessizce null doner ve e-postalar durur. Kosul: cagiran
-- ile hedef ayni konusmayi paylasiyor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_notification_email(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select p.email
  from public.profiles p
  where p.id = p_user_id
    and exists (
      select 1 from public.conversations c
      where (
          c.customer_id = auth.uid()
          or c.professional_id = auth.uid()
          or public.is_assignee(c.id, auth.uid())
          or public.is_business_member(c.customer_id)
        )
        and (
          c.customer_id = p_user_id
          or c.professional_id = p_user_id
          or public.is_assignee(c.id, p_user_id)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.get_notification_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_email(uuid) TO authenticated, service_role;

COMMIT;
