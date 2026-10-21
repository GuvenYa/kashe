# 20 — FAZ 8: Event OS modulleri (uyelik rolleri, gorevler + aktivite, CRM, tedarikciler, Buyer Workspace)

**Kaynak plan:** `04-goc-plani.md` FAZ 8 madde 37-38; `01-veri-modeli.md` bolum 10 (`crm_leads`, `contacts`, `suppliers`, `tasks`,
`activity_logs`); `05-arayuz-modeli.md` (Buyer Workspace, modul anahtarlari, alici asla Talent Pool / ic maliyet / marj gormez);
`08-faz0-kiraci-temeli.md` (uyelik, davet, `organization_modules`, `org_role_permissions`); `19-faz7` bolum 12 acik kalemler
(uyelik rol degistirme arayuzu). TUBITAK: Event OS modulleri CRM, Events, Crew, Talent Pool, Suppliers, Commercial, Operations, Finance,
Insights; BKM Mutfak niyet mektubu "musaitlik, gorev, teklif ve butceyi tek projede takip" — bu fazin ilk dilimi "gorev"i kapatir.
**Durum:** 8-U KAPANDI (20 Ekim); 8a-DB/01 + hijyen_03 + 8a-DB/02 uretimde; **8a-P1 + D1b-1 KAPANDI (21 Ekim) — FAZ 8a KAPANDI**; tasarim dili v2 KAPANDI (D1-D4, 21 Ekim; `22-tasarim-dili-v2.md`); **8b-DB/01 + 8b-P1 KAPANDI (21 Ekim) — FAZ 8b KAPANDI** (§4); sirada **8c** (§5). Sira: 8-U (uyelik rolleri) -> **8a** (gorevler + aktivite) -> 8b (CRM) -> 8c (tedarikciler + Buyer
Workspace). Her dilim: migration -> dal (asama4 + asama18) -> uretim -> Claude Code uygulama -> canli tur -> kapanis notu.

## 1. Kararlar (Guven, 19 Ekim 2026)

1. **Ilk dilim gorevler + aktivite gecmisi** (`tasks`, `activity_logs`); CRM ve tedarikciler sonra.
2. **Uyelik yonetimi arayuzu once, kucuk dilim (8-U):** rol degistirme bugun yalniz SQL ile; kurumsal pilotta sart.
3. **Gorevler hem etkinlige bagli hem kurulus geneli** (`event_id` NULL olabilir): etkinlik sayfasinda "Gorevler" bolumu + kurulus genelinde
   "Gorevler" listesi.
4. **Kurumsal alici (business) da gorev modulunu kullanir — modul anahtariyla** (`organization_modules.tasks`; ajansta varsayilan acik,
   aliciyi owner/admin acar). Alici asla Talent Pool / ic maliyet / marj gormez (05).

## 2. 8-U — Uyelik rolleri arayuzu

**Bugun:** uyeler eski tablolarda (`agency_members` / `business_members`, roller owner/manager/member) yonetiliyor (`/profil/ekibim`,
`/profil/kurumsal-ekip`); FAZ 0 aynalama tetikleyicileri `organization_memberships`'e yazar (`map_legacy_member_role`: owner->owner,
manager->admin, diger->viewer). Ince roller (sales, project_manager, crew_coordinator, finance) yalniz SQL ile veriliyor ve **eski satir her
guncellendiginde ayna `role = EXCLUDED.role` ile ince rolu EZIYOR** (`fn_sync_agency_member` / `fn_sync_business_member`, ON CONFLICT DO UPDATE).

**8-U-DB/01 (`20261020120000_faz8u_01_uyelik_rolu.sql`):**
- Ayna tetikleyicileri: ON CONFLICT DO UPDATE'te `role` yalniz **eski rol gercekten degistiyse** yazilir
  (`CASE WHEN TG_OP = 'UPDATE' AND NEW.member_role IS NOT DISTINCT FROM OLD.member_role THEN organization_memberships.role ELSE EXCLUDED.role END`);
  INSERT'te eskisi gibi. Boylece ince rol, eski satirdaki alakasiz guncellemelerde (ad, durum) korunur.
- RPC `org_member_set_role(p_membership_id uuid, p_role public.organization_member_role) RETURNS boolean` (SECURITY DEFINER; assert
  `members.manage`): kurallar — (a) kendi rolunu degistiremez; (b) `owner`/`admin` vermek ya da bir owner/admin'in rolunu dusurmek yalniz
  **owner** yetkisi; (c) son aktif owner dusurulemez (22023); (d) uyelik `active` degilse 22023. Islem sirasi: once **eski tablo**
  (`legacy_source`'a gore `agency_members` / `business_members`; `map_org_role_to_legacy`: owner->owner, admin->manager, diger->member) sonra
  `organization_memberships.role` (ayna AFTER tetikleyicisi once calisir, RPC'nin son yazimi gecerli kalir). `internal.log_access(org, 'write',
  'organization_memberships', id, {op:'member.set_role', from, to})`.
- `organization_memberships` UPDATE yetkisi uygulamaya VERILMEZ (tek yol RPC). Yeni tablo/sutun yok.
- asama4 **T25**: owner sales verir -> ince rol; eski satirda ad guncellemesi -> rol korunur (ayna ezmez); admin owner veremez (42501/22023);
  son owner dusurulemez; kendi rolu 22023; viewer RPC 42501. asama18 (yeni, FAZ 8 kontrol): K1 RPC yetkisi (authenticated var, anon yok),
  K2 ayna fonksiyon govdesi CASE icerir, K3 tutarsizlik: org owner/admin olup eski tabloda member olan (0), K4 bilgi: ince rollu uyelik sayisi.

**8-U-P1 (Claude Code):** `/profil/ekibim` ve `/profil/kurumsal-ekip` uye satirlarina **"Kurulus rolu"** secimi (7 rol; etiketler: Sahip,
Yonetici, Satis, Proje yoneticisi, Ekip koordinatoru, Finans, Izleyici; yaninda kisa yetki ozeti). Yalniz `members.manage` olan gorur;
kendi satirinda ve (owner degilse) owner/admin satirlarinda devre disi. Degisiklik -> `org_member_set_role` -> satir yenilenir; hata
metinleri RPC'den Turkce. Davet/cikarma eski akista kalir (FAZ 10'da tek tabloya iner). Test verisi: fbguvenfb'nin `sales` rolu bu arayuzle
gorulur.

**8-U KAPANDI (20 Ekim 2026).** DB: `20261020120000_faz8u_01_uyelik_rolu.sql` dal + uretim; dal asama4 26/26 (yeni **T25**),
asama18 K1-K3 ESIT (dal K4 3 test verisi; uretim K4 1 = fbguvenfb `sales`, K5 0). P1: commit `0cd83d7` — `app/lib/org-roles.ts` (tek kaynak:
`ORG_ROLES`, `ORG_ROLE_LABELS`, `ORG_ROLE_SUMMARIES`; ozetler `org_role_permissions` dizisinin Turkce karsiligi), `app/lib/org-actions.ts`
(`setOrgMemberRole` -> `org_member_set_role`; RPC metinleri Turkceye eslenir), ortak `app/components/ui/kurulus-rol-secici.tsx` (7 rol,
`owner` secimi satir ici onay "Sahip yapilsin mi? Onayla / Vazgec", ayna satiri yoksa 'viewer' + uyari), iki ekip sayfasi uyelik rolunu
`organization_memberships`'ten okur; eski rol rozeti kalkti; davet formunda "Katildiktan sonra kurulus rolunu uye kartindan inceltebilirsin."
**Canli tur (yeni yontem: Guven uygulama ici tarayicida giris yapar, Claude turu surer; sifre paylasilmaz):** `/profil/ekibim` (Sunucu Ajans
sahibi) — fbguvenfb "Satis" ilk kez arayuzde; hotmail Izleyici -> Proje yoneticisi (kaydedildi, yenilemede kaldi; SQL `project_manager` /
eski rol `member`) -> Sahip secimi onay kutusu -> Vazgec -> Izleyici. `/profil/kurumsal-ekip` (Test Guven sahibi) — hotmail Yonetici ->
Finans (SQL `finance` / eski rol `manager` -> `member`) -> Yonetici (SQL `admin` / `manager`). `internal.access_audit` 4 satir
(`member.set_role` from/to). Konsol hatasi yok; mobil duzen tamam. asama18 uretim K1-K3 ESIT, K4 1, K5 0.
**Kozmetik (bir sonraki Claude Code gorevine eklenir):** (1) `KurulusRolSecici` koku `min-w-[190px]`, ust siniri yok: uzun ozet (Yonetici)
kutuyu genisletip ad sutununu eziyor (ad "T" kaldi) — kok `min-w-0 flex-1 sm:flex-none sm:w-[280px]`, ad blogu `min-w-0`; (2) kurumsal
(alici) yuzeyde ozetlerde "havuz" geciyor — alici Talent Pool gormez; `yuzey: 'ajans' | 'kurumsal'` ile havuz ifadesi gizlenir;
(3) ~800px genislikte iki kartin rol kutusu ayni hizada baslamiyor (1 ile birlikte cozulur). Davet/cikarma eski akista (FAZ 10).

## 3. 8a — Gorevler + aktivite gecmisi

**8a-DB/01 (`20261021120000_faz8a_01_gorevler.sql`):**
- Enum `task_status` (todo, in_progress, blocked, done, cancelled).
- `tasks`: id, organization_id NOT NULL (CASCADE), event_id NULL (events, SET NULL), crew_id NULL (crews, SET NULL), title 2-200, description
  <= 4000, status DEFAULT todo, assignee_user_id NULL (profiles), assignee_talent_record_id NULL (organization_talent_records; yalniz ajans),
  due_at timestamptz NULL, is_milestone boolean DEFAULT false, depends_on_task_id NULL (tasks, SET NULL; ayni kurulus — tetikleyici),
  sort_order int, created_by, completed_at (status done olunca tetikleyici doldurur), created_at/updated_at. Indeksler: (organization_id,
  status), (event_id), (assignee_user_id) WHERE status <> done.
- `activity_logs`: id bigint, organization_id, actor_user_id NULL, entity_type text (task | event | proposal | rfp | booking | membership …),
  entity_id uuid, action text (created | updated | status_changed | assigned | deleted …), diff jsonb, created_at. INSERT yalniz tetikleyici /
  RPC (uygulamaya INSERT yok); SELECT kurulus uyesi (`events.view`). 8a'da yazan: `tasks` AFTER INSERT/UPDATE/DELETE tetikleyicisi
  (`fn_faz8a_task_activity`: degisen alanlarin eski/yeni degeri `diff`e). Diger varliklar sonraki dilimlerde baglanir (FAZ 7 RPC'leri
  `internal.log_access` yaziyor — o erisim denetimi, bu kullaniciya gorunen akis; ikisi ayri kalir).
- Yetki/RLS: **tasks.* anahtari EKLENMEZ**; gorevler etkinlik operasyonudur -> `events.view` okur, `events.manage` yazar (`org_role_permissions`
  degismez). Ek kapi: `org_module_enabled(org, 'tasks')` — RLS'te DEGIL (RLS yalniz yetki), uygulama kapisinda ve RPC'siz dogrudan yazimda
  tetikleyiciyle (`tasks` BEFORE INSERT: modul kapaliysa 22023). Ajans kuruluslarinda `tasks` modulu **varsayilan acik** (FAZ 5 talent_pool
  deseni: mevcut ajanslara dolum + yeni ajansa tetikleyici); business icin kapali, owner/admin acar (`settings.manage`).
- Yazim yolu: FAZ 7'nin aksine **RPC degil, RLS altinda dogrudan CRUD** (ticari risk yok; PostgREST ile sade): INSERT/UPDATE/DELETE
  `events.manage`; `organization_id` sabit (tetikleyici); `assignee_talent_record_id` ayni kurulusun havuz kaydi olmali (tetikleyici);
  `assignee_user_id` ayni kurulusun aktif uyesi olmali (tetikleyici). Silme yalniz `todo`/`cancelled` durumunda (aksi 22023) — bitmis gorev
  gecmisi korunur.
- Bildirim: atama ve `blocked` -> `notifications` (type **`task`**; `notifications_type_check` genisler; Edge Function liste `rfp, proposal,
  task`). Atanan kisi uyeyse bildirim; havuz kaydiysa yok (hesabi olmayabilir).
- asama4 **T26**: ajans owner gorev acar (etkinlikli + etkinliksiz), uyeye atar (bildirim), havuz kaydina atar, durum done -> completed_at,
  activity_logs 3+ satir diff'li, viewer yazamaz (42501), baska kurulusun etkinligine baglayamaz (22023), done gorev silinemez (22023), modul
  kapali business'ta INSERT 22023, modul acilinca gecer; anon 42501. asama18 K5-K10 (tablo/enum/politika/yetki/tutarsizlik: tamamlanmis
  gorevde completed_at bos (0), atanan uye kurulus disi (0)).

**8a-DB/01 + hijyen_03 + 8a-DB/02 KAPANDI (21 Ekim 2026):** `20261021120000_faz8a_01_gorevler.sql` plandaki gibi (enum, `tasks`,
`activity_logs`, kural/silme/aktivite tetikleyicileri, RLS events.view/manage, ajansta `tasks` modulu dolum + `fn_faz5_default_modules`
genisledi, `notifications_type_check` + e-posta indeksi `task`) ve plana ek: **`org_module_set(org, key, enabled)`** RPC (settings.manage;
yalniz tasks/crm/suppliers; `internal.log_access` `module.set`) — kurumsal sahibin modulu acabilmesi icin yazma yolu yoktu; kademeli silme
(kurulus/etkinlik silinirken RI) `pg_trigger_depth() > 1` ile serbest, aktivite yazilmaz; bildirim baglantisi etkinlikli gorevde
`/etkinliklerim/<id>?sekme=gorevler`, genelde `/kurulus/gorevler?gorev=<id>`; engellendi bildirimi olusturana + atanana (islemi yapan haric).
`20261021110000_hijyen_03_kurulus_karsi_taraf.sql`: `organizations_public` gorunumu (id/slug/ad/tur; security_invoker=false; authenticated)
— alici/satici karsi tarafin adini okur (21-tarama P6); eski ASCII bildirim metinleri duzeltildi (K14). `20261021130000_faz8a_02`:
Guven karari (21 Ekim) — kurulus sahiplerinin kurulussuz eski etkinlikleri kurulusa atfedildi (gosterge/gorev/RFP gorsun; uyeler gorur).
Yerel 2x idempotan; asama4 **28/28** (T26 gorevler: kurallar 22023/23514, done silinmez, atama/engellendi bildirimi, crew_coordinator okur
yazamaz, viewer/anon 42501, aktivite yalniz tetikleyici, business modul kapisi + org_module_set, etkinlik silinince event_id NULL; T27
organizations_public); asama18 K6-K15 ESIT dal + uretim, K16 0, K18 0. Siradaki: 8a-P1 (`23-claude-code-gorevi-8a-p1-gorevler.md`, dal
`tasarim/d1b-8a`, D1b-1 etkinlik sayfasi sekmeli ile birlikte).

**8a-P1 (Claude Code):** `/kurulus/gorevler` (kurulus genel liste; filtre: etkinlik, durum, atanan, "bana atanan"; hizli ekle; durum degistir;
atama: uye listesi + ajansta havuz kayitlari; son tarih; kilometre tasi rozeti; bagimlilik secimi), etkinlik sayfasinda **Gorevler** bolumu
(ayni bilesen, etkinlige sabit) ve **Aktivite** akisi (activity_logs: etkinlik + gorevleri), menu "Gorevler" (modul acik + events.view),
bildirim etiketi `task`, business icin Ayarlar/Moduller karti ("Gorevler" ac/kapat; `settings.manage`). Alici yuzeyinde havuz atamasi hic
render edilmez. Tarihler Istanbul (`app/lib/tarih.ts`), tarih kutulari `takvimiAc`.

**8a-P1 + D1b-1 KAPANDI (21 Ekim 2026; dal `tasarim/d1b-8a`, onizleme turu Claude):** Gorevler + Aktivite arayuzu plandaki gibi:
`app/lib/gorevler.ts` (durum/etiket/aktivite cumlesi/hata eslemesi), `gorev-data.ts`, `gorev-actions.ts` (dogrudan tablo, RLS; 0 satir = yetki
hatasi), `modul-actions.ts` (`org_module_set`), `app/components/gorevler/*` (liste + hizli ekle + filtreler + satir menusu, form, aktivite
akisi, modul kapali), `/kurulus/gorevler` (KPI: acik · bana atanan · gecikmis · bu hafta biten), `/kurumsal/ayarlar` (Moduller: Gorevler
ac/kapat, iki yonlu onay), etkinlik sayfasi panel kabugunda sekmeli (ajans: Genel · Adaylar · Ekip · Gorevler · Aktivite; kurum: Genel ·
Gorevler · Aktivite — Adaylar/Ekip/ic maliyet yok; kisisel etkinlik eski duzen), Genel'de "Teklif talebi ac" birincil dugme + etkinligin
RFP'leri, gostergelerde Acik/Gecikmis gorev kutulari, `/profil` "Bana atanan", yan menuye Gorevler + Ayarlar, bildirim etiketi GOREV, Edge
Function `task` tipi. Claude Code sapmalari (10) kabul; Claude duzeltmesi: `zamanCoz` dilimsiz `datetime-local` degerini Istanbul (+03:00)
sayar (sunucu UTC'de 3 saat kayiyordu). **Tur:** gmail — lansmanda "Sahne kurulumu" (atama Test Pro, 15 Kas 10:00, kilometre tasi),
Yapilacak → Devam ediyor → Engellendi → Tamamlandi, done silme DB'den "Yalniz yapilacak ya da iptal..." ile red, Aktivite 6 satir,
`/kurulus/gorevler` KPI 1/0/0/1, `/ajans` lansman artik yaklasan etkinliklerde (DB/02). hotmail — bildirimler "Sana gorev atandi" +
"Gorev engellendi" (GOREV), baglanti sekmeye dusuyor, izleyici salt okunur. testguven — Adaylar/Ekip yok, "Teklif talebi ac" + RFP listesi,
Gorevler sekmesi "modul kapali → Ayarlar'dan ac", ayarlardan ac → gorev eklendi → kapat (gorev kaldi). Konsol 0.
**Kucuk bulgular (D1b-2 gorevine):** (1) bagimlilik yokken satirda bos "↳ 'ten sonra" eki; (2) etkinlik basligi rozet/CTA ile ayni satirda
sikisip kelime kelime iniyor — rozetler altta; (3) hizli ekle "Kaydediliyor..." 6-8 sn (5 yol revalidate) — iyimser ekleme; (4) aktivite
"Test Pro'ye atadi" — ek yerine "atanan: Test Pro" kalibi; (5) filtre listesinde uye/havuz kaydi ayni adla (form eki filtreye); (6) `/profil`
"Bana atanan" karti acik gorev 0 iken gizli — bos durumla gorunsun; (7) yan menude ayni href'li maddeler (Etkinlikler) iki grupta birden
aktif; (8) cok kurulus uyesinde alt hesap karti o anki kurulusu gosteriyor (kisi adi yok).

## 4. 8b — CRM

**Kararlar (Guven, 21 Ekim 2026):** 5 asama (new · contacted · proposal_sent · won · lost); yeni yetki anahtarlari `crm.view` / `crm.manage`
(sahip/yonetici/satis yazar; proje yoneticisi/finans okur; ekip koordinatoru/izleyici gormez; `permissions` jsonb ince ayari calisir); modul
`crm` yalniz ajansta, varsayilan ACIK (business'ta kapali; sahip `org_module_set` ile acabilir ama UI yok).

### 8b-DB/01 KAPANDI (21 Ekim 2026) — `20261022120000_faz8b_01_crm.sql` (dal + uretim)

Nesneler: enum `crm_lead_stage`; `org_role_permissions` + crm.*; `contacts` (kind person/company, full_name 2-200, company_name,
email (kucuk harf + kirpma, kurulus icinde tekil — `contacts_org_email_uidx`), phone, notes ≤4000, linked_user_id, linked_organization_id
(kendi kurulusu olamaz), created_by, timestamps); `crm_leads` (contact_id RESTRICT, title 2-200, stage, estimated_value ≥0, currency TRY,
expected_date, owner_user_id (aktif uye), next_step ≤500 + next_step_at, event_id / proposal_id (ayni kurulus / satici kurulus; SET NULL),
lost_reason, won_at / lost_at asamayla); `proposals.buyer_contact_id` FK contacts (SET NULL) + satici kurulus kurali (`trg_faz8b_proposal_contact_validate`),
`GRANT UPDATE (buyer_contact_id)`; firsat teklife baglaninca teklifin bos `buyer_contact_id`'si kisiyle dolar; gorunum `crm_contact_suggestions`
(security_invoker; seller kurulusun client_email'li, kisisiz teklifleri); tetikleyiciler `fn_faz8b_contact_validate/activity`,
`fn_faz8b_lead_validate/activity` (modul kapisi 22023 'crm modulu bu kurulusta kapali', kurulus sabit, kisi/etkinlik/teklif/sahip ayni kurulus
22023, aktivite entity `contact`/`lead` — e-posta/telefon diff'e YAZILMAZ (yalniz `true`), sahibe atama bildirimi tip `crm` →
`/ajans/musteriler?firsat=<id>` 'Sana fırsat atandı: …'); `activity_logs_entity_type_check` + contact/lead; `notifications_type_check` + crm;
e-posta kuyrugu indeksi crm dahil; RLS SELECT crm.view (admin dahil), INSERT/UPDATE/DELETE crm.manage; modul dolumu + `fn_faz5_default_modules`
(talent_pool, tasks, crm). asama4 **T28** (oneri gorunumu, normalizasyon/tekillik, bildirim, teklif bagi, 7 kural 22023, asama zaman damgalari,
PII diff, sales/finance/crew_coordinator/viewer/anon yetkileri, ince ayar, business modul, silme/RESTRICT/SET NULL) — 29/29; asama18
**K19-K23** ESIT, K24 bilgi; dalda ve uretimde beklendigi gibi (Guven).

### 8b-P1 KAPANDI (21 Ekim 2026; dal `faz8b/p1`, onizleme turu Claude) — `31-claude-code-gorevi-8b-p1-crm.md`

CRM arayuzu plandaki gibi: `app/lib/crm.ts` (asama/tur etiketleri, hata eslemesi, `CRM_GOREN_ROLLER`), `crm-data.ts`, `crm-actions.ts`
(dogrudan tablo, RLS; kural kopyalamaz), `app/components/crm/*` (kisi formu/duzenleme, firsat formu, firsat panosu 5 sutun + panel
`?firsat=` — alandan cikinca kaydet, kisi arama, oneri seridi, modul kapali), `/ajans/musteriler` (KPI: acik firsat · beklenen tutar · bu ay
kazanilan · kisi; sekmeler Firsatlar/Kisiler; formlar `?yeni=kisi|firsat`), `/ajans/musteriler/[id]` (firsatlar, teklifler, aktivite, bilgiler,
silme korumasi), yan menu "Musteriler" (`crmEnabled && crm.view`), rol ozetleri, bildirim etiketi FIRSAT, teklif basliginda "Kisi: … →" +
"Kisi olarak ekle", `/ajans` "Acik firsat" KPI, org-context `crmEnabled/canViewCrm/canManageCrm`. Edge Function `send-message-notification`
tip listesine `crm` eklendi (konu "Firsat · …") — yeniden dagitim gerekir.
**Claude duzeltmeleri (tur sirasinda):** (1) panelde "Adim tarihi" duzenlenemiyordu (yalniz metin) — `datetime-local` alani (+03:00 cevirisi
`yerelGirdi`), gecikmisse "Gecikti · …"; (2) `KpiKutu` uzun metin degerler ("45.000 TL") 375 px'te iki satira boluyordu — `sm` altinda `text-2xl`;
(3) oneri seridi gecersiz e-postali teklifi listeliyor, tiklayinca "Teklifte gecerli bir e-posta yok" — sorguya `.like('client_email','%@%')`;
(4) CRM'i goremeyen uye (izleyici) firsat sahibi secilebiliyordu — bildirimi aliyor ama baglanti 403'e dusuyordu; sahip secenegi
`crm.view` olmayan roller icin kapali + "· CRM yetkisi yok" (mevcut sahip gorunur kalir). DB tetikleyicisine ayni kural 8b-P2'de.
**Tur:** gmail (Sunucu Ajans) — Yeni kisi (Deneme Musteri, firma, e-posta, telefon, not) → Kisiler 1; Yeni firsat (kisi secimi, 45.000 TL,
20 Kas, sahip Test Pro, sonraki adim + adim tarihi, etkinlik bagi) → pano "Yeni"; panelde asama → Iletisimde (sutun degisti, aktivite satiri);
adim tarihi 28 Eki 14:30 kaydedildi; oneri "Kisi olarak ekle" → kisi olustu, teklif `buyer_contact_id` doldu, teklif basliginda "Kisi: Deneme
Musteri →"; kisi sayfasi (firsat karti, teklif, 3 aktivite, silme korumasi "once firsatlari sil"); `/ajans` KPI 1; 375 px panel tam ekran,
tasma 0. hotmail (izleyici) — menude Musteriler yok, `/ajans/musteriler?kurulus=…` "Bu sayfayi gormek icin yetkin yok", bildirim "Sana firsat
atandi: Lansman sahne ekibi · FIRSAT". Firsat sil → KPI 0; iki deneme kisisi silindi (teklif `buyer_contact_id` SET NULL). Konsol 0.
**Kucuk bulgular (8b-P2'ye):** (1) teklif secim listesinde ayni baslikli iki teklif ayirt edilemiyor (etikete tarih/durum); (2) sahip
`crm.view` kurali DB tetikleyicisine (`fn_faz8b_lead_validate`); (3) panelde alt kosedeki asama rozeti (dialog sonu) islevsiz — kaldirilabilir;
(4) hotmail'deki "Sana firsat atandi" bildirimi firsat silinince kaliyor (baglanti artik olmayan kayda gider) — kayit silinince bildirimi
temizleme (genel kalem; gorev/teklif bildirimleri icin de dusunulur).

## 5. 8c — Tedarikciler + Buyer Workspace (plan; sonra)

`suppliers` (kurulus bazli defter) ve alici icin `procurement_requests` / `supplier_shortlists` (madde 38; `rfps` 7b ile geldi). Alici menusu
(05): Events, RFP, Tedarikci Arama, Teklif Karsilastirma (7b-P2 ile var), Butce, Onaylar, Sozlesmeler, Raporlama — hangi parcalarin FAZ 8'e,
hangilerinin FAZ 9+'a kalacagi dilim acilinca kararlastirilir.

## 6. Acik sorular (dilim acilirken)

- Gorevlerin musaitlik/takvimle (`/takvimim`) iliskisi: 8a'da yok; "ekip uyesi basina rezervasyon" FAZ 8 gorevlendirme kalemiyle birlikte.
- Insan onayli operasyon asistani (TUBITAK): gorev onerisi ureten yapay zeka katmani 8a'nin ustune gelir (FAZ 9 ile); 8a veri modelini
  buna gore acik tutar (`tasks.source` sutunu 8a'da YOK — gerekince eklenir; `activity_logs` zaten "kim/ne/ne zaman").
- Eski `agency_members`/`business_members` tek tabloya inisi FAZ 10 (madde 44); 8-U bunu one almaz.
