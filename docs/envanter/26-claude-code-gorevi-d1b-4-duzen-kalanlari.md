# Claude Code gorevi — Tasarim dili v2 / D1b-4: Duzen kalanlari (PanelBaslik, rezervasyon/odeme kartlari, karsilastirma, teklif kucukleri)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` (D1b-2 ve D1b-3 kapanis notlari: "D1b-4'e
kalan" maddeleri), `24-...-d1b-2.md` madde 1, 4, 5, 6 (yapilmayan kisimlar), `21-canli-tarama-1.md` K9-K12, A6. ON KOSUL: main'de D1b-3
(teklif yuzeyi, panel sol sutunu `lg`'de). Dal: `tasarim/d1b-4` (Guven acti). Migration/RPC YOK. Bu gorevle D1b (calisma sayfalari) KAPANIR;
sirada D2 (pazaryeri).

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d1b-4`). Oku: `CLAUDE.md` (FAZ 7a/7b/7c, FAZ 8a paragraflari), `DESIGN.md`
bolum 9, `docs/envanter/22-tasarim-dili-v2.md` (D1b-2/D1b-3 kapanis notlari), `app/components/panel/*` (`PanelKabugu` `ustBaslik` prop'u,
`PanelBaslik`, `VeriTablosu`, `OzetKutuSatiri`, `OzetSerit`), `app/lib/panel-kabuk.ts`, `app/ajans/teklifler/[id]/teklif-baslik.tsx`
(D1b-3 baslik karti deseni: `flex-wrap`, sol sutun `min-w-0 flex-1 basis-80`), `app/rezervasyon/[id]/page.tsx`, `app/rezervasyonlarim/page.tsx`,
`app/odemelerim/page.tsx`, `app/kurumsal/rfp/[id]/rfp-editoru.tsx`, `app/etkinliklerim/[id]/page.tsx`, `app/ajans/teklifler/[id]/teklif-editoru.tsx`
(satir ~559: musteri gorunumu verisi `seller_name: null`), `app/ajans/teklifler/[id]/teklif-kalem-tablosu.tsx` (ic maliyet hucresi `onBlur`).

**Kirmizi cizgi:** hicbir action/RPC cagrisi ve argumani degismez; secim/onay kapilari (RFP teklif secimi, rezervasyon onayi, gonderim)
AYNEN; `internal.*` icin yeni okuma/yazma yolu YOK; portal degismez. Bu gorev YERLESIM ve SUNUM isidir.

## 1) `PanelBaslik` donusumu (22 calisma sayfasi)

D1b-2'de panel kabuguna tasinan sayfalarda elle yazilmis eyebrow + `h1` bloklari (`grep -rn "font-mono text-\[10px\] uppercase" app --include=page.tsx`
ile bul; `/ajans/teklifler/page.tsx:131-138` ornek) `PanelKabugu`'nun `ustBaslik` prop'una (ya da sayfa icinde `PanelBaslik`) tasinir:
eyebrow + baslik (vurgu kelimesi `brand-accent`) + istege bagli alt satir + sag aksiyon alani. **Kural:** rozetler ve CTA'lar basligin ALTINDA
ya da sagda `flex-wrap` ile; baslik metni `truncate` ALMAZ (`break-words`). Sayfa icerigi/aksiyonlari degismez. Listeyi raporda ver (sayfa →
donustu / zaten `ustBaslik` kullaniyordu).

## 2) Baslik kartlari — D1b-3 deseni

`/etkinliklerim/[id]` baslik karti ve `/rezervasyon/[id]` baslik karti `teklif-baslik.tsx` desenine gecer: `flex items-start justify-between
gap-4 flex-wrap`, sol sutun `min-w-0 flex-1 basis-80` (yer kalmayinca sag grup ikinci satira sarar), baslik `break-words`. `/rezervasyon/[id]`
alici dali: baslik = satici kurulus adi (`organizations_public`; zaten geliyor) + `account_type` rozeti; alt satir "Kurulusunuz adina ·
<alici kurulus>" (var) + **"Teklif surumu N · Onaylayan: <ad> · <tarih>"** (`approved_by_name`, `approved_at` zaten sorguda) + baglantilar
**"Teklif talebine git →"** (`rfp_id` varsa, `/kurumsal/rfp/[id]`) ve satici dalinda **"Teklife git →"** (`/ajans/teklifler/[id]`). Eksik olanlari
ekle; olanlari raporda "vardi" diye isaretle.

## 3) `/rezervasyonlarim` kurulus karti

"Kurulusunuz adina alinan" karti: ilk satir ajans adi, altinda etkinlik adi, "tarih · sehir", "Teklif surumu N", sag ustte tutar (`para.ts`),
durum rozeti; kart `/rezervasyon/[id]`'ye baglanir. Mevcut veri (`surum.version_no`, `organizations_public` embed) yeterli; sorgu degismez.

## 4) `/odemelerim` kurulus rezervasyonlari (K12)

Kullanicinin uyesi oldugu kuruluslarin (`getCrewContext` / `org-context.ts`; `events.manage` ya da `finance.view` olan uyelikler)
`bookings.buyer_organization_id` eslesen rezervasyonlari KPI'lara ve tabloya dahil edilir: tablo `VeriTablosu`, sutunlar "Ajans / Etkinlik"
(ajans adi `organizations_public`, alt satir etkinlik), "Tarih", "Tutar", "Durum"; satir `/rezervasyon/[id]`. Kisisel rezervasyonlar ayni tabloda
(ayni sutunlar; ajans yerine profesyonel adi). RLS zaten sinirlar; sorgu `bookings` + `organizations_public` embed; ek RPC YOK.

## 5) `/kurumsal/rfp/[id]` karsilastirma (K8)

Karsilastirma tablosu `VeriTablosu` sutun basligi diline (eyebrow basliklar, `tabular-nums` tutarlar, `para.ts`), secili sutun
`brand-accent-soft` zemin + "SECILI" rozeti; `md` alti kart modu (teklif = kart). Alt yapiskan `OzetSerit` (`md` alti): sol "Secili: <ajans> ·
<tutar>", sag birincil "Sec" (mevcut secim onay kapisina girer; kapi AYNEN). Masaustunde serit yok (tablo icindeki dugme yeterli).

## 6) Teklif yuzeyi kucukleri (D1b-3 turundan)

- Musteri gorunumunde satici adi: `teklif-editoru.tsx` ~559 `seller_name: null` → kurulusun `display_name`'i (`page.tsx` zaten
  `getCrewContext` ile kurulusu biliyor; prop olarak gecir). "Kashe kurulusu" yalniz veri yoksa.
- Ic maliyet hucresi bos birakilirsa `upsertProposalItemCost` CAGRILMAZ (bugun 0 TL satir yaziyor); girdi eski degere doner, kisa ipucu
  "Silmek icin 0 gir" (DB'de silme RPC'si yok; migration YOK).
- `/ajans/teklifler/[id]` taslakta baslik girdisi `md` altinda `textarea rows={2}` + Enter engellenir (tek satir girdi telefonda kirpiliyordu);
  `onBlur` kaydetme ayni.

## 7) `DESIGN.md` bolum 9'a kural

"Panel kabugunda sol sutun `lg`'de (1024 px) acilir; altinda hamburger. Panel sayfalari `md:` yerlesimlerini viewport'a gore kullanabilir
(icerik alani `lg`'de en az 784 px). Baslik kartlari: sol sutun `min-w-0 flex-1 basis-80`, sag grup `flex-wrap`; baslik `truncate` ALMAZ."

## 8) Yapilmayacaklar

Migration/RPC YOK; kesfet/profil/ilanlar yerlesimi (D2) degismez; Kashe AI (D3) degismez; `/mesajlar/[id]` sohbet ekrani dokunulmaz;
ekip uyesi satiri (durum secimi + Kilitle/Not dugmeleri) oldugu gibi kalir (D1b-2 "…" menusu vazgecildi). Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "truncate" app --include=page.tsx | grep -i "h1\|baslik\|title"` → 0 (baslik kirpma yok); `grep -rn "₺" app` → 0;
  `grep -rn "organizations!" app` → yalniz kendi kurulusunu okuyan yerler; `grep -rn "seller_name: null" app` → 0.
- Sapkali harf 0; yorumlar ASCII; UI metinleri Turkce.
- **Onizleme turu (Claude):** gmail — `/ajans/teklifler`, `/ajans/rfp`, `/ajans/havuz`, `/ajans/ekipler` basliklari `PanelBaslik`;
  `/etkinliklerim/<lansman>` baslik karti 807 px'te sarar, kirpilmaz; `/ajans/teklifler/d3a9847a-…` Musteri gorunumu "Sunucu Ajans";
  testguven — `/kurumsal/rfp/6e337b47-…` karsilastirma `VeriTablosu` + 375 px serit (Sec'e basilmaz); `/rezervasyonlarim` kurulus karti;
  `/rezervasyon/1c277043-…` "Teklif surumu 2 · Onaylayan: Test Pro"; `/odemelerim` kurulus rezervasyonu satirda; hotmail —
  `/ajans/teklifler/[id]` ic maliyet yok. Konsol 0, yatay tasma 0.

Rapor: degisen dosyalar (sayfa listesi: donustu/vardi), satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
