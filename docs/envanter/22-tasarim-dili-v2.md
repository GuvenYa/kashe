# 22 — Tasarim dili v2: TUBITAK sunum videolarinin dili siteye (plan)

**Kaynak:** `Kashe sunum video/` — `kashe_eventai_v4.mp4` (22 sn), `kashe_eventos_v1.mp4` (18 sn), `kashe_marketplace_v1.mp4` (14 sn);
"Kashe_Ekip Tubitak basvuru" konusmasinda uretildi. 20 Ekim 2026'da kare kare incelendi (2 sn'de bir kare). `DESIGN.md` (tasarim sistemi),
`21-canli-tarama-1.md` (bulgular). **Karar (Guven, 20 Ekim):** D1 once, 8a-P1 bu kabugun icinde; D2-D4 sonra. **Durum:** D1a KAPANDI (20 Ekim); D1b-1 (8a-P1 ile) ve D1b-2 KAPANDI (21 Ekim); sirada D1b-3 (teklif yuzeyi), D1b-4 (duzen kalanlari), sonra D2. Arayuz isleri dalda +
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

## 4. D1a KAPANDI (20 Ekim 2026) — onizleme turu

Dal `tasarim/d1a` (commit `1dede2f`, ustunde hijyen tarama 1 `174b19d`); Vercel onizlemesinde tur (Claude; gmail/testguven/hotmail oturumlari
Guven'den; 807 + 375 px). **Gorulen:** `/ajans` gosterge (lacivert yan menu, "Gunaydin, Sunucu Ajans", KPI 0/0/0/1, hesap karti "Ajans
hesabi · 3 kisilik ekip", Admin paneli baglantisi), `/kurumsal` (KPI 0/1/0/1 · ₺23.400, Teklif talepleri + Yaklasan etkinlikler tablolari),
`/profil` profesyonel merkezi (KPI 1/0/₺0/%100, Kuruluslarim: Sunucu Ajans · Izleyici, Test Guven · Yonetici · Panele git; yan menude
Profesyonel + Sunucu Ajans + Test Guven + Profil icerigi + Pazaryeri + Hesap gruplari), `/admin` ayni bilesen (Yonetim/Denetim/Icerik),
telefonda cekmece, hamburger listesi modelden. Konsol hatasi 0, tasma 0. Hijyen tarama 1 maddeleri de dogrulandi: Gelen RFP'lerde
"Teklifin secildi"/"Iptal edildi", etkinlik sayfasinda "FAZ 7" yok + "Etkinlik tanimi · surum 2" + butce bicimli, RFP sayfasi telefonda
rozet ustte + etiketli rol kartlari + tasmasiz karsilastirma + "Etkinlige git →", rezervasyon sayfasi telefonda dikey kart, gelen teklif
taleplerinde etiketli alanlar + Turkce tarih + bicimli butce, Kazanclarim'da Lansman/Nisan/Dugun + "Tarihi gecmis, tamamlanmamis (3)".
Not: D1a raporunda Claude Code hijyen isini main'e commit'ledi (174b19d; "Commit ATMA" sapmasi — temiz agac icin, kabul).

**D1b'ye tasinan notlar (turdan):** (1) ajans gostergesi etkinlik sayimi yalniz `organization_id = kurulus`; sahibin FAZ 8 oncesi kisisel
etkinlikleri (lansman 20 Kasim) gorunmuyor — sahipse kisisel etkinlikler de sayilir; (2) "Acik RFP" sayimi `rfp_invites.provider_id =
kurulusun legacy_profile_id` ile suzulmeli (platform yoneticisinde tum davetler sayiliyor); (3) karsi taraf adi `organizations` uzerinden —
P6 `organizations_public` (DB hijyen_03); (4) kurumsal gosterge tablosu 807 px'te 5 sutun sikisiyor, ETKINLIK sutunu basligi tekrar ediyor —
`lg` altinda ikincil sutunlar gizlenir; (5) yan menu "PROFESYONEL TEKLIFLERI" kesiliyor → "Pro teklifleri"; (6) `/profil`'de eski Portfoy
galerisi ve Hizmetlerim listesi, "Profil icerigi" ozet kartlariyla tekrar — eski bloklar kalkar; (7) kurulus grubunda "Takvim" kisinin kendi
grubuyla tekrar; (8) Kuruluslarim kartinda "Panele git" yalniz Test Guven'de, Sunucu Ajans (izleyici) icin yok ama yan menude Gosterge var —
tek kural; (9) eyebrow "PROFESYONEL · MERKEZ" 807 px'te iki satir; (10) `/ajans/rfp` listesinde alt satir basligi tekrar ediyor (K5 kurali);
(11) `etkinlikTuruEtiketi('fashion')` → "Fashion" (sozluge "Moda / defile"); (12) musteri portali "Tur" satiri ham `event_type`
(`app/portal/teklif/[token]/page.tsx:189`) — alici goruyor, D1b'de ilk madde; (13) para bicimi `formatPrice` ₺ onek, baska yerlerde "TL"
sonek — tek bicim karari.

### D1b-2 KAPANDI (21 Ekim 2026) — onizleme turu

Dal `tasarim/d1b-2`. Yapilan: 22 calisma sayfasi `PanelKabugu` icinde (`app/lib/panel-kabuk.ts` tek yerden menu + hesap karti), para bicimi
TEK KAYNAK `app/lib/para.ts` ("12.000 TL", aralik, `paraBirimliMetin`; `₺` 0), `organizations_public` 8 embed (K9/K10 kok nedeni kapandi:
alici rezervasyon sayfasinda "Sunucu Ajans"), `TeklifBelgesi` (portal tuketiyor; "Tur" etiketli), RFP alt satir kurali ajans tarafinda,
8a turu bulgulari (bagimlilik `bagli?.id`, aktivite ek almayan kalip, revalidate daraltildi, filtre etiketleri, "Bana atanan" bos durum,
`aria-current` tekil, `VeriTablosu` `dar` sutun, "Pro teklifleri", 5 ham `event_type`, `fashion`). Lint'in yakaladigi gercek hata:
`p/[id]/iletisim-button.tsx` yerel `formatTL` kendini cagiriyordu (sonsuz dongu) — kaldirildi. Tur: testguven `/rezervasyonlarim` karti
"Ajans: Sunucu Ajans", `/rezervasyon/[id]` baslik "Sunucu Ajans", panelde, TL; gmail `/ajans/teklifler/[id]` panelde, `/ajans/rfp` alt satir
tekrar yok; konsol 0. Portal "Tur" kontrolu uretimde e-postadaki baglantiyla (jeton sayfada gosterilmez — tasarim geregi).
**Yapilmayan (Claude Code karari, kabul):** teklif editoru yeniden kurgusu → **D1b-3** (`25-claude-code-gorevi-d1b-3-teklif-yuzeyi.md`);
`PanelBaslik` donusumu, `/rezervasyon/[id]` ve `/rezervasyonlarim` kart icerikleri, `/odemelerim` kurulus rezervasyonlari (K12),
karsilastirma `OzetSerit`, ekip uyesi satir dugmeleri, iyimser hizli ekle → **D1b-4**. Yeni bulgu: `/ajans/teklifler/[id]` baslik kartinda
baslik kirpiliyor ("Ankara'da 250 ki…") — D1b-3 baslik karti ile cozulur; `/rezervasyon/[id]` baslik metin sutunu dar — D1b-4.

## 5. Kabul olcutleri (D1a)

- `/ajans`, `/kurumsal`, `/profil` ve `/admin` ayni `PanelKabugu` ile; md alti cekmece; yan menu gruplari rol/uyelige gore (sahip/yonetici tum
  gruplar; `events.view` olmayan uye etkinlik grubunu gormez; business'ta Havuz/Ic maliyet YOK).
- KPI sayilari gercek sorgudan (test verisiyle: Sunucu Ajans "Acik RFP 0 · Bekleyen teklif 1 · Bu ay etkinlik N · Aktif ekip 1").
- Ust nav calisma yuzeylerinde sadelesir (logo + Kesfet/Ilanlar/Kashe AI + bildirim/mesaj/avatar); 13 maddelik ☰ listesi kalkar.
- Konsol hatasi 0, yatay tasma 0, Lighthouse erisilebilirlik ≥ 90 (yan menu `nav` + `aria-current`).
