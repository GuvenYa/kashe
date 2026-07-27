# Yeni Kategori Doğum Listesi (uçtan uca)

Bir kategoriyi Kashe'ye eklerken **sırayla** dokunulacak her nokta. Her madde
dosya yolu içerir. Slug her yerde **birebir aynı** yazılmalı (ör. `stand-up-komedyen`).

> **Kapsama durumu (Dalga 0 sonrası — 16 slug):**
> `category-fields` 16/16 · `category-content` 16/16 · `filter-config` 16/16 ·
> `brief-config` 16/16 · ikon 16/16. **Drift kapandı** — yeni kategori eklerken
> beş dosyanın hepsine ekleyip seti senkron tut.

---

## 1. Veritabanı — `service_categories` satırı
- Tablo: `supabase/migrations/20260518000000_initial_schema.sql`
  (`id, slug, name_tr, emoji, is_active, sort_order, created_at`).
- Yeni kategori = yeni satır: `slug` (kebab-case, ASCII), `name_tr`, `emoji`,
  `is_active=true`, `sort_order`.
- **Nasıl doğar:** ya admin kategori-talep onayı (#8) ya da Dashboard SQL Editor
  (satır ekleme migration'la değil manuel — kategori satırları drift).
- ⚠️ `is_active=false` iken kategori hiçbir yerde görünmez (kayıt select'i, Keşfet,
  ana sayfa, `/kategoriler`, sitemap).
- ⚠️ **`description` ve `seo_title` kolonları ÖLÜ.** `/kategori/[slug]` onları
  yalnız `category-content` girdisi YOKKEN fallback olarak okur; o da 16/16 dolu
  olduğu için hiç gerçekleşmez. Yazma, okuma — içerik #3'te yaşar.
- ⚠️ `name_tr` kategorinin **kapsamını** yansıtmalı. Kapsam genişlerse Dashboard
  SQL ile güncelle (migration DEĞİL):
  `UPDATE public.service_categories SET name_tr = '…' WHERE slug = '…';`

## 2. İkon varlığı — `public/icons/<slug>.png`
- `app/lib/category-icon.ts` → `getCategoryIcon(slug)` = `/icons/<slug>.png`.
- Dosya yoksa `app/components/ui/category-icon.tsx` **baş harfe** düşer
  (kırık görsel değil, ama markasız).
- Ayrı renk haritası **yok** — görünüm emoji + PNG + baş-harf fallback ile kurulur.

## 3. SEO içerik — `app/lib/category-content.ts`
- `CATEGORY_CONTENT[slug]`: `heroHeadline`, `description`, `subServices[]`,
  `seoTitle`, `seoDescription`, `landingText?`.
- Kullanan: `/kategori/[slug]` (`app/kategori/[slug]/page.tsx`), `/kategoriler` hub
  (kart açıklaması = `description`'ın ilk cümlesi), `generateMetadata`.
- `subServices[]` = kaynak dokümanın §4 "Alt Hizmetler" tablosu, birebir.
- SSS: `/kategori/[slug]` içindeki `getCategoryFaq()` kategori adını enterpolasyonla
  yerleştiren **jenerik 5 soru** üretir — kategori başına ayrı SSS alanı yok.
  Kategoriye özel SSS gerekirse `CategoryContent`'e `faq?` genişletmesi (backlog).

### 3b. Komşuluk sınırı konvansiyonu (ZORUNLU)
Yeni kategori, komşusu olan **her mevcut kategorinin** `description`'ına
**karşılıklı** sınır cümlesi yazmadan kapanmış sayılmaz. Tek yüzey:
`CategoryContent.description`'ın **son cümlesi**. `seoDescription` kirletilmez.

Kalıp: *"[Ayırt edici ölçüt] değil de [öteki kategorinin işi] arıyorsan
**[Kategori Adı]** kategorisine bak."*

Mevcut çiftler: `tercuman ↔ hostes` · `stand-up-komedyen ↔ sunucu` ·
`dansci ↔ illuzyonist / palyaco`.

## 4. Profil alan preset'i — `app/lib/category-fields.ts`
`CATEGORY_FIELDS[slug]` (`CategoryFieldConfig`):
- `archetype`: `sahne | cast | produksiyon | uzmanlik` (hero + yerleşim davranışı;
  `/kategoriler` hub gruplaması da buradan). **Yeni arketip eklenmez** (4 sabit).
- `quickInfo[]`: Hakkımda altı hızlı bilgi anahtarları (2-4).
- `modules[]`: `MODULE_REGISTRY`'den ref'ler (başlık override edilebilir).
- `experienceGroups[]`, `logisticsChecks[]`, `skillsWithLevels`.
- (ops.) `labelOverrides`, `portfolioGrid`.

### 4b. Değer kümeleri — kontrollü sözlük
- **Tekli select** → `QUICK_OPTIONS_BY_SLUG[slug][quickKey]`.
- **Çoklu çip** → `QUICK_MULTI_OPTIONS[quickKey]`. Saklama **`string[]`**
  (`" · "` birleşik string DEĞİL — containment filtresi diziyi eşler).
- **Etiket** → `QUICK_LABELS[quickKey]` (yoksa key ham görünür).
- Değer kümesi tanımlanmayan quick anahtarı **serbest metne** düşer ve
  **filtrelenemez**.
- **Örnekler** → `CATEGORY_EXAMPLES[slug]` (serbest-metin/çip placeholder'ları;
  `summary_stats` anahtarı uzmanlik arketipinin tanıtım bandı çipleri için).
- **Öneriler** → `CATEGORY_PARAM_SUGGESTIONS[slug]` (`performans.details` /
  `calisma_parametreleri.params` / `teknik_teslimat.delivery` tek-tık etiketleri).

## 5. Keşfet filtreleri — `app/lib/filter-config.ts`
`CATEGORY_FILTERS[slug]` → `{ slug, source, fields[] }`.

### 5a. Kaynak: yeni kategoriler `category_attributes` kullanır
- `source: 'category_attributes'` — veri `/profil/kategori-bilgileri` formunda
  doldurulur, DB tarafında jsonb containment (`@>`) ile filtrelenir.
- **`attributes`'a AYNA YAZILMAZ.** `/profil/duzenle`'deki `AttributesEditor` bu
  kategorilerde **render edilmez** (aynı bilgi iki formda sorulmaz).
- `source: 'attributes'` (varsayılan) = ESKİ sistem, 12 kategori. Yeni kategori
  buraya **eklenmez**.
- Her alan bir `path` tanımlar: `quick | quick_array | logistics | root |
  root_array | module`. Şekil saklama şekliyle birebir olmalı (skalar↔skalar,
  dizi↔dizi) — `{"a":"x"} @> {"a":["x"]}` **yanlıştır**.

### 5b. Filtre uygunluk kısıtı
Filtre **yalnız kontrollü sözlük** alanına bağlanır: quick select'ler ·
`logisticsChecks` boolean'ları · paylaşılan setler (`EVENT_TYPES`,
`service_region`, `LANGUAGE_OPTIONS`, `FOLLOWERS_RANGES`).

**Serbest metin çipleri (`uzmanlik_alanlari.areas`) FİLTRELENMEZ** — gösterim
alanıdır. Doğrulanamaz öz-beyanlar ("kurumsal deneyim", "protokol deneyimi")
da filtreye girmez; hepsi işaretlenir, filtre bilgi taşımaz.

### 5c. ⚠️ OPTION DEĞER KISITI — PostgREST güvenliği
Filtreye bağlanan **her** değer `or=(...)` gövdesinde taşınır. Bu dilbilgisinde
`,` koşul ayracı, `( )` grup karakteridir. **Yasak: `,` `(` `)` `"` `\`.**
**Güvenli: boşluk, `+`, `–`, `/`, Türkçe harfler.**

Gerçek vakalar:
| Değer | Sorun | Düzeltme |
|---|---|---|
| `'Anında (canlı)'` | parantez | `'Anında'` (nüans `logistics.canli_cizim`'de) |
| `'Grup (4+)'` | parantez | `'Grup 4+'` |

⚠️ **Sessiz mod:** alanın diğer değerleri güvenliyse koşul `NEVER_MATCH`'e
**düşmez** — yalnız o değer OR listesinden sessizce elenir ve kullanıcı hiç
sonuç görmez. "Alan NEVER_MATCH'e düşmüyor" yeterli DEĞİL; **değer değer**
denetle. Değer değişirse eski kayıtlar için backfill migration gerekir.

### 5d. `allowCustom` kuralı
Filtreye bağlanan quick anahtarında `allowCustom` **kapalı** olmalı. Açıksa
serbest çip filtre seçenekleriyle örtüşmez ve o profiller görünmez.
(Bugün açık olan tek anahtar: `enstruman` — filtreye bağlı değil.)

### 5e. Uzunluk bütçesi
Alanlar arası AND **tek `.or()` çağrısında** açık `and(or(...),...)` ile kurulur
(`buildCategoryFilterExpression`). Tekrarlanan `or=` parametresine güvenilmez.

Ölçüm eşiği: **kodlanmış `or=` ifadesi 6 KB'ı (8 KB tamponun %75'i) geçerse**
azaltım gerekir — UI'da alan başına değer sınırı veya sorguyu RPC'ye taşıma.
En son ölçüm: tercuman, 6 alan tam seçili → 4 827 karakter (%59).

## 6. Kayıt / profil kategori seçimi — DİNAMİK (kod değişikliği YOK)
- `primary_category_id` seçimi `service_categories`'ten canlı okunur
  (`app/profil/duzenle/page.tsx`, üye-ol akışı).

## 7. Keşfet / kart / ana sayfa / hub — DİNAMİK (kod değişikliği YOK)
- `app/components/sections/categories.tsx` — ana sayfa grid'i **ilk 12** kategori
  (dolu olanlar önce, sonra `sort_order`), altında "Tüm kategoriler →".
- `app/kategoriler/page.tsx` — **tüm** aktif kategoriler, arketipe göre gruplu.
- `app/kesfet/*`, `app/kesfet/profile-card.tsx` — canlı join.

## 8. Admin kategori talep bağı — `app/admin/kategori-talepleri/*`
- `page.tsx` (liste), `talep-aksiyonlari.tsx` (onay/red),
  `yeni-kategori-formu.tsx` (admin elle yeni kategori — #1 satırını burada üretir).
- Onay sonrası **#2–#5 ve #10 hâlâ MANUEL** (ikon, içerik, preset, filtre, brief).
  Form bu uyarıyı gösterir.

## 9. Diğer slug-bağımlı noktalar
- `/kategori/[slug]` SEO sayfası — #3 içeriğine bağlı.
- `KategoriTalepCta` (`existingSlugs`) — mevcut slug'ları dışlar; otomatik.

## 10. Teklif formu — `app/lib/brief-config.ts`
`CATEGORY_BRIEFS[slug]` → `{ slug, intro, fields[] }`. Tanımsız kategori
`DEFAULT_BRIEF_FIELDS`'e düşer (müşteri kategoriye anlamsız form doldurur).
- **5 legacy primitif zorunlu**, `legacyColumn` ile: `event_type` · `event_date` ·
  `location` · `guest_count` · `budget_range`.
- **+ 2-3 kategoriye özel `select`.** Değer kümeleri ilgili quick sözlükleriyle
  **birebir hizalı** olmalı — müşterinin "Ardıl" demesi ile profesyonelin "Ardıl"
  beyanı aynı değer olsun.
- Talep tarafına özgü değerler (`no_pref`, `other`, `hourly`…) profil sözlüğünde
  karşılık aramaz — bu hizasızlık değildir.
- Tip kümesi: `select | text | textarea | number | date`. Dosya yükleme alanı YOK
  (referans dosya mesaj ekiyle gelir).

## 11. Sitemap / robots — DİNAMİK (kod değişikliği YOK)
- `app/sitemap.ts` `service_categories`'i **canlı** okur → `is_active=true` olan
  yeni kategori otomatik `/kategori/<slug>` olarak sitemap'e girer. ✅ **Teyit
  edildi: yeni kategori için sitemap'te yapılacak iş yok.**
- `app/robots.ts` sitemap'i işaret eder; özel alanlar disallow.
- Taban adres **tek kaynak**: `app/lib/site.ts` → `SITE_URL`
  (`NEXT_PUBLIC_SITE_URL` env'i ezer). Domain cutover'ında tek satır değişir.

---

## Kusursuz form tanımı (yeni kategori ön koşulu)
Yeni kategori preset'i **bu ilkeleri karşılamadan** kapanmış sayılmaz:

1. **Tek-yer kuralı.** Her bilgi tek yerde girilir, tek yerde görünür.
   Değeri modülde girilen anahtar quickInfo'da **yok** (boy/yaş → Fiziksel;
   diller → Diller & Belgeler; deneyim → `experience_label`). quick anahtarı ile
   modül alanı **aynı bilgiyi** tekrarlamaz.
   - Kalıp: quick **kontrollü çoklu çip** = *rol/hizmet türü* (filtrelenir);
     `uzmanlik_alanlari` çipleri = *deneyim/bağlam beyanı* (gösterilir). Farklı
     eksen oldukları için ihlal değil.
2. **Seçmeli alanlar.** Değer kümesi sayılabilirse select/çip: evet-hayır → select,
   süre/aralık → select, çoklu küme → çoklu çip. Serbest metin yalnız gerçekten
   açık uçlu alanlarda (uzmanlık çipleri, notlar).
3. **Örnekler.** Her serbest-metin/çip alanına `CATEGORY_EXAMPLES[slug]` örneği.
4. **Öneriler.** `key_value` alanları için `CATEGORY_PARAM_SUGGESTIONS[slug]`.
5. **Boş-modül denetimi.** Çizilebilir içerik yoksa modül başlığı **çizilmez**.
6. **KVKK/SIRA1.** Fiziksel alanlar opt-in + "Kullanıcı beyanı"; sosyal erişimde
   link YOK (yalnız takipçi aralığı); yaş **aralık**; belge "yüklendi"
   (doğrulandı değil).
7. **Rozetler.** Kaynak dokümandaki "Rozetler" listeleri **öz-beyan etiketleridir**;
   `badges.ts`'in veriye dayalı ailesine **GİRMEZ**. Uzmanlık çipi veya
   `logisticsChecks` satırı olarak modellenir. `badges.ts`'e yeni rozet eklenmez.
8. **Örnek profil kartları.** Kaynak dokümandaki tablolar kurgudur — sahte
   profil/puan/fiyat olarak sisteme **girmez**.

---

## Çalışma kuralları (acı deneyimle öğrenildi)

### Kod okuması kanıt değildir
Filtre/sorgu davranışı **canlı ölçülür**. "PostgREST şunu yapar" gibi bir iddia,
üretilen nihai URL yakalanıp gerçek DB'ye koşulmadan raporlanmaz. Tur 2'de
tekrarlanan `or=` davranışı kod okumasından ilan edildi; doğru çıktı ama süreç
hatalıydı ve bir tur kaybettirdi.

**Minimum canlı doğrulama:** tek alan → beklenen sayı · tek alan (başka) →
beklenen sayı · **iki alan → kesişim**. İki alanlı senaryo AND'i sınayan tek
testtir; naif OR hatası tam olarak orada "fazla sonuç" olarak görünür.

### Config değişikliği sonrası `.next` temizliği
`filter-config.ts` / `category-fields.ts` gibi config dosyaları bir turda birden
çok kez değişiyorsa dev sunucusunun modül grafiği bayatlayabilir ve **var olmayan
bir hata** gözlemlenir. Test etmeden önce dev sunucusunu kapat, `.next` klasörünü
sil, yeniden başlat.

### Dalga 3 (audio) uyarısı — kodda görünmeyen adım
`portfolio_items.media_type` CHECK'i `'audio'` ile genişletildiğinde Supabase
**Storage bucket MIME allowlist'i de** güncellenmelidir. Bu bir **Dashboard
ayarıdır, kodda görünmez**; unutulursa yükleme üretimde sessizce 400 döner ve
testte fark edilmez.
