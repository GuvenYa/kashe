# Claude Code gorevi — FAZ 9a / P1: Admin zeka gostergeleri (`/admin/zeka`: gunluk olaylar, huni, adalet; grafik + tablo)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/34-faz9-zeka-katmani.md` bolum 1 (kararlar 2, 7, 8) ve bolum 2
(9a-P1) + `supabase/migrations/20261025120000_faz9a_01_olay_zinciri.sql` (DB dalda ve uretimde: `analytics_events` ekle-yalniz tablo,
23 olay adi, 10 tetikleyici, RLS SELECT yalniz `is_admin`, RPC `analytics_summary(p_days integer default 30) returns jsonb` — admin degilse
42501). Dal: `faz9a/p1` (Guven acar). **Migration/RPC YOK; `analytics_events` tablosu istemciden DOGRUDAN OKUNMAZ** — tek veri kaynagi
RPC. Panel dili (DESIGN.md 9): `PanelBaslik`, `PanelKart`, `KpiKutu`/`KpiSatir`, `VeriTablosu`; grafikler `recharts` (uygulamada var:
`app/admin/istatistikler/page.tsx`).

---

Kashe reposundasin. Once `git status` (temiz; dal `faz9a/p1`). Oku: `CLAUDE.md` (FAZ 8 paragraflari + sema ozeti), `DESIGN.md` bolum 9,
migration dosyasi (yukarida; `analytics_summary` govdesi — JSON sekli asagida da var), `app/admin/layout.tsx` (ADMIN_MENU, `PanelKabugu`
kabugu; erisim korumasi burada — sayfada ikinci kontrol YOK), `app/admin/istatistikler/page.tsx` ('use client' + `createClient` from
`@/app/lib/supabase-browser` + `supabase.rpc(...)` deseni; `C` renk sabitleri, `tooltipStyle`, `SERIF`/`MONO`, `RANGE_OPTIONS` pencere
secici, `StatTile`), `app/components/panel/*` (`PanelBaslik`, `PanelKart`, `KpiKutu`, `KpiSatir`, `VeriTablosu` — `md` altinda kart modu),
`app/components/panel/panel-yan-menu.tsx` (`IKONLAR` haritasi), `app/lib/tarih.ts` (`KASHE_SAAT_DILIMI`, tarih bicimleri).

**Kirmizi cizgi:** migration/RPC YOK; `analytics_events` dogrudan sorgulanmaz (yalniz `analytics_summary`); `app/admin/istatistikler/page.tsx`
davranisi DEGISMEZ (yalniz renk sabitleri ortak module tasinir, asagida); sayi bicimi `toLocaleString('tr-TR')`, yuzde tek ondalik; tarih
`tarih.ts`; sapkali harf yok, yorumlar ASCII, UI Turkce. Commit ATMA.

## 0) RPC JSON sekli (`analytics_summary(p_days)`)

```
{
  "from": "2026-09-25T09:00:00+00:00",   -- pencere baslangici (now() - p_days gun; 1..365 araliginda kirpilir)
  "days": 30,
  "totals": { "<event_name>": <adet>, ... },               -- penceredeki olay basina toplam; olay yoksa anahtar YOK
  "daily":  [ { "day": "2026-10-01", "event_name": "match_shown", "count": 12 }, ... ],   -- Istanbul gunu; (gun, olay) basina satir
  "funnel": { "brief_created": n, "event_confirmed": n, "match_run": n, "match_shown": n, "match_clicked": n,
              "selection": n, "approval": n, "booking_created": n, "booking_completed": n, "booking_cancelled": n },
  "fairness": { "shown_total": n, "shown_new_talent": n, "new_talent_share": 0.273 | null,
                "top3_new_talent_share": 0.333 | null, "providers_shown": n, "gini": 0.412 | null }
}
```

Huni adimlari (sira sabit): brief_created → event_confirmed → match_run → match_shown → match_clicked → selection → approval →
booking_created → booking_completed. `booking_cancelled` huni DISINDA bilgi satiri. `match_run/shown/clicked` benzersiz etkinlik,
`selection` = crew_selected + proposal_sent + quote_created (benzersiz etkinlik), `approval` = proposal_approved + quote_accepted +
rfp_awarded. `fairness.*_share` ve `gini` 0..1 arasi (UI yuzdeye cevirir; `null` = veri yok).

## 1) Ortak sabitler

- **`app/lib/grafik-tema.ts`** (yeni; istemci/sunucu ortak, React yok): `istatistikler/page.tsx`'teki `C` (paper, brandInk, ink,
  brandAccent, moss, brandInkDeep), `tooltipStyle`, `SERIF`, `MONO`, `PIE_PALETTE` AYNEN tasinir ve `export` edilir. `istatistikler/page.tsx`
  yerel tanimlari silip buradan import eder — baska HICBIR degisiklik yok (satir satir ayni davranis).
- **`app/lib/zeka.ts`** (yeni; ortak sabitler): `OLAY_ETIKETLERI: Record<string, string>` — 23 olay adi Turkce (brief_created "Brief
  olusturuldu", event_confirmed "Etkinlik onaylandi", event_cancelled "Etkinlik iptal", event_completed "Etkinlik tamamlandi", match_run
  "Eslestirme kosusu", match_shown "Aday gosterildi", match_clicked "Aday tiklandi", crew_selected "Ekibe secildi", crew_confirmed "Ekip
  onayladi", crew_declined "Ekip reddetti", proposal_sent "Teklif gonderildi", proposal_approved "Teklif onaylandi", proposal_declined
  "Teklif reddedildi", proposal_revision "Teklifte revizyon istendi", quote_created "Fiyat teklifi verildi", quote_accepted "Fiyat teklifi
  kabul", quote_declined "Fiyat teklifi red", rfp_sent "RFP gonderildi", rfp_awarded "RFP sonuclandi", rfp_cancelled "RFP iptal",
  booking_created "Rezervasyon olustu", booking_cancelled "Rezervasyon iptal", booking_completed "Rezervasyon tamamlandi");
  `OLAY_GRUPLARI`: `talep` (brief_*, event_*), `eslesme` (match_*, crew_*), `ticari` (proposal_*, quote_*, rfp_*), `rezervasyon`
  (booking_*) — grup etiketi Turkce; `HUNI_ADIMLARI: { anahtar, etiket }[]` yukaridaki sirada (etiketler: "Brief", "Etkinlik onayi",
  "Eslestirme", "Gosterim", "Tiklama", "Secim / teklif", "Onay", "Rezervasyon", "Tamamlanan"); `yuzde(x: number | null)` → `'%27,3'` /
  `'—'`; `oran(a, b)` → onceki adima oran metni (`b === 0` ise `'—'`).
  (UI metinlerinde Turkce karakter serbest: "Eşleştirme", "Gösterim" vb. — sapkali harf (â, î, û) YOK.)

## 2) Sayfa: `app/admin/zeka/page.tsx` ('use client')

Desen `istatistikler/page.tsx`: `useEffect` icinde `createClient()`; `Promise.all([ rpc('analytics_summary', { p_days }), rpc(.., { p_days: 7 }),
rpc(.., { p_days: 30 }), rpc(.., { p_days: 90 }) ])` — ilki secili pencere (ana bloklar), ucu sabit pencereler (adalet karsilastirmasi,
asagida). `p_days` degisince yalniz ilk cagri yenilenir (ayri effect). Yukleme durumunda iskelet (`animate-pulse` kutular), hata durumunda
`PanelKart` icinde kirmizi olmayan sade uyari metni (`text-ink-72`): 42501 → "Bu sayfa yalnizca platform yoneticisine acik."; diger →
"Veriler yuklenemedi: <mesaj>".

Baslik: `PanelBaslik` eyebrow "Admin · Zeka katmani", h1 "Zeka <em className="not-italic text-brand-accent">gostergeleri</em>", altNot
"Olay zinciri `analytics_events` uzerinden; sayilar secili pencereye gore (Istanbul gunu)." `sagAlan`: pencere secici — `RANGE_OPTIONS`
kalibi: 7 gun · 30 gun (varsayilan) · 90 gun · 365 gun (hap dugmeler; `aria-pressed`). Pencere basligi altinda kucuk mono not:
"Pencere: <from tarihi> — bugun".

### Blok 1 — Gunluk olaylar (`PanelKart` "Gunluk olaylar")

- **Grafik:** `recharts` `AreaChart`/`LineChart` (ResponsiveContainer, yukseklik 220): X = gun (`daily` gunleri; aradaki BOS gunler 0 ile
  doldurulur — pencere basindan bugune), Y = o gunun TOPLAM olayi (tum olay adlari toplanir) — TEK seri (`C.brandInk`); ikinci seri YOK
  (23 cizgi okunmaz). Tooltip: gun + toplam + en cok olan 3 olay adi (Turkce etiket · adet). X etiketleri `dd MMM` kisa, 7 gunden uzun
  pencerede seyreltilir (`interval="preserveStartEnd"`).
- **Tablo:** `VeriTablosu` sutunlar: "Olay" (Turkce etiket + altinda `font-mono text-[10px]` ham ad), "Grup" (`dar`), "Pencere toplami"
  (`sayisal`, `totals`), "Son 7 gun" (`sayisal`; `daily`'den istemcide toplanir — secili pencere 7 gunden kisa olamaz, en kucuk secenek 7).
  Satirlar: 23 olay adinin TAMAMI (`totals`'ta olmayan 0 yazar), grup sirasina gore (talep, eslesme, ticari, rezervasyon), grup icinde
  sozluk sirasi. Toplam satiri en sonda (vurgu yok, `font-medium`).
- **Bos durum:** `totals` bos → grafik yerine `text-ink-72` "Bu pencerede olay yok."; tablo yine 23 satir 0 ile cizilir.

### Blok 2 — Huni (`PanelKart` "Huni · talepten rezervasyona")

- **Grafik:** `BarChart layout="vertical"` (yatay cubuklar; yukseklik 9 adim x 28 px): Y = adim etiketi (`HUNI_ADIMLARI`), X = sayi;
  tek renk `C.brandInk`; `booking_completed` cubugu `C.moss` (semantik: basari). Sayi cubugun ucunda (`LabelList position="right"`).
- **Tablo:** `VeriTablosu` sutunlar: "Adim", "Sayi" (`sayisal`), "Onceki adima oran" (`sayisal`; ilk satir `—`), "Brief'e oran" (`sayisal`,
  `dar`). Son satir bilgi: "Iptal edilen rezervasyon" (`booking_cancelled`; oran sutunlari `—`; `text-ink-72`).
- Ustte `KpiSatir` 3 kutu: "Brief → rezervasyon" (booking_created / brief_created, `yuzde`), "Gosterim → tiklama" (match_clicked /
  match_shown), "Rezervasyon tamamlanma" (booking_completed / booking_created; `vurgu="moss"`). Payda 0 ise `—`.
- **Bos durum:** `brief_created === 0 && booking_created === 0` → "Bu pencerede huni verisi yok." (grafik/tablo cizilmez, KPI'lar `—`).

### Blok 3 — Adalet (`PanelKart` "Adalet · gorunurluk dagilimi")

Kaynak: `fairness` (secili pencere) + 7/30/90 sabit pencereler (`Promise.all`'daki uc ek cagri).

- Ustte `KpiSatir` 4 kutu (secili pencere): "Yeni yetenek payi" (`new_talent_share`, `yuzde`, `vurgu="accent"`), "Ilk 3'te yeni yetenek"
  (`top3_new_talent_share`), "Gini" (`gini` 3 ondalik; altNot "0 esit dagilim · 1 tek saglayici"), "Gosterilen saglayici"
  (`providers_shown`; altNot `shown_total` toplam gosterim).
- **Grafik:** `BarChart` (dikey, gruplu; yukseklik 220): X = pencere ("7 gun", "30 gun", "90 gun"), iki seri: "Yeni yetenek payi"
  (`C.brandInk`) ve "Ilk 3'te yeni yetenek" (`C.brandAccent`), Y 0–100 (%). `null` deger cubuk cizmez (0 DEGIL — `connectNulls` yok,
  veri `undefined`). `Legend` altta.
- **Tablo:** `VeriTablosu` satir = pencere (7/30/90 + secili pencere farkliysa 4. satir "Secili (<n> gun)"); sutunlar: "Pencere",
  "Gosterim" (`sayisal`), "Yeni yetenek" (`sayisal`), "Pay" (`sayisal`, `yuzde`), "Ilk 3 pay" (`sayisal`), "Saglayici" (`sayisal`, `dar`),
  "Gini" (`sayisal`, `dar`).
- **Bos durum:** `shown_total === 0` (secili pencere) → KPI'lar `—`, kartin ustunde `text-ink-72` "Bu pencerede eslestirme gosterimi yok;
  Match kosusu yapildikca dolar." — grafik yine 7/30/90 ile cizilir (orada veri varsa).
- Kartin altinda kucuk aciklama (`text-xs text-ink-50`): "Yeni yetenek: eslestirme kosusunda `new_talent` kodu alan saglayici. Gini,
  saglayici basina gosterim sayisinin dagilimidir." (00-genel-bakis "Adalet olculur" ilkesine atif yok; sade.)

### Yerlesim

Mobil-oncelikli: bloklar alt alta (`space-y-6`); `lg`'de Blok 2 ve 3 yan yana (`grid lg:grid-cols-2`), Blok 1 tam genislik ustte.
Grafikler `ResponsiveContainer width="100%"`; 375 px'te eksen etiketleri tasmaz (`tick fontSize 11`, uzun huni etiketleri `width={110}`
Y ekseni). Tablolar `md` altinda `VeriTablosu` kart moduna doner (kendiliginden).

## 3) Menu: `app/admin/layout.tsx`

`ADMIN_MENU` "Denetim" grubuna "Istatistikler"den SONRA `{ href: '/admin/zeka', etiket: 'Zeka', ikon: 'zeka' }`. `panel-yan-menu.tsx`
`IKONLAR` haritasina `zeka: Sparkles` (lucide-react; mevcut importa eklenir). Baska menu degisikligi YOK.

## 4) Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json` ve `npm run lint` temiz; `npm run build` gecer.
- `/admin/zeka` admin olmayan kullanicida layout `/`'a yonlendirir (mevcut davranis; test et).
- `istatistikler/page.tsx` `git diff`: yalniz sabit bloklarinin silinip import'a donmesi; baska satir degismez.
- `grep -rnP '[âîûÂÎÛ]' app/admin/zeka app/lib/zeka.ts app/lib/grafik-tema.ts` bos.
- Sayfada `analytics_events` metni istemci sorgusu olarak GECMEZ (`grep -rn "from('analytics_events')" app` bos).

## 5) Rapor

Bitince kisa rapor: yeni/degisen dosyalar, hangi recharts bilesenleri kullanildi, bos durum ve hata metinleri, sapmalar (yapilamayan ya
da farkli yapilan maddeler — gerekcesiyle). Commit ATMA.
