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

**profiles ve organizations sutun yetkisi.** `anon` ve `authenticated`, `profiles` uzerinde 23 sutunluk SELECT listesine sahiptir (email, phone ve 5 yonetim sutunu kapali; erisim yalniz RPC'lerle: `get_own_private_profile`, `get_contact_info`, `admin_profile_contacts`, `admin_profile_ids_by_email`, `get_notification_email`). `profiles`'a yeni sutun eklenirse ayni migration'da `GRANT SELECT (sutun) ... TO anon, authenticated` ve `app/lib/own-profile.ts` `PROFILE_OPEN_COLUMNS` guncellenir. `organizations` icin ayni kural (`tax_number`, `billing_email` kapali; `anon` hic erisemez).

**Etkinlik verisi (FAZ 4a).** Yeni etkinlik turu = `event_types` satiri (migration); `EVENT_TYPES` dizisi ve eski `event_type` CHECK listesi FAZ 10'a kadar elle ayni tutulur (asama11 K1). `event_spec_versions` ekle-yalniz: duzeltme = yeni surum, gecerli surum yalniz `set_current_event_spec(uuid)`. `events`'e sorgulanacak yeni alan = sutun (jsonb `extra` icinde filtre yazilmaz). Ajans ic maliyeti/marji bu tablolara girmez (FAZ 6-7 `internal.*`). **Onay yalniz RPC ile (FAZ 4c):** uygulama `events`/`event_requirements`'a INSERT yapmaz; onaylanmis etkinlik yalniz `create_event_from_spec(p_version_id)` ile (is_current + valid surumden, atomik; ayni surumden ikinci onay 23505). Kullanicinin formda duzelttigi alanlar once `user_input` provenance ile YENI surum olur, onay o surumden; `spec_jsonb` UPDATE edilmez. Etkinlikten baslayan talep/ilan/sohbet `quote_requests.event_id` / `listings.event_id` / `conversations.event_id` tasir; bagimsiz baslayanlar NULL; eski tablolara `event_id` disinda sutun eklenmez. Prompt metni degisirse `prompt_version`, cikarim kodu degisirse `parser_version` artar (`app/lib/eventspec.ts`).

**Pazaryeri okumasi `v_providers_public`'ten (FAZ 2c).** Kesfet, kategori, /p/[id], sitemap, sihirbaz sayaci, pro-bul, teklif-topla, favoriler gibi pazaryeri LISTE/DETAY sorgulari `profiles` yerine `v_providers_public` gorunumunu okur (P1-P3 gecis sirasi `docs/envanter/14-faz2c-okuma-yolu.md` bolum 4). Yeni kod pazaryeri alanini (bio, sehir, onay, yayin, kategori, fiyat) `profiles`'tan okumaz. Kimlik (ad, avatar, rol, is_admin) ve operasyon (mesaj, rezervasyon, admin) okumalari `profiles`'ta kalir. Gorunume sutun eklemek = migration + `ProviderPublic` tipi ayni commit'te.

**`provider_id` sutunlari istemciden yazilmaz (FAZ 2b).** `services`, `portfolio_items`, `profile_experiences`, `reviews`, `favorites` tablolarindaki `provider_id` BEFORE tetikleyiciyle `profile_id`/`professional_id`'den turetilir; uygulama kodu bu sutunu INSERT/UPDATE govdesine koymaz (koysa da ezilir). `provider_services` 2c'ye kadar uygulama tarafindan okunmaz ve yazilmaz; `services` kaynak kalir, `services` fiyat/kategori/aktiflik sutunlarina dokunan her degisiklik `derive_provider_services` + `trg_faz2b_sync_services` UPDATE OF listesini gunceller.

**Yetenek havuzu (FAZ 5).** `organization_talent_records` kurulusun kendi verisidir: yalniz o kurulusun `talent.manage` uyesi yazar (RLS + `org_module_enabled(org,'talent_pool')`; modul yalniz `agency`), admin okur. Harici kisi `talents` satiri ACMAZ (`talent_id` NULL); baglama yalniz claim ile (`claim_talent_record(token)` / `_by_id`, dogrulanmis `auth.email()`). Kimlik esleme yalniz `find_talent_by_contact(org, email, phone)` ile (PII donmez, denetlenir); `talents.canonical_email/phone` kapali sutun, profillerden aynalanir. Ic oranlar yalniz `internal_talent_rate_list/upsert/close` (`commercial.view/manage`); uygulama `internal` semasina dogrudan sorgu atmaz. Davet tokeni yalniz `send_talent_record_invitation` ile (sutun istemciye kapali). **Ekibim kabulu = havuz kaydi:** `agency_members`'a yazan her yol ayni islemde `organization_talent_records` satirini da yazar (aynalama tetikleyicisi YOK — Guven karari; asama13 K5 kaymayi yakalar). `visibility` FAZ 5'te yalniz `private`. **Uygulama (P1-P3):** `/ajans/havuz` (liste, harici ekleme, davet, ic oran karti yalniz `commercial.view`), `/davet/havuz/[token]` (claim; token yalniz RPC'ye gider, tabloda aranmaz), profil bandi (`claimable_talent_records_for_me`), `/p/[id]` ve kesfet kartinda "Havuza ekle" (`talent_id` sunucuda `providers`'tan, roller `provider_services`'tan, iletisim kopyalanmaz). **Sil kurali:** yalniz aktif Ekibim uyesi kaydi (`legacy_agency_member_id` dolu + `agency_members`'ta var) silinmez; diger kayitlar `talent.manage` ile silinir, ic oranlari CASCADE ile gider. FAZ 5 KAPANDI (1 Ekim 2026) — bkz. `docs/envanter/17-faz5-yetenek-havuzu.md`.

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
Ekip uyesi basina rezervasyon YOK (FAZ 8 gorevlendirme). FAZ 7c KAPANDI (8 Ekim 2026); 7b (RFP) devam — bkz. `docs/envanter/19-faz7-ticari-katman.md`.

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

35 tablo, 148 RLS politikasi, 14 enum, 69 fonksiyon (FAZ -1 sonrasi sayim; uretim = repo zinciri). FAZ 0 ile +5 tablo (`organizations`, `organization_memberships`, `organization_invitations`, `organization_modules`, `organization_sync_log`), +5 enum — bkz. `docs/envanter/08-faz0-kiraci-temeli.md`. FAZ 1 ile `internal` semasi + `internal.access_audit` — bkz. `docs/envanter/09-faz1-internal-sema.md`. FAZ 2a ile `talents`, `providers`, `professional_profiles`, `organization_profiles` (+6 enum; `providers.id = profiles.id`; profiles hala kaynak, aynalanir) — bkz. `docs/envanter/11-faz2-saglayici-defteri.md`. FAZ 3a ile `service_roles` (taksonomi rol katmani; `roles` DEGIL — `role` kelimesi kullanici ve uyelik rolu icin dolu) + `service_categories.layer/parent_id`; 23 kategori = 23 rol, slug birebir, admin kategori eklerse rol otomatik dogar — bkz. `docs/envanter/12-faz3a-service-roles.md`. FAZ 2b ile `provider_services` (saglayici x rol; cift alan doneminde aktif `services` + `profiles.primary_category_id`'den TURETILIR, `origin` sutunu), `v_provider_roles`, ve `services`/`portfolio_items`/`profile_experiences`/`reviews`/`favorites`'ta `provider_id` (= profile_id / professional_id; tetikleyici turetir) — bkz. `docs/envanter/13-faz2b-saglayici-hizmetleri.md`. FAZ 2c ile `v_providers_public` (pazaryeri okuma SOZLESMESI: profiles pazaryeri sutunlariyla ayni adlar, kaynak providers/alt profiller/provider_services + profiles kimlik; security_invoker) — bkz. `docs/envanter/14-faz2c-okuma-yolu.md`. FAZ 4a ile `event_types` (15 tur), `event_briefs`, `event_spec_versions` (ekle-yalniz, surumlu), `events`, `event_requirements` (rol FK) + `conversations.event_id`; satir sahipligi RLS + `has_org_permission` — bkz. `docs/envanter/15-faz4a-etkinlik-eventspec.md`. FAZ 4c ile `quote_requests.event_id`, `listings.event_id` (NULL, FK SET NULL), `events_spec_version_id_key` kismi tekil indeks ve `create_event_from_spec(uuid)` RPC (SECURITY DEFINER; authenticated + service_role) — bkz. `docs/envanter/16-faz4c-yeni-talep-akisi.md`. FAZ 5 ile `organization_talent_records`, `organization_talent_record_roles`, `internal.organization_talent_rates` (+6 enum), `org_module_enabled`, `talent_pool` modulu (agency), `find_talent_by_contact`, `send_talent_record_invitation`, `claim_talent_record(_by_id)`, `decline_talent_record_invitation`, `claimable_talent_records_for_me`, `internal_talent_rate_list/upsert/close`, `faz5_backfill_agency_members` (tek seferlik dolum; `legacy_agency_member_id`), 5-DB/03 ile `ensure_talent_record_for_membership` (profesyonel kendisi / talent.manage) ve `sync_org_talent_pool` (talent.manage; havuz sayfasi acilirken) — aynalama tetikleyicisi yerine uygulama cagirir — bkz. `docs/envanter/17-faz5-yetenek-havuzu.md`. FAZ 6 ile `match_runs`, `match_candidates`, `crews`, `crew_members`, `internal.crew_member_commercials` (+7 enum), `run_event_match` (Match V0.2), `mark_match_candidates_shown/clicked`, `crew_member_commercial_snapshot`, `internal_crew_commercials_list/upsert`, `can_access_crew_row/can_access_crew` — bkz. `docs/envanter/18-faz6-eslestirme-ekip.md`. FAZ 7a ile `proposals`, `proposal_versions`, `proposal_items`, `portal_access_links`, `internal.proposal_internal_items` (+4 enum), `proposal_create/new_version/send/revoke_link/set_status`, `internal_proposal_items_list/upsert`, `can_access_proposal_row/can_access_proposal/can_access_proposal_version/is_proposal_buyer`, portal `portal_proposal_view/approve/request_revision` (anon + authenticated), 7a-DB/02 ile `proposals_delete` politikasi — bkz. `docs/envanter/19-faz7-ticari-katman.md`. FAZ 7c ile `bookings` + `buyer_organization_id`, `seller_provider_id`, `event_id`, `crew_member_id`, `proposal_version_id` (nullable; eski 4 sutun nullable; `bookings_shape_check`; surum basina tekil), `can_access_booking_row`, `booking_from_proposal`, `portal_proposal_view` -> `has_booking` — bkz. `docs/envanter/19-faz7-ticari-katman.md` bolum 11.

**Kullanici rolleri (dort, degismez):** `client`, `professional`, `business`, `agency`

`profiles` tablosu bugun uc isi birden yapiyor: kullanici kimligi, pazaryeri profili ve kurulus hesabi. Goc bunlari ayiriyor. Ayrinti: `04-goc-plani.md`

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
