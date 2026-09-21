# Claude Code gorevi — FAZ 2c / P1: liste yollari `v_providers_public`'e gecer

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/14-faz2c-okuma-yolu.md` (bolum 3 sozlesme,
bolum 4 P1, bolum 7 kurallar). ON KOSUL: `v_providers_public` uretimde (14 bolum 6 tamamlanmis) — kod deploy'u
gorunumden once gitmez.

---

Kashe reposundasin. `docs/envanter/14-faz2c-okuma-yolu.md` dosyasini oku (bolum 1 tarama, bolum 3 sozlesme, bolum 4
P1, bolum 7 kurallar). Bu is **yalniz uygulama kodu**: migration, RPC veya davranis degisikligi YOK. Amac: pazaryeri
LISTE sayfalarinin `profiles` yerine `v_providers_public` gorunumunu okumasi; kullanicinin gordugu sonuc birebir ayni
kalmali (ayni satirlar, ayni siralama, ayni sayaclar).

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

Yapilacaklar:

1. `app/lib/types.ts`
   - `ProviderPublic` tipini ekle: 14 bolum 3 tablosundaki 33 sutun, nullability tabloyla birebir. `role: UserRole`,
     `approval_status: ProfileApprovalStatus`, `premium_tier: PremiumTier` mevcut tipleri kullanir;
     `provider_type: 'professional' | 'organization'`, `verification_level: 'none' | 'email' | 'document' | 'full'`,
     `pricing_mode: 'fixed' | 'range' | 'on_request' | null`, `price_unit: 'per_job' | 'per_hour' | 'per_half_day' | 'per_day' | null`
     icin `ProviderType`, `VerificationLevel`, `PricingMode`, `ProviderPriceUnit` adli tipler ac.
   - `ProviderListing = Pick<ProviderPublic, ...>`: bugunku `ProfileListing`'in alan listesiyle AYNI alanlar
     (`ProfileListing` hangi `ProfileOpen` alanlarini seciyorsa `ProviderPublic`'ten ayni adlari sec) + `CityEmbed`
     + `CategoryEmbed`. `ProfileListing`/`ProfilePublic` simdilik kalir (P2'de /p/[id] gecince degerlendirilir).
   - `PROVIDER_LISTING_COLUMNS` sabiti: `ProviderListing`'in embed disi alanlarinin virgullu listesi; `own-profile.ts`'teki
     sutun kilidi kalibiyla (`as const satisfies readonly (keyof ProviderPublic)[]`) yaz ki gorunumden dusen bir sutun
     derlemede yakalansin.

2. Sorgu gecisi — yalniz su dosyalarda ve yalniz LISTE/SAYAC sorgularinda `.from('profiles')` -> `.from('v_providers_public')`:
   - `app/kesfet/page.tsx` (liste sorgusu; secilen sutunlar `PROVIDER_LISTING_COLUMNS` + embed'ler). Oturum sahibinin
     `select('role')` okumasi `profiles`'ta KALIR.
   - `app/kategori/[slug]/page.tsx` (ayni).
   - `app/kategoriler/page.tsx` (kategori sayaclari: `primary_category_id` okuyan sorgu).
   - `app/sitemap.ts` (`id, updated_at` + is_published + role filtresi).
   - `app/etkinlik-sihirbazi/page.tsx` (sayac sorgusu: `primary_category_id, city_id, role, category_attributes`).
   - `app/lib/discover-base.ts`: `applyDiscoverBase` DEGISMEZ (is_published + role filtresi gorunumde ayni adlarla var);
     dosya basindaki aciklamaya "profiles yerine v_providers_public uzerinde calisir" notunu ekle.
   Embed'ler ayni kalir: `turkish_cities(name)` ve `service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)`.
   Filtreler/siralama/arama (`.eq('role')`, `.in('primary_category_id')`, `.eq('city_id')`, `full_name.ilike`,
   `company_name.ilike`, `.order('updated_at')`) ayni sutun adlariyla calisir; DEGISTIRME.

3. Tip baglama: bu dosyalardaki sonuc tipleri `ProfileListing` yerine `ProviderListing` (veya sayac sorgulari icin
   `Pick<ProviderPublic, ...>`). Secilen sutun listesi ile tip alanlari ayni olmali; fazla/eksik varsa tipi sorguya
   uydur, sorguyu tipe uydurma (davranis degismez).

4. Dogrulama:
   - `npx tsc --noEmit` ciktisi bos.
   - `grep -n "from('profiles')" app/kesfet/page.tsx "app/kategori/[slug]/page.tsx" app/kategoriler/page.tsx app/sitemap.ts app/etkinlik-sihirbazi/page.tsx`
     -> yalniz oturum sahibinin rol okumasi (kesfet ve kategori'de birer tane); liste/sayac sorgularinda 0.
   - `grep -rn "from('v_providers_public')" app` -> 5 dosya.
   - `npm run build` basarili.
   - **Onizleme turu (Vercel preview veya yerel dev, gercek veriyle):**
     a. `/kesfet`: ilk yuklemede sonuc sayisi ve ilk 5 kartin sirasi degisiklik oncesiyle AYNI (once main'de, sonra
        dalda ayni URL'yi ac ve karsilastir); kategori, sehir, tur (profesyonel/ajans), arama ve siralama filtreleri
        calisiyor; kartlarda sehir adi ve kategori adi/emoji goruluyor (embed kaniti).
     b. `/kategori/<slug>`: ayni.
     c. `/kategoriler`: kategori sayaclari main ile ayni.
     d. `/etkinlik-sihirbazi`: canli sayac, kesfet'in ayni filtreyle verdigi sonuc sayisina esit.
     e. `/sitemap.xml`: profil URL sayisi main ile ayni.
   - Embed hatasi ("Could not find a relationship between v_providers_public and service_categories" veya
     turkish_cities) alirsan: once hint'i kaldirip `service_categories(name_tr, emoji, slug)` dene (gorunumde
     service_categories'e tek FK yolu var). Hala cozulmuyorsa DUR ve raporla; gorunume sutun eklenir (14 bolum 3),
     uygulamada ham SQL/RPC hack'i yapilmaz.

Yapilmayacaklar:
- `/p/[id]`, yorumlar, favoriler, pro-bul, teklif-topla (P2); admin sayfalari, mesajlasma, rezervasyon, auth (2c disi).
- `profiles`'a yazan hicbir yol degismez. Migration yok. `services` okumalari degismez.
- `applyDiscoverBase` mantigi degismez; yeni filtre (ornek `is_visible`) EKLENMEZ — bu davranis degisikligi olur ve
  ayri karar ister.

Rapor: degisen dosya listesi, tsc/build ciktisi (bos/basarili), onizleme turunun her maddesi icin main vs dal
sayilari, embed'in calistigi kanit (kartta sehir + kategori adi), varsa sapma ve nedeni.
