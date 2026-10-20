# 22 — Tasarim dili v2: TUBITAK sunum videolarinin dili siteye (plan)

**Kaynak:** `Kashe sunum video/` — `kashe_eventai_v4.mp4` (22 sn), `kashe_eventos_v1.mp4` (18 sn), `kashe_marketplace_v1.mp4` (14 sn);
"Kashe_Ekip Tubitak basvuru" konusmasinda uretildi. 20 Ekim 2026'da kare kare incelendi (2 sn'de bir kare). `DESIGN.md` (tasarim sistemi),
`21-canli-tarama-1.md` (bulgular). **Karar (Guven, 20 Ekim):** D1 once, 8a-P1 bu kabugun icinde; D2-D4 sonra. Arayuz isleri dalda +
Vercel onizlemesinde tur, sonra main.

## 1. Tespit: renk/yazi ayni, fark yerlesim ve yogunluk

Videolar sitenin `DESIGN.md` token'lariyla yapilmis: `paper #F7F9FC`, `card #FFF`, `brand-ink #040D26`, `brand-accent #FA0B96`, `sky #00ACE2`,
`--gradient-brand`, Gilroy (display/govde) + Inter (mono eyebrow). Yani **yeni palet/font YOK**. Fark, videodaki sayfalarin daha yogun, daha
hiyerarsik ve "panel" mantiginda kurulmasi. Bugun sitede calisma yuzeyleri (profil merkezi, ajans/kurumsal sayfalari) tek sutun uzun kart
yiginlari; videoda yan menu + KPI + tablo + ozet serit.

## 2. Videodan cikan 8 desen (bilesen envanteri)

| # | Desen | Videoda | Sitede bugun | Bilesen (yeni/var) |
|---|-------|---------|--------------|--------------------|
| 1 | **Panel kabugu** | eventos: lacivert sol menu (ikon + etiket, aktif madde acik zemin), altta hesap karti ("Kuzey Organizasyon · Ajans hesabi · 18 kisilik ekip"), icerik alaninda eyebrow + "Gunaydin, Kuzey Organizasyon" + sag ustte tarih/avatar | Yalniz `/admin` (admin-nav.tsx + layout.tsx) — ayni kabuk | `PanelKabugu` (yeni, admin'den genellestirilir): `yanMenu` gruplari, `hesapKarti`, `baslik` alani; `md` alti ust cubuk + cekmece |
| 2 | **KPI kutusu** | 4'lu satir: eyebrow + buyuk sayi (+ kucuk alt not); vurgulu olan pembe sayi | `/kazanclarim`, `/ajans/havuz`, `/admin` | `KpiKutu` (yeni; `vurgu?: 'accent' \| 'moss'`) |
| 3 | **Aksan kelimeli baslik** | "Etkinligini **anladim**." — vurgu kelimesi `brand-accent` | `<em class="text-brand-ink">` (lacivert) | `DESIGN.md` kurali guncellenir: calisma yuzeyi basliklarinda vurgu kelimesi `brand-accent`; vitrin (ana sayfa) lacivert kalir |
| 4 | **Yogun tablo** | eyebrow sutun basliklari, sagda tutarlar, Kashe kaynakli satir `brand-accent-soft` zemin, altta uc ozet kutu (biri lacivert "hero": Musteriye teklif 680.000 TL) | Teklif editoru kart-satir; toplamlar duz metin | `VeriTablosu` (yeni; `satirVurgu`), `OzetKutuSatiri` (yeni; `hero` varyanti) |
| 5 | **Yapiskan ozet serit** | sayfa altinda: sol eyebrow + secim ("Onerilen firma · Kuzey Organizasyon · 685.000 TL"), ortada butce cubugu (cyan→pembe gradyan, "%98 · 700.000 TL icinde"), sagda tek CTA | Profil sayfasinda 2 CTA'li alt bar (benzer) | `OzetSerit` (yeni) |
| 6 | **Guven cipleri + sag fiyat karti** | marketplace: "✓ Kimlik dogrulandi · Portfoy incelendi · 38 tamamlanmis is · Ortalama yanit: 2 saat"; sag sutun "48.000 TL'den · Komisyon dahil seffaf fiyat" + musaitlik takvimi (yesil musait / gri dolu / pembe secili) + CTA; paketler listesi fiyat sagda | Profilde "Dogrulanmis" seridi, alt yapiskan bar, paket kartlari | `GuvenCipleri`, `FiyatTakvimKarti` (D2) |
| 7 | **Kesfet filtre rayi** | sol ray: Kim (Hepsi/Profesyoneller/Ajanslar), Kategori (onay kutulari), Sehir; 5 sutun kompakt foto kart: kategori etiketi, ad ✓, "DJ · Ankara · 4,9 (38) · 72.000 TL'den" | "Filtreler" dugmesi + genis kartlar | `FiltreRayi`, kompakt `ProfilKarti` (D2) |
| 8 | **Koyu gradyan kapanis** | lacivert zemin, sag altta pembe isima (`--gradient-brand` radyal), ortada isaret + "Turkiye'nin **yetenek** sahnesi." | `/premium`, footer CTA benzeri | `KoyuBolum` (D4; az kullanilir — DESIGN.md gradyan kurali) |

Ek mikro-desenler: durum rozetleri (TASLAK gri · GONDERILDI lacivert · ONAYLANDI moss · SECILDI pembe), satir ici yesil ✓ listeleri
("14 Mayis 2027 icin musaitlik kontrol edildi"), "DEMO VERISI" notu videoya ozel (siteye gelmez), uyum skoru halkasi (95) adaylarda.

## 3. Dilimler

**D1a — Panel kabugu + merkezler (ilk; 8a-P1 oncesi).** `PanelKabugu`, `KpiKutu`, `OzetKutuSatiri`, `VeriTablosu` (temel), `OzetSerit`
(temel); uc calisma merkezi bu kabuga tasinir: **ajans gostergesi** (`/ajans` yeni; profil merkezi ajans icin buraya yonlenir), **kurumsal
gosterge** (`/kurumsal` yeni), **profesyonel merkezi** (`/profil` yeniden). Yan menu rol/uyelik bazli (A2, P3, K13). `/admin` ayni bilesene
gecer (davranis ayni). Bkz. `22-claude-code-gorevi-d1a-panel-kabugu.md`.

**D1b — Calisma sayfalari (D1a'dan sonra, 8a-P1 ile birlikte ya da hemen once).** Etkinlik sayfasi sekmeli (Genel · Adaylar · Ekip · Teklif ·
Gorevler · Aktivite; A6, K1, K3), teklif editoru tablo + ozet kutular + "Musteri gorunumu" (A5), RFP sayfalari (K5-K8), rezervasyon sayfalari
(K9-K11; DB `organizations_public`), odeme/kazanc (K12, P2), takvim/rezervasyon listeleri (P5), bildirim/mesaj paneli ici.

**D2 — Pazaryeri.** Kesfet rayi + kompakt kartlar (desen 7), profil sayfasi sag fiyat/takvim karti + guven cipleri + paket listesi (desen 6),
kategori sayfalari ayni kart. Mobilde ray → alt cekmece, sag kart → alt yapiskan serit (bugunku).

**D3 — Kashe AI.** Sihirbaz analiz sonucu "Etkinligini **anladim**." ozet ekrani (6 kutu + "Eslesme hazir" ✓ listesi + sayac kutulari),
eslesme sonucu "Uc yol: **ekibini kur**, isi firmaya ver ya da birlestir." (segment kontrol: Tekil profesyonellerden ekip · Tum isi ajansa ver ·
Hibrit), uyum skoru halkasi, alt ozet serit (desen 5). Veri: FAZ 6 match + FAZ 7b RFP; "firmaya ver" yolu RFP'ye baglanir.

**D4 — Vitrin.** Koyu gradyan kapanis bolumleri (ana sayfa alt CTA, `/premium`, `/hakkimizda`), olculu.

Her dilim: Claude Code gorevi (dal `tasarim/d1a` vb.) → Vercel onizleme → Claude turu (807 + 375; 1280 Guven Chrome) → main → kapanis
notu bu dosyaya. `DESIGN.md`'ye "Desenler (v2)" bolumu D1a ile eklenir; bilesenler `app/components/panel/` altinda.

## 4. Kabul olcutleri (D1a)

- `/ajans`, `/kurumsal`, `/profil` ve `/admin` ayni `PanelKabugu` ile; md alti cekmece; yan menu gruplari rol/uyelige gore (sahip/yonetici tum
  gruplar; `events.view` olmayan uye etkinlik grubunu gormez; business'ta Havuz/Ic maliyet YOK).
- KPI sayilari gercek sorgudan (test verisiyle: Sunucu Ajans "Acik RFP 0 · Bekleyen teklif 1 · Bu ay etkinlik N · Aktif ekip 1").
- Ust nav calisma yuzeylerinde sadelesir (logo + Kesfet/Ilanlar/Kashe AI + bildirim/mesaj/avatar); 13 maddelik ☰ listesi kalkar.
- Konsol hatasi 0, yatay tasma 0, Lighthouse erisilebilirlik ≥ 90 (yan menu `nav` + `aria-current`).
