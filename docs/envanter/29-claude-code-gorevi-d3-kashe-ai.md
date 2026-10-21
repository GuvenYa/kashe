# Claude Code gorevi — Tasarim dili v2 / D3: Kashe AI ekranlari ("Etkinligini anladim." ozeti + "Uc yol" eslesme sonucu)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` desen 3 + 5 ve D3 dilimi; video
`kashe_eventai_v4` 6. kare (eyebrow "KASHE AI · ETKINLIK PLANLAMA ASISTANI", h1 "Etkinligini **anladim**.", alt satir "Anlattiklarindan
su kisitlari cikardim; eslesme bunlara gore yapilacak.", 6 kutu: ETKINLIK TURU · SEHIR · TARIH · KATILIMCI · BUTCE (pembe) · ROLLER; altinda
"● Eslesme hazir" karti: gradyan ilerleme cubugu, 4 yesil ✓ satir, sagda 4 sayac) ve 8. kare (eyebrow "KASHE AI · ESLESME SONUCU", h1
"Uc yol: **ekibini kur**, isi firmaya ver ya da birlestir.", alt satir "4 rol · 20 aday · tarih, sehir ve butce kisitina uyumlu, uyum puanina
gore siralı.", sagda segment: "Tekil profesyonellerden ekip · Tum isi ajansa ver · Hibrit ekip"; rol sutunlari (DJ · SUNUCU · FOTOGRAFCI ·
TEKNIK EKIP, her birinde "5 ADAY"), her sutunda ustte pembe cerceveli "ONERILEN" kart, kartlar: avatar · ad ✓ · "Ankara · ★ 4,9 · 38 is" ·
sagda fiyat + uyum halkasi (96) · altta yesil "14 MAYIS MUSAIT" rozeti; altta koyu yapiskan serit: sol "ONERILEN EKIP · 4 TEKIL PROFESYONEL /
4 rol · toplam 640.000 TL", ortada "Butce kullanimi" gradyan cubuk "%91 · 700.000 TL icinde", sagda "Ekibi olustur →").
ON KOSUL: main'de D2-ek. Dal: `tasarim/d3` (Guven acti). **Migration/RPC YOK; eslestirme algoritmasi (`run_event_match`) DEGISMEZ.**

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d3`). Oku: `CLAUDE.md` (FAZ 4c sihirbaz, FAZ 6 eslestirme/ekip paragraflari),
`DESIGN.md` bolum 9, `docs/envanter/22-tasarim-dili-v2.md` (desen 3, 5; D3), `app/etkinlik-sihirbazi/sihirbaz-client.tsx` (1175; adimlar
Anlat · Etkinlik turu · Sehir · Tarih ve olcek · Ihtiyac; URL'ye bagli durum; ~385 `anladiklarimiz` cipleri; ~604 onay sonrasi
`router.push('/etkinliklerim/<id>')`), `app/etkinlik-sihirbazi/actions.ts` (analiz + onay), `app/etkinliklerim/[id]/page.tsx` (sekmeler
`?sekme=`; ~278 match kosulari; ~1117 `/kurumsal/rfp?etkinlik=`), `app/etkinliklerim/[id]/aday-paneli.tsx` (306; `runEventMatch`,
`markCandidatesShown/Clicked`, ajans adaylari + rol gruplari, `AdayKartiGovde`), `aday-data.ts` (`AdayKarti`: ad, sehir, headline, uyum,
kapsam, tamHizmet, gerekceler; `GEREKCE_ETIKETLERI`; saglayici `avatar_url`), `aday-actions.ts`, `ekip-actions.ts` (`createCrew`,
`addCrewMemberFromCandidate(crewId, eventId, roleId, providerId, matchCandidateId)`), `ekip-paneli.tsx`, `app/components/panel/ozet-serit.tsx`,
`app/components/panel/kpi-kutu.tsx`, `app/lib/para.ts`, `supabase/migrations/20261002120000_faz6_01_eslestirme_ekip.sql` ~376-520
(`run_event_match`: ayni sehir 40 · tarih musait 25 · butce uyumu 20 · yuksek guven 15 · yeni yetenek 5; musaitlik `availability_blocks`
+ onayli `bookings` ile ELENIR; `reason_codes`).

**Kirmizi cizgi:** sihirbaz adimlari, analiz ve onay action'lari; `run_event_match` ve `match_*` okuma yolu; `createCrew` /
`addCrewMemberFromCandidate` imzalari; RFP akisi; `markCandidatesShown` (kosu basina bir kez) DEGISMEZ. Puan/siralama DB'den; istemci
YENIDEN SIRALAMAZ, puan hesaplamaz. Sayilar yalniz GERCEK veriden: "Taranan profil" ve "Sure" sayaclari (videoda var) DB'de yok →
GOSTERILMEZ. Fiyat yalniz yayindaki hizmetlerin en dusuk `price_min`'i ("… TL'den"); yoksa fiyat alani bos.

## 1) Sihirbaz — "Etkinligini anladim." ozeti (desen 3)

`sihirbaz-client.tsx`: bugunku "Brief'ten anladiklarimiz" cip seridi yerine **ozet paneli** (ayni veri: URL durumu; ayni tiklama
davranisi: kutu → ilgili adim). Gorunum: eyebrow kisa pembe cizgi + "KASHE AI · ETKINLIK PLANLAMA ASISTANI"; h1 "Etkinligini
<em class="brand-accent">anladim</em>." (sihirbaz bir CALISMA yuzeyidir: vurgu PEMBE — DESIGN.md 9'a not); alt satir "Anlattiklarindan su
kisitlari cikardim; eslesme bunlara gore yapilacak."; 6 kutu `grid grid-cols-2 md:grid-cols-3 gap-3` (eyebrow etiket + deger; `KpiKutu`
dili): ETKINLIK TURU · SEHIR · TARIH (esnekse "Esnek · <ay>") · KATILIMCI ("300 kisi") · BUTCE (`vurgu='accent'`; `formatTLAralik`) ·
ROLLER (secilen kategoriler " · " ile). Eksik deger → kutu soluk, "— · ekle" (tiklaninca o adim). Panel yalniz analizden sonra ya da
adim ≥ 1 iken gorunur (bugunku serit kosulu). Adim basligi/ilerleme cubugu ve adim govdeleri AYNEN.

## 2) Onay sonrasi — Adaylar sekmesine, eslestirme otomatik

Onay basarili → `router.push('/etkinliklerim/<id>?sekme=adaylar&eslestir=1')`. `AdayPaneli`: `eslestir=1` + `sahip` + `durumUygun` +
`sonKosu === null` ise mount'ta `runEventMatch` BIR kez (mevcut `azOnce` korumasi; URL'den `eslestir` `replace` ile silinir ki yenileme
tekrar kosturmasin). Kosu varken ust kart **"● Eslesme hazir"** (`OzetKutuSatiri` degil; ozel kart): gradyan ilerleme cubugu
(`--gradient-brand`, dolu), yesil ✓ satirlar YALNIZ gecerli olanlar — "<tarih> icin musaitlik kontrol edildi" (etkinlik tarihi varsa),
"Ayni sehir puanlandi" (sehir varsa), "Butce uyumu hesaplandi" (butce varsa), "Uyum puani ile siralandi" (her zaman); sagda sayaclar
(`KpiKutu`): ROL (rol grubu sayisi) · UYGUN ADAY (`candidate_count`) · AJANS (ajans adayi sayisi). Eslestirme surerken ayni kart
"● Profesyoneller taraniyor" + bos sayaclar (video 5. kare); kosu yokken bugunku "Aday oner" dugmesi.

## 3) Adaylar sekmesi — "Uc yol" (desen 5 + video 8. kare)

- Baslik: eyebrow "KASHE AI · ESLESME SONUCU"; h1 "Uc yol: <em>ekibini kur</em>, isi firmaya ver ya da birlestir."; alt satir
  "<N> rol · <M> aday · tarih, sehir ve butce kisitina gore puanlandi, uyum puanina gore sirali." Sag: **segment kontrol** (istemci
  `useState`, `role="tablist"`): "Tekil profesyonellerden ekip" (yalniz rol sutunlari) · "Tum isi ajansa ver" (yalniz ajans listesi) ·
  "Hibrit ekip" (ikisi; varsayilan). Yeni kosu YOK — mevcut kosunun adaylari suzulur.
- **Rol sutunlari**: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4`; sutun basi eyebrow "<ROL>" + sag "N ADAY" (+ "istege bagli").
  Aday karti (kompakt): avatar 40 px (`avatar_url`; yoksa bas harfler) · ad · "<Sehir> · <gerekce rozetleri: en cok 2>" · sagda
  "… TL'den" (varsa) + **uyum halkasi** (SVG `r=14`, `stroke-dasharray`, icinde `%uyum`; ≥ 80 moss, 60-79 brand-ink, alti ink-50) ·
  altta rozet: `date_available` gerekcesi varsa yesil "<GUN AY> MUSAIT", yoksa yok. `final_rank === 1` → pembe cerceve + "ONERILEN"
  rozeti. Secim: kart tiklaninca secilir (rol basina en cok `ihtiyac` kadar; ilk acilista her rolun onerileni SECILI gelir); "Profili
  gor" baglantisi ayri (mevcut `markCandidateClicked`). Fiyat verisi: `aday-data.ts`'ye TEK toplu `services` okumasi (saglayici id'leri
  `in`), `AdayKarti.baslangicFiyati: number | null`.
- **Ajans listesi** ("Tum isi ajansa ver" / hibrit): kartlar ad · "Kapsam %N" · "Tam hizmet" rozeti · uyum halkasi · gerekceler; sag
  dugme: etkinlik kurulusa aitse (`organization_id` dolu, kullanici `events.manage`) "Teklif talebi ac →" (`/kurumsal/rfp?etkinlik=<id>`,
  mevcut), degilse "Teklif Al" (`IletisimButton`, mevcut).
- **Serit** (`OzetSerit` yeni varyant `koyu` + `herGenislik`: lacivert zemin, tum genisliklerde yapiskan; mevcut cagiranlar
  DEGISMEZ): sol eyebrow "ONERILEN EKIP · <N> TEKIL PROFESYONEL" + "<N> rol · <M> secili"; orta: etkinlik butcesi VE secili adaylarin
  HEPSINDE baslangic fiyati varsa "Baslangic fiyatlari toplami ~<X> TL · butce <Y> TL" + gradyan cubuk (oran; %100 ustu `danger`),
  biri bile yoksa bu blok YOK (yarim toplam gosterilmez); sag birincil **"Ekibi olustur →"**: ekip yoksa `createCrew` (ad: etkinlik adi),
  sonra her secili icin `addCrewMemberFromCandidate` (sirayla; hata olursa dur, mesaj), bitince `?sekme=ekip`. Ekip zaten varsa ayni
  ekibe ekler. Secim yoksa dugme pasif.
- Isaretleme (`markCandidatesShown`) ve "Yeniden eslestir"/onceki kosular bilgisi (kucuk satir) AYNEN.

## 4) `DESIGN.md` bolum 9

Desen 3 notu (sihirbaz = calisma yuzeyi, vurgu pembe), uyum halkasi (`UyumHalkasi` bileseni `app/components/panel/uyum-halkasi.tsx`),
segment kontrol dili, `OzetSerit` `koyu`/`herGenislik`.

## 5) Yapilmayacaklar

Migration/RPC YOK; `run_event_match` cagri imzasi ve strateji DEGISMEZ (segment yalniz gorunumu suzer); sihirbaz adim/analiz/onay
mantigi degismez; ekip uyesi/maliyet action'lari degismez; "Taranan profil"/"Sure" sayaci YOK; fiyat tahmini yalniz tum seciliyle.
Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "Taranan profil\|Süre" app/etkinliklerim app/etkinlik-sihirbazi` → 0; `grep -rn "run_event_match" app` → yalniz
  `aday-actions.ts`; `grep -rn "₺" app` → 0; sapkali harf 0; yorumlar ASCII.
- **Onizleme turu (Claude):** testguven — `/etkinlik-sihirbazi?kurulus=<Test Guven>`: Anlat'a "Ankara'da 120 kisilik bayi lansmani,
  12 Mart 2027, DJ ve fotografci, butce 150 bin" → Analiz → ozet paneli 6 kutu (eksikler "— · ekle") → Onayla → `?sekme=adaylar&eslestir=1`
  → "Eslesme hazir" karti (✓ satirlar, ROL/UYGUN ADAY/AJANS) → "Uc yol" basligi, segment, rol sutunlari (ONERILEN pembe, uyum halkasi,
  "… TL'den"), serit "Ekibi olustur →" → Ekip sekmesinde uyeler (test etkinligi; sonra silinebilir); 375 px: sutunlar alt alta, serit;
  gmail lansman etkinligi Adaylar sekmesi yeni gorunumde (mevcut kosu). Konsol 0, tasma 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
