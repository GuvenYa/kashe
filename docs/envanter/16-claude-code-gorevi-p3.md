# Claude Code gorevi — FAZ 4c / P3: eski akislara `event_id` bagi + P1/P2 kucuk duzeltmeler

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/16-faz4c-yeni-talep-akisi.md` (bolum 2 "Eski
akislara bag", bolum 5 P3, bolum 6 kurallar, bolum 7 P1/P2 kapanislari). ON KOSUL: P2 deploy'da (`/etkinliklerim/[id]`
calisiyor), 4c-DB uretimde (`quote_requests.event_id`, `listings.event_id`, `conversations.event_id` var).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/16-faz4c-yeni-talep-akisi.md` (bolum 2, 5-P3, 6, 7),
`app/etkinliklerim/[id]/page.tsx`, `app/etkinlik-sihirbazi/sihirbaz-client.tsx` (adim 4 cipleri),
`app/lib/ai-actions.ts` (`analyzeEventNeeds`, tarih suzgeci), `app/teklif-topla/page.tsx` + `teklif-topla-formu.tsx` +
`actions.ts` (`createQuoteRequest`, teklif verme akisinda conversation acma), `app/ilanlar/yeni/page.tsx` +
`yeni-ilan-formu.tsx` + `app/ilanlar/listings-actions.ts` (`createListing`, basvuru kabulunde conversation),
`app/mesajlar/actions.ts` (`startConversation`), `app/p/[id]/page.tsx` + `iletisim-button.tsx`, `app/kesfet/page.tsx` +
`profile-card.tsx`.

Bu is **yalniz uygulama kodu**: migration yok, yeni RPC yok. Amac: onaylanmis etkinlikten baslayan talep / ilan / sohbet
`event_id` tasisin; bagimsiz baslayanlar NULL kalsin; etkinlik sayfasi bagli kayitlari listelesin. Eski akislarin
mantigi, mesajlari, form alanlari DEGISMEZ — yalniz on dolum + `event_id` eklenir. Ayrica P1/P2'den iki kucuk duzeltme.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar

- `event_id` yalniz SUNUCU tarafinda, dogrulanarak yazilir: istemciden gelen id once `supabase.from('events').select('id').eq('id', id).maybeSingle()`
  ile okunur (RLS: kendi / kurulus / admin); gorunmuyorsa `event_id` NULL yazilir ve `console.warn('[eventspec] event_id gorunmuyor', id)`.
  Bu yardimci tek yerde: `app/lib/eventspec-server.ts` -> `export async function gorunenEtkinlikId(supabase, id: string | null | undefined): Promise<string | null>`
  (kisa; bos/gecersiz uuid -> null, sorgu yapmadan).
- Eski tablolara `event_id` disinda sutun eklenmez/yazilmaz. `events`/`event_requirements` INSERT/UPDATE yok.
- URL parametre adi her yerde `etkinlik` (= `events.id`). Kesfet'te `etkinlik` zaten TUR demek; orada `etkinlik_id` kullanilir.
- Sapkali harf yok; yorumlar Turkce ASCII.

## Yapilacaklar

### 1. P1 duzeltmesi — parser 1.2 (`app/lib/ai-actions.ts`, `app/lib/eventspec.ts`)

Uretimde gorulen: "15 Haziran" icin model yili 2026 varsaydi (`inferred: true`), tarih bugunden once oldugu icin suzgec
dusurdu; form on dolmadi. Duzeltme, PROMPT DEGISMEDEN (p2 kalir), kodda:
- `start_date`/`end_date` icin `inferred === true` VE tarih `< bugun` ise yili bugunden sonraki ilk uygun yila kaydir
  (en fazla +2 yil dene; artik yil 29 Subat gecersizse yazma). Kaydirilan tarih `derived` + `rule: 'date_assumed'`
  (zaten oyle) ve provenance'a `confidence` modelinki (degistirme). `inferred` degilse (metinde yil var) gecmis tarih
  YINE yazilmaz.
- `EVENT_NEEDS_PARSER_VERSION = 'analyze-event-needs/1.2'`; sabitin yorumuna "1.2: varsayilan yil ileri kaydirilir".
- `end_date` kaydirildiktan sonra `start_date`'ten kucuk kalirsa yazilmaz (mevcut kural).

### 2. P2 duzeltmeleri (`app/etkinlik-sihirbazi/sihirbaz-client.tsx`, `app/etkinliklerim/[id]/page.tsx`)

- Adim 4: sayisi 0 olan kategori cipi **secilebilir** olur (`kapali`/`disabled` kaldirilir; `CIP_KAPALI` stili
  kullanilmaz). Ihtiyac, bugunku arz'dan bagimsizdir (Ankara'da saglayici yoksa da "DJ lazim" denebilir). Sayi bilgi
  olarak kalir; 0 ise cipin yaninda "0" yerine "henuz yok" yazilabilir. Sayac/ozet mantigi degismez. Kesfet/Teklif
  linkleri ayni. Not: eski sihirbazda cip kapaliydi cunku amac yalniz kesfet'ti; artik EventSpec akisi.
- Detay sayfasi tarih: `end_date === start_date` ise tek tarih goster (ok isareti yok).

### 3. Teklif topla (`app/teklif-topla/page.tsx`, `teklif-topla-formu.tsx`, `actions.ts`)

- `page.tsx`: `searchParams.etkinlik` okunur; `gorunenEtkinlikId` ile dogrulanir; ayrica `butce_min`/`butce_max`
  parametreleri (sayi) `onDoldur`'a eklenir. `onDoldur`'a `etkinlikId: string | null`, `butceMin`, `butceMax`.
- `teklif-topla-formu.tsx`: `etkinlikId` state'te tutulur (gizli; kullanici degistiremez), butce alanlari on dolar
  (form zaten `budget_min`/`budget_max` alanlarina sahip; mevcut davranis: bos gelirse eskisi gibi). Ust bilgi seridi:
  `etkinlikId` doluysa "Bu talep <a href=/etkinliklerim/{id}>etkinligine</a> baglanacak" (kisa, tek satir).
- `actions.ts` `CreateQuoteRequestInput`'a `event_id?: string | null`; `createQuoteRequest` insert govdesine
  `event_id: await gorunenEtkinlikId(supabase, input.event_id)`. Baska alan degismez.
- **Sohbet bagi (teklif verme):** pro teklif verirken conversation acan/guncelleyen kod (`actions.ts` ~satir 310-360):
  `quote_requests` select listesine `event_id` eklenir; yeni conversation INSERT'ine `event_id: request.event_id`;
  mevcut conversation UPDATE'ine `request.event_id` doluysa `event_id` (Yol A: en son is kazanir; NULL ise dokunma).
- Etkinlik sayfasi "Teklif topla" linki: `&etkinlik=<event.id>&butce_min=<budget_min>&butce_max=<budget_max>` (bos olanlar atlanir).

### 4. Ilan ac (`app/ilanlar/yeni/page.tsx`, `yeni-ilan-formu.tsx`, `listings-actions.ts`)

- `page.tsx`: `searchParams.etkinlik` -> `gorunenEtkinlikId`; doluysa etkinlik `select('id, title, event_type, start_date, city_id, participant_count, budget_min, budget_max')`
  ile okunur (RLS) ve forma `onDoldur` olarak gecer: `{ etkinlikId, kategoriId: searchParams.kategori (sayi) | null, eventType, eventDate: start_date, cityId, guestCount: participant_count, budgetMin, budgetMax, title }`.
  `title` on dolum onerisi: etkinlik basligi varsa o, yoksa `<Tur adi> — <Sehir>`; kullanici degistirir.
- `yeni-ilan-formu.tsx`: `initialData` YOKKEN (yeni ilan) `onDoldur` ile baslangic state'i; `etkinlikId` gizli state;
  ust bilgi seridi "Bu ilan ... etkinligine baglanacak". Duzenleme modu (`initialData`) DEGISMEZ.
- `listings-actions.ts` `createListing` input'una `event_id?: string | null`; insert govdesine
  `event_id: await gorunenEtkinlikId(supabase, input.event_id)`. `updateListing` `event_id`'ye dokunmaz.
- **Sohbet bagi (basvuru kabulu):** `listings-actions.ts` ~satir 805-848: `listingRel` select'ine `event_id`; `eventInfo`
  nesnesine `event_id: listingRel.event_id` (INSERT ve UPDATE ayni nesneyi kullaniyor; NULL ise eskisi gibi NULL yazar —
  kabul: en son kabul edilen is kazanir, mevcut Yol A kuraliyla tutarli).
- Etkinlik sayfasi "Ilan ac" linki (rol basina): `/ilanlar/yeni?etkinlik=<event.id>&kategori=<legacy_category_id>` (kategori NULL ise atlanir).

### 5. Dogrudan mesaj bagi (Kesfet -> profil -> sohbet)

- Etkinlik sayfasi "Kesfet" linki: `&etkinlik_id=<event.id>` eklenir (mevcut `etkinlik=<tur>` kalir).
- `app/kesfet/page.tsx`: `searchParams.etkinlik_id` (uuid bicimi kontrolu; DB sorgusu YOK) `ProfileCard`'a `etkinlikId`
  prop'u olarak gecer; `profile-card.tsx`: `profileHref = etkinlikId ? '/p/' + id + '?etkinlik=' + etkinlikId : '/p/' + id`.
  Kesfet'in filtre/siralama/sayfalama linkleri parametreyi KORUR (mevcut query'yi tasiyan yerler; yoksa raporla).
- `app/p/[id]/page.tsx`: `searchParams.etkinlik` (uuid bicimi) `IletisimButton`'a `etkinlikId` prop'u; `iletisim-button.tsx`
  `startConversation` cagrisina `event_id: etkinlikId` ekler (baska davranis degismez).
- `app/mesajlar/actions.ts` `startConversation`: `data.event_id?: string | null`; `gorunenEtkinlikId` ile dogrulanir;
  yeni conversation INSERT'ine `event_id`; mevcut conversation'da doluysa `updateFields.event_id` (Yol A).

### 6. Etkinlik sayfasi — bagli kayitlar (`app/etkinliklerim/[id]/page.tsx`)

"Bagli kayitlar" bolumu (RLS ne gosteriyorsa o):
- Talepler: `from('quote_requests').select('id, status, created_at, recipient_count, category_id, service_categories(name_tr)').eq('event_id', id).order('created_at', { ascending: false })`
  -> satir: kategori adi, durum etiketi (teklif-taleplerim'deki `STATUS_LABELS`'i tekrar yazma; ayni etiketleri kisa
  bir sabitle kopyalamak yerine oradan export edip kullan), alici sayisi, link `/teklif-taleplerim/<id>`.
  (`quote_requests.category_id -> service_categories` iliskisi yoksa PGRST200 alirsin; o zaman kategori adini ayri
  sorguyla cek ve raporla.)
- Ilanlar: `from('listings').select('id, title, status, created_at').eq('event_id', id)` -> link `/ilanlar/<id>`.
- Sohbetler: `from('conversations').select('id, professional_id, last_message_at, profiles!conversations_professional_id_fkey(full_name, company_name)').eq('event_id', id)`
  -> link `/mesajlar/<id>` (iliski adi farkliysa `supabase gen types` yerine hatadan gordugun adi kullan ve raporla).
Bos bolum: "Henuz bagli talep/ilan/sohbet yok" tek satir. Sayfanin ust kismi degismez.

### 7. Dogrulama

- `npx tsc --noEmit` bos; `npm run build` basarili.
- `grep -rn "event_id" app --include=*.ts --include=*.tsx | grep -v "spec_version_id\|events\.\|etkinlik" ` -> yazma
  noktalari YALNIZ: `teklif-topla/actions.ts` (insert + conversation insert/update), `ilanlar/listings-actions.ts`
  (insert + eventInfo), `mesajlar/actions.ts` (insert + updateFields); okuma: `etkinliklerim/[id]/page.tsx`. Raporda listele.
- `grep -rn "gorunenEtkinlikId" app` -> 3 action + 2 page (teklif-topla, ilanlar/yeni).
- `grep -rn "analyze-event-needs/1.1\|CIP_KAPALI" app` -> 0.
- Sapkali harf: degisen dosyalarda 0.
- **Onizleme turu (Test Musteri + bir pro hesabi):**
  1. `/etkinliklerim/<id>` -> "Teklif topla" -> form tur/sehir/tarih/kategori/butce on dolu, serit "etkinligine baglanacak";
     talep olustur -> `/etkinliklerim/<id>` "Bagli kayitlar"da talep gorunur.
  2. Ayni sayfadan "Ilan ac" -> form on dolu (baslik onerisi, tur, tarih, sehir, katilimci, butce, kategori); taslak
     olarak kaydet -> bagli kayitlarda ilan.
  3. "Kesfet" -> kartlar `/p/<id>?etkinlik=...` -> profilde "Iletisime gec"/teklif iste -> sohbet acilir -> bagli
     kayitlarda sohbet (Test Musteri'nin o pro ile eski sohbeti varsa UPDATE ile baglanir; raporla).
  4. Pro hesabiyla (Test Pro) 1'deki talebe teklif ver -> sohbetin `event_id` dolu (SQL ile).
  5. Sihirbaz adim 4: Ankara secili, sayisi 0 cipler secilebilir; onay calisiyor.
  6. `/etkinlik-planla`: "15 Haziran'da Kadikoy'de 40 kisilik dogum gunu" -> kayitta `start_date` gelecek 15 Haziran,
     provenance `derived`/`date_assumed`, `parser_version 1.2`.
  Ardindan (Guven, uretim SQL Editor, salt okunur):
  ```sql
  select 'quote' k, id::text, event_id::text, status::text from public.quote_requests where event_id is not null
  union all select 'listing', id::text, event_id::text, status::text from public.listings where event_id is not null
  union all select 'conv', id::text, event_id::text, coalesce(last_message_at::text,'') from public.conversations where event_id is not null;
  ```
  ve `asama12`: K8 > 0 (talep*100 + ilan), K1-K6 ESIT.

## Yapilmayacaklar

- Eski formlarin alanlari, dogrulamalari, hata mesajlari, e-posta/bildirim akislari degismez.
- `event_id` istemci degeriyle dogrulanmadan yazilmaz. `events`/`event_requirements` yazilmaz. Migration yok.
- Kesfet filtre mantigi, siralama, sayac degismez (yalniz parametre tasima).
- `updateListing`, quote duzenleme, sohbet atama akislarinda `event_id`'ye dokunulmaz.

Rapor: degisen dosya listesi, tsc/build, grep ciktilari (ozellikle event_id yazma noktalari), onizleme turunun 6
maddesi, SQL ciktisi (Guven kosar), iliski adi/PGRST200 gibi sapmalar ve nedeni. Commit ATMA.
