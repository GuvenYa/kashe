# 01 — Veri Modeli

Bu belge hedef veri modelini ve her tasarim kararinin gerekcesini icerir. Mevcut semadan gecis icin `04-goc-plani.md`.

**Anahtar tipi kurali:** Taksonomi ve referans tablolari (`service_categories`, `roles`, `skills`, `turkish_cities`) **integer** anahtarlidir; mevcut sema boyle. Diger her sey **UUID**. Karisim yapilmaz.

---

## 1. KIRACI: organizations

Kurulus, bir kullanici rolu degil **veri sahipligi ve fatura sinirini tanimlayan kiraci**dir.

```
organizations
  id                    uuid pk
  slug                  text unique
  account_type          enum('business','agency')
  legal_name            text
  display_name          text
  tax_number            text
  billing_email         text
  city_id               integer fk -> turkish_cities
  owner_user_id         uuid fk -> profiles(id)
  subscription_tier     enum('trial','starter','pro','enterprise')
  subscription_status   enum('active','past_due','canceled')
  seat_limit            integer
  active_event_limit    integer
  storage_limit_mb      integer
  ai_credit_limit       integer
  settings              jsonb
  created_at, updated_at
```

**`account_type` neden burada:** `business` kurumsal alici, `agency` kurumsal saticidir. Ikisi ayni uyelik altyapisini kullanir; modul ve izin farki bu alandan turetilir.

```
organization_memberships
  id                uuid pk
  organization_id   uuid fk
  user_id           uuid fk -> profiles(id)
  role              enum('owner','admin','sales','project_manager',
                         'crew_coordinator','finance','viewer')
  permissions       jsonb            -- ince ayar gerektiginde
  status            enum('invited','active','suspended')
  invited_by        uuid
  joined_at         timestamptz
  unique(organization_id, user_id)

organization_invitations
  id, organization_id, invited_email, invited_user_id,
  invited_by_id, role, status, invitation_message,
  created_at, responded_at, expires_at

organization_modules
  organization_id   uuid fk
  module_key        text     -- 'crm','events','crew','talent_pool','suppliers',
                             -- 'commercial','proposals','tasks','run_of_show',
                             -- 'finance','reporting','rfp','supplier_search',
                             -- 'proposal_compare','budget','approvals','contracts'
  is_enabled        boolean
  enabled_at, enabled_by
  primary key(organization_id, module_key)
```

**Mevcut yapiyla iliski:** `agency_member_role` ve `business_member_role` enum'lari bugun ayni degerlere sahip (`owner, manager, member`). Goc sirasinda `manager` -> `admin`, `member` -> `viewer` eslenir; yeni roller sonradan atanir.

---

## 2. SAGLAYICI KAYIT DEFTERI: providers

Pazaryerinde listelenen her varlik burada. Hem bagimsiz profesyonel hem organizasyon firmasi.

```
providers
  id                    uuid pk
  provider_type         enum('professional','organization')
  talent_id             uuid null fk -> talents(id)
  organization_id       uuid null fk -> organizations(id)
  display_name          text
  slug                  text unique
  city_id               integer fk
  district              text
  service_radius_km     integer
  base_currency         char(3) default 'TRY'

  -- GORUNURLUK: yonetici ve kullanici yetkileri AYRI alanlarda
  approval_status       enum('draft','pending','approved','rejected','revision')  -- YONETICI
  approval_note         text                                                      -- YONETICI
  approved_at           timestamptz                                               -- YONETICI
  suspended_at          timestamptz                                               -- YONETICI
  suspension_reason     text                                                      -- YONETICI
  suspended_by          uuid                                                      -- YONETICI
  is_published          boolean default false                                     -- KULLANICI

  is_verified           boolean                                                   -- YONETICI
  verification_level    enum('none','email','document','full')                    -- YONETICI
  trust_score           numeric null       -- IP2 ciktisi, sistem hesaplar
  trust_computed_at     timestamptz
  created_at, updated_at

  check ( (provider_type='professional' and talent_id is not null
           and organization_id is null)
       or (provider_type='organization' and organization_id is not null
           and talent_id is null) )
  unique(talent_id) where talent_id is not null
  unique(organization_id) where organization_id is not null
```

**Neden supertype/subtype:** `event_crew`, `bookings`, `reviews`, `availability` gibi tablolar **tek bir saglayiciya** isaret etmeli. Ayri tablolar olsaydi polimorfik yabanci anahtar gerekirdi ve her join iki durumu ayri ele almak zorunda kalirdi. Tek tabloda `provider_type` ayirici olsaydi, firmanin kategori kapasitesi ile profesyonelin portfoyu ayni tabloda onlarca nullable sutuna donerdi ve kisitlar veritabaninda zorlanamazdi.

**Neden tek bir `marketplace_status` alani YOK:**

Ilk taslakta `marketplace_status enum('draft','pending_review','active','paused','banned')` onerilmisti. Bu **yanlisti**: tek alan, yonetici karari (`pending_review`, `banned`) ile kullanici kararini (`draft`, `paused`) ayni yere sikistirir.

Tek alan olursa ya kullanici yazabilir — o zaman onayi atlayip `active` yapabilir — ya yonetici yazabilir; o zaman kullanici kendi profilini duraklatamaz. Ikisi de yanlistir.

Mevcut `profiles` tasarimi bu ayrimi **dogru** yapmis ve aynen korunmalidir:

| Alan | Kim yazar | Koruma |
|---|---|---|
| `approval_status`, `approval_note`, `approved_at` | Yonetici | Tetikleyici kara listesinde |
| `suspended_at`, `suspension_reason`, `suspended_by` | Yonetici | Tetikleyici kara listesinde |
| `is_verified`, `verification_level` | Yonetici | Tetikleyici kara listesinde |
| `is_published` | **Kullanici** | Korunmaz — bilincli |

**Gorunurluk turetilmis bir degerdir, saklanmaz:**

```sql
is_visible = is_published
         and approval_status = 'approved'
         and suspended_at is null
```

Kullanici onaysiz profilini yayinlayabilir; kesfette gorunmez. Bu, bugunku davranistir ve korunur.

**Neden yabanci anahtar defterde:** `providers.organization_id` yerine `organizations.provider_id` da olabilirdi. Defterde tutmak, "tam olarak biri dolu" kisitinin veritabaninda zorlanmasini saglar. Ayrica profesyonel saglayici `user_id`'ye degil `talent_id`'ye baglanir; boylece henuz hesabi olmayan bir kisi ileride sorunsuz saglayiciya donusur.

```
professional_profiles
  provider_id         uuid pk fk -> providers(id)
  headline, bio       text
  experience_years    integer
  languages           text[]
  equipment           jsonb
  pricing_mode        enum('fixed','range','on_request')
  price_min, price_max numeric
  price_unit          enum('per_job','per_hour','per_half_day','per_day')

organization_profiles
  provider_id         uuid pk fk -> providers(id)
  about               text
  team_size_range     text
  can_full_service    boolean      -- tum kapsami ustlenebilir mi
  subcontracts        boolean      -- alt yuklenici kullanir mi
  min_project_budget  numeric
  portfolio_scale     jsonb

provider_services                  -- Coverage hesabinin temeli
  id                  uuid pk
  provider_id         uuid fk
  role_id             integer fk -> roles(id)
  is_primary          boolean
  capacity            integer      -- ayni tarihte kac kisi/ekip verebilir
  price_min, price_max numeric
  price_unit          enum(...)
  lead_time_days      integer
```

---

## 3. YETENEK VE HAVUZ

Uc havuz vardir: kurulusun ozel havuzu, acik pazaryeri ve Kashe hesabi olmayan harici kisiler.

```
talents                            -- CANONICAL Kashe kimligi
  id                  uuid pk
  user_id             uuid null fk -> profiles(id)
  canonical_email     citext null
  canonical_phone     text null
  full_name           text
  origin              enum('marketplace_signup','agency_added','imported')
  claim_status        enum('unclaimed','invited','claimed','merged')
  merged_into         uuid null fk -> talents(id)
  claimed_at          timestamptz
  created_at, updated_at
  unique(user_id) where user_id is not null

organization_talent_records        -- KURULUSUN YEREL KAYDI
  id                  uuid pk
  organization_id     uuid fk
  talent_id           uuid null fk -> talents(id)   -- NULL olabilir

  -- yerel kimlik (talent_id null iken tek kaynak, dolu iken tamamlayici)
  name                text
  email               citext null
  phone               text null
  city_id             integer null
  instagram           text null
  notes               text

  source              enum('marketplace_linked','invited','external_manual','imported')
  visibility          enum('private','shared_to_marketplace')
  relationship_type   enum('staff','regular_freelancer','occasional','subcontractor')
  status              enum('active','passive','blocked')
  invitation_status   enum('none','sent','accepted','declined')
  invitation_sent_at  timestamptz
  linked_at           timestamptz
  created_by          uuid
  created_at, updated_at

organization_talent_record_roles
  id, record_id fk, role_id integer fk, is_primary boolean
```

**Kritik tasarim karari:** Harici bir kisinin kaydi **hemen `talents` satirina donusmez.** `talent_id` null kalabilir. Sebep: yalniz adi bilinen kisiler icin global kimlik uretmek, `talents` tablosunu dogrulanamayan kayitlarla kirletir ve yanlis birlestirme riskini artirir.

**Uc havuzun temsili:**

| Havuz | Nasil temsil edilir |
|---|---|
| Private | `organization_talent_records`, `visibility='private'` |
| External | `organization_talent_records`, `talent_id` **null**, `source='external_manual'` |
| Marketplace | `providers`, `marketplace_status='active'` — yerel kayit gerekmez |

### Tekillestirme kurallari

**Guclu kimlik** (dogrulanmis e-posta, dogrulanmis telefon veya Kashe `user_id`): sistem baglanti onerir; dogrulanmis kimlikte kontrollu otomatik baglama uygulanabilir.

**Olasi eslesme** (ad-soyad + telefon + sehir, ya da ad-soyad + Instagram): sistem "olasi mukerrer" uyarisi verir, **otomatik birlestirme yapmaz.**

**Yalniz isim:** global tekillestirme yapilmaz, mukerrer kayit kabul edilir. Ayni ada sahip farkli kisiler olabilecegi icin yanlis birlestirme, mukerrer kayittan daha risklidir.

**Manuel birlestirme arayuzu** kurulur: "Muhtemel mukerrerler" ekrani benzer kayitlari eslesme skoruyla gosterir; kullanici "Birlestir" veya "Farkli kisiler" secer. Birlestirmede gecmis isler, fiyat karti, notlar, iliski tipi, belgeler ve performans verisi korunur.

**Claim akisi:** Harici kisi sonradan Kashe'ye kaydolursa, dogrulanmis telefon veya e-posta uzerinden "XYZ Events sizi daha once ekip havuzuna eklemis, bu kaydi profilinizle iliskilendirmek ister misiniz?" akisi gosterilir. Kabul edilirse `talents` olusur ve `organization_talent_records.talent_id` atanir. **Kurulusun yerel notlari ve maliyet bilgisi kurulusta kalir.**

---

## 4. ETKINLIK VE EVENTSPEC

Dort tabloya bolunur: ham girdi, AI ciktisi, onaylanmis canonical veri, roller.

```
event_briefs                       -- HAM GIRDI
  id                  uuid pk
  created_by_user_id  uuid
  organization_id     uuid null
  source              enum('client_web','business_workspace','agency_eventos','api')
  raw_text            text
  attachments         jsonb
  created_at

event_spec_versions                -- AI CIKTISI, SURUMLU
  id                  uuid pk
  brief_id            uuid fk
  version_no          integer
  spec_jsonb          jsonb        -- tam EventSpec
  provenance          jsonb        -- alan bazli koken + guven
  schema_version      text         -- EventSpec sozlesmesinin surumu
  parser_version      text         -- cikarim hattinin surumu
  model_id            text
  prompt_version      text
  validation_status   enum('valid','invalid','needs_input')
  is_current          boolean
  created_at

events                             -- ONAYLANMIS CANONICAL
  id                  uuid pk
  brief_id            uuid null fk
  organization_id     uuid null
  owner_user_id       uuid
  event_type          text
  start_date, end_date date
  start_time, end_time time
  is_date_flexible    boolean
  city_id             integer fk
  district            text
  venue_status        enum('confirmed','searching','not_needed')
  participant_count   integer
  budget_min, budget_max numeric
  currency            char(3)
  urgency             enum('normal','urgent','flexible')
  extra               jsonb        -- stil, tercih, ozel kisit
  status              enum('draft','confirmed','matching','booked',
                           'running','completed','cancelled')
  confirmed_at, created_at, updated_at

event_requirements                 -- ROLLER, NORMALIZE
  id                  uuid pk
  event_id            uuid fk
  role_id             integer fk -> roles(id)
  quantity            integer
  is_required         boolean
  budget_hint_min, budget_hint_max numeric
  duration_hours      numeric
  notes               text
  sort_order          integer
```

**Neden dort tablo:** Ayni brief icin birden fazla AI kosusu olabilir (model surumu degistiginde). Kullanici onayindan onceki veri ile sonraki veri farkli statudedir. Altin kume degerlendirmesi `event_spec_versions` uzerinden yapilir ve `events` bozulmaz.

**Neden roller ayri tablo:** Crew AI her zorunlu rol icin aday arayacak ve join yapacak. Ayrica "yalniz gecerli Kashe rol kimlikleri" kurali ancak yabanci anahtarla zorlanabilir; JSONB icinde zorlanamaz.

### provenance yapisi

```json
{
  "start_date":        { "source": "extracted",  "confidence": 0.94, "span": [12,24] },
  "city_id":           { "source": "extracted",  "confidence": 0.99, "span": [26,32] },
  "participant_count": { "source": "user_input", "confidence": 1.0,  "asked_at": "..." },
  "budget_max":        { "source": "derived",    "confidence": 0.71, "rule": "range_midpoint" }
}
```

Uc kaynak: `extracted` (metinden), `user_input` (soruldu ve cevaplandi), `derived` (sistem turetti). Arayuz `derived` olanlari "varsayim" olarak isaretler.

### Surum alanlari ayri tutulur

| Alan | Ne | Nerede |
|---|---|---|
| `schema_version` | EventSpec sozlesmesinin surumu | `event_spec_versions` |
| `parser_version` | Cikarim hattinin surumu | `event_spec_versions` |
| `algorithm_version` | Match/Crew/Commercial motorunun surumu | `match_runs`, `crews`, `proposals` |

Ucu ayni satirda tutulursa, yalniz siralama algoritmasi degistiginde EventSpec surumunu artirmak gerekir. Bu yanlis olur.

---

## 5. ESLESTIRME

```
match_runs
  id                  uuid pk
  event_id            uuid fk
  requirement_id      uuid null fk    -- tek rol icin kosu ise
  strategy            enum('individual','full_service','hybrid')
  algorithm_version   text
  params              jsonb
  candidate_count     integer
  latency_ms          integer
  created_at

match_candidates
  id                  uuid pk
  match_run_id        uuid fk
  provider_id         uuid fk
  role_id             integer null fk
  match_score         numeric
  trust_score         numeric
  coverage_ratio      numeric null    -- yalniz organization tipinde
  availability_conf   numeric         -- musaitlik guven derecesi
  acceptance_prob     numeric null    -- kabul olasiligi
  final_rank          integer
  reason_codes        text[]          -- 'date_available','same_city','budget_fit',
                                      -- 'coverage_full','high_trust','new_talent'
  was_shown           boolean
  was_clicked         boolean
  created_at
```

**`was_shown` neden onemli:** Yalniz secilen adaylari kaydetmek secilim yanliligi yaratir. Gosterilen ama secilmeyen adaylar da kaydedilir ki ogrenme katmani dogru calissin.

### Coverage hesabi

Duz oran (5/7 gibi) **yanlis sonuc verir**, cunku zorunlu ve istege bagli roller ayni degildir.

```
coverage = SUM(w_i * covered_i) / SUM(w_i)

w_i = 3.0  rol zorunlu ise (is_required = true)
w_i = 1.0  rol istege bagli ise

covered_i = 1.0  firma o rolde hizmet veriyor VE kapasite yeterli VE tarihte musait
          = 0.5  hizmet veriyor ama kapasite/musaitlik belirsiz
          = 0.0  aksi halde
```

**Kritik kural:** Bir zorunlu rol hic kapsanmiyorsa firma "tam hizmet" olarak sunulamaz. `full_service_eligible = false` isaretlenir ve firma **hibrit cozumun parcasi** olarak degerlendirilir.

**Hibrit cozume koordinasyon cezasi uygulanir:** farkli saglayicilardan olusan cozum kullanici acisindan daha fazla yonetim yuku demektir. Ceza katsayisi pilotta kalibre edilir.

---

## 6. EKIP

```
crews
  id                  uuid pk
  event_id            uuid fk
  organization_id     uuid null fk    -- ajans kuruyorsa
  name                text
  strategy            enum('individual','full_service','hybrid')
  algorithm_version   text
  source_policy       enum('private_first','private_plus_marketplace','marketplace_only')
  objective           enum('best_fit','most_economical','highest_margin')
  status              enum('draft','proposed','confirmed','cancelled')
  created_at, updated_at

crew_members
  id                  uuid pk
  crew_id             uuid fk
  role_id             integer fk
  talent_record_id    uuid null fk -> organization_talent_records(id)
  provider_id         uuid null fk -> providers(id)
  pool_origin         enum('private','marketplace','external')
  status              enum('proposed','contacted','confirmed','declined','replaced')
  is_locked           boolean         -- kismi sabitleme icin
  sort_order          integer
  check (talent_record_id is not null or provider_id is not null)
```

**Iki yabanci anahtar neden:** Ajans kendi havuzundan alirsa `talent_record_id`, pazaryerinden dogrudan alirsa `provider_id`, ikisini de kullanirsa her ikisi dolu olur.

**`is_locked`:** Organizator sectigi ekip uyelerini kilitleyip yalniz kalan rolleri yeniden cozdurebilir.

---

## 7. TICARI KATMAN

RFP ve Proposal **ayri varliklardir.** Ayni ticari alanda yer alirlar ama is akislari ve yonleri terstir.

```
RFP:       ALICI  -> "Bana bu hizmet icin teklif ver."  -> SATICI
PROPOSAL:  SATICI -> "Bu isi su kapsam ve fiyatla yaparim." -> ALICI
```

```
rfps                               -- ALICI TARAFI (business)
  id                  uuid pk
  organization_id     uuid fk
  event_id            uuid fk
  title               text
  status              enum('draft','sent','collecting','evaluating','awarded','cancelled')
  deadline            timestamptz
  created_by          uuid
  created_at, updated_at

rfp_items
  id, rfp_id fk, role_id integer fk, quantity, is_required,
  budget_hint_min, budget_hint_max, notes, sort_order

rfp_invites
  id, rfp_id fk, provider_id uuid null fk, invited_email text null,
  status enum('sent','viewed','responded','declined'), responded_at
```

```
proposals                          -- SATICI TARAFI (agency)
  id                  uuid pk
  seller_provider_id  uuid fk -> providers(id)
  seller_organization_id uuid null fk
  buyer_user_id       uuid null
  buyer_organization_id uuid null
  buyer_contact_id    uuid null      -- Kashe kullanicisi olmayan musteri
  event_id            uuid null fk
  crew_id             uuid null fk
  rfp_id              uuid null fk   -- RFP'ye yanit ise
  source_type         enum('direct','rfp_response','marketplace_request')
  status              enum('draft','sent','viewed','approved','revision_requested',
                           'declined','expired')
  current_version_id  uuid null
  created_at, updated_at

proposal_versions
  id                  uuid pk
  proposal_id         uuid fk
  version_no          integer
  subtotal, tax_amount, total_amount numeric
  currency            char(3)
  valid_until         timestamptz
  notes               text
  created_by          uuid
  approved_by_name    text null      -- musteri portalindan onaylayan
  approved_at         timestamptz
  created_at

proposal_items                     -- MUSTERIYE GORUNEN
  id                  uuid pk
  proposal_version_id uuid fk
  role_id             integer null fk
  crew_member_id      uuid null fk
  description         text
  quantity            numeric
  unit_client_price   numeric
  total_client_price  numeric
  is_visible_to_client boolean default true
  sort_order          integer
```

**`proposal.source_type` neden:** Teklif her zaman RFP'den dogmak zorunda degildir. Ajans kendi CRM musterisine dogrudan teklif hazirlayabilir; o durumda `rfp_id` null kalir.

**Ortak ticari ilkeller:** `role_id`, `quantity`, `date`, `currency`, `tax`, `documents`, `event_id`, kurulus/saglayici referanslari. Bunlar RFP ve Proposal arasinda paylasilir ama tablolar ayridir.

---

## 8. INTERNAL SEMA

Ic maliyet, marj ve ozel notlar **ayri semada** durur. Ayrinti ve gerekce: `02-guvenlik-modeli.md`

```
internal.organization_talent_rates       -- VARSAYILAN ORAN
  id, organization_id, talent_record_id, role_id,
  default_cost, cost_basis enum('per_job','per_hour','per_day'),
  currency, valid_from, valid_to, private_note

internal.crew_member_commercials         -- ISLEM ANI SNAPSHOT
  crew_member_id uuid pk, organization_id,
  agreed_cost, cost_basis, client_price,
  markup_amount numeric generated, margin_rate numeric generated,
  rate_source enum('default','manual_override','marketplace_quote'),
  snapshot_at, private_note

internal.proposal_internal_items         -- TEKLIF SURUMU SNAPSHOT
  id, proposal_version_id, proposal_item_id, organization_id,
  internal_cost, markup_amount, margin_rate, private_note

internal.margin_rules
  id, organization_id, role_id null, min_margin_rate,
  target_margin_rate, max_discount_rate, valid_from, valid_to

internal.access_audit
  id, organization_id, actor_user_id, action,
  target_table, target_id, ip, created_at
```

**Varsayilan oran ile anlik goruntu neden ayri:** Varsayilan oran degistiginde gecmis teklifler ve islemler degismemelidir. Marj raporlari, geriye donuk denetim ve musteri anlasmazliklari ancak islem anindaki degerle cozulur.

---

## 9. ERISIM VE PORTAL

```
portal_access_links
  id                  uuid pk
  organization_id     uuid fk
  resource_type       enum('proposal','event','document_set')
  resource_id         uuid
  token_hash          text            -- ham jeton saklanmaz
  scope               text[]          -- ['view','approve','request_revision',
                                      --  'comment','download']
  recipient_email     citext null
  expires_at          timestamptz
  max_views           integer null
  view_count          integer default 0
  first_viewed_at, last_viewed_at
  revoked_at          timestamptz null
  created_by          uuid
```

**Varsayilan misafir portali:** Ajansin musterisi cogu zaman Kashe kullanicisi degildir; teklif onaylamak icin hesap acmaya zorlanmasi donusum kaybi yaratir. Misafir isterse sonradan `client` veya `business` hesabina donusebilir; gecmis teklif ve onaylari korunur.

---

## 10. EVENT OS MODULLERI

```
crm_leads
  id, organization_id, contact_id, source, stage,
  estimated_value, expected_date, owner_user_id, next_action_at, notes

contacts                           -- her iki account_type icin ortak
  id, organization_id, type enum('person','company'),
  name, email, phone, company_name, city_id, notes, created_by

suppliers
  id, organization_id, name, category, contact_info jsonb,
  rating, notes, created_by

tasks
  id, organization_id, event_id null, title, description,
  assignee_user_id null, assignee_talent_record_id null,
  due_at, status enum('todo','in_progress','blocked','done'),
  depends_on_task_id null, milestone boolean, sort_order

activity_logs
  id, organization_id, actor_user_id, entity_type, entity_id,
  action, diff jsonb, created_at
```

---

## 11. ZEKA KATMANI

```
analytics_events                   -- OLAY ZINCIRI
  id                  bigint pk
  event_name          text     -- brief_created, match_shown, match_clicked,
                               -- quote_created, crew_selected, approval,
                               -- booking, cancellation, completion
  actor_user_id       uuid null
  organization_id     uuid null
  entity_type, entity_id
  algorithm_version   text null
  payload             jsonb
  created_at

price_benchmarks
  id, service_category_id integer, role_id integer,
  city_id integer, event_type text,
  period_start, period_end date,
  sample_size integer,
  p25, median, p75, average numeric,
  currency char(3),
  is_published boolean,       -- sample_size esik altinda ise false
  computed_at
```

**Fiyat gostergesi kaynagi:** Yalnizca musteriye donuk fiyatlar — `client_price`, teklif tutari, kabul edilen teklif, rezervasyon degeri. **`internal_cost` ve marj hicbir kosulda karismaz.** Bu, mimarinin dogal sonucudur: toplama isi `public` semadan okur, `internal` semaya erisimi yoktur.

**Yayin esigi:** Belirli bir orneklem sayisinin altinda yayin yapilmaz (baslangic: 15). Az islemli bir hucrede yayimlanan ortalama, tek bir kisinin fiyatini aciga cikarabilir.

---

## 12. MEVCUT TABLOLARDA GENISLEME

```
bookings          + buyer_organization_id, seller_provider_id,
                    event_id, crew_member_id
                  -- ajansin alici oldugu senaryo icin

availability_blocks + source enum('manual','calendar_sync','booking'),
                      last_confirmed_at, confidence numeric
                  -- musaitlik guveni (IP2)

conversations     + event_id

reviews           + provider_id
portfolio_items   + provider_id
profile_experiences + provider_id
favorites         + provider_id
services          + provider_id
```

**`bookings` neden genisliyor:** Bugun `customer_id` ve `professional_id` var, ikisi de `profiles`. Ajansin pazaryerinden satin aldigi senaryoda alici bir kurulustur. `transaction_role` diye bir alan **saklanmaz**; rol islemin baglamindan cikar.
