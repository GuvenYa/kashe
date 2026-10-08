# 19 — FAZ 7: Ticari katman (teklif dosyasi, musteri portali, bookings genislemesi, RFP)

**Kaynak plan:** `04-goc-plani.md` FAZ 7 madde 34-36; `01-veri-modeli.md` bolum 7 (RFP ve Proposal AYRI varliklar), bolum 8
(`internal.proposal_internal_items`), bolum 9 (portal_access_links, misafir portali), bolum 12 (`bookings` genislemesi);
`02-guvenlik-modeli.md` bolum 2-3 (ic maliyet uc katman, `internal_api` deseni), bolum 6 (musteri portali ayri yuzey, token_hash);
`05-arayuz-modeli.md` (portal, ic maliyet gorunurlugu, kritik islemde onay kapisi); `18-faz6` (crews, crew_member_commercials).
**Durum:** **FAZ 7a KAPANDI (7 Ekim 2026)** — 7a-DB/01-02 uretimde; P1 (`6e90b32`), P2 (`9672df0`), P2-ek (`64e567a`), P2-cila (`d84e653`)
deploy'da. **7c-DB/01 hazir** (`20261008120000_faz7c_01_bookings_genisleme.sql`; yerelde asama4 24/24, asama16 ESIT; bolum 11) -> dal -> uretim
-> 7c-P1 (`19-claude-code-gorevi-7c-p1.md`). Sonra **7b** (RFP).

## 1. Amac ve sinir

Ajansin ekipten **teklif dosyasi** hazirlamasi (surumlu, kalem kalem, musteri fiyati acik / ic maliyet gizli), Kashe hesabi
olmayan musterisine **imzali baglantiyla** gondermesi, musterinin **portalda** gorup onaylamasi veya revizyon istemesi; onaylanan
teklifin **rezervasyona** baglanmasi (7c); kurumsal alicinin **RFP** ile teklif toplamasi (7b). Pazaryerinin bugunku `quotes`
(sohbet ici teklif) akisi DEGISMEZ: profesyonel-musteri arasi teklif orada kalir; teklif dosyasi kurulus (ajans) satis aracidir.

Uc parca, sirasi Guven karari: **7a** teklif + portal -> **7c** bookings genislemesi -> **7b** RFP (Buyer Workspace).

## 2. Kararlar (2 Ekim 2026, Guven ile)

| Konu | Karar | Gerekce / etki |
|---|---|---|
| Sira | 7a teklif+portal -> 7c bookings -> 7b RFP | Ajansin kendi musterisine dogrudan teklif en yakin deger; business alici bugun az |
| Satici | **Yalniz kuruluslar** (`seller_organization_id` NOT NULL; bugun agency) | Ic maliyet/marj kurulus ekibinden gelir; bireysel profesyonel `quotes` ile devam eder, cift yapi yok (FAZ 10 birlestirme karari o zaman) |
| Portal onayi | **Baglanti + ad yazarak**: `portal_access_links` (token_hash, 30 gun, scope view/approve/request_revision), onayda ad-soyad + onay kutusu -> `approved_by_name`, `approved_at` | 01 bolum 9 / 05 misafir portali; OTP yok (donusum) |
| KDV | **Haric fiyat + KDV satiri**: `proposal_versions.tax_rate` (varsayilan 0.20, surum basina degistirilebilir), `subtotal`, `tax_amount`, `total_amount` tetikleyiciyle kalemlerden hesaplanir | Kurumsal aliskanlik; fatura FAZ 7 sonrasi |
| Alici | 7a'da `buyer_user_id` (Kashe kullanicisi; etkinlik sahibi ajansin kendisi olabilir) veya misafir (`client_name`, `client_email` teklifte; `buyer_contact_id` FAZ 8 CRM'e kadar NULL) | Misafir portal varsayilan; Kashe kullanicisi alici kendi `/tekliflerim`'de de gorur (7a-P2 kapsami disi, RLS hazir) |
| Kalem kaynagi | "Ekipten teklif olustur": ekip uyesi basina kalem (`crew_member_id`), aciklama = rol adi (kisi adi degil; ajans duzenler), adet 1, musteri fiyati = `internal.crew_member_commercials.client_price` varsa, yoksa bos (0 gonderilemez); ic kalem = `agreed_cost` | 01 bolum 7-8; uyesiz/ekipsiz teklif de olabilir (bos kalemle baslar) |
| Surumleme | Surum **ekle-yalniz**: `draft` iken kalemler duzenlenir; `proposal_send` surumu dondurur (`sent`); revizyon = `proposal_new_version` (kalemler + ic kalemler kopyalanir, yeni surum `draft`). Dondurulmus surumun kalemi degismez (tetikleyici) | 01 "varsayilan oran ile anlik goruntu ayri" ilkesinin teklif karsiligi |
| Durumlar | `proposals.status`: draft -> sent -> viewed -> approved / revision_requested / declined; expired (valid_until gecince portal okur). Yeni surum -> draft | 01 enum birebir |
| Portal RPC'leri | `portal_proposal_view(p_token)`, `portal_proposal_approve(p_token, p_name)`, `portal_proposal_request_revision(p_token, p_note)` — **anon cagirir**; token sunucuda sha256 ile eslenir; donus yalniz musteriye gorunen alanlar (satici gorunen adi, baslik, etkinlik ozeti, `is_visible_to_client` kalemler, toplamlar, gecerlilik, durum, scope). Kurulus/kullanici kimligi DONMEZ | 02 bolum 6: ayri yuzey, internal'a hicbir yoldan ulasmaz |
| Jeton teslimi | `proposal_send` ham jetonu BIR KEZ doner; uygulama baglantiyi ekranda gosterir (kopyala) ve `client_email` doluysa Resend ile gonderir (`teklifEmail`, `EMAIL_FROM`). Yeniden gonder = eski baglanti `revoked_at`, yeni jeton | FAZ 5 davet deseni |
| Ic kalem erisimi | Yalniz `internal_proposal_items_list(p_version_id)` (commercial.view) ve `internal_proposal_item_upsert(p_item_id, p_internal_cost, p_note)` (commercial.manage); marj/markup liste RPC'sinde hesaplanir (`client_price` public, `internal_cost` internal) | 02: sales musteri fiyatini girer, marji finance gorur |
| Bakim modu (7 Ekim) | `/portal` bakim modundan **muaf** (`proxy.ts`): portal oturumsuz, noindex, jetonla korunur; pazaryerini acmaz | Ajansin lansmandan once gonderdigi teklif baglantisi "Yakinda"ya dusmesin (P2-cila bulgusu) |
| Iletisim adresi (7 Ekim) | Kullaniciya gorunen tek adres **`info@kashe.net`**; `kasheofficial@gmail.com` uygulamadan tamamen kaldirildi (17 dosya, 45 metin; mantik yok) | Yakinda sayfasiyla tutarlilik; kurumsal adres. `info@kashe.net` kutusunun lansmandan once aktif oldugundan emin olunmali (Fahri) |
| 7c bookings | Yeni sutunlar NULLABLE (`buyer_organization_id`, `seller_provider_id`, `event_id`, `crew_member_id`, `proposal_version_id`); `on_quote_accepted_create_booking` tetikleyicisi AYNEN; onaylanan teklif icin `booking_from_proposal(p_proposal_id)` RPC ekip uyesi basina veya tek satir (karar 7c planinda) | 04 "risk yuksek" uyarisi: eski davranis korunur |
| 7b RFP | `rfps`, `rfp_items`, `rfp_invites`; business kurulusu olusturur, davet edilen saticilar `proposals.rfp_id` + `source_type = rfp_response` ile yanit verir | 7a bitince ayri plan bolumu |

## 3. Veri modeli (7a-DB/01)

Enum'lar: `proposal_source_type('direct','rfp_response','marketplace_request')`, `proposal_status('draft','sent','viewed','approved',
'revision_requested','declined','expired')`, `portal_resource_type('proposal','event','document_set')`, `internal_item_source('crew_snapshot','manual')`.

```
proposals               id, seller_organization_id fk organizations NOT NULL, seller_provider_id fk providers NOT NULL (kurulusun saglayicisi),
                        buyer_user_id null fk profiles SET NULL, buyer_organization_id null fk organizations SET NULL, buyer_contact_id null (FK FAZ 8),
                        event_id null fk events SET NULL, crew_id null fk crews SET NULL, rfp_id null (FK 7b), source_type default direct,
                        status default draft, title text, client_name text null, client_email text null (norm_email ile), current_version_id null
                        (FK proposal_versions, sonradan ALTER), created_by, created_at, updated_at
proposal_versions       id, proposal_id fk CASCADE, version_no int (tetikleyici: max+1), subtotal numeric default 0, tax_rate numeric default 0.20,
                        tax_amount numeric default 0, total_amount numeric default 0, currency char(3) 'TRY', valid_until timestamptz null,
                        notes text, client_note text null (revizyon istegi), approved_by_name text null, approved_at timestamptz null,
                        created_by, created_at; UNIQUE (proposal_id, version_no)
proposal_items          id, proposal_version_id fk CASCADE, role_id null fk service_roles RESTRICT, crew_member_id null fk crew_members SET NULL,
                        description text NOT NULL, quantity numeric NOT NULL default 1 CHECK > 0, unit_client_price numeric NOT NULL default 0 CHECK >= 0,
                        total_client_price numeric GENERATED (quantity * unit_client_price), is_visible_to_client bool default true, sort_order int,
                        created_at, updated_at
internal.proposal_internal_items
                        id, proposal_version_id fk CASCADE, proposal_item_id fk proposal_items CASCADE UNIQUE, organization_id fk, internal_cost numeric >= 0,
                        source internal_item_source, source_crew_member_id null, private_note, created_by, snapshot_at, updated_at
portal_access_links     id, organization_id fk, resource_type, resource_id uuid, token_hash text UNIQUE, scope text[] default
                        '{view,approve,request_revision}', recipient_email text null, expires_at timestamptz default now()+30d, max_views int null,
                        view_count int default 0, first_viewed_at, last_viewed_at, revoked_at, created_by, created_at
```

Tetikleyiciler: `version_no` otomatik (teklif icinde max+1); kalem INSERT/UPDATE/DELETE sonrasi surum toplamlari yeniden hesaplanir:
`subtotal = SUM(total_client_price)` **yalniz `is_visible_to_client = true` kalemler** (gizli kalem toplama GIRMEZ; portal toplami =
gorunur kalemler toplami; gizli kalem ajans ici not niteligindedir — ajans gizli kalemle musteri toplamini sisiremez),
`tax_amount = round(subtotal * tax_rate, 2)`, `total_amount = subtotal + tax_amount`; `tax_rate` degisince de yeniden hesap.
**Dondurma:** surum `sent_at` doluysa (gonderildi) kalem/ic kalem INSERT/UPDATE/DELETE ve surum `tax_rate/valid_until/notes` degisikligi
22023 "surum dondurulmus; yeni surum ac". `proposals` guard: `seller_organization_id`, `seller_provider_id` degismez; `status` ve
`current_version_id` yalniz RPC yazar (sutun yetkisi yok).

Yetki: public tablolara REVOKE -> `proposals` SELECT + UPDATE(title, client_name, client_email, buyer_user_id, event_id, crew_id) ;
`proposal_versions` SELECT + UPDATE(tax_rate, valid_until, notes) ; `proposal_items` SELECT/INSERT/UPDATE/DELETE (duzenlenebilir sutunlar);
`portal_access_links` SELECT (token_hash HARIC) ; INSERT'ler (`proposals`, `proposal_versions`, `portal_access_links`) YALNIZ RPC.
`internal.proposal_internal_items` tablo yetkisi 0. **7a-DB/02 (`20261003130000_faz7a_02_taslak_sil.sql`):** `proposals` DELETE yetkisi +
`proposals_delete` politikasi — yalniz `status = draft` VE hicbir surumu gonderilmemis (`sent_at` NULL) teklif, `proposals.manage` ile
silinir (surum/kalem/ic kalem CASCADE). Gonderilmis teklif silinmez; `proposal_set_status(..., 'declined')` ile kapatilir.

RLS: satici kurulus `proposals.view` okur, `proposals.manage` yazar (`has_org_permission`); `buyer_user_id = auth.uid()` ve status
<> draft ise okur (kalemler yalniz `is_visible_to_client`; **not**: RLS satir bazli — alici icin gizli kalemleri gizlemek icin
`proposal_items` politikasi alici dalinda `is_visible_to_client` kosulunu icerir); admin okur. Portal: RLS'siz, yalniz RPC.

RPC'ler (SECURITY DEFINER): `proposal_create(p_org_id, p_title, p_event_id, p_crew_id, p_client_name, p_client_email, p_buyer_user_id)`
(proposals.manage; ekip verildiyse kalemler + ic kalemler ekipten) -> id; `proposal_new_version(p_proposal_id)` -> version id;
`proposal_send(p_proposal_id, p_valid_days DEFAULT 14)` -> `{ token, link_id }` (kalem >= 1 ve fiyatlar > 0 kontrolu; eski linkleri
iptal; status sent); `proposal_revoke_link(p_link_id)`; `proposal_set_status(p_proposal_id, p_status)` yalniz `declined` (satici
kapatir); `internal_proposal_items_list(p_version_id)`, `internal_proposal_item_upsert(p_item_id, p_internal_cost, p_note)`;
portal: `portal_proposal_view(p_token)` (anon; `expires_at`/`revoked_at`/`max_views` kontrolu; `view_count++`, ilk/son goruntuleme;
sent -> viewed; `valid_until` gectiyse `expired` isaretler), `portal_proposal_approve(p_token, p_name)` (scope approve; sent/viewed;
approved_by_name/at; status approved), `portal_proposal_request_revision(p_token, p_note)` (scope request_revision; client_note;
status revision_requested). Denetim: ic kalem okuma/yazma `internal.log_access`; portal islemleri `proposal_events`? **7a'da yok** —
portal izleri `portal_access_links.view_count/first/last` + surum `approved_*`/`client_note` ile yeterli.

## 4. Dolum

Yok. `quotes`/`bookings` dokunulmaz (7c'de nullable sutunlar).

## 5. asama15 — tutarlilik (SALT OKUNUR; dal + uretim)

`docs/envanter/asama15-faz7a-teklif-kontrol.sql`: K1 tablolar (4 public + 1 internal) + 4 enum (9); K2 `proposals`/`proposal_versions`/
`portal_access_links` INSERT yetkisi anon+authenticated, tablo + sutun (0 — yalniz RPC); K3 `portal_access_links.token_hash` SELECT
yetkisi (0 — mutasyon: GRANT -> 1 FARK); K4 `internal.proposal_internal_items` tablo yetkisi (0); K5 RPC yetkileri: 7 kurulus RPC +
4 erisim fonksiyonu authenticated var + anon yok (22) ve 3 portal RPC anon VE authenticated var (6) = 28; K6 RLS politikasi (10;
7a-DB/01 ile 9, 7a-DB/02 `proposals_delete` ile 10);
K7 surum toplamlari kalemlerle tutarsiz (0); K8 gecerli surumu olmayan teklif (0); K9 dondurma ihlali — `sent_at` sonrasi guncellenen
kalem (0); K10 bilgi teklif*100 + baglanti; K11 bilgi gecerliligi gecmis ama sent/viewed; K12 bilgi ekip kaynakli ic kalemsiz kalem;
K13 durum/surum tutarsizligi (`status = draft` <> `sent_at IS NULL`) (0). Beklenen: K1-K9, K13 ESIT; K10-K12 BILGI. Yerelde hepsi ESIT, K10 204.

## 6. asama4 T21 / T22 (dalda)

T21 (teklif yasam dongusu; T20'nin kurulus ekibine dayanir; musteri uyeligi testte `sales` yapilir): owner `proposal_create` ekipten ->
1 kalem 9000 (client_price) + ic kalem 6000 (crew_snapshot), surum 1 toplamlari 9000/1800/10800; sales kalem fiyati 9500 -> 9500/1900/11400,
gizli kalem (500, is_visible false) toplama girmedi; sales `internal_proposal_items_list` 42501, dogrudan `status` UPDATE 42501, dogrudan
proposals INSERT 42501; `tax_rate` 0.10 -> 950/10450; finance liste: maliyet 6000, markup 3500, marj 0.3684; upsert 6500 -> markup 3000,
source manual; owner `proposal_new_version` taslakken 22023; `proposal_send` -> link + 64 karakter jeton, surum dondu: kalem/tax_rate/ic
kalem 22023; `proposal_new_version` -> surum 2 draft, kalem + ic kalem (6500) kopyali, toplam 9500/11400; surum 1 `sent_at`/`valid_until`
(14 gun); aktif baglanti 1; pro1 (crew_coordinator) 0 satir + `proposal_create` 42501; owner bile `token_hash` okuyamaz (42501); anon 42501;
**21f (7a-DB/02):** owner bos taslak acar ve siler (1 satir), gonderilmis teklifi silmeye calisir -> 0 satir ("taslak silme OK").
T22 (portal): T21 teklifinin surum 2'si gonderilir (eski link iptal), ikinci teklif (kalemsiz send 22023, fiyatsiz kalemle send 22023)
gonderilir; anon `portal_proposal_view`: surum 2 alanlari, 1 gorunur kalem, toplam 11400, `seller_name` var, kurulus/kullanici kimligi
yok, `view_count` 1, durum viewed; yanlis/kisa jeton P0002; onay kisa ad 22023; onay -> approved + "Ad Soyad"; ikinci onay 22023;
onayli teklifte yeni surum 22023; revizyon notu -> revision_requested; owner yeni surum (900) + send -> eski jeton 22023 (iptal), yeni
jeton surum 2 (1800/2160); `max_views` 1 -> ikinci goruntuleme 22023; `valid_until` gecmis -> onay 22023, view expired isaretler,
expired'da onay 22023; `proposal_set_status` declined -> baglantilar iptal.
Yerel zincir (2 Ekim 2026): faz7a_01 uc kez uygulandi (idempotan), asama4 **23/23**, asama15 hepsi ESIT, asama13/asama14 degismedi.
Yakalanan: `portal_proposal_approve` icinde expired isaretleyip RAISE etmek yazimi geri aliyordu -> isaret `portal_proposal_view`'a birakildi.

## 7. Uretim sirasi — 7a-DB

**7a-DB/01 (`20261003120000_faz7a_01_teklif_portal.sql`):** 1. Yerel: uc kez, asama4 23/23, asama15 ESIT (yapildi). 2. Commit. 3. Dal
`supabase link --project-ref ukqhgspaallzjscjodbb` + `supabase db push` (y!) -> dalda asama4 **23/23**, asama15 ESIT. 4. Uretim
`supabase link --project-ref qydsooqmflrrwtgawhsv` + `supabase db push` (y!) -> uretimde asama15 hepsi ESIT, K10 0; asama14/asama13 degismedi.
5. `git push` -> P1 (`19-claude-code-gorevi-p1.md`).
**7a-DB/02 (`20261003130000_faz7a_02_taslak_sil.sql`; P1 canli turunda cikti):** 1. Yerel: iki kez, asama4 23/23 (T21 21f), asama15 ESIT
K6 10 (yapildi). 2. Commit (asama4 + asama15 guncel). 3. Dal push -> asama4 **23/23**, asama15 K6 10. 4. Uretim push -> asama15 ESIT.
5. `git push` -> P2 (`19-claude-code-gorevi-p2.md`; portal + "Taslağı sil").

## 8. Uygulama parcalari (Claude Code)

**P1 — teklif editoru (`19-claude-code-gorevi-p1.md`):** `/ajans/teklifler` (liste: baslik, musteri, durum, surum, toplam, tarih) +
`/ajans/teklifler/[id]` (surum kalemleri duzenleme: aciklama/adet/birim fiyat/gorunur; tax_rate, gecerlilik, not; toplamlar; **ic maliyet
karti** yalniz commercial.view — kalem basina ic maliyet, markup, marj; "Gönder" -> onay kapisi (05) -> baglanti + e-posta; "Yeni sürüm";
durum rozeti; portal izleri). Etkinlik sayfasi ekip panelinde "Teklif oluştur" (kurulus ekibi, proposals.manage) -> `proposal_create`
-> editore. E-posta sablonu `teklifEmail` (Resend). Menu "Teklifler".
**P2 — musteri portali (`-p2.md`):** `/portal/teklif/[token]` (oturumsuz; noindex; `portal_proposal_view`): satici adi, baslik, etkinlik
ozeti, kalemler (gorunur), KDV/toplam, gecerlilik; "Onayla" (ad-soyad + onay kutusu + acik onay ekrani) -> `portal_proposal_approve`;
"Revizyon iste" (not) -> `portal_proposal_request_revision`; durum sayfalari (onaylandi / suresi doldu / baglanti gecersiz). Portal
sayfasi `internal`'a dokunan HICBIR action icermez; kurulus id istemciye gitmez. P1 turundan eklenen: (C) "Taslağı sil" (7a-DB/02
politikasi uzerinden RLS DELETE; yalniz hic gonderilmemis taslak), (D) satici yuzeyi (menu "Teklifler", `/ajans/teklifler`, "Teklif
oluştur") yalniz `account_type = 'agency'` kuruluslara — `business` kurulusunun saglayici kaydi yoktur, `proposal_create` zaten reddeder.
**7c (ayri plan bolumu, 7a kapaninca):** bookings sutunlari + `booking_from_proposal`; **7b:** RFP.

## 9. Kalici kurallar (7 sonrasi)

- **Ic maliyet uc katman** (02): `internal.proposal_internal_items` yalniz RPC; `sales`/`project_manager` musteri fiyatini girer, marji gormez.
- **Dondurulmus surum degismez**; revizyon = yeni surum. Musterinin onayladigi surum sonsuza kadar aynidir.
- **Portal ayri yuzey**: yalniz 3 anon RPC, token_hash, scope, sure, goruntuleme sayaci; kurulus/kullanici kimligi donmez; `internal` yok.
- **Gizli kalem toplama girmez**; portal toplami = gorunur kalemler.
- **Teklif dosyasi kurulus aracidir**; profesyonel-musteri teklifi `quotes`'ta kalir (FAZ 10 karari).
- **Kritik islemde onay kapisi** (05): gonderme ve onaylama tek tikla gecilmez.
- **Satici yalniz ajans kurulusu** (`account_type = 'agency'`, 'organization' saglayicisi olan): kurum (`business`) teklif yazmaz,
  alir. Uygulama satici yuzeyini bu kurala gore gosterir; DB `proposal_create`'te saglayici kaydini zorunlu tutar.
- **Gonderilmis teklif silinmez**, kapatilir (`declined`); yalniz hic gonderilmemis taslak silinir (7a-DB/02).

## 10. Kapanis kaydi

**7a-DB/01 (2 Ekim 2026, commit `6a5be05`):** yerelde uc kez (idempotan), asama4 23/23, asama15 ESIT. Dal: asama4 **23/23**, asama15
K10-K12 BILGI digerleri ESIT. Uretim: `supabase db push` 1 dosya; asama15 hepsi ESIT, K10 0; asama14 degismedi (K10 802). `git push` tamam.
Siradaki: P1 (`-p1.md`).

**P1 — teklif editoru (2 Ekim 2026, commit `6e90b32`, Vercel Ready):** `app/ajans/teklifler/{page, yeni-teklif, teklif-data,
teklif-actions, teklif-maliyet-actions, [id]/page, [id]/teklif-editoru}`, `app/lib/email/proposal-email.ts`, ekip panelinde "Teklif
oluştur", menude "Teklifler". Canli tur (Sunucu Ajans, lansman etkinliginin kurulus ekibi): ekipten teklif -> 4 kalem; baslangic fiyatlari
ekip ic maliyet kartindaki musteri fiyatlarindan geldi (0 / 10.000 / 7.500 / 8.500); DJ 15.000, Koordinator 8.000, Ses & Isik 12.000
yapildi -> 45.000 / KDV 9.000 / **54.000** (DB tetikleyicisi); Gonder -> onay kapisi -> baglanti `/portal/teklif/c80866b5...` + Gmail'e
e-posta geldi (portal P2 oncesi 404 — beklenen); Yeni surum -> surum 2 duzenlendi -> Gonder -> yeni baglanti `/portal/teklif/c3baab27...`,
eski baglanti iptal; liste "Sürüm 2 · 52.800 TL". **Yakalanan:** (1) bos "Yeni teklif" taslagi silinemiyor (DELETE yetkisi yoktu) ->
7a-DB/02 + P2 (C) "Taslağı sil". (2) Test Pro (viewer) `/ajans/teklifler`'de yonlendirme yerine "Test Guven" basligiyla bos liste gordu;
sayfa kapisi dogru (`proposals.view` olan kurulus yoksa yonlendirir) -> Test Pro'nun "Test Guven" adli ikinci bir uyeligi olmasi
muhtemel; SQL ile dogrulanacak (P2 kapanisinda not). Uretim SQL + asama15 (K7 0, K9 0, K13 0) 7a-DB/02 adiminda birlikte calisir.
Siradaki: 7a-DB/02 -> P2 (`-p2.md`).

**7a-DB/02 (3 Ekim 2026):** yerelde iki kez (idempotan), asama4 23/23, asama15 K6 10. Dal: `supabase db push` 1 dosya; asama4 **23/23**
(T21 "... taslak silme OK (gonderilmis silinmedi)"), asama15 K6 10 ESIT, K10-K12 BILGI. Uretim: push; asama15 hepsi ESIT, K6 10,
K10 **203** (2 teklif, 3 baglanti), K11 0. Uretim SQL (P1 turunun devami): lansman `sent` — surum 1 45.000/9.000/54.000 ve surum 2
44.000/8.800/52.800 gonderildi; Guven turda ikinci bir teklif ("qas", 250/50/300) acip musteri e-postasiz gonderdi (baglanti
`recipient_email` NULL) ve `declined` ile kapatti -> baglantisi iptal; lansman baglantilari: ilki iptal, ikincisi aktif (`view_count` 0,
portal P2 oncesi). Denetim: `proposal.create` x2, `proposal.send` x3, `proposal.new_version`, `proposal.decline`; ic kalem `read` yok
(ic maliyet karti tembel yuklenir, turda acilmadi — P2 turunda acilir). Test Pro uyelikleri: Sunucu Ajans `viewer` + "Test Guven"
(`business`) `admin` -> admin tum izinleri tasidigi icin Teklifler gorundu; kapi dogru, kural eksikti -> P2 (D): satici yuzeyi
yalniz `agency`. `git push` P2 oncesi. Siradaki: P2 (`-p2.md`).

**P2 — musteri portali + taslak silme + satici yuzeyi (6 Ekim 2026, commit `9672df0`, Vercel Ready):** `app/portal/layout.tsx`,
`app/portal/teklif/[token]/{page, portal-data, portal-islemleri, portal-actions}`, `app/ajans/teklifler/teklif-sil.tsx`, editor/liste/
actions, `app/lib/org-context.ts` (`CrewOrg.accountType`, `hasProposalAccess` yalniz ajans). Claude Code kaniti: tsc bos, build 88 rota +
BUILD_ID, `app/portal` icinde tablo sorgusu 0 / yalniz 3 portal RPC'si / `internal` 0 / loglarda jeton yok; gercek istekle P0002 ve 32 hex
`notFound()` dogrulandi. **Canli tur (Guven, iki pencere):** (1) iptal edilmis ilk baglanti -> "Bu bağlantı iptal edilmiş…" sayfasi.
(2) ikinci baglanti -> Surum 2, 4 kalem (DJ 14.000, Fotografci 10.000, Ses & Isik 12.000, Koordinator 8.000), 44.000 / 8.800 / 52.800,
gecerlilik 16 Ekim; "Revizyon iste" + not -> sari band, F5 sonrasi kalici. (3) Editor: liste rozeti "Revizyon istendi", not sari kutuda,
Surum 2 kilitli; "Yeni sürüm" -> Surum 3 kopya; Ses & Isik 10.000 -> 42.000 / 8.400 / 50.400; Gonder -> 3. baglanti + e-posta; ikinci
baglanti "iptal edilmiş" oldu. (4) 3. baglanti -> Surum 3; onayda ad bos -> "Ad soyad 2-120 karakter olmalı."; "Deneme Müşteri" + kutu ->
yesil "Onaylandı · Deneme Müşteri · …"; editorde onayli, kalemler kilitli, Yeni surum / Gonder yok. (5) Bos taslak: editorden "Taslağı sil"
ve listeden "Sil" calisti; lansman ve "qas" satirinda Sil yok. (6) Ic maliyet karti: DJ "iç maliyet girilmedi", Fotografci 7.000/3.000/%30,
Ses & Isik 6.000/4.000/%40, Koordinator 6.000/2.000/%25, toplam 19.000 / marj 9.000, "sürüm gönderildi; salt okunur". (7) Test Pro: menude
Teklifler yok, `/ajans/teklifler` -> `/profil`; Sunucu Ajans eskisi gibi. **Uretim SQL:** lansman `approved` — surum 1-3 gonderildi,
surum 2 `client_note`, surum 3 `approved_by_name = Deneme Müşteri`; "qas" `declined`; 2 teklif (bos taslaklar silindi). 4 baglanti:
lansman ilk ikisi iptal (0 ve 4 goruntuleme), "qas" iptal, ucuncusu aktif 4 goruntuleme + goruldu. Denetim: `proposal_internal_items`
`read`, `proposal.create` x2 (silinen taslaklar; RLS DELETE denetime yazmaz — kabul: gonderilmemis taslak, kayit yok), `proposal.send`,
`proposal.new_version`. asama15: K10 **204**, K7/K9/K11/K13 0. **Yakalanan (P2-ek):** (a) sunucuda render edilen tarih/saatler UTC
(portal "19:30/19:33", liste "2 Ekim") — bicimleyicilere `timeZone: 'Europe/Istanbul'`; (b) kalem fiyati `onBlur` ile kaydediliyor, geri
bildirim yok — ipucu + "Kaydedildi". Not: portal action'larindaki `revalidatePath` jeton yolunu aliyor (bellek ici, kalici degil; sayfa
`force-dynamic`) — kabul. Siradaki: P2-ek (`-p2-ek.md`) -> 7a KAPANIS -> 7c.

**P2-ek — saat dilimi + kaydetme geri bildirimi (7 Ekim 2026):** `teklif-data.ts` ve `portal-data.ts`'te `KASHE_SAAT_DILIMI = 'Europe/Istanbul'`
(portal sabiti kendi dosyasinda; satici tarafini import etmez), 5 bicimleyici cagrisinin hepsinde `timeZone`; editorde "Değişiklikler alandan
çıkınca kaydedilir." ipucu + "Kaydediliyor… / Kaydedildi" (2 sn, `useEffect` temizligi). tsc bos, build 88 rota + BUILD_ID. Canli: portal
"gönderim 6 Ekim 2026 22:30" / "Onaylandı · … 22:33" (UTC 19:xx yerine), liste "qas" 3 Ekim; Kaydedildi gorunup kayboldu; taslak silindi.
**Hijyen kalemi H6 (acik):** repo genelinde `timeZone` olmadan tarih bicimleyen 25 sunucu cagrisi (admin sayfalari, blog, agency/business-data,
listings-data, kazanclarim/odemelerim, e-posta sablonu, mesajlar, takvimim, rezervasyon, teklif-taleplerim, review-card, FAZ 6 aday-data
"Son eşleştirme") — ayri hijyen turunda `KASHE_SAAT_DILIMI` ortak sabitine baglanacak; istemci bilesenlerindeki 32 cagri tarayici saatiyle
dogru, dokunulmaz. **Yakalanan (P2-cila):** (a) portal kabugu yalniz "Kashe" yazisi — logo, "Kashe nedir?"/"Yardım" baglantilari, alt bilgi
baglantilari yok; icerik belge gibi durmuyor; (b) "Kalem ekle" satiri dolu geliyor ("Yeni kalem", 1, 0) — hangi kutuya ne girilecegi belirsiz;
(c) liste "Sürüm 3 · 3 Ekim" teklifin `created_at`'ini gosteriyor, surum tarihi olmali. Siradaki: P2-cila (`-p2-cila.md`) -> 7a KAPANIS -> 7c.

**P2-cila — portal kabugu ve belge duzeni, kalem satiri, liste tarihi (7 Ekim 2026, commit `d84e653`):** `app/portal/layout.tsx` (KasheMark +
"Kashe" -> `/`, "Kashe nedir?" -> `/hakkimizda`, "Yardım" -> `/yardim`; alt bilgi Gizlilik · KVKK · Kullanım koşulları · İletişim), `page.tsx`
belge karti (`bg-card`, eyebrow "Teklif" + satici adi, sagda durum rozeti `PORTAL_DURUM_ETIKETLERI/SINIFLARI`, etkinlik kutusu etiketli,
masaustu tablo / `sm` alti kalem kutulari, sagda toplam blogu, "Not" kutusu), editor kalem satiri (sutun basliklari, mobil etiketler, birim
fiyat 0 -> bos girdi + placeholder, yeni kalemde aciklama odak + secili — efektte `focus()+select()`, `useRef` bayragi), liste "Sürüm N ·
gönderim/taslak <tarih>" + soluk "Açıldı". Guven kararlariyla iki satir daha: `proxy.ts` muafiyetine `/portal` (Claude Code uyarisi: bakim
modunda gercek musteri Yakinda'ya dusuyordu), portal iletisimi `info@kashe.net`. Claude Code kaniti: tsc bos, build 88 rota + BUILD_ID, uretilen
CSS'te sinif kurallari, DOM'da metinler, portal kurallari degismedi (tablo sorgusu 0, 3 RPC, TopNav/Footer yok, loglarda jeton yok).
**Canli tur (Guven):** 3. baglantida logo + iki ust baglanti, belge karti, yesil "Onaylandı" rozeti, etkinlik kutusu, 4 kalem, toplam blogu
42.000 / 8.400 / 50.400, alt bilgi baglantilari; telefon genisliginde kalemler kutu kutu; iptal edilmis baglanti ayni kabukta; **cerezsiz yeni
gizli pencerede** 3. baglanti acildi (muafiyet calisiyor), ana sayfa Yakinda (kapi duruyor). Liste: lansman "Sürüm 3 · gönderim 6 Ekim 2026"
+ "Açıldı: 3 Ekim 2026", "qas" "Sürüm 1 · gönderim 3 Ekim 2026". Kalem satiri etiketleri/odak canlida gorulmedi (onayli teklifte kalem
eklenemez; Claude Code DOM/CSS kanitiyla yetinildi) — 7c turunda taslak acilinca gorulecek. Ayni gun: `kasheofficial@gmail.com` uygulamadan
tamamen `info@kashe.net` yapildi (17 dosya, 45 metin; hepsi iletisim metni / mailto / VAPID subject varsayilani; kimlik kontrolu yok).

**FAZ 7a KAPANDI (7 Ekim 2026).** Uretimde: 7a-DB/01 (`6a5be05`), 7a-DB/02 (`d289555`); deploy'da P1, P2, P2-ek, P2-cila. Kanit: dal asama4
23/23 (T21/T22), asama15 K1-K9/K13 ESIT (K6 10), uretim asama15 ESIT K10 204; canli: 3 surumlu lansman teklifi (gonderim -> revizyon -> yeni
surum -> onay) portal uzerinden uctan uca, 4 baglanti (3 iptal, 1 aktif), ic maliyet karti ve denetim izi, taslak silme, satici yuzeyi yalniz
ajans, Istanbul saati, bakim modu muafiyeti. **Acik kalanlar (7a):** (a) H6 — repo genelinde 25 sunucu tarih cagrisi `KASHE_SAAT_DILIMI`'ne
baglanacak (ayri hijyen turu); (b) alici Kashe kullanicisiysa `/tekliflerim` (RLS hazir, sayfa yok — 7b/8 ile); (c) portal PDF/yazdirma,
belge seti, mesajlasma (05, ileride); (d) portal action'larinda `revalidatePath` jeton yolu (bellek ici; kabul); (e) RLS DELETE denetime
yazmaz (gonderilmemis taslak; kabul); (f) `info@kashe.net` kutusunun aktif oldugu dogrulanmali (Fahri); (g) Ekibim/havuz davet baglantilari
hala bakim kapisinin arkasinda (oturum gerektirdigi icin muafiyet anlamsiz; lansmanla cozulur). Siradaki: **7c** (bolum 11).

(7c, 7b icin doldurulur)

## 11. 7c — bookings genislemesi ve onayli tekliften rezervasyon (7 Ekim 2026)

**Kararlar (Guven, 7 Ekim):** (1) `bookings` tek rezervasyon merkezi kalir, ayri tablo YOK: `quote_id`/`conversation_id`/`customer_id`/
`professional_id` NULLABLE olur, `bookings_shape_check` iki sekilden birini zorunlu kilar — **eski** (dordu dolu) ya da **teklif**
(`proposal_version_id` + `seller_provider_id` dolu). (2) Onayli teklif -> **tek rezervasyon / surum**; ekip uyesi basina rezervasyon FAZ 8
(gorevlendirme) — uye basina satir musteri fiyatini (marj dahil) profesyonele gosterirdi. (3) Kurulus kendi teklif rezervasyonlarini
`/rezervasyonlarim`'daki ucuncu bolumde ("Kuruluş rezervasyonları") gorur; detay sayfasi teklif seklini tanir.

**7c-DB/01 (`20261008120000_faz7c_01_bookings_genisleme.sql`):**
- Sutunlar (NULLABLE): `buyer_organization_id` (organizations, SET NULL), `seller_provider_id` (providers, RESTRICT), `event_id` (events,
  SET NULL), `crew_member_id` (crew_members, SET NULL; 7c'de hep NULL), `proposal_version_id` (proposal_versions, RESTRICT; kismi tekil indeks
  = surum basina tek rezervasyon). Dort eski sutunda NOT NULL kalkar; `bookings_shape_check`. Indeksler seller/buyer/event.
- Yetki: `REVOKE ALL` anon+authenticated -> `GRANT SELECT` (anon dahil: eski durum; RLS politikasi olmadigindan anon 0 satir ya da eski
  `is_agency_member` politikasi yuzunden 42501 — eskiden beri boyle, 7c degistirmez) + authenticated `UPDATE (status, cancelled_at,
  cancelled_by, cancellation_reason, completed_at)`. Dogrudan INSERT/DELETE yok. Eski tetikleyici `on_quote_accepted_create_booking`
  SECURITY DEFINER: dokunulmadi, etkilenmez (asama16 K9 + asama4 T2 kanit).
- RLS: eski 6 politika aynen; `bookings_select_org` / `bookings_update_org` -> `can_access_booking_row(seller_provider_id,
  buyer_organization_id, mode)`: satici kurulus (`providers.organization_id`) `proposals.view` / `proposals.manage`, alici kurulus
  `events.view` / `events.manage`, admin.
- RPC `booking_from_proposal(p_proposal_id) RETURNS uuid` (SECURITY DEFINER; `proposals.manage`): teklif `approved` + gecerli surum
  `approved_at` dolu degilse 22023; surumun rezervasyonu varsa onu doner (idempotan); yoksa INSERT: `proposal_version_id`, `seller_provider_id`,
  `buyer_organization_id`, `customer_id = buyer_user_id` (misafirde NULL), `event_id`; etkinlikten `event_date/start_time/end_time/event_type/
  guest_count`, `location = sehir / ilce`; `total_amount = surum.total_amount` (KDV dahil), `platform_fee 0`, `currency`, `status confirmed`;
  denetim `internal.log_access(... 'bookings', id, {op: booking.from_proposal})`.
- `portal_proposal_view` -> `has_booking` (iptal edilmemis rezervasyon var mi) eklendi; govde aynen.

**asama16 (`asama16-faz7c-bookings-kontrol.sql`):** K1 yeni sutun 5; K2 eski sutun NULLABLE 4; K3 sekil kisiti + tekil indeks 2; K4 sekil ihlali 0;
K5 INSERT/DELETE yetkisi 0 + UPDATE sutun 5 = 5; K6 RPC/erisim yetkileri 4; K7 RLS politikasi 8; K8 teklif rezervasyonu tutari surumden farkli 0;
K9 eski quote tetikleyicisi yerinde 1; K10 bilgi eski*1000 + teklif; K11 bilgi onayli teklif rezervasyonsuz; K12 portal has_booking 1.
Beklenen: K1-K9, K12 ESIT; K10-K11 BILGI. Uretimde ilk kosu: K10 = eski rezervasyon sayisi * 1000 + 0, K11 1 (lansman teklifi).

**asama4 T23:** yetkisiz 42501 (crew_coordinator, yabanci, anon); owner: tek satir/surum, idempotan, teklif sekli (eski sutunlar NULL),
etkinlikten tarih/sehir/katilimci, total 11400 KDV dahil, confirmed, denetim; declined 22023; RLS owner+finance 1 / crew_coordinator+yabanci
0 / anon 0 ya da 42501; INSERT 42501, `total_amount` 42501, finance iptal 0 satir, owner iptal 1; portal `has_booking` false -> true; misafir
`customer_id` NULL (2400); eski sekil korunur, sekilsiz satir 23514. T0 temizligi teklif rezervasyonlarini tekliflerden ONCE siler (RESTRICT).
Yerel zincir (7 Ekim 2026): faz7c_01 iki kez (idempotan), asama4 **24/24** (T2 eski akis GECTI), asama16 hepsi ESIT (K10 1002), asama15 degismedi.

**Uretim sirasi:** 1. Commit. 2. Dal `supabase link --project-ref ukqhgspaallzjscjodbb` + `supabase db push` (y) -> asama4 24/24, asama16 ESIT.
3. Uretim `supabase link --project-ref qydsooqmflrrwtgawhsv` + `supabase db push` (y) -> asama16 ESIT (K10 N000, K11 1), asama15 degismedi.
4. `git push` -> 7c-P1 (`19-claude-code-gorevi-7c-p1.md`).

**7c-P1 (uygulama):** editorde "Rezervasyon oluştur" (approved + proposals.manage; idempotan -> "Rezervasyona git"), `/rezervasyonlarim`
"Kuruluş rezervasyonları" bolumu, `/rezervasyon/[id]` teklif sekli (satici kurulus / alici; iptal: musteri veya proposals.manage; tamamlama:
proposals.manage), portal "Rezervasyon oluşturuldu" bandi. Acik: alici Kashe kullanicisina bildirim; kurulus geliri kazanc/odeme sayfalarinda
(finance); kesfet/kategori "tamamlanan is" sayaci RLS yuzunden zaten bos (H8 — toplu RPC ile FAZ 9).
