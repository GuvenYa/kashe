# Yeni Kategori Doğum Listesi (uçtan uca)

Bir kategoriyi Kashe'ye eklerken **sırayla** dokunulacak her nokta. Her madde
dosya yolu içerir. Slug her yerde **birebir aynı** yazılmalı (ör. `stand-up-komedyen`).

> Slug seti drift'e açık: `category-fields.ts` **16** slug tanımlar,
> `category-content.ts` şu an **12** slug (dansci / stand-up-komedyen / tercuman /
> karikaturist eksik). Yeni kategori eklerken **her iki dosyaya da** ekleyip
> setleri senkron tut.

---

## 1. Veritabanı — `service_categories` satırı
- Tablo: `supabase/migrations/20260518000000_initial_schema.sql` (`CREATE TABLE public.service_categories`: `id, slug, name_tr, emoji, is_active, sort_order`).
- Yeni kategori = yeni satır: `slug` (kebab-case, ASCII), `name_tr`, `emoji`, `is_active=true`, `sort_order`.
- **Nasıl doğar:** ya admin kategori-talep onayı (aşağıda #8) ya da Dashboard SQL Editor (satır ekleme migration'la değil manuel — kategori satırları drift).
- ⚠️ `is_active=false` iken kategori hiçbir yerde (kayıt select'i, Keşfet, ana sayfa) görünmez.

## 2. İkon varlığı — `public/icons/<slug>.png`
- `app/lib/category-icon.ts` → `getCategoryIcon(slug)` = `/icons/<slug>.png`.
- Dosya yoksa `app/components/ui/category-icon.tsx` **baş harfe** düşer (kırık görsel değil, ama markasız).
- Ayrı renk haritası **yok** — görünüm emoji + PNG + baş-harf fallback ile kurulur.

## 3. SEO içerik — `app/lib/category-content.ts`
- `CATEGORY_CONTENT[slug]`: `heroHeadline`, `description`, `subServices[]`, … (bkz. `CategoryContent` tipi).
- Kullanan: `/kategori/[slug]` SEO açılış sayfası (`app/kategori/[slug]/page.tsx`), `getCategoryContent(slug)`.
- Şablon şu an yalnız `fotografci` dolu; yeni kategori kendi içeriğini eklemeli (yoksa sayfa jenerik/boş).

## 4. Profil alan preset'i — `app/lib/category-fields.ts`
Yeni kategori için `CATEGORY_FIELDS[slug]` (`CategoryFieldConfig`):
- `archetype`: `sahne | cast | produksiyon | uzmanlik` (hero + yerleşim davranışını belirler).
- `quickInfo[]`: Hakkımda altı hızlı bilgi anahtarları. **TEK-YER kuralı:** değeri modülde/rail'de zaten görünen anahtar (boy, yaş, dil_cifti, calisma_sekli, deneyim) quickInfo'ya KONMAZ.
- `modules[]`: `MODULE_REGISTRY`'den ref'ler (başlık override edilebilir). Yeni modül tipi gerekiyorsa önce `MODULE_REGISTRY` + `ModuleFieldType` + form/render kolları.
- `experienceGroups[]`: Deneyim CRUD'daki work grupları.
- `logisticsChecks[]`: rail lojistik onay satırları (key/label/description).
- `skillsWithLevels`: seviyeli yetenek (cast) açık mı.
- (ops.) `labelOverrides`: quick/modül alan etiketi override (ör. model → "Görünüm yaş aralığı").
- (ops.) `portfolioGrid`: uzmanlik arketipinde cast portföy grid'i (karikatürist).
- **Örnekler:** `CATEGORY_EXAMPLES[slug]` → serbest-metin/çip modül alanlarına kategoriye özel placeholder.
- **Öneri setleri:** `CATEGORY_PARAM_SUGGESTIONS[slug]` → `{ details?: [...], params?: [...] }` (performans.details / calisma_parametreleri.params tek-tık etiket çipleri).
- **Yeni quick anahtarı** eklediysen `QUICK_LABELS`'a görünen etiketini ekle (yoksa key ham görünür).
- **Yeni tagline arketipi** yok (4 sabit); ama `ARCHETYPE_TAGLINE_EXAMPLES` arketip bazlı — yeni arketip eklenmez.

## 5. Keşfet filtreleri — `app/lib/filter-config.ts`
- `FILTER_FIELDS[slug]` (→ `getFilterFields`, `categoryHasFilters`, `getAttributeLabel`).
- Kategoriye özel filtre (multi/single + options) tanımla; yoksa `categoryHasFilters=false` (filtre paneli o kategoride sade kalır).
- ⚠️ Bu, `profiles.attributes` (eski filtre verisi) ile bağlı — `category_attributes` (yeni profil verisi) ile karıştırma.

## 6. Kayıt / profil kategori seçimi — DİNAMİK (kod değişikliği YOK)
- `primary_category_id` seçimi `service_categories`'ten canlı okunur: `app/profil/duzenle/page.tsx`, üye-ol akışı.
- Yeni kategori `is_active=true` ise otomatik listeye düşer; per-kategori kod yok.

## 7. Keşfet / kart / ana sayfa — DİNAMİK (kod değişikliği YOK)
- `app/components/sections/categories.tsx` → `service_categories` `is_active` canlı; `/kategori/<slug>` linkler + `getCategoryIcon`.
- `app/kesfet/*`, `app/kesfet/profile-card.tsx` → `service_categories` join'i canlı.

## 8. Admin kategori talep bağı — `app/admin/kategori-talepleri/*`
- `page.tsx` (liste), `talep-aksiyonlari.tsx` (onay/red), `yeni-kategori-formu.tsx` (admin elle yeni kategori — #1 satırını burada üretir).
- Kullanıcı talebi → admin onayı → `service_categories` satırı. Onay sonrası #2–#5 hâlâ MANUEL (ikon, içerik, preset, filtre).

## 9. Diğer slug-bağımlı noktalar
- `/kategori/[slug]` SEO sayfası (`app/kategori/[slug]/page.tsx`) — #3 içeriğine bağlı.
- `KategoriTalepCta` (`existingSlugs`) — mevcut slug'ları dışlar; otomatik.

---

## Kusursuz form tanımı (yeni kategori ön koşulu)
DJ / model / tercüman turlarında oturan standart. Yeni kategori preset'i
**bu ilkeleri karşılamadan** kapanmış sayılmaz:

1. **Tek-yer kuralı.** Her bilgi tek yerde girilir, tek yerde görünür.
   - Değeri modülde girilen/gösterilen anahtar quickInfo'da **yok** (boy/yaş → Fiziksel; dil çifti → Diller & Belgeler; calisma_sekli → ortak alan/rail; deneyim → experience_label/rail).
   - quick anahtarı ile modül alanı **aynı bilgiyi** tekrarlamaz (ör. `turler` quick + `repertuar.genres` modül = ihlal).
2. **Seçmeli alanlar (serbest metin bırakma).** Değer kümesi sayılabilirse select/çip:
   - evet/hayır → select (yeminli kalıbı), süre/aralık → select, çoklu küme (diller, çeviri türleri, etkinlik türleri) → çoklu çip, platform → select.
   - Serbest metin yalnız gerçekten açık uçlu alanlarda (repertuar/uzmanlık çipleri, notlar).
3. **Örnekler (placeholder).** Her serbest-metin/çip modül alanına `CATEGORY_EXAMPLES[slug]` ile kategoriye uygun örnek; genel Deneyim ve tagline'lara arketip/kalıp örneği.
4. **Öneriler (tek-tık).** key_value alanları (performans.details / calisma_parametreleri.params) için `CATEGORY_PARAM_SUGGESTIONS[slug]` etiket seti.
5. **Boş-modül denetimi.** Çizilebilir içerik yoksa modül başlığı **çizilmez** (public render sözleşmesi); form/preset bunu bozmaz.
6. **KVKK/SIRA1.** Fiziksel alanlar opt-in + "Kullanıcı beyanı"; sosyal erişimde link YOK (yalnız takipçi aralığı); yaş **aralık** (kesin yaş yok); belge "yüklendi" (doğrulandı değil).
7. **Etiketler.** Yeni quick anahtarları `QUICK_LABELS`'ta; kategoriye özel etiket farkı `labelOverrides`'ta.
