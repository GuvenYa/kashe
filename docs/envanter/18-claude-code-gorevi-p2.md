# Claude Code gorevi — FAZ 6 / P2: ekip kurma (`/etkinliklerim/[id]` icinde "Ekip") + `/ajans/ekipler` + ic maliyet karti

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/18-faz6-eslestirme-ekip.md` (bolum 2, 3, 8-P2, 9).
ON KOSUL: 6-DB/01-02 uretimde, P1 deploy'da (Adaylar bolumu calisiyor).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/18-faz6-eslestirme-ekip.md` (bolum 2, 3, 8-P2, 9),
`supabase/migrations/20261002120000_faz6_01_eslestirme_ekip.sql` (`crews`, `crew_members` sutunlari + INSERT/UPDATE sutun yetkileri,
tetikleyici hata metinleri; `crew_member_commercial_snapshot`, `internal_crew_commercials_list`, `internal_crew_commercial_upsert`
imzalari), `app/etkinliklerim/[id]/page.tsx`, `aday-paneli.tsx`, `aday-actions.ts`, `aday-data.ts` (P1), `app/lib/org-context.ts`
(`getTalentPoolContext`), `app/ajans/havuz/page.tsx` + `havuz-data.ts` (havuz listesi okuma deseni), `app/ajans/havuz/havuz-rate-actions.ts`
(ic oran action deseni), `app/ajans/havuz/havuz-paneli.tsx` (satir ici onay kutusu deseni).

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. Parcalar: (A) kurulus baglami, (B) etkinlik sayfasinda "Ekip" bolumu,
(C) ic maliyet karti, (D) `/ajans/ekipler` listesi, (E) P1 kucuk duzeltme (yeniden eslestir bekleme durumu).
Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar (18 bolum 9)

- `crews`/`crew_members` yazimi RLS ile dogrudan INSERT/UPDATE/DELETE (yalniz GRANT edilen sutunlar: crews INSERT `event_id,
  organization_id, name, strategy, source_policy, objective, status`, UPDATE `name, strategy, source_policy, objective, status`;
  crew_members INSERT `crew_id, role_id, talent_record_id, provider_id, status, is_locked, sort_order, note, match_candidate_id`,
  UPDATE `status, is_locked, sort_order, note`). `pool_origin`, `created_by` tetikleyici yazar — GONDERME. `event_id`/`crew_id`
  degistirilmez; uyenin kaynagi degistirilmez (yeni kisi = yeni uye, eskisi `replaced`).
- Ekip `confirmed` yapilirken DB tetikleyicisi zorunlu rolleri `status = confirmed` uyelerle `quantity` kadar kapsanmis ister;
  hata `22023` "zorunlu rol kapsanmadi: <slug,...>" -> kullaniciya "Zorunlu roller onaylanmış üyelerle kapsanmadan ekip onaylanamaz:
  <rol adları>" (slug -> `name_tr` eslemesi gereksinimlerden). Uygulama ayni kontrolu ONCEDEN de gosterir (kapsam ozeti) ama kapi DB'dir.
- Ic maliyet yalniz uc RPC ile; `internal` semasina sorgu YOK. Kart yalniz ekip `organization_id` doluysa ve kullanici o kurulusta
  `commercial.view` ise render edilir (DOM'da da yok); yazma dugmeleri yalniz `commercial.manage`. Bireysel ekipte (organization_id NULL)
  kart YOK.
- Havuzdan uye ekleme yalniz ekip `organization_id` doluysa ve kullanici kurulusta `talent.view` ise (havuz listesi RLS zaten kisitlar);
  `talent_record_id` ekibin kurulusuna ait kayit olmali (tetikleyici 22023 verir; listede zaten yalniz o kurulusun kayitlari var).
- Sapkali harf yok; kullaniciya gorunen metinler duzgun Turkce, yorumlar ASCII. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. Kurulus baglami (`app/lib/org-context.ts`)

`getCrewContext()`: kullanicinin aktif uyelikleri -> kurulus basina `has_org_permission` ile `canViewCrew` (crew.view), `canManageCrew`
(crew.manage), `canSeeRates` (commercial.view), `canManageRates` (commercial.manage), `canViewTalent` (talent.view) + `talent_pool`
modul durumu. `getTalentPoolContext`'e dokunma (ayri kullanim). Donus `{ orgs: CrewOrg[] }`.

### B. "Ekip" bolumu (`app/etkinliklerim/[id]`: `ekip-paneli.tsx` istemci, `ekip-actions.ts`, `ekip-data.ts` paylasilan)

Sayfada "Adaylar"dan sonra, "Bağlı kayıtlar"dan once **"Ekip"** bolumu. Yalniz etkinlik sahibi ekip kurar (crews INSERT RLS); sahip
degilse ve ekip yoksa bolum render edilmez; ekip varsa salt okunur (RLS ne gosteriyorsa).
- Sunucu: etkinligin ekipleri (`crews` SELECT; `order created_at`) + uyeleri (`crew_members` SELECT, `order sort_order, created_at`) +
  uye kisi bilgisi: `provider_id` doluysa `v_providers_public` (`display_name, city_id`), yalniz `talent_record_id` doluysa
  `organization_talent_records` (`name`; RLS kurulus uyesine acik) — ikisi de NULL ise "Kaynağı silinmiş üye".
- **Ekip kur:** sahipte ekip yoksa dugme "Ekip kur" -> `createCrew(eventId, organizationId | null)`: `getCrewContext().orgs.filter(canManageCrew)`
  bir kurulus ise onu kullan, birden fazlaysa secim, yoksa NULL (bireysel). INSERT `{ event_id, organization_id, name: 'Ekip' }`
  (source_policy/objective varsayilan; kurulus ekibinde tetikleyici `private_first` yapar). V0: etkinlik basina TEK ekip (ikinci
  "Ekip kur" dugmesi gosterilmez; DB coklu ekibe izin verir, UI vermez — raporla).
- **Uye ekleme — adaylardan:** son kosunun adaylari (P1 verisi) her gereksinim altinda "Ekibe ekle" dugmesi (profesyonel adaylar;
  ajans adaylari ekibe EKLENMEZ — not: "Ajans tam hizmet teklifi FAZ 7"). INSERT `{ crew_id, role_id, provider_id, match_candidate_id,
  status: 'proposed', sort_order }`. Ayni saglayici ayni rolde zaten ekipteyse dugme "Ekipte" (pasif).
- **Uye ekleme — havuzdan** (yalniz kurulus ekibi + `canViewTalent`): rol basina "Havuzdan ekle" -> kurulusun havuz kayitlari
  (`organization_talent_records` + roller; o rolde rol atamasi olanlar once, digerleri altta "rolu yok" notuyla) -> INSERT
  `{ crew_id, role_id, talent_record_id, status: 'proposed', sort_order }` (provider_id GONDERME; tetikleyici turetir).
- **Uye satiri:** ad, kaynak rozeti (`pool_origin`: private "Havuz", marketplace "Pazaryeri", external "Harici"), rol, durum secimi
  (`proposed` "Önerildi", `contacted` "İletişime geçildi", `confirmed` "Onaylandı", `declined` "Reddetti", `replaced` "Değiştirildi"),
  kilit (is_locked; etiket "Kilitli"), not (<= 2000), "Çıkar" (DELETE; satir ici onay kutusu "<Ad> ekipten çıkarılacak. Emin misin?").
  UPDATE yalniz `status, is_locked, sort_order, note`.
- **Kapsam ozeti:** her zorunlu gereksinim icin "onaylanmış üye / adet" (ör. "DJ 1/1 ✓", "Ses & Işık 0/1"); hepsi tamamsa rozet
  **"Tam hizmet"**, degilse "Eksik: <roller>". Istege bagli roller ayri satirda.
- **Ekip durumu:** `draft` "Taslak" -> "Öneriye çevir" (`proposed` "Önerildi") -> "Onayla" (`confirmed` "Onaylandı"; DB kontrolu,
  hata eslemesi yukarida) ; her durumdan "İptal et" (`cancelled`; satir ici onay). `confirmed`/`cancelled` ekipte uye ekleme/cikarma
  dugmeleri gizli (DB engellemez; UI kilitler — raporla).
- Hata eslemesi (`error.code`): `42501` "Bu ekip için yetkin yok."; `22023` mesajin Turkce karsiligi (yukaridaki kapsam mesaji;
  "havuz kaydi ekibin kurulusuna ait degil" -> "Bu kayıt ekibin kuruluşuna ait değil."; "ekip uyesi icin havuz kaydi veya saglayici
  gerekir" -> "Üye için kaynak seçilmedi."); `23503` "Bağlı kayıt bulunamadı."; diger "İşlem yapılamadı, tekrar dene."
- Butun action'lar `revalidatePath('/etkinliklerim/<id>')` (ve D icin `/ajans/ekipler`).

### C. Ic maliyet karti (ekip panelinde; `app/etkinliklerim/[id]/ekip-maliyet-actions.ts`)

Ekip `organization_id` dolu ve `canSeeRates` ise uye satirinin altinda/yaninda **"İç maliyet"** acilir karti (tembel: acilinca
`listCrewCommercials(crewId)` -> `rpc('internal_crew_commercials_list', { p_crew_id })`). Satir: tutar (TL), birim (per_job "iş başı",
per_hour "saatlik", per_day "günlük"), musteri fiyati (varsa), marj (`margin_rate` yuzde; `markup_amount` TL), kaynak (`default`
"Varsayılan oran", `manual_override` "Elle", `marketplace_quote` "Pazaryeri teklifi"), not. Etiket: "Gizli — yalnız ticari yetkililer görür".
`canManageRates` ise: uye basina **"Varsayılan orandan al"** -> `rpc('crew_member_commercial_snapshot', { p_crew_member_id })`
(hata `22023` mesajlari: "bireysel ekipte" -> gosterilmez zaten; "havuz kaydi olmayan uye" -> "Bu üye havuzdan değil; maliyeti elle gir.";
"acik ic oran yok" -> "Bu rol için açık iç oran yok; elle gir."), **"Elle gir / güncelle"** formu (tutar >= 0, birim, musteri fiyati
opsiyonel >= 0, not) -> `rpc('internal_crew_commercial_upsert', { p_crew_member_id, p_agreed_cost, p_basis, p_currency: 'TRY',
p_client_price, p_note })`. Action'lar sunucuda `has_org_permission` ile yetkiyi ayrica dogrular (duzgun mesaj; asil kapi DB).
`canSeeRates` degilse kart, dugme ve action cagrisi HIC yok.

### D. `/ajans/ekipler` (yeni sayfa + menu)

`getCrewContext().orgs.filter(canViewCrew)` bos ise `/profil`'e yonlendir. Kurulus(lar)in ekipleri: `crews` SELECT (`organization_id in`)
+ uye sayisi (`crew_members` count) + etkinlik basligi: `events` SELECT `id, title, start_date, city_id` — **RLS etkinligi gostermeyebilir**
(FAZ 8 oncesi `events.organization_id` NULL): gelmezse "Etkinlik ayrıntısı görünmüyor (sahibi değilsin)" yaz, satir yine listelenir
(ekip adi, durum, uye sayisi, tarih). Satir baglantisi: sahipse `/etkinliklerim/<event_id>`; degilse baglanti yok. Menu: ajans
kullanicisi icin TopNav'a "Ekipler" (Yetenek Havuzu'nun yanina), `canViewCrew` kurulus varsa.

### E. P1 duzeltme: "Yeniden eşleştir" bekleme durumu

`aday-paneli.tsx`: dugme `pending` iken metin "Eşleştiriliyor…" ve pasif; action donunce `router.refresh()` tamamlanana kadar
pasif kalsin (`useTransition` + `router.refresh()` ayni transition icinde). Ayrica son kosu 10 saniyeden yeniyse dugme pasif
("Az önce eşleştirildi") — cift tiklama/yenileme ile gereksiz kosu uretimini onler (DB tarafi degismez).

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu (`/ajans/ekipler`) + hata yok + `.next/BUILD_ID`.
- `grep -rn "internal_crew_commercial\|crew_member_commercial_snapshot" app` -> yalniz `ekip-maliyet-actions.ts`; `grep -rn "from('internal" app` -> 0.
- `grep -rn "pool_origin\|created_by" app/etkinliklerim/[id]/ekip-actions.ts` -> INSERT nesnelerinde YOK (yorum haric).
- `grep -rn "from('crews')\|from('crew_members')" app` -> yalniz `ekip-actions.ts`, `etkinliklerim/[id]/page.tsx`, `ajans/ekipler/page.tsx`.
- Sapkali harf 0; metinler duzgun Turkce.
- **Canli tur (Guven):**
  1. Test Musteri, dogum gunu etkinligi: "Ekip kur" -> bireysel ekip (Taslak). DJ altinda Ahmet Yilmaz "Ekibe ekle", Fotografci altinda
     Test Pro "Ekibe ekle" -> iki uye "Pazaryeri" rozetli, "Önerildi". Kapsam: "Fotoğrafçı 0/1, DJ 0/1, Koordinatör 0/1, Ses & Işık 0/1".
     "Onayla" -> hata "Zorunlu roller onaylanmış üyelerle kapsanmadan ekip onaylanamaz: …". Iki uyeyi "Onaylandı" yap -> kapsam 2/4 ->
     yine hata (Koordinatör, Ses & Işık). Ic maliyet karti YOK (bireysel).
  2. Sunucu Ajans: sihirbazdan kendi etkinligi ("Istanbul'da 100 kisilik kurumsal lansman, DJ ve fotografci") -> onayla -> Aday öner ->
     "Ekip kur" -> kurulus ekibi (Sunucu Ajans) -> DJ: adaylardan Test Pro2 ("Pazaryeri"), Fotografci: "Havuzdan ekle" -> Test Pro
     ("Havuz") -> ic maliyet karti gorunur (owner) -> Test Pro'da "Varsayılan orandan al" -> P2 turunda girilen oran (6000 gunluk kapali,
     yeni acik oran yoksa "açık iç oran yok; elle gir") -> "Elle gir" 7000 is basi, musteri 10000 -> marj %30. Iki uye Onaylandi ->
     "Onayla" -> ekip Onaylandı, rozet "Tam hizmet".
  3. `/ajans/ekipler` (Sunucu Ajans): 1 ekip, 2 uye, Onaylandı, etkinlik basligi gorunur (sahip). Test Pro (viewer, Ekibim) ile
     `/ajans/ekipler`: ekibi gorur (crew.view), etkinlik ayrintisi "görünmüyor" notu; `/etkinliklerim/<id>` -> 404.
  4. Yeniden eslestir: dugme "Eşleştiriliyor…" -> doner; hemen tekrar basinca "Az önce eşleştirildi" (pasif).
  SQL (uretim, salt okunur, tek tek):
  ```sql
  select c.name, c.organization_id is not null as kurulus, c.source_policy, c.status,
         (select count(*) from public.crew_members m where m.crew_id = c.id) as uye
    from public.crews c order by c.created_at;
  select m.role_id, m.pool_origin, m.status, m.provider_id is not null as saglayici, m.talent_record_id is not null as havuz, m.match_candidate_id is not null as adaydan
    from public.crew_members m order by m.created_at;
  select action, target_table, detail, created_at from internal.access_audit where target_table = 'crew_member_commercials' order by created_at desc limit 6;
  ```
  Beklenen: 2 ekip (bireysel draft/proposed, kurulus confirmed), uyeler kaynaklariyla; denetim `crew.override` (+ `crew.snapshot`
  denendiyse) ve `read` satirlari. `asama14`: K7 0, K12 0, K13 0, K10 = kosu*100 + 2.

## Yapilmayacaklar

- Teklif/fiyat (FAZ 7), ajans adayini ekibe ekleme (FAZ 7 tam hizmet teklifi), etkinlik basina coklu ekip (UI), hibrit koordinasyon
  cezasi hesabi (01; FAZ 6-ek), `events.organization_id` yazimi (FAZ 8). Migration/RPC yok.
- `pool_origin`/`created_by` istemciden gonderilmez; `internal` semasina sorgu yok.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, sapma ve nedeni. Commit ATMA.
