# Claude Code gorevi — Duzeltme 01 / P1: Sahne senaryo turu bulgulari (uygulama tarafi; #29 #28 #14 #6 #7 #16 #19 #20 #4 #5 #18 #26)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/sahne/bulgular.md` (madde numaralari oradan), urun kararlari (Guven, 29 Ekim 2026):
#4 bos kategori filtrede gizlenir; #5 avatarsiz saglayicida kategori ikonu; #18 pazar butce kutusu kismi kapsamla gosterilir; #23 ekip
bildirimleri DB tetikleyicisiyle (uygulamada is yok). DB tarafi `supabase/migrations/20261030120000_duzeltme_01_sahne_bulgulari.sql`
(dalda uygulanmis): `provider_public_stats(p_provider)`, `proposals_expire_stale()` + gunluk is, `analytics_summary().funnel.linked`,
ekip bildirim tetikleyicileri. Dal: `duzeltme-01` (Guven acar, `faz10a/p1` uzerinden). **Migration YOK.**

---

Kashe reposundasin. Once `git status` (temiz; dal `duzeltme-01`). Oku: `CLAUDE.md`, `DESIGN.md`, migration dosyasinin baslik yorumu,
`app/p/[id]/page.tsx` (guven cipleri, `getBadgeCards`, `YorumButton`, ajans ekip/kimlik karti), `app/rezervasyon/[id]/page.tsx` +
`aksiyonlar.tsx`, `app/mesajlar/[id]/page.tsx`, `app/ajans/page.tsx` ("Acik isler"), `app/ajans/teklifler/*`, `app/admin/page.tsx`,
`app/admin/zeka/page.tsx` (huni blogu, `oran`, `Huni` tipi), `app/ajans/teklifler/teklif-actions.ts` (portal baglantisi), `app/lib/site.ts`,
`app/lib/email/resend-client.ts` (`SITE_URL`), `app/etkinliklerim/[id]/{aday-paneli,ekip-paneli}.tsx`, `app/kesfet/page.tsx` +
`kesfet-filters.tsx`, `app/components/ui/category-icon.tsx`, `app/etkinlik-sihirbazi/pazar-butce-kutusu.tsx` + `app/lib/fiyat-kiyas-data.ts`.

**Kirmizi cizgi:** migration/RPC YOK; sayilar UYDURULMAZ (RPC/veri yoksa cip cizilmez); `bookings`'i ucuncu kisi adina istemci sorgusuyla
saymaya CALISMA (RLS; #29'un nedeni); sapkali harf yok, yorumlar ASCII, UI Turkce; Kesfet siralamasi ve portal gorunumu degismez. Commit ATMA.

## 1) #29 — /p/[id] guven cipleri `provider_public_stats` ile

`supabase.rpc('provider_public_stats', { p_provider: profile.id })` -> `{ provider_id, completed_jobs, distinct_customers, repeat_customers }`
(anon ve authenticated cagirir; SECURITY DEFINER; kimlik yok). Profesyonel dalinda `dealRows` sorgusu ve ondan turetilen
`tamamlanmisIsSayisi` / `repeatSignal` KALKAR: `tamamlanmisIs = completed_jobs`, `repeat = distinct_customers > 0 ?
{ distinctCustomers: distinct_customers, repeatRate: repeat_customers / distinct_customers } : null`. Ajans dalinda `ajansDealRows` sorgusu
KALKAR: `ajansTamamlanmisIs = completed_jobs`, `ajansTekrarTercih = repeat_customers > 0`. RPC hata verirse (`error`) cip ve rozet CIZILMEZ
(0 degil, "veri yok"); `console.error('[profil] provider_public_stats', ...)`. `deal_confirmed_customer_ids` ("onayli yorum") ve `canReview`
hesabi DEGISMEZ (onlar ziyaretcinin kendi iliskisini sorar).

## 2) #28 — "Yorum birak" cagrisi

- `/rezervasyon/[id]`: rezervasyon `completed` ve bakan kisi `customer_id` (ya da kurum adina `canOwnForBusiness`) ise ve bu musterinin
  bu saglayiciya yorumu yoksa (`reviews` kendi satiri RLS ile okunur) sayfanin ust bloguna "Yorum bırak →" baglantisi:
  `/p/<saglayici id>?yorum=1`. Yorum varsa "Yorumun yayında →" (`/p/<id>#yorumlar`).
- `/mesajlar/[id]`: konusmada "işi tamamlandı" sistem mesajinin (booking completed) altinda ayni baglanti (yalniz musteri tarafinda; pro
  tarafinda yok). Sistem mesaji tespiti mevcut `message_type = 'system'` + rezervasyon durumu uzerinden; metin eslestirme YAPMA, konusmanin
  `bookings` satirina bak (musteri kendi rezervasyonunu RLS ile okur).
- `/p/[id]`: `?yorum=1` geldiginde `YorumButton` modalini acik baslatir (`enabled` kosullari ayni; kosul tutmuyorsa parametre yok sayilir).
  `searchParams` sunucudan prop olarak gecer; istemci `useSearchParams` ile de olabilir, ikisi birden degil.

## 3) #14 — suresi dolan teklif

DB artik `valid_until` gecen `sent/viewed` teklifleri gunluk `expired` yapar (00:15) ve migration ilk kosuyu yapti. Uygulama:
- `/ajans` "Acik isler": `status IN ('sent','viewed')` VE gonderilmis surumun `valid_until >= now()` olanlar acik sayilir; gecmisse liste
  disi (ya da ayni satirda "Süresi doldu" rozeti — Acik isler bloguna GIRMEZ). `expired` durumunun etiketi/tonu teklif listesi ve detayda
  var mi kontrol et (`'expired'` -> "Süresi doldu", notr ton); yoksa ekle.
- Teklif detayinda (`/ajans/teklifler/[id]`) `expired` iken "Yeni sürüm" eylemi acik kalir (7a kurali), "Gönder" kapali — mevcut davranisi
  dogrula, degistirme.

## 4) #6 — admin dashboard "onay bekleyen" karti

`/admin` ust kartlarina "Onay bekleyen profil" karti: `providers` `approval_status = 'pending'` sayisi + alt satir "N revizyon istendi"
(`approval_status = 'revision'`); baglanti `/admin/profiller?durum=pending` (sayfanin mevcut filtre parametresi neyse onu kullan; yoksa
`/admin/profiller`). Admin RLS `providers`'i okur. Diger kartlarla ayni bilesen/duzen (yeni kart stili uydurma).

## 5) #7 — /admin/zeka huni baslik KPI'lari

`analytics_summary(p_days).funnel.linked = { events, with_match, with_selection, with_approval, with_booking }` (pencerede onaylanan
etkinlikler; her adim ayni etkinlige bagli; oranlar <= %100). Baslik KPI'lari bu bloktan: "Onaylanan etkinlik → rezervasyon"
`= with_booking / events` ("x / y" alt satiriyla), "Eşleştirme kullanan" `= with_match / events`, "Seçim yapan" `= with_selection / events`.
Mevcut ham huni tablosu (`funnel.*` adimlari, "oncekine gore" ve "brief'e gore" sutunlari) AYNEN kalir; tablo ustune tek cumle not: "Adımlar
iç içe değildir; başlık oranları zincirli sayımdan (aynı etkinlik) hesaplanır." `Huni` tipine `linked` eklenir; `linked` yoksa (eski RPC)
baslik KPI'lari "—" gosterir (uydurma yok). Tiklanma/gosterim orani KPI'si degismez.

## 6) #16 — portal baglantisi onizlemede

`app/lib/site.ts`'e `requestSiteUrl()`: `VERCEL_ENV` `'production'` DEGILSE ve `VERCEL_BRANCH_URL` (yoksa `VERCEL_URL`) doluysa
`https://<o deger>`; aksi halde `SITE_URL`. `teklif-actions.ts` portal baglantisini (`/portal/teklif/<token>`) ve RFP/portal baglantisi
ureten diger action'lari (`grep -rn "/portal/" app --include=*.ts`) bununla kurar. E-posta sablonlari, sitemap, robots, OG `SITE_URL`'de
kalir (canonical). Sahne icin Vercel Preview `NEXT_PUBLIC_SITE_URL` gecici degeri kaldirilabilir — bunu Guven yapar, kodda not dusme.

## 7) #19 / #20 — etkinlik adaylari ve ekip paneli kucukleri

- `aday-paneli.tsx` `sureMetni`: 1 sn altinda "<ms> ms" (orn. "420 ms"), ustunde "x,x sn"; 0/NULL -> "—".
- `ekip-paneli.tsx` kapsam satiri: yalniz onayli sayilan "zorunlu roller eksik" yerine rol basina "0/1 onaylı · 1 önerildi" bicimi
  (onerilen + iletisime gecilen "önerildi" sayilir, onayli ayri); zorunlu rolde ne onayli ne onerili yoksa "Eksik: ..." kalir.
  "Havuzdan seç" listesi: rolu olan kayitlar once; "rolü yok" olanlar listenin sonunda daraltilmis "Rolü olmayan N kayıt" basligi altinda
  (ac/kapa), etiket tekrarina gerek kalmaz.

## 8) #4 — Kesfet kategori filtresi: bos kategori gizlenir

`app/kesfet/page.tsx` kategori listesi: yalniz `v_providers_public` icinde `is_visible = true` saglayicisi olan kategoriler (`primary_category_id`
GROUP BY ya da `in(...)` ile tek sorgu; mevcut `service_categories` sorgusuna eklenir). URL'de secili kategori boşsa bile (`?kategori=`) sayfa
kirilmaz: secim korunur, liste "0 sonuç" der. `/kategoriler` sayfasi ve ana sayfa kategori bolumleri DEGISMEZ (23 kategori). Filtre
bileseni prop olarak aldigi listeyi kullanir; sabit liste varsa prop'a cevrilir.

## 9) #5 — avatarsiz saglayicida kategori ikonu

`/p/[id]` baslik avatari ve ajans kimlik karti (ekip uyesi kartlari dahil): `avatar_url` yoksa bas harf karesi yerine
`CategoryIcon` (`app/components/ui/category-icon.tsx`; kategori slug'i `service_categories` embed'inden) ayni boyutta, zemin rengi mevcut
kare ile ayni. Kategori de yoksa (ajans) mevcut bas harf karesi kalir. Kesfet/ana sayfa kapak sirasi (portfoy > avatar) DEGISMEZ.

## 10) #18 — sihirbaz 4. adim pazar butce kutusu kismi kapsam

`pazar-butce-kutusu.tsx` / `fiyat-kiyas-data.ts`: rollerin en az yarisi icin yayinli hucre varsa kutu gosterilir: baslik
"Benzer etkinliklerde ~X TL (4/5 rol)", altinda "Veri olmayan rol: Ses & Işık" (eksik roller). Tam kapsamda mevcut metin aynen. Toplam
yalniz veri olan rollerin medyan toplami; eksik rol icin tahmin UYDURULMAZ.

## 11) #26 — konusma sayfasi basligi

`/mesajlar/[id]` `generateMetadata`: "Mesaj — <karsi tarafin adi> — Kashe" (ad yoksa "Mesajlar — Kashe"). Karsi taraf ad bilgisi sayfanin
zaten yaptigi sorgudan; metadata icin ek PII sorgusu YOK (yalniz ad).

## 12) Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`; `npx eslint <degisen dosyalar>`; `npm run build` (route tablosu +
  hata satiri yok + `.next/BUILD_ID`).
- `grep -rn "from('bookings')" "app/p/[id]/page.tsx"`: yalniz `canReview` (bakan kisinin kendi tamamlanmis rezervasyonu) sorgusu kalir.
- `grep -rn "provider_public_stats" app`: `/p/[id]` (profesyonel + ajans dali). `grep -rn "requestSiteUrl" app`: portal baglantisi ureten
  action'lar. `grep -rnP '[âîûÂÎÛ]' <degisen dosyalar>` bos.
- Onizleme (Sahne): `/p/<pro id>` anonim: "N TAMAMLANMIŞ İŞ" cipi dolu (Sahne'de 14 tamamlanmis isi olan `sahne+...` profilleri
  `docs/sahne/hesaplar.md`); musteri girisli ayni sayi; `/rezervasyon/<tamamlanan>` "Yorum bırak" -> modal acik; `/ajans` acik islerde
  suresi gecmis teklif yok; `/admin` onay karti 10 bekleyen / 3 revizyon; `/admin/zeka` baslik KPI'lari <= %100 ("x / y"); teklif gonderiminde
  portal baglantisi onizleme alan adinda; Kesfet filtresinde `Faz1 Test Havuz Rol A/B`, `Match A/B/C` yok; `/p/<pro>` avatar yerine kategori
  ikonu; sihirbaz 4. adimda 4/5 rol kutusu; konusma sekmesi "Mesaj — <ad> — Kashe".

## 13) Rapor

Bitince kisa rapor: degisen dosyalar, madde basina ne yapildi, sapmalar (gerekcesiyle). Commit ATMA.
