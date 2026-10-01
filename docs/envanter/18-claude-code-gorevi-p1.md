# Claude Code gorevi — FAZ 6 / P1: aday listesi (`/etkinliklerim/[id]` icinde "Aday öner")

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/18-faz6-eslestirme-ekip.md` (bolum 2 kararlar, bolum 3 RPC'ler,
bolum 8 P1, bolum 9 kurallar). ON KOSUL: 6-DB/01 uretimde (commit `0b473f0`).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/18-faz6-eslestirme-ekip.md` (bolum 2, 3, 8-P1, 9),
`supabase/migrations/20261002120000_faz6_01_eslestirme_ekip.sql` (`run_event_match`, `mark_match_candidates_shown`,
`mark_match_candidate_clicked` imzalari ve hata metinleri; `match_candidates` sutunlari), `app/etkinliklerim/[id]/page.tsx`
(sayfa yapisi, `gereksinimler`, "Bagli kayitlar" bolumu), `app/lib/eventspec-server.ts`, `app/ajans/havuz/havuz-rate-actions.ts`
(action + hata eslemesi deseni), `app/kesfet/profile-card.tsx` (kart gorunumu; yeniden kullanma zorunlu degil).

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. Tek parca: etkinlik detay sayfasina "Adaylar" bolumu.
Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar (18 bolum 9)

- Skor ve aday listesi DB'de uretilir: uygulama yalniz `rpc('run_event_match', { p_event_id })` cagirir (strateji varsayilan `hybrid`;
  parametre GONDERME), sonucu okur ve gosterir. `match_runs`/`match_candidates` tablolarina INSERT/UPDATE **YOK** (yetki de yok).
- Gosterilen her aday isaretlenir: liste ekranda gorununce `rpc('mark_match_candidates_shown', { p_run_id, p_candidate_ids })`;
  "Profili gör" tiklaninca `rpc('mark_match_candidate_clicked', { p_candidate_id })` (basarisiz olsa da gezinme devam eder).
- Gerekce kodlari SABIT listeden Turkce etikete cevrilir; bilinmeyen kod GOSTERILMEZ, yeni kod uretilmez:
  `same_city` "Aynı şehir", `date_available` "Tarihte müsait", `budget_fit` "Bütçeye uygun", `high_trust` "Yüksek güven",
  `new_talent` "Yeni yetenek", `coverage_full` "Tam kapsam".
- "Aday öner" dugmesi yalniz **etkinlik sahibine** (`events.owner_user_id === user.id`) ve yalniz `status` `confirmed`/`matching`
  iken. Baskasi (kurulus uyesi / admin; RLS satiri gosteriyorsa) mevcut kosuyu salt okunur gorur, dugme yok, isaretleme RPC'leri
  cagrilmaz (sahip degil -> 42501 verirdi).
- Sapkali harf yok; kullaniciya gorunen metinler duzgun Turkce, yorumlar ASCII. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. Veri (sunucu, `page.tsx` + `app/etkinliklerim/[id]/aday-data.ts` paylasilan tipler/etiketler — `'use client'` DEGIL)

- Son kosu: `match_runs` SELECT (`id, strategy, algorithm_version, candidate_count, created_at`) `event_id = id` `order created_at desc`
  — ilk satir "son kosu", kalanlar "onceki kosular" (yalniz sayi + tarih listesi).
- Son kosunun adaylari: `match_candidates` SELECT (`id, provider_id, role_id, match_score, coverage_ratio, full_service_eligible,
  final_rank, reason_codes, was_shown, was_clicked`) `match_run_id = son.id` `order final_rank`.
- Saglayici bilgisi: `v_providers_public` SELECT (`id, display_name, provider_slug, city_id, avatar_url, provider_type, headline`)
  `.in('id', providerIds)` + sehir adi (`turkish_cities`), rol adi `gereksinimler`'den (`service_roles.name_tr`).
- `aday-data.ts`: `GEREKCE_ETIKETLERI`, `uyumYuzdesi(match_score)` (0-100 tam sayi), `kapsamYuzdesi(coverage_ratio)`, tipler.

### B. Bolum (istemci `aday-paneli.tsx` + `aday-actions.ts`)

Sayfada "İhtiyaçlar" bolumunden sonra, "Bağlı kayıtlar"dan once yeni bolum **"Adaylar"** (ayni baslik stili: mono, uppercase).
- Ust satir: son kosu bilgisi ("Son eşleştirme: 1 Ekim 2026 14:05 · v0.1 · 7 aday") veya "Henüz eşleştirme yapılmadı."; sahip ve
  durum uygunsa dugme **"Aday öner"** (ilk kosuda) / **"Yeniden eşleştir"** (kosu varsa) -> `runEventMatch(eventId)` ->
  `rpc('run_event_match', { p_event_id })` -> `revalidatePath('/etkinliklerim/<id>')`. Dugme `pending` durumunda kilitli.
  Hata eslemesi: `42501` "Bu etkinlik için eşleştirme yapma yetkin yok."; `22023` message 'onaylanmali' iceriyorsa "Önce etkinliği
  onayla.", 'gereksinimi yok' iceriyorsa "Etkinlikte ihtiyaç kaydı yok; sihirbazdan ekle.", degilse mesajin kendisi; `P0002`
  "Etkinlik bulunamadı."; diger: "Eşleştirme yapılamadı, tekrar dene."
- Kosu yoksa ve sahip degilse bolum hic render edilmez.
- **"Tam hizmet: ajanslar"** alt bolumu (`role_id` NULL adaylar, `final_rank` sirali): kart = ad, sehir, "Kapsam %87", `full_service_eligible`
  ise rozet **"Tam hizmet"**, degilse kucuk not "Kısmi kapsam — bazı zorunlu roller karşılanmıyor", gerekce rozetleri, uyum %,
  "Profili gör" (`/p/<provider_id>`). Aday yoksa "Bu etkinlik için uygun ajans bulunamadı."
- **"Rol bazında profesyoneller"** alt bolumu: her gereksinim icin (sort_order sirali) baslik "<rol adı> · <adet> kişi" ve o rolun
  adaylari (`final_rank` sirali) kartlar: ad, sehir, uyum %, gerekce rozetleri, "Profili gör". Aday yoksa "Bu rol için aday yok."
- Gosterim isareti: panel ilk render edildiginde (`useEffect`, bir kez; `localStorage` yok) `markCandidatesShown(runId, idler)` —
  yalniz `was_shown = false` olanlar gonderilir; sahip degilse cagrilmaz.
- "Profili gör": `<a>`/`Link` tiklamasinda `markCandidateClicked(id)` (await etmeden; `startTransition`), ardindan gezinme.
- Alt not (sabit metin, kucuk): "Bu liste kurallara göre otomatik sıralanır; gerekçeler her kartta yazar. Sıralamaya itiraz etmek
  veya inceleme istemek için bize yaz." — "bize yaz" mevcut iletisim sayfasina/e-postasina baglanir (footer'da ne varsa; yoksa duz metin).
- Etkinlik durumu rozeti `matching` -> "Eşleştiriliyor" zaten var (`DURUM_ETIKETLERI`); kosudan sonra sayfa yenilenince gorunur.

### C. Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -rn "run_event_match\|mark_match_candidate" app` -> yalniz `aday-actions.ts`. `grep -rn "from('match_" app` -> yalniz
  `app/etkinliklerim/[id]/page.tsx` (SELECT). `grep -rn "insert\|update" app/etkinliklerim/[id]/aday-actions.ts` -> 0.
- Sapkali harf 0 (kod noktasiyla tara). Kullaniciya gorunen metinler duzgun Turkce.
- **Canli tur (Guven):**
  1. Test Musteri: onayli etkinliklerinden biri (`/etkinliklerim` -> onayli olan) -> "Adaylar" bolumu "Henüz eşleştirme yapılmadı." +
     "Aday öner" -> tikla -> liste: "Tam hizmet: ajanslar" (Sunucu Ajans bekleniyor: kapsam yuzdesi, tam hizmet/kismi) ve rol bazinda
     profesyoneller (Test Pro vb.); durum rozeti "Eşleştiriliyor".
  2. Bir "Profili gör" -> profil acildi; geri don -> "Yeniden eşleştir" -> ikinci kosu, ust satirda "Önceki eşleştirmeler: 1".
  3. Sunucu Ajans ile ayni etkinlik URL'si -> sahibi degil; RLS satir vermiyorsa 404 (beklenen, FAZ 8 oncesi).
  4. Taslak (onaysiz) bir etkinlikte "Adaylar" bolumu dugmesiz ("Önce etkinliği onayla" metni gorunebilir) — varsa.
  SQL (uretim, salt okunur, tek tek):
  ```sql
  select r.id, r.strategy, r.algorithm_version, r.candidate_count, r.latency_ms, e.status
    from public.match_runs r join public.events e on e.id = r.event_id order by r.created_at desc limit 5;
  select c.role_id, c.final_rank, c.match_score, c.coverage_ratio, c.full_service_eligible, c.reason_codes, c.was_shown, c.was_clicked
    from public.match_candidates c where c.match_run_id = (select id from public.match_runs order by created_at desc limit 1)
   order by c.role_id nulls first, c.final_rank;
  ```
  Beklenen: 2 kosu, etkinlik `matching`; ilk kosunun adaylarinda `was_shown` true, tiklanan `was_clicked` true; ajans satiri `role_id`
  NULL + `coverage_ratio` dolu. `asama14`: K8 0, K10 >= 200.

## Yapilmayacaklar

- Ekip kurma (P2). Strateji secimi (yalniz `hybrid`). Skor hesaplama/siralama istemcide YOK (DB sirasi aynen).
- `match_*` tablolarina yazma. Gerekce kodu uydurma.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, sapma ve nedeni. Commit ATMA.
