# Claude Code gorevi — FAZ 4c / P2: Etkinlik sihirbazi yeniden (EventSpec akisi) + `/etkinliklerim`

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/16-faz4c-yeni-talep-akisi.md` (bolum 2 kararlar,
bolum 3 RPC sozlesmesi, bolum 5 P2, bolum 6 kurallar); sozlesme: `docs/architecture/06-eventspec-sozlesmesi.md`.
ON KOSUL: 4c-DB uretimde (asama12 6 ESIT), P1 deploy'da (`analyzeEventNeeds` `spec` + `provenance` donduruyor).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/16-faz4c-yeni-talep-akisi.md` (bolum 2, 3, 5-P2, 6),
`docs/architecture/06-eventspec-sozlesmesi.md`, `app/lib/eventspec.ts`, `app/lib/ai-actions.ts` icinde
`analyzeEventNeeds` (P1 sonrasi: `spec`, `provenance`, `briefId`, `specVersionId` donduruyor),
`app/etkinlik-sihirbazi/page.tsx` + `sihirbaz-client.tsx` (bugunku sihirbaz: URL = tek gercek, canli sayac,
kesfet/teklif linkleri), `app/teklif-taleplerim/page.tsx` (liste sayfasi kalibi: getCachedUser, SuspendedNotice, TopNav).

Bu is **yalniz uygulama kodu**: migration yok. Amac: `/etkinlik-sihirbazi` EventSpec akisi olur — istege bagli "Anlat"
adimi (AI cikarimi form'u on doldurur), 4 form adimi, "Onayla" ile onaylanmis etkinlik (`events` +
`event_requirements`) olusur ve `/etkinliklerim/[id]`'ye gidilir. `/etkinlik-planla` DEGISMEZ. Bugunku sihirbazin canli
sayaci ve Kesfet/Teklif topla linkleri KORUNUR.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar (16 bolum 6)

- Uygulama `events` / `event_requirements` tablolarina INSERT YAPMAZ. Onay yalniz `supabase.rpc('create_event_from_spec', { p_version_id })`.
- `event_spec_versions` ekle-yalniz: kullanicinin duzelttigi/onayladigi hal YENI surum olarak INSERT edilir
  (`version_no`, `is_current`, `created_by_user_id` GONDERILMEZ — tetikleyici verir). `spec_jsonb` hicbir zaman UPDATE edilmez.
- `spec_jsonb`'ye bos/null alan yazilmaz; provenance yalniz yazilan alanlar icin girdi alir (06 bolum 1-2).
- `organization_id` gonderilmez (4b/P1 ile ayni; kurulus atfi FAZ 8). `events.owner_user_id` RPC'de `auth.uid()`.
- Sapkali harf (a/i/u sapkali) hicbir dosyada yok. Yorumlar Turkce ASCII.

## Yapilacaklar

### 1. `app/lib/eventspec.ts` — sihirbaz damgasi

- `export const EVENT_WIZARD_PARSER_VERSION = 'wizard/1.0'` (sihirbazin yazdigi surumlerde `parser_version`;
  `model_id` ve `prompt_version` NULL — model yok). `schema_version` yine `EVENTSPEC_SCHEMA_VERSION`.

### 2. `app/etkinlik-sihirbazi/actions.ts` (yeni, `'use server'`) — `confirmEventFromWizard`

Girdi (istemciden, URL'deki degerlerin aynisi):
```ts
{
  briefId?: string;          // Anlat adimindan geldi ise
  baseVersionId?: string;    // Anlat adiminin surumu (AI, needs_input)
  rawText?: string;          // Anlat metni (yalniz form-yalniz brief icin OZET uretiminde KULLANILMAZ; bilgi)
  eventType: string;         // zorunlu
  title?: string;
  cityId?: number; district?: string;
  startDate?: string; endDate?: string; isDateFlexible?: boolean;   // YYYY-MM-DD
  participantCount?: number; budgetMin?: number; budgetMax?: number;
  venueStatus?: 'confirmed' | 'searching' | 'not_needed';
  roles: { slug: string; quantity: number; isRequired: boolean }[]; // en az 1
}
```
Akis (sira onemli; her adimda hata -> `{ success: false, error }` Turkce mesaj, hicbir sey yazilmadan/yarim kalmadan):
1. Oturum: `supabase.auth.getUser()`; yoksa `error: 'Giris yapmalisin.'`. Askidaki kullanici (profiles.suspended_at) -> hata.
2. Sunucu tarafi dogrulama (RPC'nin kontrolleriyle AYNI, kullaniciya duzgun mesaj icin): `eventType` aktif `event_types`
   key'i; `cityId` varsa `turkish_cities`'te var; tarihler `YYYY-MM-DD` gecerli gun, `startDate >= bugun`
   (Europe/Istanbul), `endDate >= startDate`; `participantCount` 1..100000 tam sayi; butce >= 0 ve `min <= max`; `title` <= 200;
   `district` <= 100; roller: slug'lar aktif `service_roles` (tekil; ayni slug ikinci kez gelirse birlestirme degil hata), `quantity` 1..50, en az 1 rol.
3. Taban surum (varsa): `baseVersionId` verildiyse `event_spec_versions`'tan `id, brief_id, spec_jsonb, provenance, is_current`
   oku (RLS sahiplik); yoksa/okunamadiysa hata `'Analiz bulunamadi, yeniden anlat.'`; `is_current` degilse ayni hata.
   `briefId` verildiyse taban surumun `brief_id`'siyle ayni olmali; degilse hata.
4. Brief yoksa (form-yalniz kullanim): `event_briefs` INSERT `{ created_by_user_id: user.id, source: 'client_web', raw_text }`
   ile `raw_text = '[form] ' + ozet` — ozet: `"<Tur adi>, <Sehir adi veya 'sehir belirsiz'>, <tarih veya 'tarih belirsiz'>, <N kisi veya 'katilimci belirsiz'>, roller: <slug listesi>"`.
5. Yeni spec + provenance (`spec: EventSpecV1`, `provenance: EventSpecProvenance`), `bugunIso = new Date().toISOString()`:
   - Formdaki her alan icin (event_type, title, city_id, district, start_date, end_date, is_date_flexible,
     participant_count, budget_min, budget_max, venue_status): deger bos/undefined ise YAZMA. Deger doluysa:
     taban surumde ayni alan VAR ve degeri ESIT ise taban provenance girdisini AYNEN kopyala; degilse
     `{ source: 'user_input', confidence: 1, asked_at: bugunIso }`.
   - `suggested_roles`: form sirasiyla `{ slug, reason?, quantity, is_required }`; `reason` taban surumdeki ayni slug'in
     `reason`'i (varsa). Provenance: slug kumesi + adet + zorunluluk taban ile birebir ayni ise taban girdisi, degilse
     `user_input` (tek girdi, dizinin tamami icin).
   - Tabandan tasinanlar (formda alani olmayanlar): `urgency` ve `tip` varsa aynen + taban provenance'lari; `extra` varsa
     aynen (date_note/city_note dahil; `extra.error` varsa TASIMA).
   - `is_date_flexible` yalniz `true` ise yazilir (false = varsayilan, yazilmaz).
6. Surum INSERT: `{ brief_id, spec_jsonb: spec, provenance, schema_version: EVENTSPEC_SCHEMA_VERSION, parser_version: EVENT_WIZARD_PARSER_VERSION, validation_status: 'valid' }`
   (`model_id`/`prompt_version` gonderilmez). `.select('id').single()` -> `versionId`. Hata -> `'Kayit yapilamadi, tekrar dene.'`
7. Onay: `const { data, error } = await supabase.rpc('create_event_from_spec', { p_version_id: versionId })`.
   Hata kodlari (`error.code`): `23505` -> `'Bu analiz zaten onaylanmis.'`; `42501` -> `'Bu etkinligi onaylama yetkin yok.'`;
   `22023` -> `'Etkinlik bilgileri gecersiz: ' + error.message`; `23514` -> `'Tarih veya butce araligi gecersiz.'`;
   diger -> `'Onay sirasinda bir sorun oldu, tekrar dene.'`. `console.error('[eventspec] onay', error)`.
   Basari: `{ success: true, eventId: data as string, versionId }`.
Not: surum INSERT'i basarili ama RPC hatali olursa surum kalir (ekle-yalniz; `valid` ama etkinliksiz — asama12 K3
bunu saymaz, sorun degil). Kullanici tekrar "Onayla" derse YENI surum + RPC; eski surum `is_current=false` olur.

### 3. `app/etkinlik-sihirbazi/page.tsx` — veri

Bugunku uc sorguya ek: `event_types` (`key, name_tr, group_key, sort_order`, `is_active`), oturum (`getCachedUser()` ->
`oturumVar: boolean`, `kullaniciAdi` gerekmez). `EVENT_TYPES`/`TUR_GRUPLARI` sabitleri yerine tur listesi
**`event_types` tablosundan** gelir (grup: `group_key` sosyal/kurumsal/diger; etiket `name_tr`). `kategoriler`
(`service_categories` aktif, `layer = 'legacy_role'` filtresi VARSA koru) ve `sehirler` ayni. Sayac verisi ayni.

### 4. `app/etkinlik-sihirbazi/sihirbaz-client.tsx` — akis

**URL = tek gercek (koru).** Parametreler — mevcutlar AYNEN (`adim`, `tur`, `sehir`, `tarih`, `kategoriler`) + yeniler:
`ilce`, `bitis`, `esnek` (`1`), `katilimci`, `butce_min`, `butce_max`, `mekan` (`confirmed|searching|not_needed`),
`adet` (`<kategoriId>:<n>,...`; yoksa 1), `opsiyonel` (`<kategoriId>,...`; listede olmayan = zorunlu), `baslik`,
`brief`, `surum` (Anlat sonucu id'leri), `tarih_notu`, `sehir_notu` (AI ipuclari), `metin` (Anlat metni; giris
yonlendirmesinden donuste korunsun diye). Adimlar `0..4`; `adim` yoksa 0.

- **Adim 0 — Anlat (istege bagli):** textarea (`metin`, 1000 karakter, `/etkinlik-planla` ile ayni placeholder),
  "Analiz et" ve "Atla, formu kendim doldurayim" (-> `adim=1`). "Analiz et":
  - `oturumVar` degilse: `router.push('/giris?redirect=' + encodeURIComponent(pathname + '?' + params (metin dahil)))`.
  - Doluysa: `analyzeEventNeeds({ eventDescription, categories: kategoriler.map(k => ({ slug: k.slug, name_tr: k.name_tr })) })`;
    basari -> URL'ye yaz: `tur=spec.event_type`, `sehir=spec.city_id`, `ilce`, `tarih=spec.start_date`, `bitis=spec.end_date`,
    `esnek`, `katilimci`, `butce_min/max`, `mekan=spec.venue_status`, `baslik=spec.title`,
    `kategoriler` = `spec.suggested_roles` slug'larina karsilik gelen kategori id'leri (slug = kategori slug'i; eslesmeyen atlanir),
    `adet`/`opsiyonel` = rollerdeki `quantity`/`is_required` (varsa), `brief=briefId`, `surum=specVersionId`,
    `tarih_notu=spec.extra?.date_note`, `sehir_notu=spec.extra?.city_note`, `adim=1`. Bos/undefined alanlar URL'ye YAZILMAZ.
    Hata -> mesaj, adimda kal. Yukleme durumu ("Analiz ediliyor…") goster.
  - Baslik/aciklama metni: "Etkinligini anlat, gerisini biz dolduralim. Istersen atla."
- **Adim 1 — Tur:** bugunku cipler; kaynak `event_types` (name_tr, group_key). Zorunlu (Onayla icin).
- **Adim 2 — Sehir:** bugunku select + **Ilce/semt** metin alani (`ilce`, istege bagli). `sehir_notu` varsa select
  ustunde ipucu: "Metinde gecen sehir: <not> — listeden sec".
- **Adim 3 — Tarih ve olcek:** baslangic tarihi (`tarih`), **bitis tarihi** (`bitis`, istege bagli), "Tarih esnek"
  onay kutusu (`esnek`), **katilimci sayisi** (`katilimci`), **butce min/max** (TL, istege bagli), **mekan durumu**
  select (`mekan`: "Belirtilmedi" / "Mekan belli" / "Mekan araniyor" / "Mekan gerekmiyor"). `tarih_notu` varsa ipucu:
  "Metinde: <not>". Bugunku "Tarihi temizle" kalir. Tarih sayaci etkilemez (bugunku not aynen).
- **Adim 4 — Ihtiyac + Onay:** bugunku kategori cipleri + sayilar AYNEN; secili her cipin altinda satir: **adet**
  (1-50, `adet`) ve **"zorunlu"** onay kutusu (`opsiyonel` tersi). **Baslik** alani (`baslik`, istege bagli, 200).
  Ozet kutusu (tur, sehir/ilce, tarih, katilimci, butce, mekan, roller). `derived` alanlar icin "varsayim" etiketi
  GEREKMEZ (URL'de provenance yok; kullanici zaten formda goruyor) — 06'daki isaret Event OS'a kalir.
  Dugmeler: **"Onayla ve etkinligi olustur"** (birincil) + mevcut "Kesfet'te gor" ve "Teklif topla" (ikincil, linkler AYNEN).
  Onayla: tur secili degilse "Once etkinlik turunu sec (adim 1)"; rol yoksa "En az bir ihtiyac sec"; `oturumVar`
  degilse `/giris?redirect=<mevcut URL>`; doluysa `confirmEventFromWizard({...URL'den...})` — roller: URL'deki kategori
  id'leri `kategoriler` listesinden `slug`'a cevrilir (rol slug'i = kategori slug'i), `adet`/`opsiyonel` ile
  birlestirilir; sayilar `Number()` ile, bos alanlar `undefined`. Basari: `router.push('/etkinliklerim/' + eventId)`;
  hata: mesaj. Cift tiklama korumasi (loading).
- Ilerleme cubugu 5 adim (0-4). Ust metin: "Bes kisa adim; ilki istege bagli. Adimlari gezmek icin kayit gerekmiyor;
  anlatmak ve onaylamak icin giris istenir."
- `sanitizeReturnPath` ile calisan `/giris?redirect=` mevcut mekanizma; sihirbaz URL'si (query dahil) goreli yol oldugu
  icin gecer — dogrula (bir kez giris yapip donuste `adim`, `metin` ve secimlerin korundugunu gor).

### 5. `/etkinliklerim` (yeni: `app/etkinliklerim/page.tsx`) — liste

Kalip `teklif-taleplerim/page.tsx`: `getCachedUser` yoksa `redirect('/giris?redirect=/etkinliklerim')`; suspended ->
`SuspendedNotice`; TopNav. Sorgu (RLS kendi + kurulus events.view + admin):
`from('events').select('id, title, event_type, start_date, end_date, is_date_flexible, city_id, participant_count, status, confirmed_at, created_at, event_types(name_tr), turkish_cities(name), event_requirements(id)').order('start_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })`
(rol sayisi = `event_requirements.length`; PostgREST `count` toplami Supabase'de varsayilan kapali olabilir, kullanma).
Satir: baslik (yoksa `<Tur> · <Sehir>`), tarih (esnekse "esnek" etiketi), sehir, katilimci, rol sayisi, durum etiketi
(`confirmed` "Onaylandi", `draft` "Taslak", `matching` "Eslestiriliyor", `booked` "Rezerve", `completed`
"Tamamlandi", `cancelled` "Iptal"). Bos durum: "Henuz etkinlik yok — Etkinlik sihirbazi ile olustur" (link).
Ust sagda "Yeni etkinlik" -> `/etkinlik-sihirbazi`.

### 6. `/etkinliklerim/[id]` (yeni: `app/etkinliklerim/[id]/page.tsx`) — detay

Sorgu: `from('events').select('*, event_types(name_tr), turkish_cities(name), event_requirements(id, quantity, is_required, sort_order, notes, service_roles(id, slug, name_tr, legacy_category_id))').eq('id', id).maybeSingle()`;
yoksa `notFound()`. `event_requirements` `sort_order`'a gore siralanir (istemci tarafinda sort).
Icerik: baslik, durum etiketi, tur, tarih (bitis/esnek), sehir + ilce, katilimci, butce (min-max TL; `venue_status`
etiketi; `urgency` yalniz normal degilse), `extra.date_note`/`city_note` varsa "Notlar". Roller tablosu: rol adi, adet,
zorunlu/istege bagli, ve her rol icin linkler:
- **Kesfet** -> `/kesfet?kategori=<legacy_category_id>&sehir=<city_id>&etkinlik=<event_type>` (bos olanlar atlanir),
- **Teklif topla** -> `/teklif-topla?tur=<event_type>&sehir=<city_id>&tarih=<start_date>&kategori=<legacy_category_id>` (bos olanlar atlanir),
- **Ilan ac** -> `/ilanlar/yeni` (parametre yok; P3'te `event_id` bagi).
`legacy_category_id` NULL olan rol icin Kesfet/Teklif linkleri kategori parametresiz verilir.
Alt bilgi: "EventSpec surumu: v<version_no>" — `spec_version_id` uzerinden `event_spec_versions(version_no)` embed
edilebilir (`events.spec_version_id -> event_spec_versions`), yoksa yazma. Duzenleme/iptal P2'de YOK (FAZ 5+).

### 7. Menu

`app/components/sections/top-nav.tsx` `menuLinks`: TUM giris yapmis roller icin `{ href: '/etkinliklerim', label: 'Etkinliklerim' }`
(`Bildirimler`'den once). `/profil`'de bolum EKLENMEZ.

### 8. Dogrulama

- `npx tsc --noEmit` bos; `npm run build` basarili.
- `grep -rn "from('events')\|from(\"events\")\|from('event_requirements')\|from(\"event_requirements\")" app` -> yalniz
  `etkinliklerim` sayfalari (SELECT); `.insert(` bu tablolara HICBIR yerde yok.
- `grep -rn "create_event_from_spec" app` -> yalniz `etkinlik-sihirbazi/actions.ts`.
- `grep -rn "from('event_spec_versions')" app` -> `ai-actions.ts` (P1) + `etkinlik-sihirbazi/actions.ts` (INSERT + taban okuma).
- `grep -rn "EVENT_TYPES" app/etkinlik-sihirbazi` -> 0 (tur listesi tablodan).
- Sapkali harf: degisen/yeni dosyalarda 0.
- **Onizleme turu (bakim anahtari cookie'si):**
  1. Oturumsuz: `/etkinlik-sihirbazi` acilir, adim 0 gorunur, "Atla" ile 1-4 gezilir, sayac calisir; adim 4'te "Onayla"
     `/giris?redirect=...` ister; giris sonrasi ayni adim/secimlerle donulur.
  2. Test Musteri: adim 0'a "15 Haziran'da Kadikoy'de 40 kisilik dogum gunu, butcemiz 20-30 bin TL, mekan belli" ->
     adim 1'de "Dogum gunu" secili, adim 2 Istanbul + ilce Kadikoy, adim 3 tarih (gelecek 15 Haziran), 40, 20000-30000,
     mekan belli; adim 4 onerilen roller secili (sayac calisir). Katilimciyi 50 yap, bir rolun adedini 2 yap, Onayla ->
     `/etkinliklerim/<id>` acilir; liste sayfasinda gorunur; menude "Etkinliklerim".
  3. Ayni kullanici, Anlat'i atlayip formla ikinci etkinlik (Dugun, Ankara, tarih bos + esnek, 2 rol) -> onaylanir.
  4. Detay sayfasinda "Teklif topla" linki teklif formunu on dolu acar (tur/sehir/tarih/kategori).
  Ardindan (Guven, Dashboard SQL Editor, uretim, salt okunur):
  ```sql
  select e.id, e.title, e.event_type, e.city_id, e.district, e.start_date, e.is_date_flexible, e.participant_count,
         e.budget_min, e.budget_max, e.venue_status, e.status, e.owner_user_id, v.version_no, v.parser_version, v.validation_status,
         (select count(*) from public.event_requirements r where r.event_id = e.id) as rol_sayisi,
         v.provenance
    from public.events e left join public.event_spec_versions v on v.id = e.spec_version_id
   order by e.created_at desc limit 3;
  select brief_id, version_no, is_current, validation_status, parser_version, prompt_version
    from public.event_spec_versions order by created_at desc limit 6;
  ```
  Beklenen: 2 etkinlik `confirmed`; ilkinde v2 (`wizard/1.0`, `valid`; v1 `needs_input`, `is_current=false`),
  provenance'ta `participant_count` ve `suggested_roles` `user_input`, `event_type`/`city_id` AI girdisi
  (`extracted`); ikincisinde brief `[form] ...`, v1 `wizard/1.0`, tum girdiler `user_input`. `asama12` uretimde: K3/K4/K6
  ESIT, K7 = 20000.

## Yapilmayacaklar

- `/etkinlik-planla`, `/teklif-topla`, `/kesfet`, `/ilanlar/yeni` degismez (P3). `quote_requests.event_id`/`listings.event_id` yazilmaz.
- `events`/`event_requirements` INSERT/UPDATE/DELETE yok (yalniz RPC + SELECT). `event_spec_versions` UPDATE yok.
- `organization_id` gonderilmez. Migration yok. Yeni RPC yok.
- Etkinlik duzenleme/iptal, `matching`/`booked` gecisleri yok.

Rapor: degisen/yeni dosya listesi, tsc/build, grep ciktilari, onizleme turunun 4 maddesi (ekran/URL notlari), SQL
ciktisi (Guven kosar), sapma ve nedeni. Commit ATMA.
