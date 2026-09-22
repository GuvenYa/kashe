# 08 — FAZ 0: Kiraci temeli (organizations)

**Baslangic:** 15 Eylul 2026 (profiles PII kapanisindan sonra; goc planinin ilk fazi)
**Durum:** KAPANDI (01-03 15 Eylul, 04 22 Eylul uretimde; commit `77b1342`). Kapanis kaydi bolum 8 (01-03) ve bolum 9 (04).
**Kaynak belgeler:** `docs/architecture/01-veri-modeli.md` bolum 1, `02-guvenlik-modeli.md` bolum 4-5, `04-goc-plani.md` "FAZ 0".

---

## 1. Amac ve sinir

Kurulus (ajans / kurum) bugun rolu `agency`/`business` olan bir **profil satiri**. FAZ 0, kurulusa kendi
kimligini verir: `organizations`, `organization_memberships`, `organization_invitations`,
`organization_modules`. **Goc yok, yalniz ekleme.** Hicbir okuma yolu, politika metni veya uygulama
kodu degismez; eski tablolar (`agency_members`, `business_members`, `agency_invitations`,
`business_invitations`) aynen calisir ve yeni tablolara **veritabani tetikleyicileriyle aynalanir**.

Yeni tablolar FAZ 0'da uygulama tarafindan okunmaz veya yazilmaz. Amac: uretimde dolu, senkron ve
dogrulanmis bir kiraci katmani olusturmak; FAZ 1 (internal sema) ve FAZ 8 (Event OS) bunun uzerine kurulur.

## 2. Kararlar (15 Eylul, Guven onayi)

| Konu | Karar | Gerekce |
|---|---|---|
| Dolum | Ayri, idempotan migration dosyasi (`03_dolum`) zincirde | Dal ve uretim ayni dosyayi kosar; bos dalda sifir satir yazar. FAZ -1'in "veri degistirmez" kurali onarim dosyalari icindi; FAZ 0 plani dolumu acikca icerir |
| `subscription_tier` tipi | Mevcut `premium_tier` enum'u (none/premium/plus/agency) | 01-veri-modeli yeni enum (trial/starter/pro/enterprise) yaziyordu, 04-goc-plani "premium_tier kopyalanir" diyordu; celisti. Deger kayipsiz kopyalanir, esleme uydurulmaz; paket adlari netlesince ayri migration'la yeniden adlandirilir. `profiles.premium_tier` simdilik kaynak kalir |
| Cift yazma | Veritabani tetikleyicisi (eski tablo -> yeni tablo, AFTER, SECURITY DEFINER) | Uygulama kodu hic degismez; davet-kabul tetikleyicisi otomatik kapsanir. Hata eski akisi KESMEZ, `organization_sync_log`'a duser |
| Yetki fonksiyon gecisi | Ayri dosya (`04`), tutarlilik kontrolu birkac gun sifir gosterdikten sonra | 25 politika `has_business_role`/`is_business_member`'a bagli; geri alma tek dosya |

Uygulama sirasinda alinan tasarim kararlari (belgelere islendi):

- **`organizations.legacy_profile_id`** (unique): kurulusun turetildigi profil. Aynalama ve uyumluluk gorunumleri
  bu alanla eslesir; `owner_user_id` ileride devredilebilir, bu alan degismez. FAZ 0'da ikisi ayni degerdir.
- **Ayni id:** `organization_memberships.id = agency_members.id / business_members.id`,
  `organization_invitations.id = eski davet id`. Aynalama anahtari; ek eslestirme tablosu gerekmez.
  Kurucu uyeligi (`legacy_source = 'owner_seed'`) eski tablolarda karsiligi olmayan yeni satirdir.
- **Rol eslemesi:** `owner -> owner`, `manager -> admin`, `member -> viewer` (01 bolum 1). Ters yon
  (gorunumler icin): `owner -> owner`, `admin -> manager`, digerleri `-> member`.
- **Izin anahtarlari:** 02 bolum 4'teki 11 anahtar + matrisi ifade etmek icin 4 ek: `talent.view`,
  `proposals.view`, `proposals.manage`, `billing.manage`. "admin: ayarlar kismi" = `billing.manage` yalniz
  owner'da. `commercial.view` = ic maliyeti gorme; `sales`/`project_manager` teklif hazirlar
  (`proposals.*`) ama `commercial.view` almaz.
- **Yetki:** `anon` yeni tablolara HIC erisemez. `authenticated` yalniz SELECT; `organizations`'ta sutun
  listesiyle (`tax_number`, `billing_email` disarida — profiles PII dersi). Istemciden yazma yolu YOK
  (FAZ 8'e kadar); yazma yalniz tetikleyiciler ve dolum. `organization_modules` bos (Event OS ile dolar).
- **Tespit:** 04-goc-plani "iki uyelik tablosu birebir ayni yapida" diyordu; `agency_members` sutunu
  `professional_id`, `business_members` sutunu `member_user_id`. Aynalama iki ayri fonksiyonla yapildi.
  `agency_members`'i dogrudan okuyan tek politika var: `bookings."Assigned pros read team bookings"`.

## 3. Dosyalar

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260915150000_faz0_01_kiraci_tablolari.sql` | 5 enum; `organizations`, `organization_memberships`, `organization_invitations`, `organization_modules`, `organization_sync_log`; indeksler; REVOKE/GRANT; RLS acik |
| `supabase/migrations/20260915150100_faz0_02_fonksiyonlar_aynalama.sql` | rol esleme, `organization_id_for_profile`, `ensure_organization_for_profile`, `is_org_member`, `org_role_permissions`, `has_org_permission`, 5 SELECT politikasi, `log_org_sync_error`, 5 aynalama tetikleyicisi (profiles, agency_members, business_members, agency_invitations, business_invitations), `v_agency_members` / `v_business_members` (security_invoker) |
| `supabase/migrations/20260915150200_faz0_03_dolum.sql` | VERI YAZAR: profiller -> kuruluslar + kurucu; uyelikler ve davetler ayni id ile. Idempotan |
| `supabase/migrations/20260922100000_faz0_04_yetki_fonksiyon_gecisi.sql` (15-22 Eylul arasi `docs/envanter/bekleyen/20260915150300_...` adiyla bekledi) | ZINCIRDE (22 Eylul). `has_business_role`, `is_business_member`, `is_business_member_of_request` govdeleri yeni tablodan okur (imza ayni); yeni `is_agency_member`; bookings politikasi yeniden yazilir |
| `docs/envanter/asama5-faz0-tutarlilik.sql` | SALT OKUNUR, dal + uretim: 14 kontrol (K1-K8), hepsi ESIT olmali |
| `docs/envanter/asama4-davranis-testi.sql` | T8 (FAZ 0) ve T9 (04; uygulanmamissa ATLANDI) eklendi; T0 temizligi kurum/uye sabitlerini de siler |

Yerel zincir (46 dosya + PII 2a/2b) uzerinde: 01/02/03/04 ikiser kez kosuldu (idempotan), T0-T9 10/10 GECTI
(04 uygulanmadan T9 ATLANDI, uygulandiktan sonra GECTI), tutarlilik 14/14 ESIT, `organization_sync_log` bos.
T8 mutasyon testi: aynalama tetikleyicisi kapatildi / `tax_number` acildi / politika `true` yapildi —
ucunde de T8 HATA verdi, geri alinca GECTI.

## 4. Davranis ozeti

- Kayit: `handle_new_user` profili yazar -> `trg_faz0_sync_profile_to_organization` agency/business icin
  kurulus + `owner_seed` uyeligi olusturur. Client/professional icin hicbir sey olmaz.
- Profil guncellemesi (`company_name`, `full_name`, `city_id`, `premium_tier`, `premium_until`, `role`) kurulusa
  yansir (profil hala kaynak). Rol agency/business DISINA cikarsa kurulus silinmez (K1c raporlar).
- `agency_members` / `business_members` INSERT/UPDATE/DELETE -> `organization_memberships` ayni id ile.
  Davet kabulunde eski tetikleyici `agency_members`'a yazar, aynalama onu izler.
- Davetler ayni id ve ayni durum degeriyle aynalanir.
- Aynalama hatasi eski islemi bozmaz; `organization_sync_log`'a `source/operation/legacy_id/detail` yazilir.
  K8 bu tabloyu sayar; sifir olmali.
- `has_org_permission(org, 'anahtar')`: aktif uyelik + rolun varsayilan anahtarlari; `permissions` jsonb
  ile satir bazinda ekleme/cikarma (`{"crew.manage": true}` verir, `{"events.view": false}` alir).

## 5. Uretim sirasi (adim adim)

On kosul: `git status` temiz; dal ref `ukqhgspaallzjscjodbb` (T7 icin 2a/2b dalda uygulanmis).

1. **Uretimde on kontrol (salt okunur, SQL Editor):**
   ```sql
   select role, count(*) from public.profiles group by 1 order by 1;
   select count(*) agency_members from public.agency_members;
   select count(*) business_members from public.business_members;
   select status, count(*) from public.agency_invitations group by 1;
   select status, count(*) from public.business_invitations group by 1;
   -- 04-goc-plani bolum 3: professional'a agency tier verilmis mi? (grantPremium rol kontrolu yok)
   select role, premium_tier, count(*) from public.profiles where premium_tier <> 'none' group by 1,2 order by 1,2;
   ```
   Sayilar not edilir; dolum sonrasi K1/K3/K4/K5/K6 "eski" sutunlari bunlarla ayni olmali.
2. **Dal:** `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push`. Not: dalda 2b elle
   kosuldugu icin push 4 dosya gosterebilir (2b + faz0 01/02/03); 2b idempotan, zararsiz.
3. **Dalda test:** SQL Editor'da `asama4-davranis-testi.sql` -> 10 satir, T9 `ATLANDI`, digerleri `GECTI`.
   Sonra `asama5-faz0-tutarlilik.sql` -> 14 satir ESIT/BILGI (test verisi kalir; K1 = 2, K5 = 1 gibi kucuk sayilar normal).
4. **Uretim:** `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (3 dosya).
5. **Uretimde dogrulama:** `asama5-faz0-tutarlilik.sql` -> hepsi ESIT, K1 "eski" = adim 1'deki agency+business
   toplami. `select * from public.organization_sync_log` -> 0 satir. Onizleme ile sayfalar (mesajlar,
   ekibim, davetlerim, kurumsal ekip) normal.
6. `git add -A`, commit (`FAZ 0: kiraci temeli — 3 migration, 04 bekleyen, T8/T9, tutarlilik`), push.
7. **Izleme:** birkac gun boyunca (en az bir davet kabulu ve bir uye cikarma yasandiktan sonra) uretimde
   `asama5-faz0-tutarlilik.sql` tekrar: hepsi ESIT ve sync_log 0 ise -> 04 dosyasi `git mv` ile
   `supabase/migrations/`'a tasinir, dala push + asama4 (T9 GECTI beklenir), uretime push.

Geri alma: 01-03 icin `DROP TRIGGER trg_faz0_*` (5 tetikleyici) yeterlidir; tablolar dursa da zarar vermez.
04 icin eski govdeler `20260620090200_faz_minus1_03_yetki_fonksiyonlari.sql` ve
`20260701120000_business_member_shared_visibility.sql` icinde; bookings politikasi `06_politikalar`'da.

## 6. Kalici kurallar (FAZ 0 sonrasi)

- `organizations`'a yeni sutun = ayni migration'da `GRANT SELECT (sutun) ON public.organizations TO authenticated`
  (hassas sutunsa verilmez, RPC ile acilir).
- `agency_members` / `business_members` / davet tablolarina **yeni sutun eklenirse** aynalama fonksiyonu
  (`fn_sync_*`) ve dolum dosyasi guncellenir; aksi halde yeni alan yeni tabloya tasinmaz.
- Yeni `organization_member_role` degeri eklenirse `org_role_permissions` CASE'i ve (gerekirse)
  `map_org_role_to_legacy` guncellenir.
- Uretimde `organization_sync_log` bos degilse once sebep, sonra 04.

## 7. Acik noktalar

- `organization_modules` bos; hangi `account_type`'in varsayilan olarak hangi modulleri alacagi Event OS
  tasariminda kararlastirilir (`commercial`, `crew_commercial`, `talent_pool` business'a asla — 01/02).
- Paket adlari (`trial/starter/pro/enterprise` vs `none/premium/plus/agency`): is planiyla birlikte kararlastirilir;
  o zaman `subscription_tier` yeni enum'a tek migration'la cevrilir.
- `grantPremium` rol kontrolu (04-goc-plani bolum 3): adim 1'deki sorgu professional'a `agency` tier
  gosterirse kod duzeltmesi ayri is.
- Ajans uyelerinin (profesyoneller) uzun vadede yeri `organization_talent_records` (FAZ 5); FAZ 0'da
  `viewer` uyelik olarak aynalanir, FAZ 5'te yerel kayda tasinir.

## 8. Kapanis kaydi — 01-03 (15 Eylul 2026)

**Uretim on kontrolu (push oncesi):** 48 profil (1 agency, 2 business, 10 client, 35 professional);
agency_members 2, business_members 1; agency_invitations 2 accepted, business_invitations 2 accepted;
premium_tier <> none yalniz 1 professional/premium (grantPremium anormalligi YOK); 3 kurulus profilinin
slug'i bos (dolum `org-<uuid>` verdi), adlari dolu. Not: kurum davetlerinden 2'si accepted ama kurum uyesi 1 —
biri sonradan cikarilmis olmali; aynalama var olani kopyalar, FAZ 0'i etkilemez.

**Dal (`ukqhgspaallzjscjodbb`):** `db push` -> asama4 T0-T8 GECTI, T9 ATLANDI (04 yok); asama5 14/14 ESIT
(K1 2/2 = test ajansi + test kurumu, K5 1/1, K6 1/1).

**Uretim (`qydsooqmflrrwtgawhsv`):** `db push` 3 dosya; 02 NOTICE'lari ("does not exist, skipping") beklenen
DROP IF EXISTS ciktisi; 03 `NOTICE: faz0 dolum: 3 kurulus olusturuldu`. asama5: **14/14 ESIT** —
K1 3/3, K2 0, K3 2/2, K4 1/1, K5 2/2, K6 2/2, K7 0, K8 0 (sync_log bos). Sayilar on kontrolle birebir.
`git push` -> `5847212..5b441dc main`.

**Olay ve ders:** asama4 bir kez yanlislikla URETIMDE kosuldu — Supabase Dashboard uretimi dal listesinde
"main" diye etiketliyor. T0-T7 uretime 4 test kullanicisi, 1 rezervasyon, 2 sohbet, 1 davet yazdi ve T5
test ajans hesabini admin yapti. T0 temizlik blogu (0005/0006 dahil) uretimde kosuldu; dogrulama: test
kullanicisi 0, profil 48, admin 1, `protect_profile_fields` tetikleyicisi acik (O), agency_members 2,
agency_invitations 2, business_members 1, bookings kalintisi 0. Kalici onlem: asama4'un basina
**uretim korumasi** eklendi (pg_cron isi `send-message-notifications` varsa veya test disi profil > 10 ise
ilk blokta durur, hicbir sey yazmaz; yerelde sahte cron kaydiyla dogrulandi). Kural: SQL Editor'da is
yapmadan once adres cubugundaki proje ref'i okunur; "main"/"dal" degil ref adi kullanilir.

**Kalan:** bolum 5 adim 7 — birkac gun sonra (en az bir gercek davet kabulu + bir uye cikarma yasandiginda)
uretimde asama5 tekrar; hepsi ESIT ve K8 = 0 ise 04 dosyasi `git mv` ile `supabase/migrations/`'a, once
dala (T9 GECTI beklenir), sonra uretime.

## 9. 04 — zincire alinma ve uretim sirasi (22 Eylul 2026)

**Neden simdi:** 15 Eylul'den beri uretimde asama5 hep 14/14 ESIT (K8 sync_log 0); dalda T3/T4/T8 gercek davet
kabulu ve uye cikarma akislarini aynalama uzerinden dogruluyor. Uretimde bu sure icinde gercek davet/cikarma
olmadi (bakim modu); daha uzun beklemek yeni kanit uretmez. Dosya icerigi 15 Eylul'deki ile ayni; **yalniz zaman
damgasi yenilendi** (`20260922100000`): CLI, uzak gecmisteki son surumden eski bir yerel dosyayi `--include-all`
olmadan uygulamaz; zincir sirasi bozulmasin diye yeniden damgalandi (baslik yorumu bunu soyler). Eski dosya
`docs/envanter/bekleyen/`'den `git rm` ile kaldirilir (git yeniden adlandirma olarak gorur).

**Yerel zincir (22 Eylul):** dosya (yeni adiyla) zaten 04 uygulanmis harness'a yeniden uygulandi; 4 fonksiyon
govdesinin md5'i degismedi (idempotan); asama4 T9 GECTI.

**Uretim sirasi:**
1. `git rm docs/envanter/bekleyen/20260915150300_faz0_04_yetki_fonksiyon_gecisi.sql`; `git add -A`; commit
   `FAZ 0/04: yetki fonksiyon gecisi zincire alindi (20260922100000)`.
2. Uretimde on kontrol (SQL Editor, salt okunur): `asama5-faz0-tutarlilik.sql` -> 14/14 ESIT, K8 0; ve
   `select proname from pg_proc where proname = 'is_agency_member';` -> bos.
3. Dal: `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (1 dosya).
4. Dalda: `asama4-davranis-testi.sql` -> **T9 GECTI** (ilk kez; 15 satir hepsi GECTI); `asama5` -> 14/14 ESIT.
5. Uretim: `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (1 dosya).
6. Uretimde: `asama5` -> 14/14 ESIT; `select proname from pg_proc where proname = 'is_agency_member';` -> 1 satir.
   Onizlemeyle kurumsal ekip (`/profil/kurumsal-ekip`) ve ajans ekibi (`/profil/ekibim`) sayfalari acilir;
   uye listesi ve yetkiler ayni gorunmeli (politikalar artik yeni tablodan okuyor).
7. `git push`.

**Geri alma:** dosya basligindaki not — eski govdeler `20260620090200` ve `20260701120000` dosyalarindan
`CREATE OR REPLACE` ile geri yazilir; bookings politikasi `06_politikalar` metniyle.

**Kapanis (22 Eylul 2026):** uretim on kontrolu asama5 14/14 ESIT + `is_agency_member` yok; dal push -> asama4 15/15,
**T9 GECTI** (ilk kez; has_business_role member/manager gecer owner gecmez, is_business_member true, kurucu false,
mutasyon kaniti); uretim push -> asama5 **14/14 ESIT** (K1 3/3, K3 2/2, K4 1/1, K5 2/2, K6 2/2, K8 0); `supabase
migration list` uretimde `20260922100000 | 20260922100000` (kayit var; CLI yalniz basarili dosyayi kaydeder, dolayisiyla
`is_agency_member` ve yeni govdeler uretimde). `/profil/ekibim` (ajans): 2 uye + 2 kabul edilmis davet, yetkiler ayni.
git `77b1342`. **FAZ 0 tamamen kapandi**; `docs/envanter/bekleyen/` bos. Yetki fonksiyonlari artik
`organization_memberships`'ten okuyor; eski `agency_members`/`business_members` tablolari FAZ 8/10'a kadar aynalanmaya
devam eder (asama5 K3/K4 bunu olcer).

