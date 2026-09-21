# Claude Code gorevi — FAZ 2c / P2: detay sayfasi ve havuzlar `v_providers_public`'e gecer

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/14-faz2c-okuma-yolu.md` (bolum 3 sozlesme,
bolum 4 P2, bolum 7 kurallar). ON KOSUL: P1 commit'lenmis ve deploy edilmis (kesfet/kategori gorunumden okuyor).

---

Kashe reposundasin. `docs/envanter/14-faz2c-okuma-yolu.md` dosyasini oku (bolum 3 sozlesme, bolum 4 P2, bolum 7
kurallar); P1'de eklenen `ProviderPublic`, `PROVIDER_LISTING_COLUMN_LIST`, `ProviderListing` tiplerini
(`app/lib/types.ts`) kullan. Bu is **yalniz uygulama kodu**: migration, RPC veya davranis degisikligi YOK. Amac:
pazaryeri DETAY sayfasi ve aday HAVUZU sorgularinin `profiles` yerine `v_providers_public` okumasi; kullanicinin
gordugu sonuc ve algoritmalarin aldigi girdiler birebir ayni kalmali.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

Yapilacaklar:

1. `app/lib/types.ts`
   - `ProviderPage = ProviderListing & Pick<ProviderPublic, 'is_published' | 'last_seen_at'>` (bugunku `ProfilePublic`'in
     karsiligi).
   - `ProviderCard = Pick<ProviderPublic, 'id' | 'full_name' | 'avatar_url' | 'company_name' | 'role'>` (saglayici karti;
     musteri/yorumcu kartlari icin `ProfileCard` profiles'ta kalir).
   - P2 sonunda `ProfileListing` ve `ProfilePublic` hicbir yerde kullanilmiyorsa SIL (`grep -rn "ProfileListing\|ProfilePublic" app`
     ile kanitla); kullaniliyorsa birak ve raporla.

2. Sorgu gecisi — yalniz su dosyalarda ve yalniz SAGLAYICI okuyan sorgularda `.from('profiles')` -> `.from('v_providers_public')`:
   - `app/p/[id]/page.tsx`:
     * yayin on kontrolu (`full_name, company_name, role, is_published` secen sorgu) -> gorunum;
     * ana detay sorgusu (16 sutun + embed'ler) -> gorunum, tip `ProviderPage`; sutun listesi
       `PROVIDER_LISTING_COLUMNS + ', is_published, last_seen_at'` (ayni sutunlar, ayni sira; select dizesi ayni kalsin);
     * "benzer profiller" sorgusu -> gorunum (secilen sutunlar ayni);
     * oturum sahibinin `role, is_admin` okumasi ve yorumcularin `id, full_name, avatar_url` okumasi `profiles`'ta KALIR.
   - `app/p/[id]/yorumlar/page.tsx`: iki saglayici sorgusu (`... is_published`) -> gorunum, tip
     `ProviderCard & Pick<ProviderPublic, 'is_published'>`; yorumcu kartlari profiles'ta kalir.
   - `app/favoriler/page.tsx`: favori saglayici kartlari sorgusu (`id, city_id, primary_category_id, approval_status,
     premium_tier, premium_until, created_at, attributes, category_attributes` + embed'ler) -> gorunum; oturum sahibinin
     `role, suspended_at` okumasi profiles'ta kalir.
   - `app/lib/ai-actions.ts`: pro-bul aday havuzu (`id, full_name, company_name, role, bio, premium_tier`, is_published +
     role + primary_category_id filtreleri) -> gorunum.
   - `app/teklif-topla/actions.ts`: dagitim havuzu (`id, premium_tier, premium_until, created_at`, role + approval_status
     + is_published + primary_category_id filtreleri) -> gorunum. Kota algoritmasina giden alanlar AYNI adlarla gelir;
     algoritma DEGISMEZ. Oturum sahibinin `role` okumasi profiles'ta kalir.
   Embed'ler ayni kalir (`turkish_cities(name)`, `service_categories!profiles_primary_category_id_fkey(...)` — P1'de
   gorunum uzerinden calistigi kanitlandi). `services`, `portfolio_items`, `profile_experiences`, `reviews`,
   `favorites`, `availability`, `increment_profile_views` okuma/cagrilari DEGISMEZ.

3. Tip baglama: `PublicProfile` -> `ProviderPage`; yorumlar ve favoriler yerel tipleri `ProviderPublic`'ten `Pick`.
   Secilen sutun listesi ile tip alanlari ayni; fazla/eksik varsa tipi sorguya uydur, sorguyu tipe uydurma.

4. Dogrulama:
   - `npx tsc --noEmit` bos; `npm run build` basarili.
   - `grep -n "from('profiles')" "app/p/[id]/page.tsx" "app/p/[id]/yorumlar/page.tsx" app/favoriler/page.tsx app/lib/ai-actions.ts app/teklif-topla/actions.ts`
     -> yalniz kimlik okumalari (oturum sahibi rol/is_admin/suspended_at, yorumcu kartlari); saglayici sorgularinda 0.
   - `grep -rn "from('v_providers_public')" app` -> 10 dosya (P1 5 + P2 5).
   - **Onizleme turu (gercek veriyle, bakim modu anahtariyla); P1'deki gibi once profiles vs gorunum ayni anda
     sorgulanip karsilastirilir, sonra sayfalar cekilir:**
     a. `/p/<yayinda onayli bir id>` ziyaretci (anon): baslik, sehir, kategori, bio, son gorulme, benzer profiller
        (id sirasi) main ile ayni.
     b. Ayni sayfa sahip oturumu ile ve admin oturumu ile (admin/sahip ozel bloklari degismedi).
     c. `/p/<yayinda OLMAYAN bir id>` ziyaretci: "yayinda degil" davranisi ayni; sahip: kendi sayfasini gorur.
     d. `/p/<id>/yorumlar`: baslik karti + yorumlar + yorumcu adlari ayni.
     e. `/favoriler` favorisi olan bir musteri ile: kart sayisi ve icerik ayni.
     f. pro-bul (`/pro-bul` veya `/etkinlik-planla` akisi) bir kategori icin: aday havuzu sayisi profiles ile ayni
        (fonksiyonun aldigi satir sayisini logla, sonra logu kaldir).
     g. teklif-topla: bir kategori icin aday havuzu sayisi ve `premium_tier/premium_until/created_at` kumesi profiles
        ile birebir (ayni yontem); gercek talep OLUSTURMA (bildirim gider).
   - Embed hatasi alirsan DUR ve raporla (hack yok).

Yapilmayacaklar:
- Admin sayfalari, mesajlasma, rezervasyon, auth, profil duzenleme (yazma) — 2c disi / FAZ 10.
- `profiles`'a yazan hicbir yol degismez. Migration yok. `applyDiscoverBase` degismez; `is_visible` filtresi EKLENMEZ.

Rapor: degisen dosya listesi, tsc/build ciktisi, onizleme turunun her maddesi icin main vs dal degerleri, silinen
tipler (varsa) ve kaniti, sapma ve nedeni. Commit ATMA; Guven commit'ler.
