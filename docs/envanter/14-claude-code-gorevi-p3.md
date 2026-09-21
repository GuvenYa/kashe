# Claude Code gorevi — FAZ 2c / P3: ana sayfa bilesenleri, /p/[id] rol kapisi, kalan okumalarin siniflandirmasi

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/14-faz2c-okuma-yolu.md` (bolum 3 sozlesme,
bolum 4 P3, bolum 7 kurallar, bolum 8 P2 bulgulari). ON KOSUL: P2 commit'lenmis ve deploy edilmis.

---

Kashe reposundasin. `docs/envanter/14-faz2c-okuma-yolu.md` dosyasini oku (bolum 3, 4 P3, 7, 8). P1/P2'de eklenen
`ProviderPublic`, `PROVIDER_LISTING_COLUMN_LIST`, `ProviderListing`, `ProviderPage`, `ProviderCard` tiplerini kullan.
Bu is **yalniz uygulama kodu**: migration, RPC yok; tek bilincli davranis degisikligi madde 2'de yazili ve bugun
etkisi olculebilir sekilde sifir.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

Yapilacaklar:

1. **Ana sayfa bilesenleri** (P1 taramasi tek tirnakli `from('profiles')` aradigi icin bunlar kacmisti; cift tirnakli
   `from("profiles")` kullaniyorlar) — saglayici sorgulari `v_providers_public`'e:
   - `app/components/sections/featured-profiles.tsx` (24 one cikan saglayici; `is_published` + role filtresi,
     `updated_at` siralamasi, embed'ler `turkish_cities(name)`, `service_categories!profiles_primary_category_id_fkey(name_tr, slug)`).
     Yerel `FeaturedProfile` tipi `Pick<ProviderPublic, ...>` + dar embed sekli (emoji secilmiyor; sorguya alan EKLEME).
   - `app/components/sections/marquee-profiles.ts` (`MarqueeProfile` -> `Pick<ProviderPublic, ...>` + embed).
   - `app/components/sections/categories.tsx` (kategori basina saglayici sayaci: `primary_category_id`).
   - `app/components/sections/hero.tsx` (yayinda saglayici sayisi, `count: exact, head: true`).
   `top-nav.tsx` oturum sahibini okur — `profiles`'ta KALIR. Filtre/siralama/limit degismez; `is_visible` EKLENMEZ.

2. **`/p/[id]` rol kapisi — business** (`app/p/[id]/page.tsx`, metadata ve sayfa govdesindeki iki kosul):
   Gorunumde yalniz `professional` ve `agency` var; `business` saglayici degildir (11-faz2 bolum 2: "business
   kurumsal alici, providers satiri almaz"). Bugun yayinda business profili 0 (P2 olcumu), o yuzden davranis
   degismiyor; ama kapi `business`'a izin verdigi icin ileride yayinlanan bir business profili gorunumde bulunamayip
   404 verirdi. Karar (14 bolum 8): **kapidan `business` cikarilir**; iki kosul `professional`/`agency` olur, yorum
   satiri "business saglayici degil; kurum sayfasi FAZ 8 (organizations)" yazar. `name` hesabindaki
   `data.role === 'business' || data.role === 'agency'` -> yalniz `agency`. Baska davranis degismez.

3. **Sapkali harf:** `app/lib/ai-actions.ts:86` "davetkar" (sapkali a -> a). Tek karakter; baska metin degismez.

4. **Kalan okumalarin siniflandirmasi (kod degismez, tablo uretilir):** `grep -rn "from(['\"]profiles['\"])" app`
   ciktisindaki HER cagri icin bir satir: `dosya:satir | secilen sutunlar | sinif`. Siniflar:
   - `kimlik` (oturum sahibi / karsi taraf adi-avatari-rolu-is_admin),
   - `operasyon` (mesajlasma, rezervasyon, ilan/basvuru uygunluk kontrolleri — `is_published`, `approval_status`
     okuyan ama saglayici LISTELEMEYEN yollar; ornek `ilanlar/listings-actions.ts:552`, `mesajlar/actions.ts:377`),
   - `yazma-yolu` (profil duzenleme, kategori bilgileri, avatar — FAZ 10),
   - `admin`,
   - `pazaryeri-kaldi` (varsa: hala profiles'tan pazaryeri LISTE/DETAY okuyan yol — beklenen 0; varsa DUR ve raporla,
     kod degistirme).
   Tabloyu `docs/envanter/14-faz2c-okuma-yolu.md` bolum 9'a ("FAZ 10 kesim listesi") yaz; dosya sapkali harf icermez.

5. Dogrulama:
   - `npx tsc --noEmit` bos; `npm run build` basarili.
   - `grep -rn "from(['\"]v_providers_public['\"])" app` -> 14 dosya (P1 5 + P2 5 + P3 4).
   - `grep -rn "from(['\"]profiles['\"])" app/components/sections` -> yalniz `top-nav.tsx`.
   - Sapkali harf taramasi (U+00E2/U+00EE/U+00FB ve buyukleri): `grep -rnP '(*UTF8)[\x{00E2}\x{00EE}\x{00FB}\x{00C2}\x{00CE}\x{00DB}]' app --include=*.ts --include=*.tsx` -> 0 satir.
   - **Onizleme turu (ana sayfa, main vs dal, ayni veri aninda profiles vs gorunum + sayfa cekimi):** one cikan
     saglayicilar 24 id ve sira ayni; hero sayaci 34; kategori marquee sayaclari ayni; marquee profilleri ayni.
     `/p/<yayinda professional>` ve `/p/<ajans>` ayni; `/p/<business id>` (varsa, yayinda olmasa da) 404 — bugun de
     404 (yayinda degil) oldugu icin fark yok; bunu olc ve yaz.

Yapilmayacaklar:
- "Benzer profiller" sorgusunun hic kosmamasi (P2 bulgusu: professional dalinda erken return) DUZELTILMEZ — urun
  karari ve davranis degisikligi; 14 bolum 8'e islendi, ayri is.
- Admin, mesajlasma, rezervasyon, ilan, auth, yazma yollari degismez. Migration yok.

Rapor: degisen dosya listesi, tsc/build, grep ciktilari, onizleme turu degerleri (main vs dal), bolum 9 tablosunun
satir sayisi ve sinif dagilimi, `pazaryeri-kaldi` sayisi (0 beklenir). Commit ATMA.
