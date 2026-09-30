# 17 — FAZ 5: Yetenek havuzu (organization_talent_records, roller, gizli oranlar, dolum, davet/claim)

**Kaynak plan:** `04-goc-plani.md` FAZ 5 madde 27-30; `01-veri-modeli.md` bolum 3 (yetenek ve havuz, tekillestirme,
claim), bolum 8 (`internal.organization_talent_rates`); `02-guvenlik-modeli.md` (internal sema); `08-faz0` (kurulus,
uyelik, `has_org_permission`, `organization_modules`); `09-faz1` (assert -> log -> sorgu deseni); `11-faz2a` (`talents`).
**Durum:** 5-DB DOSYALAR HAZIR (30 Eylul 2026; yerelde test edildi, bolum 6). Uretim sirasi bolum 7; uygulama P1-P3 Claude Code (bolum 8).

## 1. Amac ve sinir

Ajansin calisabilecegi herkes tek yapida: **kendi ekibi** (bugun `agency_members`), **Kashe uyeleri** (havuza eklenen
saglayicilar) ve **Kashe hesabi olmayan harici kisiler**. Kisi basina roller (`service_roles`) ve **gizli ic oranlar**
(`internal` semasi). FAZ 6 (eslestirme/ekip) ve FAZ 7 (teklif) bu havuzdan beslenir.

Sinir: ekip kurma, eslestirme, teklif kalemleri FAZ 6-7. Pazaryeri akislari degismez. `business` kuruluslarina
havuz ACILMAZ (`organization_modules.talent_pool` yalniz `agency`). Harici kisiler pazaryerinde GORUNMEZ
(`visibility` FAZ 5'te yalniz `private`).

## 2. Kararlar (30 Eylul 2026, Guven ile)

| Konu | Karar | Sonuc / uygulama |
|---|---|---|
| `agency_members` -> havuz | **Tek seferlik dolum; yeni yazimlar yalniz yeni tabloya** (Guven'in tercihi; onerilen aynalama tetikleyicisi DEGIL) | 5-DB/02 dolumu mevcut satirlari `organization_talent_records`'a kopyalar (`legacy_agency_member_id` ile idempotan). Tetikleyici YOK. Bundan sonra: Ekibim akisinda davet kabul edilince uygulama (P1) AYNI islemde havuz kaydini da yazar; `agency_members` uyelik/yetki icin (FAZ 0 aynasi -> `organization_memberships`) kalir. **Kayma riski** asama13 K5 ile izlenir: her `agency_members` satirinin bir havuz kaydi olmali |
| Kimlik esleme | `talents.canonical_email/phone` profillerden aynalanir (kapali sutun); esleme yalniz RPC ile | `trg_faz5_sync_talent_contact` (profiles INSERT/UPDATE OF email, phone) + dolum; `find_talent_by_contact(p_email, p_phone)` yalniz `talent_id` + eslesme turu doner, PII donmez; cagiran en az bir kurulusta `talent.manage` sahibi olmali |
| Davet e-postasi | FAZ 5 uygulama parcasinda (P1), mevcut Resend altyapisiyla | Kayitta `invitation_status/sent_at/token/expires_at`; baglanti `/davet/havuz/<token>`; kabul = `claim_talent_record(p_token)` RPC |
| Havuz ekrani | Yeni sayfa `/ajans/havuz` | Ekibim (`/profil/ekibim`) oldugu gibi kalir; havuz uc kaynagi tek listede gosterir |
| Harici kisi kimligi | (01 bolum 3) `talents` satiri ACILMAZ, `talent_id` NULL kalir | Claim ile dolar; yalniz isim eslesmesinde birlestirme YOK |
| Modul kapisi | `organization_modules.talent_pool` yalniz `agency` kuruluslarinda acik | 5-DB/01 mevcut ajans kuruluslarina acar; yeni ajans kurulusunda tetikleyici acar; RLS + RPC'ler `org_module_enabled(org, 'talent_pool')` ister |
| Ic oran erisimi | FAZ 0 anahtarlari: `commercial.view` okur, `commercial.manage` yazar (owner, admin, finance) | `crew_coordinator`/`project_manager` havuzu yonetir ama orani GOREMEZ (assert 42501) |

## 3. Veri modeli (5-DB/01)

```
public.organization_talent_records
  id                       uuid pk
  organization_id          uuid fk organizations ON DELETE CASCADE
  talent_id                uuid null fk talents ON DELETE SET NULL      -- Kashe kimligi (varsa)
  name                     text NOT NULL (1..200)
  email                    text null            -- yerel kimlik; kurulus girdi, kurulus gorur
  phone                    text null
  city_id                  integer null fk turkish_cities
  instagram                text null
  notes                    text null
  source                   talent_record_source   ('marketplace_linked','invited','external_manual','imported')
  visibility               talent_record_visibility ('private','shared_to_marketplace')  -- FAZ 5: CHECK yalniz private
  relationship_type        talent_relationship_type ('staff','regular_freelancer','occasional','subcontractor')
  status                   talent_record_status   ('active','passive','blocked')
  invitation_status        talent_invitation_status ('none','sent','accepted','declined')
  invitation_sent_at       timestamptz null
  invitation_token         uuid null UNIQUE       -- yalniz sent iken dolu
  invitation_expires_at    timestamptz null
  linked_at                timestamptz null       -- talent_id dolduginda
  legacy_agency_member_id  uuid null UNIQUE       -- 5-DB/02 dolumu izi
  created_by               uuid null fk profiles ON DELETE SET NULL
  created_at, updated_at
  CHECK: talent_id dolu iken source IN ('marketplace_linked','invited'); external_manual iken talent_id NULL
  UNIQUE (organization_id, talent_id) WHERE talent_id IS NOT NULL   -- ayni kisi ayni kurulusta tek kayit
  INDEX (organization_id, status), (lower(email)) WHERE email IS NOT NULL

public.organization_talent_record_roles
  id uuid pk, record_id uuid fk records ON DELETE CASCADE, role_id integer fk service_roles ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false, created_at
  UNIQUE (record_id, role_id); UNIQUE (record_id) WHERE is_primary

internal.organization_talent_rates
  id uuid pk, organization_id uuid fk, talent_record_id uuid fk records ON DELETE CASCADE, role_id integer fk service_roles,
  default_cost numeric NOT NULL CHECK (>= 0), cost_basis talent_cost_basis ('per_job','per_hour','per_day'),
  currency char(3) NOT NULL DEFAULT 'TRY', valid_from date NOT NULL DEFAULT current_date, valid_to date null,
  private_note text, created_by uuid, created_at, updated_at
  CHECK (valid_to IS NULL OR valid_to >= valid_from); UNIQUE (talent_record_id, role_id, valid_from)
  -- talent_record_id'nin organization_id'si ile ayni kurulus olmali: tetikleyici kontrolu (fn_faz5_rate_org_check)
```

Ek nesneler:
- `public.org_module_enabled(p_org uuid, p_key text) RETURNS boolean` (STABLE, SECURITY DEFINER): `organization_modules` satiri `is_enabled`.
- `trg_faz5_default_modules` (organizations AFTER INSERT): `account_type = 'agency'` ise `talent_pool` acik satiri ekler. 5-DB/01 mevcut ajans kuruluslari icin ayni satiri yazar (idempotan).
- `talents.canonical_email/phone` aynasi: `fn_faz5_sync_talent_contact()` (profiles AFTER INSERT OR UPDATE OF email, phone; `talents.user_id = NEW.id`; e-posta `lower(trim)`, telefon yalniz rakam) + dolum. Sutunlar KAPALI kalir (GRANT yok; asama13 K7).
- `find_talent_by_contact(p_org_id uuid, p_email text, p_phone text) RETURNS TABLE (talent_id uuid, match_kind text)` SECURITY DEFINER: `p_org_id`'de `talent.manage` + modul acik; `match_kind` `email` | `phone`; eslesme yoksa bos. PII donmez; her cagri `internal.log_access` (action `read`, `detail.op = talent.lookup` — `access_audit.action` FAZ 1 kisitiyla yalniz read|write; islem turu `detail.op`'ta). Public tabloya bakar ama arama davranisi denetlenir.
- `send_talent_record_invitation(p_record_id uuid) RETURNS uuid` SECURITY DEFINER: `talent.manage` + modul; kayitta e-posta zorunlu, `talent_id` bos, engelli degil; token uretir (`invitation_status = sent`, 14 gun), `external_manual` -> `invited`; token'i doner (uygulama e-postalar). **Token sutunu istemciye kapali** (sutun bazli GRANT'ta yok).
- `claim_talent_record(p_token uuid) RETURNS uuid` SECURITY DEFINER (govde `fn_faz5_claim_record`, `claim_talent_record_by_id(p_record_id)` ayni govdeyi token'siz kullanir): token gecerli + suresi gecmemis + kayit `invitation_status = 'sent'`; cagiranin `auth.email()` kaydin `email`'i ile (normalize) esit; `talents` satiri (user_id = auth.uid()) yoksa hata (`no_data_found`; profesyonel/ajans olmadan claim yok); kaydi `talent_id`, `source = 'invited' -> 'marketplace_linked'`, `invitation_status = 'accepted'`, `linked_at = now()`, token NULL; `talents.claim_status = 'claimed'`, `claimed_at`; kaydin id'sini doner. Ayni kurulusta ayni talent icin baska kayit varsa `unique_violation` (23505) — birlestirme P2/FAZ 8.
- `decline_talent_record_invitation(p_token uuid)`: `declined`, token NULL.
- `claimable_talent_records_for_me() RETURNS TABLE (record_id uuid, organization_name text, invited_at timestamptz)`: e-postasi `auth.email()` ile eslesen, `talent_id` NULL kayitlar (giris sonrasi "sizi eklemis" bandi; P2).
- Oran RPC'leri (public, `internal_` on eki; assert -> log -> sorgu; toplam RPC 9):
  - `internal_talent_rates_list(p_org uuid, p_record_id uuid)` -> `commercial.view`; kaydin gecerli (valid_to NULL veya >= today) ve gecmis oranlari.
  - `internal_talent_rate_upsert(p_org, p_record_id, p_role_id, p_cost numeric, p_basis, p_currency, p_valid_from date, p_note)` -> `commercial.manage`; ayni (kayit, rol) icin acik oran varsa `valid_to = p_valid_from - 1` ile kapatir, yeniyi ekler (tarihce korunur).
  - `internal_talent_rate_close(p_org, p_rate_id, p_valid_to date)` -> `commercial.manage`.
  - Hepsi: `p_org` kaydin kurulusuyla ayni degilse 42501; modul kapaliysa 42501.

RLS (records ve roles; roles kayit uzerinden):
- SELECT: `org_module_enabled(org,'talent_pool') AND (has_org_permission(org,'talent.view') OR is_admin(auth.uid()))`
- INSERT/UPDATE/DELETE: `org_module_enabled AND has_org_permission(org,'talent.manage')`; UPDATE'te `organization_id` ve `legacy_agency_member_id` degistirilemez (BEFORE tetikleyici).
- anon: hic. `internal.*`: FAZ 1 deseni (USAGE yok; yalniz RPC). GRANT: records/roles SELECT/INSERT/UPDATE/DELETE authenticated (RLS suzer); `invitation_token` sutunu authenticated SELECT listesinden CIKARILIR (token yalniz e-postada; sutun bazli GRANT — FAZ 0/07 deseni).

## 4. Dolum (5-DB/02) — `agency_members` -> havuz (tek sefer)

On kontrol (uretim, DEGERLER): `agency_members` satirlari (agency_id, professional_id, member_role, joined_at) +
`organizations.legacy_profile_id = agency_id` eslesmesi + `talents.user_id = professional_id` eslesmesi. Eslesmeyen
satir varsa dolum o satiri ATLAR ve NOTICE ile bildirir (kurulus/talent yoksa FAZ 0/2a eksigi demektir; once o kapanir).

Dolum: her `agency_members` satiri icin `organization_talent_records` (`talent_id` = talents.id, `name` =
profiles.full_name, `email`/`phone` YAZILMAZ — kurulus bunlari girmedi; kimlik `talent_id` ile), `source =
'marketplace_linked'`, `relationship_type = 'regular_freelancer'` (ajans degistirir), `status = 'active'`, `visibility =
'private'`, `linked_at = joined_at`, `created_by = agency_id`, `legacy_agency_member_id = agency_members.id`;
`ON CONFLICT (legacy_agency_member_id) DO NOTHING`. Roller: profesyonelin `provider_services` satirlari (`is_primary`
korunur); yoksa rol yok. `updated_at` tetikleyicileri dolumda DEVRE DISI (2b kurali). NOTICE: kurulus / kayit / rol
sayilari. Idempotan (ikinci kosuda 0 yeni).

## 5. asama13 — tutarlilik (SALT OKUNUR; dal + uretim)

| K | Kontrol | Beklenen |
|---|---|---|
| K1 | tablolar (2 public + 1 internal) + 6 enum | 9 |
| K2 | `talent_pool` acik modul sayisi = `account_type='agency'` kurulus sayisi | fark 0 |
| K3 | `business` kurulusunda `talent_pool` acik | 0 |
| K4 | dolum izi (`legacy_agency_member_id`) dolu kayit = eslesebilen `agency_members` (kurulus + talent var) | fark 0 |
| K5 | havuz kaydi OLMAYAN `agency_members` satiri (kayma) | 0 |
| K6 | `talent_id` dolu kayitta `source` external_manual | 0 |
| K7 | `talents.canonical_email/phone` sutun yetkisi anon/authenticated | 0 (kapali) |
| K8 | `canonical_email` dolu talents = e-postali profili olan talents | fark 0 |
| K9 | `internal.organization_talent_rates` tablo yetkisi anon/authenticated/service_role | 0 |
| K10 | 9 RPC: authenticated EXECUTE var + anon yok | 18 |
| K11 | records + roles RLS politikasi | 8 |
| K12 | kayit basina >1 birincil rol | 0 |
| K13 | `invitation_token` sutunu authenticated SELECT | 0 (kapali) |
| K14 | bilgi: kayit sayisi marketplace_linked*1e4 + invited*100 + external_manual | BILGI |

## 6. asama4 T17 (dalda) ve yerel zincir

T17 adimlari: (a) modul kapisi ajans acik / kurum kapali; kimlik aynasi (pro1 `canonical_email` normalize); uyelikler
(pro1 Ekibim -> FAZ 0 aynasi -> `crew_coordinator`; musteri `viewer`, uye `finance` dogrudan); test rolleri. (b) owner
harici kayit (pro2 e-postasi, bosluk/buyuk harf normalize) + 2 rol; ikinci birincil 23505; `visibility` CHECK; kurulus
sabit. (c) `crew_coordinator` yazar/okur; `viewer` 0 satir + INSERT 42501; kurum sahibi kendi kurulusuna 42501 (modul
kapali); anon 42501. (d) `find_talent_by_contact`: pro1 e-postayla (`email`), client bulunmaz, viewer 42501, denetim
satiri. (e) oranlar: owner iki upsert (eski `valid_to` = yeni-1), `finance` okur + kapatir, `crew_coordinator`/kurum/anon
42501, dogrudan tablo 42501, gecersiz `cost_basis` 22023, denetim write>=3 read>=2. (f) davet: token sutunu authenticated'a
kapali (42501), yanlis e-posta 42501, pro2 `claimable` 1 -> claim -> 0, talent bagli + `claimed`, ayni token
`no_data_found`, suresi gecmis 22023, client (talents yok) `no_data_found`, decline. (g) dolum fonksiyonu: pro1 yeni kayit
+ rol (`provider_services`'tan), pro2 mevcut kayda iz, ikinci kosu 0, kayma 0.

**Yerel zincir (30 Eylul):** 01 + 02 iki kez uygulandi (ikincisi 0 degisiklik); asama13 K1-K13 ESIT (K14 = 20200 test
verisiyle); asama4 T0-T17 **18/18 GECTI**. Mutasyon: `otr_insert` modul kapisi kaldirildi -> HATA ("business kurulusu
havuza yazdi"); `internal_talent_rates_list` assert kaldirildi -> HATA ("crew_coordinator ic orani gordu"); claim
e-posta kontrolu kaldirildi -> HATA ("yanlis e-postali kullanici kaydi sahiplendi"). Duzeltilen: `access_audit.action`
yalniz read|write (islem turu `detail.op`); dolum izi guard'i NULL -> deger yazimina izin verir.

## 7. Uretim sirasi — 5-DB (adim adim)

1. Commit: `git add -A` / `git commit -m "FAZ 5-DB: yetenek havuzu (organization_talent_records, roller, internal oranlar, kimlik aynasi, davet/claim RPC), dolum, asama13, T17, plan 17"`.
2. Uretimde on kontrol (SQL Editor, salt okunur; DEGERLER):
   ```sql
   select a.id, a.agency_id, a.professional_id, a.member_role, a.joined_at,
          (select id from public.organizations o where o.legacy_profile_id = a.agency_id) as org_id,
          (select id from public.talents t where t.user_id = a.professional_id) as talent_id
     from public.agency_members a order by a.joined_at;
   select count(*) as modul_satiri from public.organization_modules;
   select count(*) as ajans_kurulus from public.organizations where account_type = 'agency';
   select count(*) from pg_proc where proname = 'find_talent_by_contact';
   ```
   Beklenen: her agency_members satirinda `org_id` ve `talent_id` DOLU (bos olan varsa dolum onu atlar; once bana yaz); `modul_satiri` 0; `ajans_kurulus` = bugunku ajans sayisi; fonksiyon 0.
3. Dal: `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (2 dosya). NOTICE: `FAZ 5 dolum: ...` satiri (dalda agency_members yok -> 0).
4. Dalda: `asama4-davranis-testi.sql` -> **18 satir, T17 GECTI**; `asama13-faz5-havuz-kontrol.sql` -> K1-K13 ESIT.
5. Uretim: `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (2 dosya). NOTICE'taki `atlanan` 0 olmali.
6. Uretimde: `asama13` -> K1-K13 ESIT (K2 = ajans sayisi, K4 = agency_members sayisi, K5 0), K14 bilgi; `asama5` degismedi.
7. `git push` -> P1 (`17-claude-code-gorevi-p1.md`).

Geri alma: fonksiyon/tetikleyici/tablo DROP (veri: yalniz dolum kayitlari; `agency_members` dokunulmadi); `organization_modules` satirlari silinir; `talents.canonical_*` NULL'lanir.

## 8. Uygulama parcalari (Claude Code)

**P1 — `/ajans/havuz` + Ekibim kaydi (`17-claude-code-gorevi-p1.md`):** liste (kaynak/rol/iliski/durum filtreleri; uc havuz
tek listede: `talent_id` dolu = Kashe uyesi, NULL = harici), harici kisi ekleme formu (ad, e-posta, telefon, sehir,
Instagram, roller + birincil, iliski turu, not) -> INSERT (RLS); e-posta girildiyse `find_talent_by_contact` ile
"Kashe uyesi olabilir" onerisi (baglama secenegi: `talent_id` set, source marketplace_linked); davet gonder (token
uretimi sunucuda `gen_random_uuid()`, `invitation_expires_at = now() + 14 gun`, Resend sablonu; `/davet/havuz/<token>`);
**Ekibim davet kabulu** (`agency-actions.ts` accept) ayni islemde havuz kaydi INSERT (ON CONFLICT (org, talent) DO NOTHING).
Menu: ajans icin "Yetenek havuzu".
**P2 — claim + oranlar (`-p2.md`):** `/davet/havuz/[token]` sayfasi (oturumsuz: kurulus adi + "Kashe'ye katil / giris yap"
-> redirect; oturumlu: e-posta eslesiyorsa "Kaydi sahiplen" -> `claim_talent_record`; eslesmiyorsa aciklama);
giris sonrasi `claimable_talent_records_for_me` bandi; kayit detayinda **ic oran karti** yalniz `commercial.view` olanlara
(`internal_talent_rates_list`), duzenleme `commercial.manage` (`internal_talent_rate_upsert/close`); diger uyeler karti
hic gormez (yetki `has_org_permission` ile sunucuda okunur).
**P3 — pazaryerinden havuza (`-p3.md`):** ajans uyesi `/p/[id]`'de "Havuza ekle" (marketplace_linked, `talent_id` =
saglayicinin talents.id; roller `provider_services`'tan on dolu); kesfet kartinda kisa yol. Kesfet/ profil mantigi degismez.

## 9. Kalici kurallar (5 sonrasi)

- **Havuz kaydi = kurulusun kendi verisi.** `organization_talent_records` satirini yalniz o kurulusun `talent.manage` uyesi yazar; admin okur, yazmaz.
- **Ic oran yalniz `internal_talent_rate_*` RPC'leriyle.** Uygulama `internal` semasina dogrudan sorgu atmaz (zaten yetki yok).
- **Kimlik esleme yalniz `find_talent_by_contact` ile;** e-posta/telefonla `profiles`/`talents` taranmaz.
- **Ekibim kabulu = havuz kaydi.** `agency_members`'a yazan her yol ayni islemde havuz kaydini da yazar; asama13 K5 kaymayi yakalar.
- **Yalniz isimle birlestirme yok.** Claim yalniz dogrulanmis e-posta (auth.email) ile.
- **`visibility` FAZ 5'te `private`.** Pazaryerine acma (harici kisiyi vitrine tasima) ayri karar (FAZ 8+).

## 10. Kapanis kaydi

(5-DB uretim sonrasi ve her P icin doldurulur)
