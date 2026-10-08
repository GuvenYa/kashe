# KASHE — Ana Sayfa Yenileme Brief'i (v3 — kod denetimi islenmis, Claude Code'a hazir)

**Bu surum ne?** v2 brief'inin (Guven'in 8 Ekim kararlari) repo kodu ve veritabani ile satir satir dogrulanmis hali. v2'de yanlis ya da
eksik olan noktalar duzeltildi (asagida "Denetim bulgulari"); Guven'in 9 Ekim kararlari islendi. Dosyanin ortasindaki
"CLAUDE CODE GOREVI" ayrac satirinin altindaki bolum Claude Code'a oldugu gibi verilir.

**Amac.** TUBITAK hakemi basvuruyu okuduktan sonra kashe.net'i actiginda basvurudaki urunu gorsun. Duzenlemeler bitince gecit kaldirilacak
ve site genel erisime acilacak (bolum 8).

## Denetim bulgulari (v2 -> v3; repo 9 Ekim 2026)

| # | v2'de | Kodda gercek durum | v3 karari |
|---|---|---|---|
| D1 | `12.000+ Etkinlik` -> `1.500+ Etkinlik` | `hero.tsx` `eventNum = 12000` sabit; platformda etkinlik sayaci yok, 1.500 de platform verisi degil | **Ucuncu sayac `23 Kategori`** — `service_categories` aktif sayisi (hero zaten cekiyor); uc sayac da gercek (Guven, 9 Ekim) |
| D2 | `34+` -> `34 Profesyonel` "DB'den" | Dogru: `v_providers_public` yayinda professional+agency sayisi. Ama sorgu bos donerse `2400` yedek sabiti var | Yedek sabit kaldirilir; sayi yoksa sayac render edilmez |
| D3 | Sayaclar sunucuda `0+` | `StatCounter` 0'dan baslayip istemcide sayiyor | Ilk render nihai deger (SSR); animasyon yalniz istemcide, `prefers-reduced-motion`'da yok |
| D4 | 12 kart sabit liste, "Seslendirme", "Cevirmen", "Oyuncu ve Figuran" adlari | Grid VERI GUDUMLU: dolu kategoriler once (sort_order korunur), ilk 12; boslar "Yakinda" etiketi alir. "Seslendirme" diye kategori YOK; "Cevirmen" = `tercuman`; kategori adlari DB'den (`name_tr`) gelir, kodda yazilmaz | **Grid mantigi degismez** (Guven, 9 Ekim: "mevcut mantik kalsin"); ust yazi "Populer kategoriler" kalir (mantikla tutarli). Yalniz 4 eksik ikon eklenir + kirik resim yedegi. Not: Guven ileride sabit liste isterse 12. kart `etkinlik-koordinatoru` (karar kayitli) |
| D5 | Ajans CTA `/uye-ol` ajans rol parametresi | `/uye-ol?rol=` yalniz `musteri|profesyonel|kurumsal`; ajans kaydi AYRI sayfa `/uye-ol/ajans` (hakkimizda zaten oraya baglaniyor) | CTA -> `/uye-ol/ajans` |
| D6 | "robots noindex kaliyor" | Ana sayfada noindex YOK: `app/robots.ts` `/`'e izin verir, `layout.tsx`'te robots meta yok (noindex yalniz yakinda/admin/portal/davet) | **Indekslenebilir kalir** (Guven, 9 Ekim); bolum 8 duzeltildi |
| D7 | "proxy.ts ayni bayragi okudugu icin gecit ve sitemap birlikte doner" | `sitemap.ts` bayragi okumaz; `/sitemap.xml` gecit muafiyetinde olmadigi icin bakim modunda Yakinda HTML'ine yonlenir | Ifade duzeltildi; acilis sonrasi `/sitemap.xml` XML donmeli (bolum 8) |
| D8 | Nav'a `Ajanslar` eklenir; T1 yatay tasma 807 px | Public nav `app/lib/nav-links.ts` (DISCOVERY 4 + MARKETING 4) `md` (768) ustunde acik; 9. baglanti tasmayi buyutur | `MARKETING_LINKS`'e `/#ajanslar`; masaustu nav esigi `lg` (1024) — altinda hamburger (mobil nav ayni listeyi okur, parite otomatik) |
| D9 | "Organizasyon Firmalari" kategori karti | `organizasyon` kategorisi profesyonel kategorisidir; adi DB'de ("Organizasyon") | Kategori adlari DEGISTIRILMEZ (veri + FAZ 3a rol aynasi); metinlerde "organizasyon firmalari" ifadesi serbest |
| D10 | og:image "public altina eklenir" | Hazir 1200x630 gorsel yok; `public/kashe-lockup.png` var | Claude Code `sharp` ile tek seferlik uretir (`public/og-anasayfa.png`): marka laciverti zemin + lockup; betik `scripts/` altinda kalir |
| D11 | Her madde ayri commit | Calisma deseni: Claude Code commit atmaz, Guven atar | Tek gorev, commit YOK; Guven raporu inceleyip commit atar |
| D12 | T9 analitik `/85a72832e91eb4b2/view` | `@vercel/analytics/next` — cerezsiz | Islem yok |

Dogrulanan v2 iddialari (kodla birebir): hero/alt bilgi/profesyoneller "ajanssiz/aracisiz" metinleri, `48 saat` cumlesi, Hilton karti
(`b2b-section.tsx`: "Ilan #4231 · Hilton Istanbul", "22 Mart 2026", "Aktif"), SSS 03/06 cevaplari, Kashe AI karti `/etkinlik-planla`,
`/hakkimizda` "16 kategorideki" ve "Premium seni kesfetin ust siralarina tasir", `/fiyatlandirma` "Arama sonuclarinda one cikma" /
"Gelismis gorunurluk" / "%10 komisyon", `/yardim` "Tamamlanan profiller otomatik yayina gecer", iki H1 (hero + hero-mobile), 4 eksik ikon
(`public/icons/` icinde konusmaci, influencer, drone-pilotu, akrobat yok). Uc "erken erisim" yolu uretimde (`/ajans/ekipler`,
`/ajans/havuz`, `/ajans/teklifler` + `/portal/teklif/[token]`).

## Karar gereği DEĞİŞMEYECEKLER (v2 bolum 1.2 — aynen gecerli)

- "Öne çıkanlar" bolumu (baslik ve mevcut kartlar, test/tohum hesaplar dahil); kayan serit.
- Guvenlik bolumunun dort karti (e-Devlet, iyzico/PCI-DSS, platform guvencesi/odeme transferi, 7/24 destek).
- Kullanici yorumlari (uc yorum; ilk yorumdaki "Aracı yok, fiyat baştan belli" dahil).
- Komisyon cumleleri: Profesyoneller madde 1, SSS 01, kapanis CTA, `/fiyatlandirma` "%10 komisyon", `/yardim` "ilerleyen dönemde komisyon".
- Nasil calisir'in 48 saat cumlesi disindaki her sey; Hero H1 ve fotograf halkasi; SSS 02, 04, 05; kapanis CTA metni.
- **Kategori gridinin veri gudumlu mantigi ve "Yakinda" etiketi** (9 Ekim karari).

Bilgi notu (v2 1.3): e-Devlet dogrulama / iyzico odeme / komisyon ifadeleri sitenin baska sayfalariyla celisiyor; karar geregi dokunulmuyor,
hakem sorarsa basvuru karsiliklari E.1.4, D.1.1/F.1.4, G.1.4.

=== CLAUDE CODE GOREVI ===

Kashe reposundasin. Once su dosyalari oku: `app/page.tsx`, `app/layout.tsx`, `app/lib/nav-links.ts`, `app/lib/site.ts`,
`app/components/sections/{hero,hero-mobile,hero-stats,stat-counter,kashe-ai-section,categories,how-it-works,b2b-section,pro-cta-section,
faq-section,footer,top-nav,mobile-nav}.tsx`, `app/lib/category-icon.ts`, `public/icons/` listesi, `app/hakkimizda/page.tsx`,
`app/fiyatlandirma/page.tsx`, `app/yardim/page.tsx`, `DESIGN.md`, `CLAUDE.md`. Baslamadan `git status --short` temiz olmali; degilse dur ve soyle.

Bu is yalniz uygulama kodu ve `public/` varliklari: migration yok, veri degisikligi yok (kategori adlari DB'den gelir, DEGISTIRILMEZ).
Dil: bireysel kullanici ve profesyonele **sen**, kurumsal ve ajans bolumlerinde **siz**. Sapkali harf (a, i, u uzerinde sapka) HICBIR
dosyada yok; UI metinleri duzgun Turkce, kod yorumlari ASCII. "Degismeyecekler" listesindeki hicbir metin ve bilesen — iyilestirme olarak
bile — degistirilmez.

## 0. Degismeyecekler (dokunma)

"Öne çıkanlar" (`featured-profiles.tsx`) ve kayan serit (`category-marquee.tsx`, `marquee-profiles.ts`); guvenlik bolumu (`trust-section.tsx`)
dort kart; yorumlar (`testimonials.tsx`); kapanis CTA metni (`footer-cta.tsx`); Profesyoneller madde 1 ve 3; SSS 01, 02, 04, 05; Nasil calisir
baslik/uc adim; Hero H1 `Türkiye'nin yetenek sahnesi.` ve fotograf halkasi; kategori gridinin siralama/limit/"Yakında" mantigi
(`categories.tsx` — yalniz ikon yedegi eklenir); `/fiyatlandirma` "%10 komisyon" ve `/yardim` komisyon/odeme/kimlik dogrulama cevaplari.

## 1. Head ve meta (`app/layout.tsx`)

- title: `Kashe — Türkiye'nin Yetenek Sahnesi · Etkinlik sektörü için yapay zeka destekli pazaryeri ve operasyon platformu`
- description: `Türkiye'nin etkinlik ve yetenek pazaryeri. Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu ve organizasyon firmaları — şeffaf fiyatla, tek platformda.`
- `metadataBase: new URL(SITE_URL)`; `alternates.canonical: '/'` (ana sayfa); `openGraph` (type website, locale tr_TR, siteName Kashe,
  title/description yukaridakiyle ayni, images `/og-anasayfa.png` 1200x630); `twitter.card summary_large_image`.
- `og-anasayfa.png`: `scripts/og-anasayfa.mjs` ile `sharp` kullanilarak tek seferlik uretilir — 1200x630, zemin marka laciverti (`#040D26`),
  ortada `public/kashe-lockup-white.png` (genislik ~560 px), altinda kucuk beyaz satir "Türkiye'nin etkinlik ve yetenek pazaryeri".
  Betik `sharp`'i `devDependency` olarak gerektiriyorsa ekle; uretilen PNG `public/`'e konur ve commit'e girer. Betik tekrar calistirilabilir.
- JSON-LD (`<script type="application/ld+json">`, ana sayfa `app/page.tsx` icinde): `Organization` — name `Kashe`, url `SITE_URL`,
  logo `${SITE_URL}/kashe-lockup.png`, email `info@kashe.net`, foundingDate `2026`, areaServed `TR`, address `{ addressLocality: İstanbul,
  addressCountry: TR }`. Sirket unvani YAZILMAZ.
- robots: ekleme/degisiklik YOK (site indekslenebilir; `app/robots.ts` mevcut).

## 2. Hero (`hero.tsx`, `hero-mobile.tsx`, `stat-counter.tsx`)

- Ust yazi `Etkinlik & Yetenek Pazaryeri` -> `Etkinlik ve Yetenek Pazaryeri`. H1 degismez.
- Alt metin -> `Düğün, kurumsal etkinlik ya da özel bir kutlama. Türkiye'nin en yetenekli profesyonelleri, ekipleri ve organizasyon firmaları — şeffaf fiyatla, tek platformda.`
- Sayaclar: `Profesyonel` = `v_providers_public` sayisi (mevcut sorgu; "+" eki KALKAR); `Şehir` = `turkish_cities` sayisi (mevcut; "+" kalkar);
  ucuncu sayac `Etkinlik` yerine **`Kategori`** = aktif `service_categories` sayisi (hero zaten `categoriesData` cekiyor; `categories.length`).
  `eventNum = 12000` ve `2400` yedek sabiti SILINIR; bir sayac icin deger yoksa (null/0) o sayac render edilmez.
- `StatCounter`: sunucu HTML'inde nihai deger gorunur (ilk state = `value`); animasyon yalniz mount sonrasi, `prefers-reduced-motion`'da yok.
  Boylece HTML'de `0` ya da `0+` gecmez.
- Populer etiketleri: `Düğün fotoğrafçısı (fotografci) · DJ (dj) · Sunucu (sunucu) · Oyuncu (oyuncu) · Dansçı (dansci) · Müzisyen (muzisyen)`.
- **Tek H1:** `hero.tsx` masaustu ve `hero-mobile.tsx` DOM'da ayni anda; mobil kopyadaki `<h1>` -> `<p>` (ayni siniflar) ya da tek hero
  bileseni. Sayfada bir H1 kalir.
- Arama kutusu, sihirbaz satiri (`Etkinliğini adım adım kuralım →`), fotograf halkasi, kayan serit degismez.

## 3. Kashe AI (`kashe-ai-section.tsx`)

- H2 degismez. Metin -> `Etkinliğini serbest metinle anlat: tür, tarih, şehir, katılımcı sayısı, bütçe. Kashe ihtiyaç duyduğun rolleri çıkarır; eksik bilgiyi uydurmak yerine sorar. Ya da nasıl biri aradığını söyle, sana en uygun profilleri gerekçesiyle bulalım.`
- Kart 1 `Etkinlik Planlama` -> href `/etkinlik-sihirbazi`; alt metin `Hangi rollere ihtiyacın var, tahmini bütçen ne?`
- Kart 2 `Profesyonel Bulma` -> `/pro-bul` (degismez).
- Alt not (kucuk, soluk): `Kashe AI öneri üretir; fiyat belirlemez, rezervasyon yapmaz. Son karar her zaman sende.`
- `/etkinlik-planla` sayfasi kalir, yalniz ana sayfadan baglanmaz.

## 4. Kategoriler (`categories.tsx`, `public/icons/`)

- Grid mantigi (dolu kategoriler once, sort_order, ilk 12, bos kategoride "Yakında" etiketi) ve ust yazi `Popüler kategoriler` DEGISMEZ.
- `public/icons/` altina 4 eksik ikon eklenir: `konusmaci.png`, `influencer.png`, `drone-pilotu.png`, `akrobat.png` — mevcut ikonlarla ayni
  boyut/stil (ornek: `dj.png`, `sunucu.png`); mevcut ikonlardan birini kopyalayip uyarlayarak ya da ayni cizgi dilinde sade bir simge
  ureterek (ikon dosyalari ikili varlik; kaynak betik gerekmez).
- Kirik resim yedegi: ikon `onError` verirse kart bas harf kutusuna duser (kodda `initials` zaten hesaplaniyor); kirik resim simgesi hicbir
  kosulda gorunmez. Bu istemci etkilesimi gerektiriyorsa kucuk bir `'use client'` `KategoriIkonu` bileseni; `categories.tsx` sunucu kalir.
- `Aradığın kategori yok mu? Bize öner` ve `Tüm kategoriler →` kalir.

## 5. Nasil calisir (`how-it-works.tsx`)

Tek degisiklik: `İhtiyacını yaz, teklif al, güvenle öde. Bütün süreç ortalama 48 saat.` -> `İhtiyacını yaz, teklif al, güvenle öde.`

## 6. Kurumsal (`b2b-section.tsx`)

- Metin -> `Lansman, konferans, bayi toplantısı, gala, fuar ya da marka etkinliği düzenleyen pazarlama, kurumsal iletişim, insan kaynakları ve satın alma ekipleri için. Şirket adınızla ilan açın, tek brief ile çok sayıda profesyonelden teklif toplayın, süreci ekipçe yönetin.`
- Uc madde degismez.
- Ornek kart: `AKTİF` rozeti yerine sag ustte `ÖRNEK` rozeti (ortak kucuk bilesen `OrnekRozeti`, 3 kartta ayni); baslik `İlan · Yıllık bayi toplantısı`
  (marka adi YOK; `Hilton`, `#4231` kalkar); tarih `14 Mayıs 2027`; satir `6 hostes · 1 sunucu · 1 DJ`; "teklif istenen" ve "butce" degerleri
  kalabilir. Alttaki gri `↑ Örnek bir kurumsal ilan kartı` kalir.

## 7. YENI BOLUM — Ajanslar (`app/components/sections/ajanslar-section.tsx`, `app/page.tsx`, `nav-links.ts`, `footer.tsx`)

Kurumsal bolumunun hemen altina, Profesyoneller'den once; `id="ajanslar"`. Gorsel dil Kurumsal ile ayni aile (acik zemin, solda metin, sagda
ornek kart). Fiyat YAZILMAZ. "Event OS" kucuk etiket olarak kullanilabilir; "Crew AI" ve "Copilot" yalniz "Geliştiriliyor" listesinde.

- Ust yazi: `Organizasyon firmaları, ajanslar ve menajerler için`
- H2: `Ekibinizi, müşterilerinizi ve tekliflerinizi tek çalışma alanında yönetin.`
- Metin: `Kashe'de ajanslar rakip değil, müşteridir. Ajans profilinizi açın, ekibinizi davet edin; müşteriler hem ekibinizi hem sizi keşfetsin. Eksik rolleri pazaryerinden tamamlayın.`
- **Bugün — erken erişim** (yesil etiket `Erken erişim`):
  1. `Ajans profili ve ekip sayfası` — `Ekibinizi davet edin; kabul eden her üyenin profilinde ajansınız görünür.`
  2. `Özel yetenek havuzu` — `Kashe hesabı olmayan profesyonellerinizi de kaydedin. Havuz yalnız size görünür, pazaryerine açılmaz.`
  3. `Teklif ve müşteri onayı` — `Teklifinizi oluşturun, müşterinize bağlantıyla gönderin, onayı platformda alın. İç maliyetiniz müşteriye görünmez.`
- **Geliştiriliyor — 2027 pilot programı** (gri etiket `Geliştiriliyor`):
  1. `Brief'ten otomatik ekip kurgusu` — `Rol, tarih, bütçe ve müsaitlik kısıtları altında ekip alternatifleri.`
  2. `Maliyet ve marj kısıtlı teklif alternatifleri` — `En uygun, en ekonomik ve hedef marja uygun seçenekler yan yana.`
  3. `İnsan onaylı operasyon asistanı` — `Görev, risk ve taslak teklif üretir; bağlayıcı işlemleri siz onaylarsınız.`
- CTA: birincil `Tasarım ortağı olun →` (`mailto:info@kashe.net?subject=Tasarim%20ortagi%20programi`), ikincil `Ajans hesabı açın` -> **`/uye-ol/ajans`**.
- Ornek kart (`ÖRNEK` rozetli): `Teklif · Kurumsal yıl sonu daveti` · `Ekip: 1 sunucu · 1 DJ · 4 hostes` · `Kaynak: 3 özel havuz, 3 pazaryeri` ·
  `Durum: Müşteri onayı bekleniyor`.
- Nav: `MARKETING_LINKS`'e `{ href: '/#ajanslar', label: 'Ajanslar' }` (Kurumsal'dan sonra); hamburger ayni listeden turer.
- Alt bilgi Kurumsal sutununa `Ajanslar ve organizasyon firmaları` -> `/#ajanslar` (mevcut `Ajanslar` -> `/hakkimizda#ajanslar` kalabilir).
- Dogrulama: `/ajans/ekipler`, `/ajans/havuz`, `/ajans/teklifler` rotalari repo'da var (uc "erken erisim" maddesinin karsiligi); raporda listele.

## 8. Profesyoneller (`pro-cta-section.tsx`)

- Metin -> `DJ, fotoğrafçı, sunucu, oyuncu, dansçı, müzisyen, hostes ya da organizasyon — profilini aç, portfolyonu yükle, sana doğrudan ulaşılsın. Şeffaf, kontrol sende.`
- Madde 1 ve 3 degismez. Madde 2 -> baslik `Doğrudan iletişim.`, metin `Müşteriyle platform içinde doğrudan konuş. Teklifler ve mesajlar kayıt altında kalır, iletişim bilgilerin anlaşma netleşene kadar gizlidir.`
- Ornek kart icerigi degismez; ustune `ÖRNEK` rozeti (ortak bilesen).

## 9. SSS (`faq-section.tsx`)

- 01, 02, 04, 05 aynen.
- 03 soru -> `Ajanslar ve organizasyon firmaları Kashe'de nasıl yer alır?`; cevap -> `Kashe'de bağımsız profesyoneller, ekipler ve organizasyon firmaları aynı platformdadır. Hizmet alan; tekil profesyonel, ihtiyacın tamamını üstlenen bir firma ya da ikisinin birleşimi arasından seçim yapar. Ajanslar ekiplerini, özel yetenek havuzlarını ve tekliflerini yönettikleri operasyon araçlarına erken erişimle ulaşır; tüm iletişim ve teklifler platform içinde kalır.`
- 06 cevap -> `Verilerin KVKK uyumlu şekilde saklanır, üçüncü taraflarla paylaşılmaz. Profilinde yalnız senin yayınladığın bilgiler görünür; telefon ve e-posta adresin herkese açık değildir, anlaşma netleşene kadar gizli kalır. Hesabını dilediğin zaman silebilirsin.`
- 07 YENI: soru `Kashe'de yapay zeka ne yapar, ne yapmaz?`; cevap `Kashe AI etkinlik ihtiyacını yapılandırır, eksik bilgiyi sorar ve uygun profilleri gerekçesiyle önerir. Fiyat belirlemez, rezervasyon yapmaz, ödeme veya iade kararı vermez; bu kararlar her zaman kullanıcıda kalır.`

## 10. Alt bilgi (`footer.tsx`)

- `Türkiye'nin etkinlik ve yetenek pazaryeri. Doğru profesyoneli ajanssız, şeffaf fiyatla bul.` -> `Türkiye'nin etkinlik ve yetenek pazaryeri. Doğru profesyoneli, ekibi ya da organizasyon firmasını şeffaf fiyatla bul.`; altina ayri satir `İstanbul, Türkiye`.
- Kurumsal sutununa `Ajanslar ve organizasyon firmaları` (`/#ajanslar`). Telif satiri degismez.

## 11. Teknik

- **T1 yatay tasma:** masaustu nav (`top-nav.tsx` iki `hidden md:flex` blogu) esigi `lg` olur; `lg` altinda hamburger (`mobile-nav.tsx`).
  807 ve 1024 px genislikte `document.documentElement.scrollWidth === window.innerWidth`.
- **T5 prefetch:** `featured-profiles.tsx`, `categories.tsx`, kategori/profil kartlarindaki `Link`lerde `prefetch={false}`.
- **T6 bosluklar:** guvenlik ve kurumsal bolumlerinde `md` kiriliminda 250-300 px bos alan — `min-h`/alt padding duzeltilir (gorsel kontrol 807 px).
- **T7 kontrast:** CTA bolumundeki `Hizmet ara` ve profesyonel bolumundeki `Nasıl çalışır?` ikincil dugmeleri cerceveli/okunur yapilir
  (DESIGN.md tokenleri; kontrast >= 4.5:1).
- **T11 mobil hero:** 375 px'te metin fotograf halkasinin ustune biniyor — halka saydamligi ya da metin bloguna zemin.
- T9 (Vercel Analytics, cerezsiz) islem yok.

## 12. Bir tik uzaktaki sayfalar

- `/hakkimizda`: meta + govde `etkinlik düzenleyenlerle sahne profesyonellerini doğrudan buluşturan ... aracısız, şeffaf fiyatla` ->
  `etkinlik düzenleyenlerle profesyonelleri, ekipleri ve organizasyon firmalarını buluşturan ... şeffaf fiyatla, tek platformda`;
  `16 kategorideki` -> `23 kategorideki`; `Premium seni keşfetin üst sıralarına taşır.` -> `Premium profiller "Sponsorlu" etiketiyle ayrı bir alanda öne çıkar; organik sıralama ve yapay zeka önerisi satın alınamaz.`;
  `Ajanslar için` paragrafi bolum 7'deki erken erisim + gelistiriliyor icerigiyle genisletilir (CTA `/uye-ol/ajans` zaten dogru); uc katman
  (Pazaryeri bugun / Event AI gelistiriliyor / Event OS erken erisim) kisa paragraf + `İstanbul`. `Yolculuğun başındayız` kalir.
- `/fiyatlandirma`: `Arama sonuçlarında öne çıkma` ve `Gelişmiş görünürlük` -> `Sponsorlu alanda öne çıkma (organik sıralama değişmez)`;
  sayfaya tek cumle: `Öne çıkarılan ilanlar ve premium profiller "Sponsorlu" etiketiyle gösterilir.` Paketler/fiyatlar/`%10 komisyon` aynen.
- `/yardim`: `Tamamlanan profiller otomatik yayına geçer.` -> `Profil bilgilerini tamamladıktan sonra ekibimiz inceler; onaylanan profil yayına alınır.`;
  `Kashe kimlere uygun?` cevabina `organizasyon firmaları`; 4. secenek `Ajans/menajer` -> `Ajans, organizasyon firması veya menajer`.
  Komisyon/odeme/kimlik dogrulama cevaplari AYNEN.

## 13. Dogrulama

- `npx tsc --noEmit` bos; `rm -rf .next && npm run build` -> route tablosu + hata satiri yok + `.next/BUILD_ID`.
- Uretim derlemesi + onizleme cerezi ile `/`, `/hakkimizda`, `/fiyatlandirma`, `/yardim` HTML'inde **gecmemesi gerekenler** (buyuk/kucuk
  harf duyarsiz): `ajanssız`, `aracısız`, `ajans kesintisi`, `aracı pazarlığı`, `48 saat`, `81+`, `12.000`, `1.500`, `34+`, `Hilton`, `#4231`,
  `Fahri`, `A.Ş.`, `Ltd.`, `Seslendirme`; sapkali harf 0. Tek istisna: yorumlardaki `Aracı yok, fiyat baştan belli` (karar) — tarama bunu atlar.
- **Olmasi gerekenler:** DOM'da tek `<h1>`; `Ajanslar` nav ogesi + `id="ajanslar"`; sayaclarda `Profesyonel`, `Şehir`, `Kategori` ve HTML'de
  `0+` yok; SSS 7 soru; alt bilgide `İstanbul, Türkiye`; `<link rel="canonical" href="https://kashe.net/">`, `og:image` yukleniyor (200),
  JSON-LD gecerli; Kashe AI kart 1 `/etkinlik-sihirbazi`; `/icons/{konusmaci,influencer,drone-pilotu,akrobat}.png` 200; konsolda 404 yok.
- Genislik: 375, 807, 1024, 1366 px ekran goruntusu; 807 ve 1024'te yatay kaydirma yok.
- Profil onayi cumlesi (`/`, `/hakkimizda`, `/yardim`: ekip inceler) ve sponsorlu gorunurluk cumlesi (`/hakkimizda`, `/fiyatlandirma`) ayni.
- Hakemin tiklayabilecegi her baglanti gercek icerige gider: kategori kartlari, Kesfet, Kashe AI kartlari, kurumsal ve ajans CTA'lari, alt bilgi.

## 14. Yapilmayacaklar

Bolum 0'daki alanlar; kategori adlari/veri; migration; `/etkinlik-planla` silme; robots/noindex degisikligi; v2 3.11 "Neden böyle kurduk"
blogu (Guven acikca isterse); e-posta/sablon. **Commit ATMA.**

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), tarama ciktisi (gecmemesi/olmasi gerekenler listesi madde madde), ekran goruntusu notlari,
sapma ve nedeni.

## 15. Acilis sirasi (Guven; gorev disi)

1. Rapor + commit + push; Vercel Ready.
2. Gecit acikken oturumsuz kontrol (cerezsiz cekim, 807/375 px, bolum 13 taramasi).
3. Vercel'de `NEXT_PUBLIC_BAKIM_MODU` kaldirilir ya da `false`; **Redeploy** (derleme aninda gomuluyor). `proxy.ts` gecidi kapatir.
4. Genel erisimde: `kashe.net` cerezsiz ana sayfa; `/portal/teklif/<jeton>` acilir; `/sitemap.xml` XML doner (gecit varken Yakinda HTML'ine
   yonleniyordu); `/robots.txt` `/`'e izin verir — site indekslenebilir (karar).
5. Basvuru tarafi: G.1.4 ilk satir (`Pazaryerinin kamuya açılması — Ekim 2026`), B.5 ve G.1.2 ile tutarli.
