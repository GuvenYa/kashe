# 20 — FAZ 8: Event OS modulleri (uyelik rolleri, gorevler + aktivite, CRM, tedarikciler, Buyer Workspace)

**Kaynak plan:** `04-goc-plani.md` FAZ 8 madde 37-38; `01-veri-modeli.md` bolum 10 (`crm_leads`, `contacts`, `suppliers`, `tasks`,
`activity_logs`); `05-arayuz-modeli.md` (Buyer Workspace, modul anahtarlari, alici asla Talent Pool / ic maliyet / marj gormez);
`08-faz0-kiraci-temeli.md` (uyelik, davet, `organization_modules`, `org_role_permissions`); `19-faz7` bolum 12 acik kalemler
(uyelik rol degistirme arayuzu). TUBITAK: Event OS modulleri CRM, Events, Crew, Talent Pool, Suppliers, Commercial, Operations, Finance,
Insights; BKM Mutfak niyet mektubu "musaitlik, gorev, teklif ve butceyi tek projede takip" — bu fazin ilk dilimi "gorev"i kapatir.
**Durum:** 8-U KAPANDI (20 Ekim); 8a-DB/01 + hijyen_03 + 8a-DB/02 uretimde; **8a-P1 + D1b-1 KAPANDI (21 Ekim) — FAZ 8a KAPANDI**; tasarim dili v2 KAPANDI (D1-D4, 21 Ekim; `22-tasarim-dili-v2.md`); sirada **8b CRM** (§4). Sira: 8-U (uyelik rolleri) -> **8a** (gorevler + aktivite) -> 8b (CRM) -> 8c (tedarikciler + Buyer
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

## 4. 8b — CRM (plan; sonra)

`contacts` (person/company; kurulus bazli; e-posta/telefon kurulus ici — PII kurali: baska kurulus okuyamaz) + `crm_leads` (asama, tahmini
deger, beklenen tarih, sahip, sonraki adim). Baglar: lead -> brief/event -> proposal (`proposals.client_name/email` ile eslesme onerisi). Ajansa
ozel (`crm` modulu). Sayfa `/ajans/musteriler`. Detay dilim acilinca.

## 5. 8c — Tedarikciler + Buyer Workspace (plan; sonra)

`suppliers` (kurulus bazli defter) ve alici icin `procurement_requests` / `supplier_shortlists` (madde 38; `rfps` 7b ile geldi). Alici menusu
(05): Events, RFP, Tedarikci Arama, Teklif Karsilastirma (7b-P2 ile var), Butce, Onaylar, Sozlesmeler, Raporlama — hangi parcalarin FAZ 8'e,
hangilerinin FAZ 9+'a kalacagi dilim acilinca kararlastirilir.

## 6. Acik sorular (dilim acilirken)

- Gorevlerin musaitlik/takvimle (`/takvimim`) iliskisi: 8a'da yok; "ekip uyesi basina rezervasyon" FAZ 8 gorevlendirme kalemiyle birlikte.
- Insan onayli operasyon asistani (TUBITAK): gorev onerisi ureten yapay zeka katmani 8a'nin ustune gelir (FAZ 9 ile); 8a veri modelini
  buna gore acik tutar (`tasks.source` sutunu 8a'da YOK — gerekince eklenir; `activity_logs` zaten "kim/ne/ne zaman").
- Eski `agency_members`/`business_members` tek tabloya inisi FAZ 10 (madde 44); 8-U bunu one almaz.
