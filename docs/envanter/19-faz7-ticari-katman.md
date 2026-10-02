# 19 — FAZ 7: Ticari katman (teklif dosyasi, musteri portali, bookings genislemesi, RFP)

**Kaynak plan:** `04-goc-plani.md` FAZ 7 madde 34-36; `01-veri-modeli.md` bolum 7 (RFP ve Proposal AYRI varliklar), bolum 8
(`internal.proposal_internal_items`), bolum 9 (portal_access_links, misafir portali), bolum 12 (`bookings` genislemesi);
`02-guvenlik-modeli.md` bolum 2-3 (ic maliyet uc katman, `internal_api` deseni), bolum 6 (musteri portali ayri yuzey, token_hash);
`05-arayuz-modeli.md` (portal, ic maliyet gorunurlugu, kritik islemde onay kapisi); `18-faz6` (crews, crew_member_commercials).
**Durum:** 7a-DB/01 URETIMDE (2 Ekim 2026, commit `6a5be05`; bolum 10). Sirada P1 (`19-claude-code-gorevi-p1.md`).

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
`internal.proposal_internal_items` tablo yetkisi 0.

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
4 erisim fonksiyonu authenticated var + anon yok (22) ve 3 portal RPC anon VE authenticated var (6) = 28; K6 RLS politikasi (9);
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
(14 gun); aktif baglanti 1; pro1 (crew_coordinator) 0 satir + `proposal_create` 42501; owner bile `token_hash` okuyamaz (42501); anon 42501.
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

## 8. Uygulama parcalari (Claude Code)

**P1 — teklif editoru (`19-claude-code-gorevi-p1.md`):** `/ajans/teklifler` (liste: baslik, musteri, durum, surum, toplam, tarih) +
`/ajans/teklifler/[id]` (surum kalemleri duzenleme: aciklama/adet/birim fiyat/gorunur; tax_rate, gecerlilik, not; toplamlar; **ic maliyet
karti** yalniz commercial.view — kalem basina ic maliyet, markup, marj; "Gönder" -> onay kapisi (05) -> baglanti + e-posta; "Yeni sürüm";
durum rozeti; portal izleri). Etkinlik sayfasi ekip panelinde "Teklif oluştur" (kurulus ekibi, proposals.manage) -> `proposal_create`
-> editore. E-posta sablonu `teklifEmail` (Resend). Menu "Teklifler".
**P2 — musteri portali (`-p2.md`):** `/portal/teklif/[token]` (oturumsuz; noindex; `portal_proposal_view`): satici adi, baslik, etkinlik
ozeti, kalemler (gorunur), KDV/toplam, gecerlilik; "Onayla" (ad-soyad + onay kutusu + acik onay ekrani) -> `portal_proposal_approve`;
"Revizyon iste" (not) -> `portal_proposal_request_revision`; durum sayfalari (onaylandi / suresi doldu / baglanti gecersiz). Portal
sayfasi `internal`'a dokunan HICBIR action icermez; kurulus id istemciye gitmez.
**7c (ayri plan bolumu, 7a kapaninca):** bookings sutunlari + `booking_from_proposal`; **7b:** RFP.

## 9. Kalici kurallar (7 sonrasi)

- **Ic maliyet uc katman** (02): `internal.proposal_internal_items` yalniz RPC; `sales`/`project_manager` musteri fiyatini girer, marji gormez.
- **Dondurulmus surum degismez**; revizyon = yeni surum. Musterinin onayladigi surum sonsuza kadar aynidir.
- **Portal ayri yuzey**: yalniz 3 anon RPC, token_hash, scope, sure, goruntuleme sayaci; kurulus/kullanici kimligi donmez; `internal` yok.
- **Gizli kalem toplama girmez**; portal toplami = gorunur kalemler.
- **Teklif dosyasi kurulus aracidir**; profesyonel-musteri teklifi `quotes`'ta kalir (FAZ 10 karari).
- **Kritik islemde onay kapisi** (05): gonderme ve onaylama tek tikla gecilmez.

## 10. Kapanis kaydi

**7a-DB/01 (2 Ekim 2026, commit `6a5be05`):** yerelde uc kez (idempotan), asama4 23/23, asama15 ESIT. Dal: asama4 **23/23**, asama15
K10-K12 BILGI digerleri ESIT. Uretim: `supabase db push` 1 dosya; asama15 hepsi ESIT, K10 0; asama14 degismedi (K10 802). `git push` tamam.
Siradaki: P1 (`-p1.md`).

(P1, P2, 7c, 7b icin doldurulur)
