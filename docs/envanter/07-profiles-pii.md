# 07 — profiles kisisel verileri: anon/authenticated sutun kisiti

**Baslangic:** 14 Eylul 2026 (FAZ -1 kapanisindan hemen sonra; yeni migration akisinin ilk uygulamasi)
**Durum:** Adim 1 uretimde, kapandi. Adim 2 spesifikasyonu asagida, uygulama degisikligi gerektirir.

---

## 1. Sorun

`Profiles are viewable by everyone` politikasi `qual = true` ({public}); `anon` ve `authenticated`
rollerinin `profiles` uzerinde tablo duzeyinde tam SELECT yetkisi var (FAZ -1 parmak izi N).
RLS **satir** filtreler, **sutun** filtreleyemez. Sonuc: giris yapmamis herhangi biri
`GET /rest/v1/profiles?select=email,phone` ile 48 kullanicinin e-posta ve telefonunu cekebiliyordu
(14 Eylul'de dogrulandi). KVKK acisindan dogrudan sizinti.

Uygulama tarafi (14 Eylul kod taramasi, 50 dosya):
- `profiles` uzerinde hicbir yerde `select('*')` yok; tum sorgular acik sutun listesi kullaniyor.
- Anonim sayfalar (kesfet, kategori/[slug], /p/[id], /p/[id]/yorumlar, ana sayfa, sitemap,
  featured/marquee) toplam **19 sutun** seciyor: approval_status, attributes, avatar_url, bio,
  category_attributes, city_id, company_name, created_at, full_name, id, is_admin, is_published,
  last_seen_at, premium_tier, premium_until, primary_category_id, role, updated_at
  (+ turkish_cities ve service_categories embed'leri).
- Baska bir kullanicinin email/phone'unu okuyan **tek** yer `app/mesajlar/[id]/page.tsx`:
  conversations sorgusundaki `customer:customer_id (... phone, email ...)` ve
  `professional:professional_id (... phone, email ...)` embed'leri. Kodda `contactUnlocked`
  (bu konusmada confirmed/completed rezervasyon var mi) kapisiyla client'a gecirilmiyor —
  ama veri sunucuya kadar geliyor ve API'den dogrudan okunabiliyor.
- Kendi satirini okuyanlar: `app/lib/admin.ts` (`select('id, full_name, email, is_admin')`),
  `app/lib/profile-helpers.ts` (tamamlanma hesabi `profile.phone`), profil sayfalari.
- Politikalar: 4 davet politikasi `profiles.email` okuyor (agency_invitations x2,
  business_invitations x2: `invited_email = (select email from profiles where id = auth.uid())`).
  Politika ifadeleri sorguyu yapan rolun yetkisiyle calisir; sutun kapaninca bu politikalar
  o rol icin "permission denied" uretir (bos kume degil).
- Fonksiyonlar: email/phone okuyan 6 fonksiyon (handle_new_user, davet tetikleyicileri,
  admin_recent_actions) SECURITY DEFINER — sutun kisitindan etkilenmez.

## 2. Adim 1 — anon (KAPANDI, 14 Eylul)

`supabase/migrations/20260914150000_profiles_anon_pii_kapat.sql`:
`REVOKE SELECT ON public.profiles FROM anon` + 23 sutunluk `GRANT SELECT (...) TO anon`.
Kapanan 7 sutun: email, phone, kvkk_approved_at, approval_note, suspension_reason,
suspended_by, welcome_email_sent_at.

Dogrulama: yerelde iki kosu (idempotan), asama4 davranis testi 7/7; dalda ve uretimde
`db push` tek dosya; uretimde `set role anon; select email from profiles` →
`42501 permission denied for table profiles`; `count(*)` 48 (satir filtresi degismedi);
bakim modu onizlemesiyle ana sayfa/kesfet/kategori/profil normal.

Yan etki (bilincli): anon rolu `agency_invitations` / `business_invitations` sorgularsa
politika `profiles.email` okudugu icin hata alir. Anonim hicbir sayfa bu tablolari sorgulamaz;
adim 2'de politikalar `auth.email()`'e cevrilince ortadan kalkar.

**Kalici kural:** `profiles`'a anonim sayfalarin secebilecegi yeni bir sutun eklenirse ayni
migration'da `GRANT SELECT (yeni_sutun) ON public.profiles TO anon` gerekir.

## 3. Adim 2 — authenticated (SPEC; Claude Code isi)

Hedef: hesap acan biri de herkesin email/phone'unu okuyamasin; iletisim bilgisi yalniz
(a) sahibine, (b) admine, (c) onayli/tamamlanmis rezervasyonun karsi tarafina (ve o
konusmada yetkili ajans atanani / kurum ekip uyesine) acilsin — yani uygulamanin
`contactUnlocked` kuralinin veritabani karsiligi.

### 3.1 Migration (tek dosya, dalda test → uretim)

1. **4 politika**: `(SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())`
   yerine `auth.email()` (JWT'deki email claim'i; profiles.email ile ayni deger,
   handle_new_user kopyalar). DROP + CREATE, tanimlarin geri kalani aynen.
2. **RPC** `public.get_contact_info(p_profile_id uuid) RETURNS TABLE (email text, phone text)`
   `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`:
   ```sql
   select p.email, p.phone
   from public.profiles p
   where p.id = p_profile_id
     and (
       p_profile_id = auth.uid()
       or public.is_admin(auth.uid())
       or exists (
         select 1 from public.bookings b
         join public.conversations c on c.id = b.conversation_id
         where b.status in ('confirmed','completed')
           and (c.customer_id = p_profile_id or c.professional_id = p_profile_id)
           and (
             c.customer_id = auth.uid()
             or c.professional_id = auth.uid()
             or public.is_assignee(c.id, auth.uid())
             or public.is_business_member(c.customer_id)
           )
       )
     );
   ```
   `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated, service_role`.
   Not: kural 9 (Neoform'dan): RPC'ye satir bazinda yetki kontrolu gomulu; cagirani degil,
   iliskiyi dogrular.
3. **Admin RPC** `public.admin_profile_contacts(p_ids uuid[]) RETURNS TABLE (id uuid, email text, phone text)`
   SECURITY DEFINER, ilk satir `if not public.is_admin(auth.uid()) then raise exception ...`.
   Admin listeleri (kullanicilar, profiller, sikayetler) bununla e-posta gosterir.
4. **Sutun kisiti**: `REVOKE SELECT ON public.profiles FROM authenticated` + adim 1'deki
   23 sutunluk `GRANT SELECT (...) TO authenticated`. UPDATE/INSERT/DELETE tablo duzeyinde
   kalir (RLS + koruma tetikleyicisi zaten sinirliyor).
5. Migration'in **sirasi**: 1-3 once, 4 en son — 4 uygulandiginda uygulama kodu artik
   email/phone secmiyor olmali (deploy sirasi: once kod, sonra migration; ya da ayni
   bakim penceresinde).

### 3.2 Uygulama degisiklikleri

| Dosya | Degisiklik |
|---|---|
| `app/mesajlar/[id]/page.tsx` | Iki embed'den `phone, email` kaldir. `contactUnlocked` ise `supabase.rpc('get_contact_info', { p_profile_id: other.id })` cagir, sonucu `other`'a ekle. Kilitliyken RPC cagrilmaz. |
| `app/lib/admin.ts` | `select('id, full_name, is_admin')`; e-posta gerekiyorsa `user.email` (auth). `profile.email` kullanan yerler taranir. |
| `app/lib/profile-helpers.ts`, `app/profil/page.tsx`, `app/profil/duzenle/*` | Kendi phone/email'i icin `get_contact_info(user.id)`; profil formu kaydetmede `.update(...)` degismez (UPDATE yetkisi duruyor), ama `.update().select('... phone ...')` varsa select listesinden cikar. |
| `app/admin/**` (kullanicilar, profiller, sikayetler, rapor) | `email`/`phone` secen sorgular → `admin_profile_contacts(ids)` ile birlestir. `grep -rn "email\|phone" app/admin` ile bul. |
| Tum repo | `grep -rn "phone\|email" app --include=*.ts --include=*.tsx` ile profiles baglaminda kalan secimleri tara; `tsc --noEmit` bos. |

### 3.3 Dogrulama

- `asama4-davranis-testi.sql`'e T7: authenticated (pro1) → `select email from profiles`
  HATA; `get_contact_info(pro1)` kendi bilgisi doner; `get_contact_info(musteri)` T2'deki
  onayli rezervasyon sayesinde doner; `get_contact_info(ajans)` (iliski yok) bos doner;
  anon → RPC "permission denied".
- Parmak izi v2: D (4 politika) ve N (authenticated satirlari) degisir, beklenen.
- Uretim sonrasi: giris yapmis test hesabiyla mesajlar sayfasi, profil duzenleme, admin
  kullanici listesi.
