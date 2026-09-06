# 03 — Taksonomi

## Uc katmanli yapi

```
SERVICE CATEGORY    Fotograf ve Video
  |
  +-- ROLE          Photographer · Videographer · Drone Operator
        |
        +-- SKILL   dugun · kurumsal · moda · drone · sinematik
```

**Service Category** — ust gruplama, gezinme ve pazar analizi icin.
**Role** — eslestirmenin temel birimi. `event_requirements` ve `provider_services` buna baglanir.
**Skill** — serbest ve genisleyen katman; stil ve uzmanlik.

---

## Mevcut durum

Bugun tek katman var: `service_categories` (23 kayit, integer anahtarli).

```
service_categories
  id integer, slug, name_tr, emoji, sort_order, is_active,
  description, seo_title
```

Bunlar cogunlukla **rol** duzeyindedir: fotografci, DJ, sunucu, dansci.

---

## Goc yontemi

**Mevcut 23 kategori ROL olur.** Uzerine 6-8 servis kategorisi gelir. Skill katmani bos baslar.

```sql
service_categories        -- MEVCUT TABLO, genisletilir
  id integer pk
  slug, name_tr, emoji, sort_order, is_active, description, seo_title
  + layer      enum('category')      -- yeni: bu satirin katmani
  + parent_id  integer null          -- ileride alt kategori gerekirse

roles                     -- YENI
  id                  integer pk
  service_category_id integer fk -> service_categories(id)
  slug                text unique
  name_tr             text
  legacy_category_id  integer null    -- ESKI KATEGORI KIMLIGI
  sort_order          integer
  is_active           boolean

skills                    -- YENI
  id          integer pk
  slug        text unique
  name_tr     text
  skill_type  enum('domain','technique','style')
  is_active   boolean

role_skill_map
  role_id integer fk, skill_id integer fk, is_common boolean
  primary key(role_id, skill_id)
```

**`legacy_category_id` kritiktir.** Mevcut `services.category_id`, `listings.category_id`, `quote_requests.category_id` ve `profiles.primary_category_id` bozulmadan calismaya devam eder.

---

## Ornek esleme

| Mevcut kategori | Yeni Service Category | Yeni Role |
|---|---|---|
| Fotografci | Fotograf ve Video | Photographer |
| Videograf | Fotograf ve Video | Videographer |
| DJ | Muzik ve Ses | DJ |
| Muzisyen | Muzik ve Ses | Musician |
| Sunucu | Sahne ve Sunum | Presenter |
| Dansci | Sahne ve Sunum | Dancer |
| Oyuncu / Figuran | Oyunculuk ve Cast | Actor / Extra |
| Model | Oyunculuk ve Cast | Model |
| Host / Hostes | Etkinlik Operasyonu | Host |
| Teknik ekipman | Teknik ve Sahne | Technical Operator |
| Dekorasyon | Tasarim ve Dekorasyon | Decorator |

Kesin esleme, mevcut 23 kategorinin tam listesi alindiktan sonra yapilir.

---

## Uyumluluk gorunumu

Eski kod calismaya devam ederken yeni kod gorunumu kullanir:

```sql
create view v_provider_roles as
  select s.profile_id,
         s.provider_id,
         r.id as role_id,
         r.service_category_id
  from services s
  join roles r on r.legacy_category_id = s.category_id;
```

Tum yollar gectikten sonra eski sutunlar kaldirilir.

---

## Skill katmani nasil dolar

Skill'ler **elle girilmez.** IP1'in stil cikarim faaliyetinden beslenir: portfoy aciklamalari, hizmet metinleri ve gecmis is kayitlarindan cikarilir.

Bu, IP1 ile taksonomi arasinda dogal bir bag kurar: talep tarafinda kullanicinin yazdigi stil ifadesi ile arz tarafinda cikarilan stil etiketi ayni uzayda eslesir.

Baslangicta `skills` bos olabilir; sistem skill olmadan da calisir (Match Score'da stil bileseni sifir agirlikli olur).

---

## Yeni kategori talebi

Mevcut `category_requests` tablosu korunur. Yeni yapida talep hem kategori hem rol duzeyinde olabilir; `requested_layer` alani eklenir.

---

# MEVCUT KATEGORI ALTYAPISI ILE ILISKI

Kashe'de kategori eklemek yalniz bir veritabani satiri degildir. `docs/yeni-kategori-checklist.md` on bir dokunma noktasi tanimlar ve bunlarin bes tanesi **birbirine senkron tutulmasi gereken TypeScript yapilandirma dosyalaridir.**

Taksonomi gocu bu altyapiyi bozmadan yapilmalidir. Asagida catisma noktalari ve cozumleri.

---

## 1. BIRLESTIRME ANAHTARI `slug`, `id` DEGIL

Bes yapilandirma dosyasinin tamami **slug** ile anahtarlanir:

```
CATEGORY_FIELDS[slug]      app/lib/category-fields.ts
CATEGORY_CONTENT[slug]     app/lib/category-content.ts
CATEGORY_FILTERS[slug]     app/lib/filter-config.ts
CATEGORY_BRIEFS[slug]      app/lib/brief-config.ts
public/icons/<slug>.png
```

**Sonuc:** Mevcut kategoriler `roles` tablosuna tasinirken **slug degerleri korunmalidir.** Slug degisirse bes dosyanin hepsi ve ikonlar kirilir.

`roles.slug` = eski `service_categories.slug` (birebir). Yeni servis kategorisi katmani kendi slug uzayini kullanir ve bu dosyalara dokunmaz.

---

## 2. `archetype` ILE SERVICE CATEGORY AYNI SEY DEGIL

`category-fields.ts` icinde dort sabit arketip var: `sahne`, `cast`, `produksiyon`, `uzmanlik`. Bunlar profil formunun **davranisini** belirler (hero yerlesimi, modul dizilimi) ve `/kategoriler` hub gruplamasini yapar.

Onerilen servis kategorileri ise **ticari gruplamadir**: Fotograf ve Video, Muzik ve Ses, Sahne ve Sunum gibi.

Iki eksen farklidir ve **birlikte yasar:**

| Rol | archetype | service_category |
|---|---|---|
| Photographer | `produksiyon` | Fotograf ve Video |
| Videographer | `produksiyon` | Fotograf ve Video |
| Technical Operator | `produksiyon` | Teknik ve Sahne |
| Presenter | `sahne` | Sahne ve Sunum |
| Dancer | `sahne` | Sahne ve Sunum |

Ayni arketip farkli ticari kategorilere dagilabilir. `roles` tablosu **ikisini birden** tasir:

```
roles
  id, service_category_id fk, slug, name_tr,
  archetype enum('sahne','cast','produksiyon','uzmanlik'),
  legacy_category_id integer null
```

**`archetype` bugun TypeScript'te, veritabaninda degil.** Gocte veritabanina tasinabilir; ancak `category-fields.ts` yine de tek kaynak kalabilir. Karar: **once TypeScript'te birakilir**, `roles.archetype` bir kolaylik kopyasi olarak eklenir ve yalniz hub gruplamasi icin okunur.

**Yeni arketip eklenmez** — dort sabit. Yeni servis kategorisi eklenebilir.

---

## 3. OLU KOLONLAR: `description` VE `seo_title`

`service_categories.description` ve `service_categories.seo_title` kolonlari **kullanilmiyor.** `/kategori/[slug]` bunlari yalniz `category-content` girdisi yokken geri donus olarak okur; 16/16 dolu oldugu icin hic gerceklesmez.

**Icerik `category-content.ts`'te yasar.** Goc sirasinda bu kolonlar `roles` tablosuna **tasinmaz**; olu olarak birakilir veya kaldirilir.

---

## 4. `category_attributes` ILE `provider_services` FARKLI SEYLER

Karistirilmamalidir:

| Yapi | Ne tutar | Nerede |
|---|---|---|
| `profiles.category_attributes` | Profilin kategoriye ozel **zengin alanlari** (quick info, moduller, lojistik) | jsonb, profil uzerinde |
| `provider_services` | Saglayicinin **ticari teklifi**: hangi rolde, ne kapasiteyle, hangi fiyatla | iliskisel tablo |

Ikisi de yasar. Filtreleme `category_attributes` uzerinden jsonb containment ile devam eder; eslestirme ve kapsam hesabi `provider_services` uzerinden yapilir.

### Cok rollu profesyonelde `category_attributes`

Once bir ayrim: **cok rollu teklif verme kapsamdadir ve kaldirilmamistir.** `provider_services` bastan cok satirli tasarlandi; bir saglayici istedigi kadar rolde hizmet verebilir. Provider Coverage hesabi zaten bunu gerektirir — bir ajansin yedi hizmetten besini karsilamasi tam olarak budur.

Buradaki soru daha dardir: **ikincil rol icin ayri bir zengin alan seti doldurulacak mi?**

`category_attributes` yalniz bir jsonb blob degildir; arkasinda bes dosyalik bir yapilandirma seti vardir (quick info anahtarlari, moduller, deneyim gruplari, lojistik kontrolleri, filtre yollari). Rol basina set, bu yuku rol sayisiyla carpar.

**Karar: ilk surumde rol basina alan seti yoktur.** Profil birincil rolun setini doldurur; ikincil roller `provider_services` satiri olarak durur ve rol duzeyinde kesfedilir, ancak role ozel filtrelere takilmaz.

**Kabul edilen kayip:** Fotografci ikinci rol olarak videograf eklerse, "4K cekim yapan videograf" gibi role ozel bir filtrede gorunmez. Rol duzeyinde bulunur, alan duzeyinde bulunmaz.

**Gerekce:** Bugun profesyoneller zaten tek kategori seciyor; kacinin ikinci rol ekleyecegi bilinmiyor. Bes dosyalik senkron yuku zaten agir. Ihtiyac olculmeden bes katina cikarilmaz.

#### Ikinci asama esigi

Su iki kosul **birlikte** gerceklesirse `provider_role_attributes` tablosu eklenir:

```
provider_role_attributes
  provider_id   uuid fk
  role_id       integer fk
  attributes    jsonb
  primary key(provider_id, role_id)
```

| Kosul | Esik | Olcum |
|---|---|---|
| Ikinci rol ekleme orani | Profesyonellerin **%15'inden fazlasi** doksan gun icinde ikinci rol ekler | `provider_services` satir sayisi / benzersiz `provider_id` |
| Eslesme kaybi | Ikincil roldeki **teklif alma orani**, birincil rolden belirgin dusuk | Rol basina `match_candidates.was_shown` -> teklif donusumu |

Ikinci kosul onemlidir: cok rol eklense bile ikincil rollerde eslesme kaybi yoksa ayri alan seti gereksizdir.

**Ikinci asamanin maliyeti:** Filtre sorgusu iki kaynaga birden bakmak zorunda kalir ve `or=` uzunluk butcesi buyur. `konusmaci` su an %54,5'te; bu ekleme onu esige yaklastirabilir. Eklemeden once uzunluk yeniden olculur; %75'i asiyorsa once sorgu RPC'ye tasinir.

Bu olcumler `analytics_events` ve `match_candidates` uzerinden hesaplanir; ayri bir izleme altyapisi gerektirmez.

---

## 5. FILTRE KAYNAGI IKI SISTEMLI

```
source: 'attributes'          ESKI — 12 kategori
source: 'category_attributes' YENI — yeni kategoriler
```

Yeni kategoriler `attributes`'a **eklenmez.** Taksonomi gocu bu ayrimi degistirmez; her iki sistem de rol kimligine baglanabilir.

Uzun vadede tek sisteme gecis ayri bir istir ve bu gocun kapsaminda degildir.

---

## 6. `or=` UZUNLUK BUTCESI — GERCEK RISK

Kesfet filtreleri tek bir `.or()` cagrisinda `and(or(...),...)` ifadesi kurar. Olcum esigi: **kodlanmis ifade 6 KB'i (8 KB tamponun %75'i) gecerse azaltim gerekir.**

En son olcum: `konusmaci` 4.464 karakter (**%54,5**) — yirmi uc kategorinin en yuksegi.

**Skill katmani filtreye baglanirsa bu esik asilabilir.** Her yeni filtrelenebilir alan ifadeyi buyutur.

**Karar: skill'ler ilk surumde filtreye baglanmaz.** Gosterim ve eslestirme sinyali olarak kullanilir; Kesfet filtresine girmez. Filtreye baglanmasi gerekirse once sorgu RPC'ye tasinir.

Bu, `02-guvenlik-modeli.md`'deki "once calisan ve olculen surum" ilkesiyle uyumludur.

### Deger kisiti taksonomiye de uygulanir

PostgREST `or=` dilbilgisinde **yasak karakterler:** `,` `(` `)` `"` `\`

Bu kisit yalniz filtre secenekleri icin degil, **filtreye baglanabilecek her taksonomi degeri** icin gecerlidir. Yeni rol ve beceri adlari bu karakterleri icermemelidir.

Guvenli: bosluk, `+`, `-`, `/`, Turkce harfler.

⚠️ **Sessiz mod:** Alanin diger degerleri guvenliyse kosul `NEVER_MATCH`'e dusmez; yalniz o deger OR listesinden **sessizce elenir** ve kullanici hic sonuc gormez. Deger deger denetlenmelidir.

---

## 7. `brief-config.ts` EVENTSPEC ICIN TOHUM

Bu, catisma degil **firsat.**

`CATEGORY_BRIEFS[slug]` bugun kategori basina yapilandirilmis talep formu tanimliyor:

```
5 legacy primitif (zorunlu):
  event_type · event_date · location · guest_count · budget_range
+ 2-3 kategoriye ozel select
```

Bu, o rol icin **cikarim hedefinin zaten tanimlanmis hali.** Event Understanding bir "DJ" talebini cozumlerken hangi alanlari cikarmasi gerektigi `CATEGORY_BRIEFS['dj']`'de yazili.

**Kullanim:** IP1'in EventSpec semasi kurulurken `brief-config.ts` girdi olarak alinir. Bes legacy primitif dogrudan `events` tablosunun sutunlarina, kategoriye ozel select'ler `event_requirements` veya `events.extra`'ya eslenir.

**Deger hizalamasi korunur.** Checklist'in kurali gecerli kalir: musterinin "Ardil" demesi ile profesyonelin "Ardil" beyani ayni deger olmalidir. Event AI serbest metinden cikarim yaparken de ayni sozluge baglanir.

### Iki talep yolu birlikte yasar

```
YAPILANDIRILMIS YOL (bugun)     SERBEST METIN YOLU (yeni)
Kategori sec                    Etkinligi anlat
  -> CATEGORY_BRIEFS formu        -> Event Understanding
  -> quote_requests               -> event_briefs + event_spec_versions
                                  -> events + event_requirements
```

Eski yol kesilmez. Kullanici formu tercih ederse form calisir; serbest metni tercih ederse AI calisir. Ikisi de ayni deger sozlugune baglanir.

---

## 8. CHECKLIST NASIL DEGISIR

`docs/yeni-kategori-checklist.md` yeni yapida **"yeni rol dogum listesi"** olur. On bir dokunma noktasindan:

| Madde | Degisim |
|---|---|
| 1. `service_categories` satiri | -> `roles` satiri; `service_category_id` de doldurulur |
| 2. Ikon | Degismez (`public/icons/<slug>.png`) |
| 3. SEO icerik | Degismez (`category-content.ts`) |
| 3b. Komsuluk siniri | Degismez — rol duzeyinde kalir |
| 4. Alan preset'i | Degismez (`category-fields.ts`, arketip 4 sabit) |
| 5. Kesfet filtreleri | Degismez; **skill filtreye baglanmaz** |
| 6-7. Kayit / Kesfet / hub | Dinamik kalir; hub gruplama arketipten okur |
| 8. Admin talep bagi | `requested_layer` alani eklenir (kategori mi rol mu) |
| 9. Slug bagimli noktalar | Degismez |
| 10. Teklif formu | Degismez; ayrica EventSpec eslemesi eklenir |
| 11. Sitemap | Dinamik kalir |

**Yeni eklenen adim:** servis kategorisi yoksa once o olusturulur, sonra rol ona baglanir. Servis kategorisi seyrek eklenir (6-8 adet, yilda bir iki).

---

## 9. GOC SIRASINDA KIRILMAMASI GEREKENLER

Bu maddeler `04-goc-plani.md` Faz 3'un kabul kriteridir:

1. **Bes yapilandirma dosyasi 16/16 senkron kalir.** Goc sonrasi yeni bir drift olusmaz.
2. **Slug degerleri degismez.** Hicbir ikon, icerik veya filtre girdisi kirilmaz.
3. **`or=` uzunluk butcesi asilmaz.** Goc sonrasi en yuksek kategori yeniden olculur; %75 esigi asilmamalidir.
4. **Filtre davranisi canli dogrulanir.** Checklist'in kurali gecerlidir: kod okumasi kanit degildir. Minimum uc test — tek alan, baska tek alan, **iki alan kesisimi**.
5. **`.next` temizligi.** Yapilandirma dosyalari bir turda birden cok kez degistiginde dev sunucusu kapatilir, `.next` silinir, yeniden baslatilir.
