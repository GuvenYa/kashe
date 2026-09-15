# 07 — profiles kisisel verileri: anon/authenticated sutun kisiti

**Baslangic:** 14 Eylul 2026 (FAZ -1 kapanisindan hemen sonra; yeni migration akisinin ilk uygulamasi)
**Durum:** Adim 1 uretimde, kapandi. Adim 2 dosyalari hazir (15 Eylul), UYGULANMADI: 2a `supabase/migrations/`'ta, 2b `docs/envanter/bekleyen/`'de.

---

## 1. Sorun

`Profiles are viewable by everyone` politikasi `qual = true` ({public}); `anon` ve `authenticated`
rollerinin `profiles` uzerinde tablo duzeyinde tam SELECT yetkisi var (FAZ -1 parmak izi N).
RLS **satir** filtreler, **sutun** filtreleyemez. Sonuc: giris yapmamis herhangi biri
`GET /rest/v1/profiles?select=email,phone` ile 48 kullanicinin e-posta ve telefonunu cekebiliyordu
(14 Eylul'de dogrulandi). KVKK acisindan dogrudan sizinti.

Uygulama tarafi (14 Eylul kod taramasi, 50 dosya):
- Anonim sayfalarda `profiles` uzerinde `select('*')` yok. **Duzeltme (15 Eylul, AST taramasi):**
  giris gerektiren 8 kendi-profil sorgusu `select('*')` kullaniyordu (/profil, /profil/duzenle +
  togglePublish, deneyim, hizmetlerim, kategori-bilgileri, paketler, portfoy). 14 Eylul taramasi
  yalniz anonim sayfalara bakmisti; adim 1'i etkilemedi, adim 2b'de hepsi 42501 verirdi.
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
- **Eklenen (15 Eylul):** "tek yer" tespiti email/phone ve admin disi icin dogruydu. 2b ise 7 sutunun
  hepsini kapatir; su yerler de kiriliyordu: auth/callback + auth/confirm (email,
  welcome_email_sent_at), askiya-alindi (suspension_reason), davetlerim ve ajans/kurum davet
  action'lari (kendi email'i), admin onay/revizyon action'lari (`.update().select('... email ...')`
  — UPDATE butunuyle reddedilir), admin kullanici ve profil aramasi (`email.ilike` filtresi),
  admin listeleri ve embed'leri (email, phone, suspension_reason, approval_note). Tam liste 3.2'de.
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

### 3.1 Migration — IKI dosya (dalda test → uretim)

**2a** `<ts>_profiles_pii_adim2a_rpc.sql` — yalniz EKLEME yapar (politika duzeltme + RPC'ler);
kod deploy'undan once uretime gidebilir, eski kodu bozmaz.
**2b** `<ts+1>_profiles_pii_adim2b_authenticated_kisit.sql` — yalniz sutun kisiti; eski kodu
bozar, bu yuzden ayri dosya (geri almasi tek satir: `GRANT SELECT ON public.profiles TO authenticated`).

1. **4 politika** (2a): `(SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())`
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
3. **Admin RPC** (2a) `public.admin_profile_contacts(p_ids uuid[])` — **15 Eylul karariyla genisletildi:**
   `RETURNS TABLE (id, email, phone, kvkk_approved_at, approval_note, suspension_reason, suspended_by,
   welcome_email_sent_at)`, yani kapali 7 sutunun hepsi. plpgsql SECURITY DEFINER, ilk satir
   `if not public.is_admin(auth.uid()) then raise exception ... using errcode = 'insufficient_privilege'`
   (42501). Admin listeleri (kullanicilar, dashboard, profiller, sikayetler, rapor, ilanlar,
   kategori-talepleri, yorumlar) ve onay/revizyon e-postalari bununla okur.
3c. **Kendi satiri RPC** (2a, 15 Eylul karari) `public.get_own_private_profile()` argumansiz,
   `RETURNS TABLE` kapali 7 sutun, `where p.id = auth.uid()`. Profil sayfalari (phone,
   approval_note), askiya-alindi (suspension_reason) ve auth rotalari (welcome_email_sent_at)
   bununla okur. Yalniz kendi e-postasi gereken yerde (davetlerim, davet action'lari, hos geldin
   adresi) `user.email` kullanilir: uygulama e-posta degistirmiyor, auth ile profiles ayni.
3d. **Admin arama RPC** (2a) `public.admin_profile_ids_by_email(p_query text) RETURNS SETOF uuid`,
   ayni is_admin kapisi. Admin kullanici ve profil aramasi `email.ilike` filtresini kuramaz (2b
   sonrasi 42501); eslesen id'leri bu fonksiyon verir, sayfa `.or(..., id.in.(...))` ile birlestirir
   ve sayfalama/sayim ayni sorguda kalir.
3b. **Bildirim RPC** (2a) `public.get_notification_email(p_user_id uuid) RETURNS text`
   SECURITY DEFINER: `app/lib/email/send-email.ts` icindeki `getUserEmail(supabase, userId)`
   bugun karsi tarafin e-postasini profiles'tan gonderenin oturumuyla okuyor (mesaj ve teklif
   e-postalari icin; mesajlar/actions.ts ve quote-actions.ts'ten 4, rezervasyon/[id]/actions.ts'ten
   2 = toplam 6 cagri; rezervasyon taraflari ayni konusmayi paylastigi icin kosul onlari da kapsar). 2b'den sonra bu
   "permission denied" ile sessizce null doner ve bildirim e-postalari durur. RPC kosulu:
   cagiran ile hedef ayni konusmayi paylasiyor —
   `exists (select 1 from conversations c where (c.customer_id = auth.uid() or c.professional_id = auth.uid() or is_assignee(c.id, auth.uid()) or is_business_member(c.customer_id)) and (c.customer_id = p_user_id or c.professional_id = p_user_id or is_assignee(c.id, p_user_id)))`.
   Uygulamada `getUserEmail` govdesi `supabase.rpc('get_notification_email', { p_user_id: userId })` olur; imza degismez.
4. **Sutun kisiti** (2b): `REVOKE SELECT ON public.profiles FROM authenticated` + adim 1'deki
   23 sutunluk `GRANT SELECT (...) TO authenticated`. UPDATE/INSERT/DELETE tablo duzeyinde
   kalir (RLS + koruma tetikleyicisi zaten sinirliyor).
5. **Uretim sirasi**: 2a (guvenli, ekleme) → kod deploy (git push → Vercel) → 2b.
   `supabase db push` bekleyen her dosyayi uygular; bu yuzden 2b, kod deploy edilene kadar
   `supabase/migrations/` disinda (`docs/envanter/bekleyen/`) tutulur, deploy sonrasi
   klasore tasinip push edilir. Bakim modunda oldugumuz icin aradaki dakikalar tolere
   edilebilir, ama sira yine de bu.

### 3.2 Uygulama degisiklikleri

| Dosya | Degisiklik |
|---|---|
| `app/mesajlar/[id]/page.tsx` | Iki embed'den `phone, email` kaldir. `contactUnlocked` ise `supabase.rpc('get_contact_info', { p_profile_id: other.id })` cagir, sonucu `other`'a ekle. Kilitliyken RPC cagrilmaz. |
| `app/lib/admin.ts` | `select('id, full_name, is_admin')`; e-posta gerekiyorsa `user.email` (auth). `profile.email` kullanan yerler taranir. |
| `app/lib/profile-helpers.ts`, `app/profil/page.tsx`, `app/profil/duzenle/*` | Kendi phone/email'i icin `get_contact_info(user.id)`; profil formu kaydetmede `.update(...)` degismez (UPDATE yetkisi duruyor), ama `.update().select('... phone ...')` varsa select listesinden cikar. |
| `app/lib/email/send-email.ts` | `getUserEmail`: `.from('profiles').select('email')` yerine `rpc('get_notification_email')`. Cagiranlar (mesajlar/actions.ts, quote-actions.ts) degismez. |
| `app/admin/**` (kullanicilar, profiller, sikayetler, rapor) | `email`/`phone` secen sorgular → `admin_profile_contacts(ids)` ile birlestir. `grep -rn "email\|phone" app/admin` ile bul. |
| Tum repo | `grep -rn "phone\|email" app --include=*.ts --include=*.tsx` ile profiles baglaminda kalan secimleri tara; `tsc --noEmit` bos. |
| **Eklenen (15 Eylul)** `app/lib/own-profile.ts` (yeni) | `PROFILE_OPEN_COLUMNS` (2b GRANT listesiyle birebir 23 sutun), `getOwnPrivateProfile()`, `fetchOwnProfile()`: select('*') yerine acik sutunlar + kapali sutunlar tek nesnede. |
| `app/profil/` page, duzenle/page, duzenle/actions, deneyim, hizmetlerim, kategori-bilgileri, paketler, portfoy | 8 `select('*')` → `fetchOwnProfile`. |
| `app/auth/callback/route.ts`, `app/auth/confirm/route.ts` | `welcome_email_sent_at` → `get_own_private_profile()`, adres → `user.email`. |
| `app/askiya-alindi/page.tsx` | `suspension_reason` → `get_own_private_profile()`. |
| `app/davetlerim/page.tsx`, `app/ajans/agency-actions.ts`, `app/kurumsal/business-actions.ts` | kendi email'i → `user.email`; select'ten `email` cikti. |
| `app/lib/admin-contacts.ts` (yeni) | `getAdminProfileContacts(ids)`, `findProfileIdsByEmail(q)`. |
| `app/admin/actions.ts` | onay/revizyon `.update().select()`'ten `email` cikti; adres `admin_profile_contacts`'tan. |
| `app/admin/kullanicilar/page.tsx`, `app/admin/profiller/page.tsx` | select'ten email/suspension_reason/approval_note cikti, RPC ile birlesir; `email.ilike` aramasi → `admin_profile_ids_by_email` + `id.in.(...)`. |
| `app/admin/page.tsx`, `sikayetler`, `ilanlar`, `kategori-talepleri`, `yorumlar`, `rapor/route.ts` | select ve embed'lerden email/phone/suspension_reason cikti, `admin_profile_contacts` ile birlesir. |

### 3.2a Duzeltilen sorgu yerleri — dosya ve satir (15 Eylul)

Satir numaralari degisiklik SONRASI dosyalardan okundu (duzeltilmis sorgunun ya da cagrinin satiri).
Tarama: TypeScript AST (145 `profiles` zinciri + tum embed'ler) ve cok satirli filtre aramasi.
Degisiklik sonrasi kapali sutuna ya da `*`'a dokunan `profiles` sorgusu: **0**.

**A. Spec'in hic kapsamadigi 16 yer**

| # | Dosya:satir | Eski okuma | Yeni |
|---|---|---|---|
| 1 | `app/profil/page.tsx:41` | `select('*, turkish_cities(...), service_categories!...')` | `fetchOwnProfile` |
| 2 | `app/profil/duzenle/page.tsx:25` | `select('*')` | `fetchOwnProfile` |
| 3 | `app/profil/duzenle/actions.ts:148` (togglePublish) | `select('*')` | `fetchOwnProfile` |
| 4 | `app/profil/deneyim/page.tsx:26` | `select('*, service_categories!...')` | `fetchOwnProfile` |
| 5 | `app/profil/hizmetlerim/page.tsx:30` | `select('*')` | `fetchOwnProfile` |
| 6 | `app/profil/kategori-bilgileri/page.tsx:26` | `select('*, service_categories!...')` | `fetchOwnProfile` |
| 7 | `app/profil/paketler/page.tsx:26` | `select('*')` | `fetchOwnProfile` |
| 8 | `app/profil/portfoy/page.tsx:29` | `select('*')` | `fetchOwnProfile` |
| 9 | `app/auth/callback/route.ts:51-52` | email, welcome_email_sent_at | `select('role, full_name')` + `get_own_private_profile()`; adres `user.email` |
| 10 | `app/auth/confirm/route.ts:81-82` | email, welcome_email_sent_at | ayni |
| 11 | `app/askiya-alindi/page.tsx:34-35` | suspension_reason | `select('full_name, suspended_at')` + `get_own_private_profile()` |
| 12 | `app/davetlerim/page.tsx:30` (filtre: 52, 88) | email (select ve `.or` filtresi) | `select('role, suspended_at')`; filtrede `user.email` |
| 13 | `app/ajans/agency-actions.ts:52` (kullanim: 65) — davet gonderme | `select('role, email')` | `select('role')`; kendine davet engeli `user.email` |
| 14 | `app/ajans/agency-actions.ts:186` (kullanim: 195) — davet yanitlama | `select('email, role')` | `select('role')`; eslesme `user.email` |
| 15 | `app/kurumsal/business-actions.ts:52` (kullanim: 65) — davet gonderme | `select('role, email')` | `select('role')`; `user.email` |
| 16 | `app/kurumsal/business-actions.ts:186` (kullanim: 195) — davet yanitlama | `select('email')` | `select('id')`; `user.email` |

**B. Spec'in kismen kapsadigi 3 admin sorgusu** (email/phone disinda kapali sutun ya da e-posta filtresi)

| # | Dosya:satir | Eski okuma | Yeni |
|---|---|---|---|
| 17 | `app/admin/kullanicilar/page.tsx:72` (arama: 89, birlestirme: 103) | email, suspension_reason, `email.ilike` | `admin_profile_ids_by_email` + `admin_profile_contacts` |
| 18 | `app/admin/page.tsx:90` (ikinci sorgu: 98, birlestirme: 115) | email, suspension_reason | `admin_profile_contacts` |
| 19 | `app/admin/profiller/page.tsx:90` (arama: 102, birlestirme: 114) | email, approval_note, `email.ilike` | `admin_profile_ids_by_email` + `admin_profile_contacts` |

**C. Spec'te zaten olan (email/phone) ve duzeltilen yerler**

| Dosya:satir | Yeni |
|---|---|
| `app/mesajlar/[id]/page.tsx:71, 76` (embed'ler), `:246` | embed'lerden phone/email cikti; kilit acikken `get_contact_info` |
| `app/lib/email/send-email.ts:123` | `getUserEmail` govdesi → `get_notification_email` |
| `app/lib/admin.ts:16` | `select('id, full_name, is_admin')`; `profile.email` kullanan yer yok |
| `app/admin/actions.ts:311, 337` (onay) ve `:415, 435` (revizyon) | `.update().select()`'ten email cikti; adres `admin_profile_contacts` |
| `app/admin/rapor/route.ts:83, 103` | email/phone → `admin_profile_contacts` |
| `app/admin/sikayetler/page.tsx:100, 108` | sikayet edenin email'i → `admin_profile_contacts` |
| `app/admin/ilanlar/page.tsx:89, 97` | creator embed'inden email cikti → `admin_profile_contacts` |
| `app/admin/kategori-talepleri/page.tsx:117, 131` | user embed'inden email cikti → `admin_profile_contacts` |
| `app/admin/yorumlar/page.tsx:134, 137, 166` | customer/professional embed'lerinden email cikti → `admin_profile_contacts` |

**D. `getUserEmail` — 6 cagrinin hepsi RPC'den geciyor**

`getUserEmail`'in imzasi degismedi; govdesi `get_notification_email` cagirir (`send-email.ts:123`).
Bu yuzden 6 cagri noktasinin hepsi RPC'ye gecmistir. RPC kosulu: cagiran konusmanin
customer/professional'i, atanani ya da musteri kurumunun uyesi; hedef ayni konusmanin
customer/professional'i ya da atanani.

| Cagri (dosya:satir) | Cagiran (action'daki yetki kontrolu) | Hedef | Kosul |
|---|---|---|---|
| `app/mesajlar/actions.ts:198` notifyNewMessage | musteri, profesyonel, `conversation_assignees`, kurum owner/manager | konusmanin diger tarafi | saglanir |
| `app/mesajlar/actions.ts:265` notifyNewConversation | musteri ya da kurum uyesi (konusma satiri once eklenir) | `conv.professional_id` | saglanir |
| `app/mesajlar/quote-actions.ts:365` notifyNewQuote | sahip profesyonel ya da `conversation_assignees` | `conv.customer_id` | saglanir |
| `app/mesajlar/quote-actions.ts:434` notifyQuoteAccepted | musteri ya da kurum owner/manager (`canWriteForBusiness`) | `conv.professional_id` | saglanir |
| `app/rezervasyon/[id]/actions.ts:274` notifyBookingCancelled | rezervasyonun taraflarindan biri (`isCustomer` / `isProfessional`) | diger taraf | saglanir |
| `app/rezervasyon/[id]/actions.ts:352` notifyBookingCompleted | yalniz `booking.professional_id` | `booking.customer_id` | saglanir |

Rezervasyon cagrilari icin gerekce (kodda da yorum olarak yazili): `bookings` satirini yalniz
`on_quote_accepted_create_booking` tetikleyicisi olusturur — uretim dokumunde ve repoda `bookings`
icin INSERT politikasi yok, uygulama insert etmez — ve `customer_id` / `professional_id`'yi
konusmanin taraflarindan kopyalar. `cancelBooking` / `completeBooking` UPDATE yukleri taraf
sutunlarina dokunmaz (yalniz status, cancelled_at, cancelled_by, cancellation_reason /
completed_at). Dolayisiyla cagiran ve alici her zaman `booking.conversation_id` konusmasinin
customer/professional'idir.

Not: "Parties update own bookings" politikasinda WITH CHECK yok; bir taraf API'den taraf
sutununu degistirirse o kayitta RPC null doner. Sonuc e-postanin gitmemesidir, sizinti degil.

### 3.3 Dogrulama

- `asama4-davranis-testi.sql`'e T7: authenticated (pro1) → `select email from profiles`
  HATA; `get_contact_info(pro1)` kendi bilgisi doner; `get_contact_info(musteri)` T2'deki
  onayli rezervasyon sayesinde doner; `get_contact_info(ajans)` (iliski yok) bos doner;
  `get_notification_email(musteri)` pro1 icin doner (ayni konusma), pro2 icin null;
  anon → RPC "permission denied"; pro1 → `admin_profile_contacts` HATA, ajans (admin) → doner.
- T7'ye eklenenler (15 Eylul):
  - **Hazirlik:** pro1'e bilinen telefon (`+905550000002`) ve revizyon notu admin claim'iyle yazilir.
    T1'de pro1'in telefonu yok; NULL = NULL karsilastirmasi "kendi telefonunu doner"i kanitlamaz.
  - pro1 → `get_own_private_profile()` tek satir; **kendi phone'u** `+905550000002`, e-postasi ve notu doner.
  - pro1 → `admin_profile_contacts` ve `admin_profile_ids_by_email` ikisi de **42501**.
  - ajans (admin) → `admin_profile_contacts`: imza **id + 7 kapali sutun = 8** (`proargmodes`'taki
    't' sayilir); 7 sutunun hepsi adiyla okunur; pro1 satirinda email/phone/not dogru; 2 hedef → 2 satir.
  - ajans (admin) → `admin_profile_ids_by_email('faz1test+pro1')` pro1'i bulur.
  - Davet sorgusu `request.jwt.claim.email` ile pro2'nin T3 davetini gorur ("hata vermez"den guclu).
  - T7 2a ve 2b uygulanmis dalda kosar; 2b yoksa ilk kontrol (`select email` → 42501) GECMEZ.
- `select * from public.agency_invitations` authenticated ile hata vermemeli (politika
  artik auth.email() kullaniyor).
- Parmak izi v2: D (4 politika) ve N (authenticated satirlari) degisir, beklenen.
- Uretim sonrasi: giris yapmis test hesabiyla mesajlar sayfasi, profil duzenleme, admin
  kullanici listesi.

### 3.4 Olcum: sutun GRANT'i neyi reddeder (15 Eylul, PGlite 0.5.8)

`authenticated` rolune yalniz `(id, full_name)` SELECT verilmis bir `profiles` tablosunda:

| Deneme | Sonuc |
|---|---|
| `select id, full_name` | gecti |
| `select *` (PostgREST `select('*')`) | **42501** permission denied for table |
| `select email` | **42501** |
| `where email = ...` (kapali sutunla filtre) | **42501** |
| `count(*)` | gecti |
| `update ... set phone` | gecti |
| `update ... returning *` | **42501** — UPDATE butunuyle reddedilir |
| `update ... returning id, full_name` | gecti |
| RLS politikasi icinde `(select email from profiles ...)` | **42501** |
| SECURITY DEFINER RPC | gecti, email doner |

Sonuc: kapali sutun yalniz secimde degil; **filtrede, RETURNING'de, politika ifadesinde ve
`*` icinde** de hata verir. Kod taramasi bu bicimlerin hepsine bakmali; tek satirlik grep
zincirlenmemis `query = query.or(...)` filtrelerini kacirir (15 Eylul'de iki admin aramasi
boyle bulundu).

**Kalici kural** (adim 1'deki anon kuralinin genisletilmis hali): profiles'a yeni sutun
eklenirse ayni migration'da `GRANT SELECT (yeni_sutun) ON public.profiles TO anon, authenticated`
yazilir ve sutun `app/lib/own-profile.ts` `PROFILE_OPEN_COLUMNS` listesine eklenir. Hassas bir
sutunsa GRANT verilmez; 2a'daki RPC'lere eklenir.
