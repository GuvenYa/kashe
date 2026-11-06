# Kashe — Proje Baglami

Bu dosya her oturumda okunur. Kashe'nin ne oldugu, hangi kisitlarla calisildigi ve mimari kararlarin nerede oldugu burada.

---

## Urun

Kashe; etkinlik, eglence, medya ve produksiyon sektorlerinde hizmet alanlari bagimsiz profesyoneller, organizasyon firmalari, ajanslar ve menajerlerle bulusturan dikey bir platform.

Uc katman:

1. **Marketplace** — dogrulanmis profil, portfoy, teklif, rezervasyon, odeme. **Bugun canli.**
2. **Event AI** — serbest Turkce brief'ten yapilandirilmis etkinlik tanimi, aday getirme, eslestirme, ekip onerisi. **Gelistirilecek.**
3. **Event OS / Crew AI** — ajans ve organizatorler icin CRM, ekip, tedarikci, teklif, butce, operasyon yonetimi. **Gelistirilecek.**

Ayrintili urun modeli: `docs/architecture/00-genel-bakis.md`

---

## Teknik yigin

- Next.js 16 (App Router), React, TypeScript
- Tailwind CSS v4
- Supabase (Postgres + RLS + Auth + Storage + Realtime), Frankfurt
- Vercel
- Depo: `GuvenYa/kashe`, canli: `kashe.net`

---

## CALISMA KISITLARI — bunlara mutlaka uy

**Ortam:** Windows + PowerShell + VS Code.

**PowerShell yapistirma sorunu.** Yapistirma sirasinda `<` karakteri dusuyor. SQL veya kod terminale yapistirilmaz; her sey dosya olarak yazilir.

**Migration akisi (14 Eylul 2026'dan itibaren, FAZ -1 sonrasi).** Sema degisikligi = `supabase/migrations/` altinda benzersiz zaman damgali dosya -> `supabase db push` ile once onizleme dalina -> sonra uretime. Dashboard SQL Editor yalniz salt okunur kontroller ve test betikleri (`docs/envanter/asama4-davranis-testi.sql` YALNIZ dalda) icin. Dashboard'dan sema degisikligi yapilmaz; zorunlu kalinirsa ayni gun dosya yazilir ve `supabase migration repair --status applied <ts>` ile kayit duzeltilir. Dosyalar idempotan olur (IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS), veri degistiren dosya ayri ve acikca isaretli olur (ornek: `faz0_03_dolum`). Deploy sirasi kod gerektiren degisikliklerde: ekleyen dosya -> `git push` (Vercel) -> kisitlayan dosya (bkz. `docs/envanter/07-profiles-pii.md`). Uretimin migration kaydi tamdir (`supabase migration list` 46/46, 14 Eylul); repo zinciri uretimi birebir uretir.

**Supabase CLI surumu (6 Kasim 2026).** CLI 3.x `supabase/config.toml` icindeki `[inbucket]` bolumu yuzunden calismadan durur; komutlar `npx supabase@2 link ...` / `npx supabase@2 db push` bicimiyle 2.x'e sabit calistirilir. 3.x'e gecis ayri bir is: `[inbucket]` -> `[local_smtp]` ve yerel `supabase start` denemesiyle birlikte yapilir.

**profiles ve organizations sutun yetkisi.** `anon` ve `authenticated`, `profiles` uzerinde 23 sutunluk SELECT listesine sahiptir (email, phone ve 5 yonetim sutunu kapali; erisim yalniz RPC'lerle: `get_own_private_profile`, `get_contact_info`, `admin_profile_contacts`, `admin_profile_ids_by_email`, `get_notification_email`). `profiles`'a yeni sutun eklenirse ayni migration'da `GRANT SELECT (sutun) ... TO anon, authenticated` ve `app/lib/own-profile.ts` `PROFILE_OPEN_COLUMNS` guncellenir. `organizations` icin ayni kural (`tax_number`, `billing_email` kapali; `anon` hic erisemez).

**Etkinlik verisi (FAZ 4a).** Yeni etkinlik turu = `event_types` satiri (migration) - TEK KAYNAK (FAZ 10b, uretim 4 Kasim 2026): `conversations` / `listings` / `bookings` / `quote_requests` `event_type` FK `event_types(key)` ON UPDATE CASCADE (CHECK listesi yok). Uygulama listeyi `app/lib/etkinlik-turleri.ts` ile okur (`unstable_cache` 1 saat, etiket `event-types`, cerezsiz anon istemci; okuma hatasi onbellege girmez): sunucuda `etkinlikTurleri()` / `etkinlikTuruAnahtarlari()`, istemcide kok layout'taki `EtkinlikTurleriProvider` + `useEtkinlikTurleri()` (aktif) / `useTumEtkinlikTurleri()`; etiket `etiketle(turler, key)`. Kod icinde tur listesi YAZILMAZ; sunucu eylemleri gelen turu tablodaki anahtarlarla dogrular. Pasif tur (`is_active=false`) secim kutularinda cikmaz, eski kayitlarda etiketlenir. Yeni tur bir saat icinde gorunur (hemen gerekirse `revalidateTag('event-types')`). `event_spec_versions` ekle-yalniz: duzeltme = yeni surum, gecerli surum yalniz `set_current_event_spec(uuid)`. `events`'e sorgulanacak yeni alan = sutun (jsonb `extra` icinde filtre yazilmaz). Ajans ic maliyeti/marji bu tablolara girmez (FAZ 6-7 `internal.*`). **Onay yalniz RPC ile (FAZ 4c):** uygulama `events`/`event_requirements`'a INSERT yapmaz; onaylanmis etkinlik yalniz `create_event_from_spec(p_version_id)` ile (is_current + valid surumden, atomik; ayni surumden ikinci onay 23505). Kullanicinin formda duzelttigi alanlar once `user_input` provenance ile YENI surum olur, onay o surumden; `spec_jsonb` UPDATE edilmez. Etkinlikten baslayan talep/ilan/sohbet `quote_requests.event_id` / `listings.event_id` / `conversations.event_id` tasir; bagimsiz baslayanlar NULL; eski tablolara `event_id` disinda sutun eklenmez. Prompt metni degisirse `prompt_version`, cikarim kodu degisirse `parser_version` artar (`app/lib/eventspec.ts`).

**Pazaryeri okumasi `v_providers_public`'ten (FAZ 2c).** Kesfet, kategori, /p/[id], sitemap, sihirbaz sayaci, pro-bul, teklif-topla, favoriler gibi pazaryeri LISTE/DETAY sorgulari `profiles` yerine `v_providers_public` gorunumunu okur (P1-P3 gecis sirasi `docs/envanter/14-faz2c-okuma-yolu.md` bolum 4). Yeni kod pazaryeri alanini (bio, sehir, onay, yayin, kategori, fiyat) `profiles`'tan okumaz. Kimlik (ad, avatar, rol, is_admin) ve operasyon (mesaj, rezervasyon, admin) okumalari `profiles`'ta kalir. Gorunume sutun eklemek = migration + `ProviderPublic` tipi ayni commit'te.

**Pazaryeri yazimi saglayici tarafina (FAZ 10c-1).** Saglayici hesabinin (`providers` satiri olan: `professional`, `agency`) pazaryeri alanlari yalniz saglayici tarafina yazilir: `providers` (city_id, district, service_radius_km, is_published, attributes, category_attributes; onay / askiya alma yalniz admin), `professional_profiles` / `organization_profiles` (bio / about, headline, ...), birincil kategori `provider_set_primary_category` RPC'si; yardimcilar `app/lib/saglayici-yazma.ts` (`saglayiciMi` sorgu hatasinda firlatir). `profiles`'taki ayni 13 alan (city_id, bio, primary_category_id, attributes, category_attributes, views_count, is_published, approval_*, approved_at, suspended_*) ters aynayla dolan KOPYADIR ve 10c-1/03'ten beri KILITLIDIR: saglayici hesabinda kullanici ve admin yazimi hata vermeden eski degerde kalir (sessiz kayip - kod bunu yakalayamaz). Hesap alanlari (full_name, company_name, phone, avatar_url, premium, is_admin, role) `profiles`'ta; musteri / isletme hesabi her seyi `profiles`'a yazar. SQL betigi (Sahne, asama4) saglayici alanini `profiles`'a yazarsa `kashe.sync_bypass` ile yazar ve kaynak tarafi ayni blokta esitler (ornek `docs/sahne/01a-sahne-hesaplar.sql`). Bkz. `docs/envanter/38-faz10-temizlik.md` bolum 10c.

**Girissiz Kashe AI (Duzeltme 06).** Yalniz `analyzeEventNeeds` girissiz calisir (`/kashe-ai` tek kutu ve sihirbaz "Anlat" adimi); model cagrisindan ONCE `girissizHakKullan` (`app/lib/girissiz-ai.ts`). Sinirlar DB'de (`internal.ai_girissiz_ayar`: IP basina gunluk + gunluk toplam; RPC `ai_girissiz_hak_kullan`, sunucu anahtari `AI_GIRISSIZ_ANAHTAR` - tanimsizsa girissiz kullanim KAPALI). Ham IP hicbir yere yazilmaz ya da loglanmaz (gunluk degisen ozet). Girissizde EventSpec kaydi (`event_briefs` / `event_spec_versions`) yazilmaz. Yeni bir AI eylemi girissiz acilacaksa ayni kapidan gecer. Kashe AI'in profesyonel listesi model degil veritabani (`app/kashe-ai/actions.ts`; Kesfet gorunurlugu, "Ad S."); ikinci model cagrisi eklenmez. Tek AI girisi `/kashe-ai`; `/etkinlik-planla` ve `/pro-bul` kalici yonlendirme (`next.config.ts`). Kontrol `docs/envanter/asama23-duzeltme-06-kontrol.sql`.

**Sahip kimligi `provider_id` (FAZ 10c-2, 5 Kasim 2026).** `services`, `portfolio_items`, `profile_experiences`, `reviews`, `favorites` tablolarinda uygulama sahip kimligi icin YALNIZ `provider_id` kullanir: suzgec (`.eq`/`.in`), INSERT yuku ve okunan alan. Eski sutunlar (`profile_id` / `professional_id`) veritabaninda FAZ 11'e kadar KALIR ve iki yonlu BEFORE tetikleyiciyle dolar (istemci yalniz `provider_id` gonderir -> eski sutun ondan dolar; eski uygulama da aynen calisir). Kimlikler birebir ayni (FAZ 2a: `providers.id = profiles.id`); tek gercek eski sutun kalir, istemcinin verdigi farkli `provider_id` EZILIR ve RLS (eski sutun = `auth.uid()`) tetikleyiciden SONRA denetlendigi icin baskasi adina satir acilamaz. Saglayici olmayan sahip (musteri / isletme) icin satir acilamaz (42501). Yuke eski sutun YAZILMAZ. PostgREST gomme ipuclari (`profiles!reviews_professional_id_fkey(...)`, `professional:professional_id(...)`) eski anahtarla AYNEN kalir — ipucu degisimi FAZ 11'de eski sutunlarla birlikte. Paylasilan tiplerde (`Service`, `PortfolioItem`, `Review`, `ProfileExperience`) `provider_id` zorunlu alandir; eski alan tipten DUSMEZ (veri hala geliyor) ama yeni kod onu okumaz. Ayni adli sutunlari olan diger tablolar (`service_packages`, `service_addons`, `availability_blocks`, `bookings`, `conversations`, `professional_rating_summary`, `quote_request_recipients`) DOKUNULMAZ. `provider_services` uygulama tarafindan OKUNUR (iki yer: `app/ajans/havuz/havuz-actions.ts` havuza eklenen saglayicinin rolleri, `app/p/[id]/page.tsx` profil rol listesi), YAZILMAZ (turetim DB tarafinda); `services` kaynak kalir, `services` fiyat/kategori/aktiflik sutunlarina dokunan her degisiklik `derive_provider_services` + `trg_faz2b_sync_services` UPDATE OF listesini gunceller.

**Yetenek havuzu (FAZ 5).** `organization_talent_records` kurulusun kendi verisidir: yalniz o kurulusun `talent.manage` uyesi yazar (RLS + `org_module_enabled(org,'talent_pool')`; modul yalniz `agency`), admin okur. Harici kisi `talents` satiri ACMAZ (`talent_id` NULL); baglama yalniz claim ile (`claim_talent_record(token)` / `_by_id`, dogrulanmis `auth.email()`). Kimlik esleme yalniz `find_talent_by_contact(org, email, phone)` ile (PII donmez, denetlenir); `talents.canonical_email/phone` kapali sutun, profillerden aynalanir. Ic oranlar yalniz `internal_talent_rate_list/upsert/close` (`commercial.view/manage`); uygulama `internal` semasina dogrudan sorgu atmaz. Davet tokeni yalniz `send_talent_record_invitation` ile (sutun istemciye kapali). **Ekibim kabulu = havuz kaydi:** uyelik artik `organization_memberships` (FAZ 10a) ve davet kabulu `org_invitation_respond` RPC'si; havuz kaydini bu RPC `ensure_talent_record_for_membership` ile ayni islemde yazar. Uygulama ayrica `/ajans/havuz` acilirken `sync_org_talent_pool` cagirarak kacani onarir (aynalama tetikleyicisi YOK — Guven karari; asama13 K5 kaymayi yakalar). `visibility` FAZ 5'te yalniz `private`. **Uygulama (P1-P3):** `/ajans/havuz` (liste, harici ekleme, davet, ic oran karti yalniz `commercial.view`), `/davet/havuz/[token]` (claim; token yalniz RPC'ye gider, tabloda aranmaz), profil bandi (`claimable_talent_records_for_me`), `/p/[id]` ve kesfet kartinda "Havuza ekle" (`talent_id` sunucuda `providers`'tan, roller `provider_services`'tan, iletisim kopyalanmaz). **Sil kurali:** yalniz aktif Ekibim uyesi kaydi silinmez — olcut `legacy_agency_member_id` dolu VE o kimlik `organization_memberships`'te `status = 'active'` (sutun adi eski, degeri kurulus uyeliginin kimligi; `havuz-actions.ts` bu kontrolu yapar, mesaj "Aktif Ekibim uyesi havuzdan silinemez"); diger kayitlar `talent.manage` ile silinir, ic oranlari CASCADE ile gider. FAZ 5 KAPANDI (1 Ekim 2026) — bkz. `docs/envanter/17-faz5-yetenek-havuzu.md`.

**Eslestirme ve ekip (FAZ 6).** Skor DB'de hesaplanir: uygulama yalniz `run_event_match(p_event_id)` cagirir (etkinlik sahibi; varsayilan
`hybrid`), `match_runs`/`match_candidates` tablolarina YAZMAZ (yetki de yok); gosterilen her aday `mark_match_candidates_shown`, tik
`mark_match_candidate_clicked` ile isaretlenir. Degisiklik = yeni `algorithm_version` (bugun `v0.2`), eski kosular degismez (ekle-yalniz).
Gerekce kodlari sabit liste (`same_city, date_available, budget_fit, high_trust, new_talent, coverage_full`); uygulama Turkce etikete
cevirir, yeni kod uretmez. Ajans adaylari (`role_id` NULL, `coverage_ratio`) yalniz ACIK verilerden (kendi `provider_services` + Ekibim
uyelerininki; ozel havuz kapsama girmez); zorunlu rol kapsanmayan ajans "tam hizmet" degildir. Ekip: `crews`/`crew_members` RLS ile
dogrudan yazilir (yalniz GRANT'li sutunlar; `pool_origin`/`created_by` tetikleyici), sahip kurar, kurulus `crew.view`/`crew.manage`;
zorunlu roller `confirmed` uyelerle kapsanmadan ekip `confirmed` olamaz (tetikleyici). Ic maliyet goruntusu yalniz kurulus ekibinde ve
yalniz `crew_member_commercial_snapshot` / `internal_crew_commercials_list` / `internal_crew_commercial_upsert` ile (`commercial.view/manage`).
FAZ 6 KAPANDI (2 Ekim 2026) — bkz. `docs/envanter/18-faz6-eslestirme-ekip.md`.

**Teklif dosyasi ve musteri portali (FAZ 7a).** Teklif saticisi yalniz AJANS kurulusu (`seller_organization_id`; `account_type = 'agency'`,
'organization' saglayicisi olan; uygulama satici yuzeyini — menu "Teklifler", `/ajans/teklifler`, "Teklif oluştur" — buna gore gosterir,
`proposal_create` saglayici yoksa reddeder). `proposals`/`proposal_versions`/`portal_access_links` INSERT yalniz RPC (`proposal_create`,
`proposal_new_version`, `proposal_send`); `status` ve `current_version_id` yalniz RPC yazar. Surumler ekle-yalniz: `sent_at` dolu surum
DONMUSTUR (kalem / ic kalem / tax_rate / valid_until / notes degismez; revizyon = `proposal_new_version`). Toplamlar tetikleyicide: subtotal =
yalniz `is_visible_to_client` kalemler, tax = round(subtotal * tax_rate, 2), KDV varsayilan 0.20; uygulama toplam yazmaz. Ic kalemler
(`internal.proposal_internal_items`) yalniz `internal_proposal_items_list` (commercial.view) / `internal_proposal_item_upsert` (commercial.manage).
Ham jeton yalniz `proposal_send` donusunde BIR KEZ gorunur; `token_hash` sutunu istemciye kapali; jeton loglanmaz, saklanmaz, baska URL'ye
yazilmaz. Portal (`/portal/teklif/[token]`) AYRI YUZEY: yalniz 3 anon RPC (`portal_proposal_view/approve/request_revision`), tabloya sorgu yok,
`internal` yok, kurulus/kullanici kimligi donmez; sayfa `force-dynamic`, noindex, referrer no-referrer; onay acik onay ekraniyla (ad soyad +
kutu), revizyon notu zorunlu. Gonderilmis teklif SILINMEZ (`proposal_set_status(..., 'declined')` ile kapatilir); yalniz hic gonderilmemis
taslak RLS DELETE ile silinir (7a-DB/02). Sunucuda render edilen tarih/saat `timeZone: 'Europe/Istanbul'` ile bicimlenir
(`KASHE_SAAT_DILIMI`; P2-ek). `/portal` bakim modundan muaftir (`proxy.ts`): ajansin gonderdigi baglanti lansmandan once de acilir.
Kullaniciya gorunen tek iletisim adresi `info@kashe.net` (7 Ekim 2026; eski gmail adresi kaldirildi). FAZ 7a KAPANDI (7 Ekim 2026) —
bkz. `docs/envanter/19-faz7-ticari-katman.md`.

**Rezervasyon iki sekilli (FAZ 7c).** `bookings` tek rezervasyon merkezidir; ayri tablo YOK. **Eski sekil:** `quote_id + conversation_id +
customer_id + professional_id` dordu dolu (quote kabulu; `on_quote_accepted_create_booking` tetikleyicisi AYNEN, dokunulmaz). **Teklif sekli:**
`proposal_version_id + seller_provider_id` dolu, dort eski sutun NULL olabilir (`customer_id` yalniz alici Kashe kullanicisiysa);
`bookings_shape_check` iki sekilden birini zorunlu kilar. Teklif rezervasyonu YALNIZ `booking_from_proposal(p_proposal_id)` ile (approved +
onayli surum; surum basina TEK satir, idempotan; total = KDV dahil; `proposals.manage`); uygulama `bookings`'e INSERT yapmaz (yetki de yok),
UPDATE yalniz `status, cancelled_at, cancelled_by, cancellation_reason, completed_at`. Kurulus erisimi `can_access_booking_row`
(satici kurulus proposals.view/manage, alici kurulus events.view/manage, admin); eski kisi politikalari aynen. Uygulama kodu iki sekli
acikca ayirir (`null` kontrolleri; eski kartlar eski sekle sabit); sohbet/e-posta gonderen eski kod `conversation_id` NULL ise atlanir.
Ekip uyesi basina rezervasyon YOK (FAZ 8 gorevlendirme). FAZ 7c KAPANDI (8 Ekim 2026) — bkz. `docs/envanter/19-faz7-ticari-katman.md`.

**Teklif talebi / RFP (FAZ 7b).** RFP ve teklif AYRI varliklar: `rfps` (alici kurulus + etkinlik; `event_id` NOT NULL, etkinlik kurulusun
olmali), `rfp_items` (rol + adet + **butce ipucu**), `rfp_invites` (davetli ajans saglayicisi; UNIQUE). RFP'yi `events.manage` yetkili HER
kurulus acar (kurum veya ajans); yanit veren yalniz davetli AJANS kurulusu (`proposals.manage`). **Kapali RFP**: davetsiz ajans talebi
goremez (`can_access_rfp_row`: alici kurulus events.view/manage | admin | davetli saticinin kurulusu, taslak disinda). **Butce ipucu
saticiya gitmez**: `rfp_items.budget_hint_*` sutun SELECT yetkisi yok, alici `rfp_detail` ile okur; satici kodu bu sutunlari HIC okumaz
(`grep budget_hint app/ajans` = 0). INSERT ve durum degisimleri yalniz RPC (`rfp_create/invite/send/close/cancel/request_revision/award`,
`rfp_mark_viewed/invite_decline`, `proposal_create_from_rfp`); gonderilmis RFP ve kalemleri degismez. RFP yaniti = `proposals` satiri
(`rfp_id`, `source_type = rfp_response`, `buyer_organization_id`, `event_id`): **portal baglantisi ACILMAZ** (`proposal_send` RFP dali NULL
doner; `portal_access_links` 0), alici kurulus teklifi Kashe icinde gorur — EN AZ BIR SURUMU GONDERILMIS teklifleri (6 parametreli
`can_access_proposal_row`; taslak surum ve gizli kalemler aliciya kapali). Secim `rfp_award`: teklif approved (onaylayan = alici kullanici
adi), RFP awarded, diger davetler not_selected; rezervasyon yine `booking_from_proposal` ile satici tarafindan. Alici yuzeyinde ic
maliyet/marj/`internal.*` ASLA okunmaz. Bildirim tipleri `rfp` ve `proposal` (uygulama ici; e-posta yok). Etkinligin kurulusa atfi:
sihirbaz son adiminda "Bu etkinlik kimin adina?" (brief `organization_id`, `events.manage` kontrolu; 7b-P1-ek) — kurulussuz etkinlik RFP'ye
baglanamaz. Platform yoneticisi (`is_admin`) tum RFP/teklifleri gorur (tasarim geregi). FAZ 7b KAPANDI (19 Ekim 2026) — **FAZ 7 KAPANDI**;
bkz. `docs/envanter/19-faz7-ticari-katman.md` bolum 12.

**Kurulus uyelik rolu (FAZ 8-U, 20 Ekim 2026).** Uyelik rolu TEK GERCEK `organization_memberships.role` (7 rol: owner, admin, sales,
project_manager, crew_coordinator, finance, viewer); eski `agency_members` / `business_members.member_role` (owner/manager/member) FAZ 0
aynasiyla eslenir ve ayna, eski satirdaki alakasiz guncellemelerde ince rolu EZMEZ. Rol degistirme TEK YOL `org_member_set_role(uuid, role)`
RPC (members.manage; kendi rolu, owner_seed, son sahip korunur; owner/admin yalniz sahip) — uygulamanin `organization_memberships` UPDATE
yetkisi YOK, eski tabloya dokunmaz. Etiket/ozet tek kaynak `app/lib/org-roles.ts` (ozetler `org_role_permissions`'tan turetilir, elle
yazilmaz); secim bileseni `app/components/ui/kurulus-rol-secici.tsx`. Davet/cikarma FAZ 10a RPC'lerinde (asagida). Bkz.
`docs/envanter/20-faz8-event-os-modulleri.md` bolum 2.

**Uyelik tek tablo (FAZ 10a, uretim 3 Kasim 2026) + Duzeltme 01.** Uyelik ve davet TEK GERCEK `organization_memberships` /
`organization_invitations`; eski `agency_members`, `business_members`, `agency_invitations`, `business_invitations` SALT OKUNUR (yazma
42501, ayna ve eski tetikleyiciler/fonksiyonlar dustu) ve Hijyen 05'te (~3 Aralik) DROP edilir — yeni kod bunlari OKUMAZ bile. Davet/kabul/
ret/iptal/cikarma/ayrilma yalniz RPC: `org_invitation_create(org, email, role, message)`, `org_invitation_cancel(id)`,
`org_invitation_respond(id, accept)`, `org_member_remove(org, user)`, `org_member_leave(org)` (kurallar DB'de; hatalar 42501/22023/23505/
P0002 Turkce mesajli, uygulama `uyelikHataMesaji` ile gosterir); uygulamanin bu iki tabloya INSERT/UPDATE/DELETE yetkisi YOK. Ortak katman
`app/lib/uyelik.ts` (`kurulusumunId`, `uyeliklerim`, `OWNER_SEED_HARIC` — sahip tohumu listelerde sayilmaz). Halka acik ekip listesi yalniz
`organization_team_public` gorunumu (rol sutunu yok). Havuz kaydi `ensure_talent_record_for_membership(p_membership_id)`. Suresi gecen davet
`expires_at` ile suzulur (durum pending kalir). Bildirim turu `team`. Duzeltme 01 kurallari: profil cipleri (`N tamamlanmis is`, tekrar
tercih) YALNIZ `provider_public_stats(uuid)` RPC'sinden (bookings ziyaretci RLS'iyle sayilmaz); suresi gecen `sent` teklifler gunluk
`proposals_expire_stale()` (pg_cron 00:15 UTC) ile `expired` olur, uygulama ayrica `valid_until` ile suzer; e-posta/portal baglantilari
`requestSiteUrl()` (`app/lib/site.ts`; onizlemede dal adresi); ekip bildirimleri (`crew_members` INSERT -> "ekibine ekledi", tekliften
rezervasyon -> "is kesinlesti") tetikleyicide. Admin onay kuyrugu sayimi `profiles`'tan (isletme hesabinin `providers` satiri yok). Bkz.
`docs/envanter/38-faz10-temizlik.md` (10a, Duzeltme 01, 10b/10c plani), `docs/sahne/bulgular.md`.

**Bildirimler ve kilitler (Duzeltme 03-B, uretim 3 Kasim 2026).** Kurulus uyelerine bildirim TEK yardimci:
`fn_faz7b_notify_org(org, izin, link, govde, tur DEFAULT 'rfp', haric_kullanici DEFAULT NULL)` (islemi yapan kendine almaz).
Bildirim turu `booking`: `trg_duz03_booking_notify` (bookings INSERT + UPDATE OF status) — teklif sekli olusunca alici kurulus
(`events.view`) + musteri, iptalde karsi taraf, tamamlanmada musteri (`/p/<pro>?yorum=1`) + alici kurulus; link `/rezervasyon/<id>`.
`booking` e-posta kuyruguna GIRMEZ (eski sekil e-postasi uygulamada). Portal onay/revizyonu saticiya `proposal` bildirimi yazar;
onayda `proposals.client_email` bir hesapla birebir eslesirse `buyer_user_id` dolar (satici kurulusun kendi hesabi haric) ve
`booking_from_proposal` musteriyi tasir — uygulama bu rezervasyonlari `/rezervasyonlarim` "Teklif dosyasıyla aldığın" bolumunde
`customer_id` + `proposal_version_id` ile okur. RFP: revizyon YANITI (onceki gonderilmis surumde alici notu var) `evaluating` ve son
tarih sonrasi da gonderilir, ilk yanit kurali aynen; `rfp_award` `revision_requested` teklifi de secer (son gonderilmis surum).
Sohbet teklifleri `quotes_expire_stale()` (pg_cron `quotes-expire-daily` 00:20 UTC); uygulama suresi gecmis `pending`i de "Suresi
doldu" cizer. Yorum INSERT politikasi `fn_duz03_tamamlanmis_rezervasyon_var(musteri, saglayici)` ister (sohbet sarti aynen).
Bkz. `docs/envanter/38-faz10-temizlik.md` bolum 6, `asama21-duzeltme-03b-kontrol.sql`.

**RPC bayragi (Duzeltme 04, 4 Kasim 2026).** `fn_faz7_rpc_flag()` = `COALESCE(current_setting('kashe.faz7_rpc', true) = '1', false)`.
Eskiden ayar o oturumda hic set edilmemisse NULL donuyordu; `IF ... AND NOT fn_faz7_rpc_flag() THEN RAISE` NULL olup RAISE calismiyor,
taze PostgREST baglantisinda gonderilmis/onayli teklif surumunun kalemleri ve vergisi dogrudan degisebiliyordu (bulgu 62). Kural: bir
kilidin `NOT <fonksiyon>()` kosulundaki fonksiyon ASLA NULL donmez (COALESCE); `current_setting(x, true)` karsilastirmasi hep
COALESCE ile sarilir. Gonderilmis surume dokunan bakim betikleri (asama4 T0/T99, Sahne 00/01a/02a/05) bayragi
`set_config('kashe.faz7_rpc', '1', true)` ile acar. Kontrol `asama22-duzeltme-04-kontrol.sql`, test asama4 T37.

**Ad gosterimi ve arama (Duzeltme 05, uretim 5 Kasim 2026).** Bireysel profesyonelin adi iliskisiz herkese "Ad S." gosterilir:
`app/lib/kamu-adi.ts` (`kamuAdi`, `gosterilecekAd(rol, ad, tamAd)`, sunucuda `tamAdGorebilirMi` - kendisi / admin / onayli ya da tamamlanmis
rezervasyon). Yeni bir yuzey saglayici adi gosteriyorsa bu yardimcidan gecer; tam ad istemciye gonderilmez (rezervasyon sonrasi yuzeyler
haric). Ajans/kurulus adi degismez. Kesfet `q` terimi `.or()`/`.ilike` icine HAM GIRMEZ: `aramaTerimi()` (`app/lib/arama.ts`) PostgREST filtre
karakterlerini (virgul, parantez, yildiz, iki nokta, yuzde, ters bolu, cift tirnak) temizler; es anlamlilar ayni dosyada, etkinlik turu listesi tablodan. Arama Turkce harf duyarsiz (Duzeltme 07): metin `v_providers_public.arama_metni` (DB `public.tr_katla` ile katlanmis ad + sirket + baslik + tanitim + kategori adi) sutununda `aramaKatla(terim)` ile aranir; iki katlama birebir ayni esleme - biri degisirse digeri ayni commit'te. Kesif yuzeylerinde ajans tipi
"Kurumsal hizmet saglayicilar" adiyla anilir (kod adi `agency`, URL `?tip=ajans` degismez).

**Gorevler ve aktivite (FAZ 8a).** Yazma DOGRUDAN TABLOYA (`tasks`; FAZ 7'nin aksine RPC YOK — ticari risk yok): RLS SELECT `events.view`,
INSERT/UPDATE/DELETE `events.manage`. Kurallar DB tetikleyicisinde, uygulama YALNIZ anlasilir Turkce mesaj uretir (`app/lib/gorevler.ts`
hata eslemesi; metinler `RAISE EXCEPTION` govdeleriyle birebir). Ayni kural iki yerde yazilmaz: "atanan kisi aktif uye mi", "etkinlik/havuz
kaydi/bagli gorev ayni kurulus mu", "silme yalniz todo/cancelled" kontrolleri uygulama tarafinda TEKRARLANMAZ. `activity_logs` INSERT yalniz
tetikleyici — uygulamanin yazma yetkisi yok, yuzey salt okunur; `internal.access_audit` (erisim denetimi) ile AYRI kalir. Modul kapisi
`org_module_enabled(org,'tasks')`: ajansta varsayilan ACIK, kurumda kapali dogar ve `settings.manage` sahibi `/kurumsal/ayarlar`dan
`org_module_set` RPC'siyle acar (uygulama `organization_modules`'a yazmaz). Bildirim tipi `task` (atama ve `blocked`; tetikleyici yazar,
`link` `/etkinliklerim/<id>?sekme=gorevler` ya da `/kurulus/gorevler?gorev=<id>`); Edge Function kuyrugu `['rfp','proposal','task']`.
Gorev listesi `/kurulus/gorevler?kurulus=<orgId>`; etkinlik sayfasi `/etkinliklerim/[id]` SEKMELI (`?sekme=`: genel · adaylar · ekip ·
gorevler · aktivite) — Adaylar/Ekip yalniz AJANS kurulusu etkinliginde, kisisel etkinlik (organization_id NULL) sekmesiz eski duzende kalir.
Alici kurulus yuzeyinde havuz ve ic maliyet gorunmez. FAZ 8a-P1 — bkz. `docs/envanter/20-faz8-event-os-modulleri.md` bolum 3.

**CRM ve tedarikciler (FAZ 8b-8c) — FAZ 8 KAPANDI (22 Ekim 2026).** Ikisi de 8a deseni: yazma DOGRUDAN TABLOYA, kurallar DB
tetikleyicisinde (`fn_faz8b_*`, `fn_faz8c_*`), uygulama yalniz Turkce mesaj esler (`app/lib/crm.ts`, `app/lib/tedarikci.ts`), RPC yalniz ic
maliyet icin. **CRM** (`contacts`, `crm_leads`; yetki `crm.view` / `crm.manage`; modul `crm` YALNIZ ajansta, varsayilan acik):
kisi e-posta/telefonu KURULUS ICI (RLS; aktivite diff'ine PII yazilmaz, yalniz `true`), firsat sahibi aktif uye VE `crm.view` tasir
(`user_has_org_permission`), firsat teklife baglaninca `proposals.buyer_contact_id` dolar, oneri gorunumu `crm_contact_suggestions`
(teklif musterisi -> kisi), bildirim tipi `crm` -> `/ajans/musteriler?firsat=<id>`. Yuzey `/ajans/musteriler` (pano + panel `?firsat=`,
kisiler, oneri seridi), `/ajans/musteriler/[id]`; kurumsal kurulusta CRM menusu YOK. **Tedarikciler** (`suppliers`, `event_suppliers`;
yetki `suppliers.view` / `suppliers.manage`; modul `suppliers` yalniz ajansta): defter serbest kayit + istege bagli `providers` bagi (kendi
saglayicisi olamaz), arsiv (`is_active=false`) atanamaz, atanmis tedarikci silinmez (RESTRICT). Anlasilan tutar IC MALIYET:
`internal.event_supplier_costs` yalniz `internal_event_supplier_costs_list` (`commercial.view`) / `internal_event_supplier_cost_set`
(`commercial.manage`; NULL siler) ile — UI yetki yoksa sutunu HIC cizmez. Etkinlik sayfasinda "Tedarikciler" sekmesi yalniz ajans
etkinliginde. **Alici kisa listesi** (`supplier_shortlists` + `supplier_shortlist_items`; modul `supplier_search`, business'ta varsayilan
acik, ajans acabilir; yetki `events.view` / `events.manage`, ayri anahtar yok): kalem = `providers` satiri (bilgi yalniz
`v_providers_public`), kendi saglayicisi eklenemez; Kesfet kartinda "Kisa listeye ekle" (tek yonetilebilir kurulus kurali, havuz kisa yolu
oncelikli), `/kurumsal/kisa-liste`, RFP davet kutusunda "Kisa listeden sec" (yalniz ajans kalemleri). `org_module_set` izin listesi
`tasks/crm/suppliers/supplier_search` — uygulamadaki `modul-actions.ts` listesi AYNI tutulur. Edge Function kuyrugu
`['rfp','proposal','task','crm']`. Bkz. `docs/envanter/20-faz8-event-os-modulleri.md` bolum 4-5.

**Zeka katmani (FAZ 9) — FAZ 9 KAPANDI (26 Ekim 2026).** Uc kural tabanli V0: **olay zinciri** (`analytics_events`, ekle-yalniz;
uygulama olay YAZMAZ, 10 tetikleyici yazar — `fn_faz9_olay_yaz` SECURITY DEFINER, `(event_name, entity_id)` tekil; payload'a PII girmez;
SELECT yalniz `is_admin`; ozet `analytics_summary(p_days)`), **fiyat kiyaslari** (`price_benchmarks` rol x sehir x tur, kayan 90 gun,
p25/medyan/p75, yayin esigi `fn_faz9b_yayin_esigi()` = 15; gozlemler yalniz MUSTERIYE DONUK fiyat — son gonderilmis teklif surumunun gorunur
rol kalemleri + kabul edilmis pro teklifleri, `internal.*` ASLA; gunluk `price_benchmarks_compute` (pg_cron 00:30 UTC; varsayilan gun
ISTANBUL gunu, `current_date` UTC'dir) ayni gun yeniden kosarsa gunceller ve gozlemi kalmayan hucreyi siler; okuma YALNIZ
`price_benchmark_lookup(_many)` (anon + authenticated; yayinli en dar satir + `granularity`; yayinli yoksa BOS ve UI HICBIR SEY cizmez —
"veri yok" yazisi bile yok); admin `price_benchmarks_summary`), **Trust Score V0** (`fn_faz9c_hesapla` alti bilesen: dogrulama 0-25, profil
0-15, tamamlanan is 0-25, iptal -15..0, degerlendirme 0-20 notr 8, yanit suresi 0-15 notr 7; `trust_score_compute` gorunur saglayicilari
hesaplar, `trust_score_snapshots`'a (ekle-yalniz) yazar ve `providers.trust_score`'u koruma kapisiyla (`kashe.sync_bypass`) gunceller,
gorunmeyenin skoru NULL; pg_cron 00:45 UTC; kullanici skoru yazamaz — sutun yetkisi 42501 + koruma tetikleyicisi; Match V0.2
`high_trust` >= 70 kendiliginden; okuma yalniz `my_trust_breakdown` (kendisi ya da ajansta `settings.manage`); itiraz `trust_appeals`'a
DOGRUDAN INSERT (RLS; saglayici basina tek acik; UPDATE/DELETE yok), karar yalniz `trust_appeal_review` (admin); ozet
`trust_score_summary`). Yuzeyler: `/admin/zeka` (5 blok, grafik + tablo; recharts, `app/lib/grafik-tema.ts` ortak), sihirbaz butce kutusu
(`adet x medyan`, her secili rol yayinli degilse kutu YOK), Kesfet seridi, teklif editoru kalem ipucu (`canManageProposals`), `/profil`
pazar araligi + guven dokumu + itiraz, `/ajans` guven dokumu. MUSTERI YUZEYINDE SKOR YOK; Kesfet siralamasi degismez. Sabitler
`app/lib/zeka.ts`, `fiyat-kiyas.ts`, `guven.ts`; sunucu okuma `*-data.ts` (`server-only`). Bkz. `docs/envanter/34-faz9-zeka-katmani.md`.

**Onizleme ve tur — Sahne (27 Ekim 2026'dan itibaren).** Dal projesi (`ukqhgspaallzjscjodbb`) = **Sahne**: sentetik test dunyasi
(171 hesap `sahne+<slug>@kashe.net`, parola `Sahne!2026`, id oneki `5a4e0000-`; 122 profesyonel / 12 ajans / 8 kurum / 20 musteri / 1 yonetici,
6 aylik gecmis, fotografli portfoy) + asama4 fixture'lari. Vercel **Preview** ortam degiskenleri dala cevrildi: onizlemeler Sahne'ye baglanir;
uretim (`qydsooqmflrrwtgawhsv`) ve Production env dokunulmaz. Uretec `scripts/sahne/uret.py` -> `docs/sahne/0x-sahne-*.sql` (dal SQL Editor;
her dosyada uretim korumasi; sira 00 -> 01a/01b -> 02a..e -> 03 -> 04; v2 29 Ekim: FAZ 10a sonrasi uyelikler dogrudan `organization_memberships`), fotograflar `scripts/sahne/foto-indir.mjs` + `foto-yukle.mjs` (service role yalniz Guven'in PowerShell
ortaminda). Uretim korumasi deseni: test disi profil = `email NOT LIKE 'faz1test+%' AND email NOT LIKE 'sahne+%'`. Hesap listesi
`docs/sahne/hesaplar.md`, plan ve senaryolar `docs/envanter/39-sahne-sentetik-dunya.md`. Migration akisi degismez (dal -> asama4/asamaN ->
uretim). Uretime yalniz UI uzerinden, yalniz okuma. Ayni islemde iki hesap kosusu `clock_timestamp()` ister (`now()` esit kalir).

**Derleme dogrulamasi cikis koduyla DEGIL (24 Eylul 2026).** `npm run build` Windows'ta hata verse de exit 0 donebiliyor (`Failed to collect page data for /...` ciktisi gecti, `.next/BUILD_ID` olusmadi). Kanit = cikti sonunda route tablosu + hata satiri yok + `.next/BUILD_ID` var. Ayrica `'use client'` modulunden sunucu bilesenine sabit/veri import edilmez (sayfa verisi toplamayi kirar); ortak veri `'use client'` OLMAYAN bir `*-data.ts` modulunde tutulur (ornek `app/ilanlar/listings-data.ts`).

**Find/Replace All kullanma.** Buyuk dosyalarda toplu degistirme yapiyi bozuyor. Tek tek BUL/DEGISTIR ya da dosyanin tamamini yeniden yazma (Ctrl+A, Delete, yapistir) yontemi kullanilir.

**`.next` onbellegi bozuluyor.** Beklenmeyen davranista once `.next` klasoru silinip sunucu yeniden baslatilir. Kod hatasi aramadan once bunu dene.

**Dil:** Tum aciklamalar, yorum satirlari, commit mesajlari ve kullanici arayuzu metinleri **Turkce**. Sapkali harf (a, i, u) kullanilmaz.

**Uydurma veri yok.** Metrik, rakam veya orneklem sayisi uydurulmaz. Bilinmeyen deger icin "olculecek" denir.

**Migration raporlama.** Her oturum sonunda uygulanan migration dosyalari en ustte listelenir. "N tane donusturuldu" kaniti degildir; kalan sifir sonucunu gosteren bir arama kanittir.

**Tailwind sinifi `${` ile BITISIK yazilmaz.** Tailwind kaynak dosyalarini metin olarak tarayip aday sinif cikarir; bitisik `${` adayi bozar ve sinif uretilen CSS'e HIC girmez. Belirti sinsidir: derleme hatasi YOK, TypeScript hatasi YOK, lint hatasi YOK — yalniz kural eksik kalir ve duzen sessizce bozulur.

```jsx
// YANLIS — "md:grow" sinifi sessizce yok olur
className={`... md:basis-0 md:grow${adsiz ? ' border-danger/40' : ''}`}

// DOGRU — kosullu ifade sinifin TAMAMININ yerine gecer
className={adsiz ? `${INPUT} border-danger/40` : INPUT}

// DOGRU — ya da siniftan sonra bosluk
className={`... md:grow ${adsiz ? 'border-danger/40' : ''}`}
```

Duzen sinifi ekleyen her degisiklikten sonra uretilen CSS'te kuralin varligi kanitlanir — "derlendi" demek yetmez, satir gosterilir. Kural yalniz Tailwind utility'leri icindir; `globals.css`'te elle yazili siniflar (`pano-card`, `kashe-tap`) tarayicidan bagimsiz uretilir ama okunurluk icin yine kacinilir. Ayrinti ve olcum komutu: `DESIGN.md` → bolum 8.

**Commit ve push disiplini.** Commit'leri **Claude atar**; **push YALNIZ Guven'in onayiyla** yapilir. `git status --short`'ta gorunen her dosya bilincli olarak ya bir commit'e girer ya da raporda **"kasitli disarida"** diye adiyla yazilir — `??` isaretli dosya sessizce birakilmaz. Build her zaman **SON commit'ten SONRA** kosar; teyidi build sonrasi `git status --short` ciktisinin bos olmasidir (calisma agaci HEAD ile birebir ayni demektir).

Bu kural bir uretim olayindan dogdu: push brief'indeki `git add` satirlari eksik uygulanip modul commit'e girmeyince Vercel build'i "Module not found" ile kirildi; ayrica yarim uygulanmis bir ozellik (AI hala butce uretiyordu, yalniz gosterilmiyordu) ve olu kalmis bir mimari bag (ortak filtre fonksiyonu cagrilmiyordu) dogdu — ucu de derleme hatasi vermeden.

---

## Mimari kararlar nerede

| Dosya | Icerik |
|---|---|
| `docs/architecture/00-genel-bakis.md` | Urun modeli, roller, uc katman, modul haritasi |
| `docs/architecture/01-veri-modeli.md` | Tablo tasarimlari ve gerekceleri |
| `docs/architecture/02-guvenlik-modeli.md` | internal sema, RLS, portal erisimi, yapay zeka yetki sinirlari |
| `docs/architecture/03-taksonomi.md` | Servis/rol/beceri katmanlari ve mevcut kategorilerin gocu |
| `docs/architecture/04-goc-plani.md` | Faz faz goc sirasi ve uretim riskleri |
| `docs/architecture/05-arayuz-modeli.md` | Baglam anahtari, calisma alanlari, yuzey ayrimi |
| `docs/yeni-kategori-checklist.md` | Kategori/rol ekleme dokunma noktalari (operasyonel) |

Taksonomi isinde **her iki belge birlikte** okunur: `03-taksonomi.md` hedef yapiyi, checklist mevcut altyapinin dokunma noktalarini anlatir. `03-taksonomi.md`'nin son bolumu ikisi arasindaki catisma noktalarini ve cozumlerini icerir.

**Bu dosyalar celiskiye dusmez.** Bir karar degisirse ilgili dosya guncellenir; eski karar birakilmaz.

---

## Degismez kurallar

Bunlar mimari kararlar degil, **ihlal edilemez sinirlar**:

1. **`internal` semasi PostgREST'e acilmaz.** Ic maliyet, marj ve ozel notlar orada durur. Erisim yalniz `security definer` fonksiyonlarla ve uyelik + rol kontroluyle olur.

2. **Kurulus verisi kiraci sinirini gecmez.** Bir kurulusun ozel yetenek havuzu, maliyeti ve notlari baska kurulusa, musteriye veya pazaryeri sorgusuna sizamaz.

3. **Yapay zeka rakam uretmez.** Fiyat, butce, marj ve musaitlik sunucu tarafinda hesaplanir. Model yalniz anlama, aciklama ve taslak uretir.

4. **Yapay zeka kritik islem yapmaz.** Odeme, iade, kesin rezervasyon, teklif gonderimi, rol degisikligi ve profesyonel dislama **insan onayi** gerektirir.

5. **Model yalniz gecerli kimlik uretir.** Kategori, rol veya saglayici adi uydurulamaz; cikti veritabanindaki kimliklerle sinirlidir.

6. **Organik siralama satin alinamaz.** Sponsorlu gorunurluk ayri alanda tutulur ve arayuzde acikca etiketlenir.

7. **Eski akislar kesilmez.** Yeni yapilar mevcut olanlarin yanina eklenir; uretimde kullanicisi olan hicbir akis aniden kapatilmaz.

---

## Mevcut sema ozeti

35 tablo, 148 RLS politikasi, 14 enum, 69 fonksiyon (FAZ -1 sonrasi sayim; uretim = repo zinciri). FAZ 0 ile +5 tablo (`organizations`, `organization_memberships`, `organization_invitations`, `organization_modules`, `organization_sync_log`), +5 enum — bkz. `docs/envanter/08-faz0-kiraci-temeli.md`. FAZ 1 ile `internal` semasi + `internal.access_audit` — bkz. `docs/envanter/09-faz1-internal-sema.md`. FAZ 2a ile `talents`, `providers`, `professional_profiles`, `organization_profiles` (+6 enum; `providers.id = profiles.id`; FAZ 10c-1 ile pazaryeri KAYNAGI `providers` + alt profiller, `profiles` kopyayi TERS aynayla alir) — bkz. `docs/envanter/11-faz2-saglayici-defteri.md`. FAZ 3a ile `service_roles` (taksonomi rol katmani; `roles` DEGIL — `role` kelimesi kullanici ve uyelik rolu icin dolu) + `service_categories.layer/parent_id`; 23 kategori = 23 rol, slug birebir, admin kategori eklerse rol otomatik dogar — bkz. `docs/envanter/12-faz3a-service-roles.md`. FAZ 2b ile `provider_services` (saglayici x rol; cift alan doneminde aktif `services` + `profiles.primary_category_id`'den TURETILIR, `origin` sutunu), `v_provider_roles`, ve `services`/`portfolio_items`/`profile_experiences`/`reviews`/`favorites`'ta `provider_id` (= profile_id / professional_id; tetikleyici turetir) — bkz. `docs/envanter/13-faz2b-saglayici-hizmetleri.md`. FAZ 2c ile `v_providers_public` (pazaryeri okuma SOZLESMESI: profiles pazaryeri sutunlariyla ayni adlar, kaynak providers/alt profiller/provider_services + profiles kimlik; security_invoker) — bkz. `docs/envanter/14-faz2c-okuma-yolu.md`. FAZ 4a ile `event_types` (15 tur), `event_briefs`, `event_spec_versions` (ekle-yalniz, surumlu), `events`, `event_requirements` (rol FK) + `conversations.event_id`; satir sahipligi RLS + `has_org_permission` — bkz. `docs/envanter/15-faz4a-etkinlik-eventspec.md`. FAZ 4c ile `quote_requests.event_id`, `listings.event_id` (NULL, FK SET NULL), `events_spec_version_id_key` kismi tekil indeks ve `create_event_from_spec(uuid)` RPC (SECURITY DEFINER; authenticated + service_role) — bkz. `docs/envanter/16-faz4c-yeni-talep-akisi.md`. FAZ 5 ile `organization_talent_records`, `organization_talent_record_roles`, `internal.organization_talent_rates` (+6 enum), `org_module_enabled`, `talent_pool` modulu (agency), `find_talent_by_contact`, `send_talent_record_invitation`, `claim_talent_record(_by_id)`, `decline_talent_record_invitation`, `claimable_talent_records_for_me`, `internal_talent_rate_list/upsert/close`, `faz5_backfill_agency_members` (tek seferlik dolum; `legacy_agency_member_id`), 5-DB/03 ile `ensure_talent_record_for_membership` (profesyonel kendisi / talent.manage) ve `sync_org_talent_pool` (talent.manage; havuz sayfasi acilirken) — aynalama tetikleyicisi yerine uygulama cagirir — bkz. `docs/envanter/17-faz5-yetenek-havuzu.md`. FAZ 6 ile `match_runs`, `match_candidates`, `crews`, `crew_members`, `internal.crew_member_commercials` (+7 enum), `run_event_match` (Match V0.2), `mark_match_candidates_shown/clicked`, `crew_member_commercial_snapshot`, `internal_crew_commercials_list/upsert`, `can_access_crew_row/can_access_crew` — bkz. `docs/envanter/18-faz6-eslestirme-ekip.md`. FAZ 7a ile `proposals`, `proposal_versions`, `proposal_items`, `portal_access_links`, `internal.proposal_internal_items` (+4 enum), `proposal_create/new_version/send/revoke_link/set_status`, `internal_proposal_items_list/upsert`, `can_access_proposal_row/can_access_proposal/can_access_proposal_version/is_proposal_buyer`, portal `portal_proposal_view/approve/request_revision` (anon + authenticated), 7a-DB/02 ile `proposals_delete` politikasi — bkz. `docs/envanter/19-faz7-ticari-katman.md`. FAZ 7c ile `bookings` + `buyer_organization_id`, `seller_provider_id`, `event_id`, `crew_member_id`, `proposal_version_id` (nullable; eski 4 sutun nullable; `bookings_shape_check`; surum basina tekil), `can_access_booking_row`, `booking_from_proposal`, `portal_proposal_view` -> `has_booking` — bkz. `docs/envanter/19-faz7-ticari-katman.md` bolum 11. FAZ 7b ile `rfps`, `rfp_items`, `rfp_invites` (+2 enum `rfp_status`, `rfp_invite_status`), `proposals.rfp_id`, `can_access_rfp_row/can_access_rfp/can_access_rfp_invite_row`, 6 parametreli `can_access_proposal_row`, `fn_faz7b_*` (koruma tetikleyicileri, `notify_org`, `version_sent`, `provider_org_permission`, `my_invite`), RPC `rfp_create/invite/send/close/cancel/request_revision/award/detail/mark_viewed/invite_decline`, `proposal_create_from_rfp`, `proposal_send` RFP dali, `notifications_type_check` + `rfp`/`proposal` — bkz. `docs/envanter/19-faz7-ticari-katman.md` bolum 12. FAZ 8 ile (8-U) `org_member_set_role`, `map_org_role_to_legacy`; (8a) `tasks`, `activity_logs` (+1 enum `task_status`), `org_module_set`, `organizations_public` gorunumu (hijyen_03), `events.organization_id` dolumu; (8b) `contacts`, `crm_leads` (+1 enum `crm_lead_stage`), `proposals.buyer_contact_id` FK, `crm_contact_suggestions` gorunumu, `fn_faz8b_*`, yetki `crm.*`, modul `crm`; (8c) `suppliers`, `event_suppliers`, `internal.event_supplier_costs`, `supplier_shortlists`, `supplier_shortlist_items`, `internal_event_supplier_costs_list/cost_set`, `user_has_org_permission`, `fn_faz8c_*`, yetki `suppliers.*`, moduller `suppliers` / `supplier_search`; `activity_logs_entity_type_check` 12 deger, `notifications_type_check` + `task`/`crm` — bkz. `docs/envanter/20-faz8-event-os-modulleri.md`. FAZ 9 ile `analytics_events` (+ `fn_faz9_olay_yaz`, `fn_faz9_booking_payload`, 10 `trg_faz9_*`, `analytics_summary`), `price_benchmarks` (+ `fn_faz9b_yayin_esigi`, `fn_faz9b_gozlemler`, `price_benchmarks_compute`, `price_benchmark_lookup(_many)`, `price_benchmarks_summary`; pg_cron `price-benchmarks-daily`), `trust_score_snapshots`, `trust_appeals` (+ `fn_faz9c_provider_yetkisi`, `fn_faz9c_hesapla`, `fn_faz9c_appeal_before_insert`, `trust_score_compute`, `my_trust_breakdown`, `trust_appeal_review`, `trust_score_summary`; pg_cron `trust-score-daily`) — bkz. `docs/envanter/34-faz9-zeka-katmani.md`.

**Kullanici rolleri (dort, degismez):** `client`, `professional`, `business`, `agency`

`profiles` bugun KIMLIK tablosudur (kullanici adi, avatar, rol, `is_admin`, premium, iletisim). Pazaryeri verisinin kaynagi `providers` + alt profiller (`professional_profiles` / `organization_profiles`), kurulus hesabi `organizations`. `profiles` ayni alanlarin KOPYASINI FAZ 11'e kadar tasir: ters ayna her yazimda esitler, 83 okuyan dosya degismeden calisir. Ayrinti: `04-goc-plani.md`, `docs/envanter/38-faz10-temizlik.md` bolum 10c

**Yetkilendirme fonksiyonlari.** RLS politikalari yetki fonksiyonlarini cagirir. FAZ -1 (14 Eylul 2026) ile uretimdeki tum fonksiyonlar repoya alindi: `is_admin(uuid)` (`faz_minus1_02`), `has_business_role`, `is_business_member`, `is_business_member_of_request`, `owns_quote_request`, `is_professional_or_agency`, `is_assignee` (`faz_minus1_03`). FAZ 0 ekledi: `is_org_member(uuid)`, `has_org_permission(uuid, text)`, `org_role_permissions(role)`, `organization_id_for_profile(uuid)`; 04 dosyasiyla `is_agency_member(uuid)`. FAZ 1 (internal sema) kalibi: istemciye acik RPC `public.internal_*` adiyla `SECURITY DEFINER` yazilir ve sirayla `internal.assert_org_permission(org, izin, tablo)` -> `internal.log_access(org, 'read'|'write', tablo, id, detail)` -> sorgu cagirir; `internal` semasina yeni tablo = ayni migration'da RLS + `REVOKE ALL` + yalniz bu kalipla erisim (bkz. `docs/envanter/09-faz1-internal-sema.md`). Yeni bir RPC veya politika yazmadan once `docs/envanter/` altindaki ilgili raporu oku; RPC'lere satir bazinda iliski kontrolu gomulur (cagirani degil iliskiyi dogrula), `SECURITY DEFINER` + `SET search_path = public` + `REVOKE ... FROM PUBLIC, anon`.
Tarihsel kanit: `docs/envanter/01-rol-kontrolleri.md` bolum 5b (FAZ -1 oncesi durum).

Gocte **politikalar degil, fonksiyon govdeleri** degistirilir: `has_business_role` ve `is_business_member` govdeleri `organization_memberships`'e cevrilince bu iki fonksiyonu cagiran 26 politika **otomatik** dogru calisir.

---

## Calisma bicimi

- Once mimari belgeyi oku, sonra kod yaz.
- Migration dosyasi olustur; SQL'i terminale yapistirmaya calisma. Uygulama Guven'in isidir (`supabase db push`), Claude Code uygulamaz.
- Buyuk degisiklikte once plan sun, onay al.
- Her degisiklikten sonra hangi dosyalarin degistigini listele.
- Emin olmadigin yerde tahmin etme, sor.
