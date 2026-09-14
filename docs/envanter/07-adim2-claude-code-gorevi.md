# Claude Code gorevi — profiles PII adim 2 (authenticated)

Asagidaki metni oldugu gibi Claude Code'a ver. Spec dosyasi `docs/envanter/07-profiles-pii.md`,
bolum 3. Bu gorev metni onun uygulama talimatidir.

---

Kashe reposundasin. `docs/envanter/07-profiles-pii.md` dosyasini oku; bolum 1 ve 2 baglam,
bolum 3 senin isin. Adim 1 (anon icin profiles sutun kisiti) uretimde; sen adim 2'yi
(authenticated) hazirlayacaksin. **Uretime ve dala hicbir sey uygulamayacaksin** —
`supabase db push`, `supabase link`, Dashboard yok; sadece dosya yazacaksin, Guven uygular.

Baslamadan: `git status` temiz olmali; degilse dur ve soyle.

Uretilecekler:

1. `supabase/migrations/20260915100000_profiles_pii_adim2a_rpc.sql` — spec 3.1'deki 1, 2, 3
   ve 3b maddeleri: 4 davet politikasinin `auth.email()` ile yeniden yazilmasi (DROP IF EXISTS
   + CREATE, tanimlarin geri kalani uretimdeki gibi; ifadeler `docs/envanter/uretim-dokum/
   politika-ifadeleri-*.csv` icinde), `get_contact_info(uuid)`, `admin_profile_contacts(uuid[])`,
   `get_notification_email(uuid)`. Ucu de SECURITY DEFINER, `SET search_path = public`,
   `REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated, service_role`.
   Dosya `BEGIN; ... COMMIT;` icinde, idempotan (CREATE OR REPLACE / DROP IF EXISTS),
   basinda repodaki diger faz_minus1 dosyalarinin uslubunda Turkce aciklama blogu.

2. `docs/envanter/bekleyen/20260915100100_profiles_pii_adim2b_authenticated_kisit.sql` —
   spec 3.1 madde 4: `REVOKE SELECT ON public.profiles FROM authenticated` + adim 1
   dosyasindaki (`20260914150000_profiles_anon_pii_kapat.sql`) 23 sutunluk listeyle
   `GRANT SELECT (...) ON public.profiles TO authenticated`. Bu dosya BILEREK
   `supabase/migrations/` disinda: kod deploy edildikten sonra Guven tasiyacak. Basina
   bunu yazan bir not koy.

3. Uygulama degisiklikleri — spec 3.2 tablosu. Ozellikle:
   - `app/mesajlar/[id]/page.tsx`: iki embed'den `phone, email` cikar; `contactUnlocked`
     true ise `supabase.rpc('get_contact_info', { p_profile_id: other.id })` ile al.
   - `app/lib/email/send-email.ts` `getUserEmail`: govdeyi `rpc('get_notification_email',
     { p_user_id: userId })` ile degistir, imza ve cagiranlar aynen kalsin.
   - `app/lib/admin.ts`: `email` secimini kaldir; `profile.email` kullanan yer varsa
     `user.email`'e cevir.
   - Kendi profili: `app/lib/profile-helpers.ts`, `app/profil/page.tsx`, `app/profil/duzenle/*`
     icinde kendi `phone`/`email`'ini profiles'tan secen sorgular → `get_contact_info(user.id)`.
     `.update({...})` cagrilari degismez; `.update().select('...phone/email...')` varsa o
     select'ten cikar.
   - `app/admin/**`: `email`/`phone` secen sorgular → `admin_profile_contacts(ids)` ile
     birlestir.
   - Son kontrol: `grep -rn "phone\|email" app --include=*.ts --include=*.tsx` — profiles
     baglaminda `email`/`phone` secen hicbir sorgu kalmamali (auth `user.email` ve
     form alanlari haric). Bulduklarini listele.

4. `docs/envanter/asama4-davranis-testi.sql`'e T7 blogu (spec 3.3): pro1 authenticated →
   `select email from profiles` HATA beklenir; `get_contact_info(pro1)` doner;
   `get_contact_info(musteri)` doner (T2 rezervasyonu); `get_contact_info(ajans)` bos;
   `get_notification_email(musteri)` pro1 icin doner, pro2 icin null;
   `admin_profile_contacts` pro1 icin HATA, ajans (T5'te admin yapildi) icin doner;
   anon → `get_contact_info` "permission denied"; authenticated ile
   `select count(*) from agency_invitations` hata vermemeli. Diger testlerin kalibina uy
   (kendi DO blogu, t_sonuc'a GECTI/HATA). Baslik listesine T7'yi ekle.

Kurallar: dosyalarda sapkali harf yok (a, i, u uzerinde ^ isareti olan harfler yasak, duz a/i/u yazilir); `tsc --noEmit` ciktisi bos
olmali; migration dosyalarina veri degistiren ifade (INSERT/UPDATE/DELETE) girmez;
mevcut migration dosyalarina dokunma. Bittiginde: degisen dosyalarin listesi, grep sonucu
ve `tsc --noEmit` ciktisini goster; commit yapma, Guven yapacak.
