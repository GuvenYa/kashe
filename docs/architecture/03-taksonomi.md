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
