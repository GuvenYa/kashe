# 21 — Canli tarama 1 (20 Ekim 2026)

**Yontem:** Claude uygulama ici tarayicida (Guven'in actigi oturumlarla; sifre paylasilmaz) her yuzeyi gezdi: sayfa metni, ekran goruntusu,
konsol hatasi, yatay tasma (`scrollWidth > innerWidth`), kirik gorsel; genislikler 807 px (pane; tablet/kucuk masaustu) ve 375 px (telefon).
1280+ masaustu bu panelde guvenilir olcul(e)medi — genis ekran kontrolu Guven'in Chrome'unda (ya da Claude in Chrome ile) ayri yapilir.
**Onem:** **A** kirik/yanlis davranis · **B** yaniltici/eksik (kullanici yanlis anlar ya da yolu bulamaz) · **C** kozmetik/metin.
**Kapsam:** kurum sahibi (testguven, Test Guven) — tamam; ziyaretci, profesyonel (hotmail), ajans sahibi (gmail, platform yoneticisi) — asagida.
Duzeltmeler tek Claude Code hijyen gorevinde toplanir (`21-claude-code-gorevi-hijyen-tarama-1.md`); 8-U'nun uc kozmetik bulgusu da dahil.

## 1. Kurum sahibi yuzeyi (testguven@gmail.com — Test Guven, business)

| # | Onem | Sayfa | Genislik | Bulgu | Oneri |
|---|------|-------|----------|-------|-------|
| K1 | B | `/etkinliklerim/[id]` | hepsi | Alici (business) etkinlik sayfasinda ajans kavramlari: **EKIP** (Taslak · Kurulus ekibi · "Oneriye cevir / Onayla / Iptal et"), **UYE EKLE** ("Bu rol icin aday yok; once eslestirme calistir" — sayfada eslestirme dugmesi YOK, cikmaz sokak), **Ic maliyet** karti ("GIZLI — YALNIZ TICARI YETKILILER GORUR · Ac"). 05: alici asla Talent Pool / ic maliyet gormez. | Business kurulusunun etkinliginde EKIP / UYE EKLE / Ic maliyet bolumleri render edilmez; yerine **Teklif talepleri** bolumu (bu etkinligin RFP'leri: durum, davet/yanit sayisi, baglanti) + mevcut BAGLI KAYITLAR. Ajans etkinliginde degisiklik yok. |
| K2 | A | `/etkinliklerim/[id]` | hepsi | UI metninde ic jargon: "Ajans adaylari ekibe eklenmez; **ajansla tam hizmet teklifi FAZ 7**." (FAZ 7 bitti, RFP var). | Cumle kaldirilir; ajans etkinliginde "Ajansla calismak icin teklif talebi ac" baglantisi (K1 ile birlikte). |
| K3 | B | `/etkinliklerim/[id]` | hepsi | "Teklif talebi ac (RFP)" basligin altinda duz metin baglanti — alt baslik gibi gorunuyor, CTA degil. Etkinligin MEVCUT RFP'leri (biri secildi, biri iptal) sayfada gorunmuyor; BAGLI KAYITLAR yalniz Rezervasyon. | Birincil dugme "Teklif talebi ac"; BAGLI KAYITLAR'a RFP satirlari (baslik · durum · baglanti). |
| K4 | C | `/etkinliklerim/[id]` | hepsi | Alt bilgi "EVENTSPEC SURUMU: V2" — ic terim. | "Etkinlik tanimi surum 2" ya da kaldir. |
| K5 | B | `/kurumsal/rfp`, `/kurumsal/rfp/[id]` | hepsi | RFP basligi = etkinlik basligi oldugunda alt satir basligi tekrar ediyor ("Ankara'da 250 kisilik bayi toplantisi · Ankara'da 250 kisilik bayi toplantisi · 14 Mayis 2027"). | Alt satirda etkinlik adi yalniz RFP basligindan FARKLIYSA; aksi halde yalniz tur · tarih · sehir · kisi. |
| K6 | B | `/kurumsal/rfp/[id]` | 375 | Baslik karti: durum rozeti basligin yanina sikisiyor, baslik 4 satira boluniyor; "Istenen roller" tablosu telefonda etiketsiz dikey degerler ("Sunucu / 1 / 5.000 TL – 8.000 TL / — / Zorunlu") — ne oldugu anlasilmiyor. | Telefonda rozet basligin ustune; roller tablosu `sm` alti kart (Adet: 1 · Butce ipucu: … · Zorunlu). |
| K7 | C | `/kurumsal/rfp/[id]` | 375 | Karsilastirma tablosu yatay kaydiriyor (73 px tasma) ama ipucu yok; hucre metni "1 × 3.000 TL = 3.0" kesik gorunuyor. | Telefonda kisa bicim (yalniz toplam: "3.000 TL"), ya da kaydirma ipucu. |
| K8 | C | `/kurumsal/rfp/[id]` | hepsi | Alt satir "Bu talep bir etkinlige bagli. Etkinlige git (etkinligin sahibi degilsen gorunmez)." — parantez kullaniciya anlamsiz. | "Etkinlige git →" baglantisi; erisim yoksa satir hic render edilmez. |
| K9 | B | `/rezervasyonlarim` | hepsi | "Kurulusunuz adina alinan" karti SATICIYI (Sunucu Ajans) gostermiyor; alt satir "Surum 2" (jargon). Para bicimi tutarsiz: ust kartta "₺12.000", kurulus kartinda "23.400 TL". | Kart: ajans adi + etkinlik + tarih; "Surum 2" yerine "Teklif surumu 2" ya da kaldir; tek para bicimi (`formatTL`). |
| K10 | B | `/rezervasyon/[id]` (alici) | hepsi | Baslik karti "K / KURULUS / **Kurulus**" — karsi taraf (satici ajans) adi yok; "ONAYLANDI · TEST PRO" onaylayan kisi mi satici mi belirsiz. RFP/teklife baglanti yok. | Baslik: satici ajans adi (logo), alt: "Kurulusunuz adina · Test Guven", "Onaylayan: Test Pro"; "Teklif talebine git →". |
| K11 | B | `/rezervasyon/[id]` (alici) | 375 | Baslik karti telefonda ezik: avatar + rozet metin sutununu ~100 px'e sikistiriyor, meta satiri kelime kelime alt alta. | `sm` altinda dikey yigin (rozet altta), meta satiri `flex-wrap`. |
| K12 | B | `/odemelerim` | hepsi | "YAKLASAN ₺0 · 0 onayli rezervasyon" — kurulus adina alinan ONAYLI 23.400 TL rezervasyon sayilmiyor; tablo yalniz eski kisisel rezervasyonlari listeliyor. (19-faz7 acik kalem b: kurulus gelir/odeme sayfalari.) | Kurulus rezervasyonlari (buyer_organization_id) sayilara ve tabloya dahil ("Ajans / Etkinlik" sutunu). |
| K13 | B | Menu (☰) | hepsi | "TEKLIF TALEPLERIM" (eski: profesyonellerden teklif) ile "RFP TALEPLERI" (ajanslardan) yan yana — fark anlasilmaz. | Etiketler: "Profesyonel teklifleri" / "Ajans teklif talepleri (RFP)"; ya da tek "Teklifler" sayfasinda iki sekme (sonra). |
| K14 | B | `/bildirimler` | hepsi | Eski bildirim satirlari ASCII: "Sunucu Ajans teklif **gonderdi**" (hijyen_02 oncesi uretilmis; yeniler dogru). | Tek seferlik SQL: `UPDATE notifications SET body = replace(body, ' teklif gonderdi: ', ' teklif gönderdi: ') WHERE type = 'proposal' AND body LIKE '% teklif gonderdi: %'` (hijyen migration). |
| K15 | C | `/profil` (business) | hepsi | Kurum hesabinin profil merkezi "PROFIL TAMLIGI %33 / YAYINDA DEGIL / Yayinla" — kurum alici icin yayin anlamli mi? Merkezde Etkinliklerim / RFP / Rezervasyonlar kisayolu yok (yalniz Kurumsal Ekip, Ilanlarim). | Guven karari: business profili pazaryerinde yayinlaniyorsa kalir; degilse tamlik karti gizlenir. Merkeze "Etkinliklerim", "Teklif talepleri (RFP)", "Rezervasyonlar" kartlari. |
| K16 | C | `/profil/kurumsal-ekip`, `/profil/ekibim` | 807 | (8-U kapanis notundan) rol kutusu `min-w-[190px]` ust sinirsiz — uzun ozet ad sutununu eziyor; kurumsal yuzeyde "havuz" kelimesi; tablet hizasi. | 20-faz8 bolum 2 kozmetik (1)-(3). |

Konsol hatasi: yok. Yatay tasma: yok. Kirik gorsel: yok. Mobil menu, bildirim ve mesaj sayfalari duzgun.

## 2. Ziyaretci (girissiz) sayfalar

Gezilen: `/`, `/kesfet`, `/kategoriler`, `/kategori/dj`, `/p/[id]` (Test Pro), `/pro-bul`, `/kashe-ai`, `/etkinlik-sihirbazi`, `/ilanlar`,
`/giris`, `/uye-ol`, `/sifremi-unuttum`, `/yardim`, `/fiyatlandirma`, `/hakkimizda`, `/blog`, `/gizlilik`, `/kvkk`, `/kullanim-kosullari`,
`/teklif-topla` ve `/premium` (giris sayfasina yonlendiriyor — dogru), `/yakinda`, 404. Konsol hatasi yok (yalniz `/ilanlar`'da iki 404 kaynak),
yatay tasma yok, kirik gorsel yok. Ana sayfa EK-1..4 turlarinda incelendigi icin yalniz kontrol edildi.

| # | Onem | Sayfa | Genislik | Bulgu | Oneri |
|---|------|-------|----------|-------|-------|
| Z1 | — | `/ilanlar`, `/basvurularim`, `/ilanlarim` | — | **YANLIS ALARM (geri cekildi):** sayfalar "hazirlaniyor / YUKLENIYOR" durumunda kaliyor gibi gorundu. Kok neden test ortami: tarayici paneli gizliyken `requestAnimationFrame` calismiyor, React 19 akis (streaming) ortaya cikarma (`$RC` → `$RB`/rAF) hic tetiklenmiyor; icerik DOM'da (`div[hidden] id="S:0"`) ama gorunmuyor. Panel gorunurken ayni sayfalar aciliyor. | Yontem notu: tur sirasinda panel **gorunur** olmali (Ctrl+Shift+B); `loading` durumunda kalan sayfa once `tabs_context` ile dogrulanir. Site tarafinda is yok. |
| Z2 | **A** (itibar) | `/kesfet`, `/`, `/p/[id]` | hepsi | Canli sitede test icerigi herkese acik: "Mail Test7", "Mail Test_4", "inf 4/5", "k 4", "dj test", "konusmaci 2", "Model Test", "Drone 1/3"; Test Pro profilinde "uyfytrghjkoıip ubıuıuh ıuhoı" yorumu, "Paket Deneme1-4" paketleri, portfoyde teklif ekran goruntusu ve TUBITAK gorselleri. Ilk ziyaretci bunlari goruyor. | Veri hijyeni (kod degil): test profilleri yayindan kaldirilir (`is_published=false` ya da `approval_status`), cop yorum silinir; tur hesaplari (Test Pro, Test Pro2, Sunucu Ajans) kalacaksa icerikleri gercekci hale getirilir. Guven karari — liste SQL ile cikarilir. |
| Z3 | C | `/ilanlar` | — | Sayfa basligi (`<title>`) genel site basligi; "Ilanlar — Kashe" yok. | `metadata.title`. |
| Z4 | C | `/yakinda` | — | Eski "yakinda" sayfasi hala erisilebilir (baslik "Etkinlik sektoru icin yapay zeka destekli pazaryeri"); site acik. | `/`'ye 308 yonlendirme ya da sayfa kaldirilir. |
| Z5 | C | `/etkinliklerim/[id]` vb. | 1280+ | Genis masaustu (1280+) bu panelde olculemedi. | Guven kendi Chrome'unda 1 tur ya da Claude in Chrome ile ayri tarama. |

## 3. Profesyonel yuzeyi (guvenyapicioglu@hotmail.com — Test Pro; Sunucu Ajans izleyici, Test Guven yonetici)

Gezilen: `/profil`, `/profil/paketler`, `/takvimim`, `/kazanclarim`, `/teklif-talepleri`, `/rezervasyonlarim`, `/davetlerim`, `/ilanlar`,
`/basvurularim`, `/ilanlarim`, menu. Konsol hatasi yok, tasma yok.

| # | Onem | Sayfa | Genislik | Bulgu | Oneri |
|---|------|-------|----------|-------|-------|
| P1 | B | `/teklif-talepleri` | hepsi | Ham degerler arayuzde: etkinlik turu "birthday", "fashion", "corporate"; kategori sorulari "no", "yes", "classic", "1_2h", "half_day", "no_pref"; tarih "2027-06-15"; "Butce: 20000 - 30000 TL" bicimsiz. | Etkinlik turu etiketi (`event_types.name_tr` / mevcut sozluk), kategori sorularinin etiketleri (soru metni + secenek etiketi), `app/lib/tarih.ts` ile tarih, `formatTL`. |
| P2 | B | `/kazanclarim` | hepsi | Etkinlik turu ham: "launch", "engagement", "wedding". "Yaklasan isler"te tarihi gecmis onayli kayitlar (29 May 2026) "yaklasan" gorunuyor. | Tur etiketi Turkce; tarihi gecmis onayli → "Tarihi gecti · tamamla" uyarisi ya da ayri kume. |
| P3 | B | Menu (☰) | hepsi | Profesyonel menusunde "ILANLARIM" (`/ilanlarim` — ilan acma musteri/kurum isi) ve "ETKINLIKLERIM"/"RFP TALEPLERI" (Test Guven yoneticisi oldugu icin) yan yana; "BASVURULARIM" menude yok. Ajans uyeligi (Sunucu Ajans izleyici) icin "Ajans paneli" girisi de yok. | Rol bazli menu: profesyonelde "Basvurularim" (Ilanlarim yerine); kurulus uyelikleri "Kuruluslarim" altinda (Test Guven · RFP/Etkinlikler; Sunucu Ajans · panel — rol izin veriyorsa). |
| P4 | B | `/profil` (pro) | hepsi | "Uye oldugum ajanslar (1): Sunucu Ajans" — Test Guven (kurumsal, yonetici) listede yok; profil merkezi 12 kartlik tek sutun, hiyerarsi yok (Gorunurluk → Hesap → Deneyim → Kategori → Portfoy → Hizmetlerim → Paketlerim → Basvurularim → Ajanslar → Premium → Yayin → ID). "Hizmetlerim" ile "Paketlerim" ayni sey gibi duruyor. | Tasarim dili v2 ile (bkz. bolum 5): panel kabugu + KPI satiri; "Uye oldugum kuruluslar" (ajans + kurumsal); Hizmetler/Paketler tek kartta iki sekme. |
| P5 | C | `/takvimim`, `/rezervasyonlarim` | hepsi | "Gecmis (11)" uzun duz liste; iptal edilenler ve tamamlananlar ayni kume. | Durum filtresi (Tamamlandi / Iptal) ya da iptaller katlanir. |
| P6 | **A** (DB) | `/rezervasyonlarim`, `/rezervasyon/[id]` | hepsi | **K9/K10'un kok nedeni:** `organizations_select_member` politikasi (FAZ 0) kurulus satirini yalniz uye/sahip/admin'e acar; alici kurulus (Test Guven) satici ajansin (Sunucu Ajans) `display_name`'ini OKUYAMIYOR → kart "Surum 2", baslik "Kurulus". hotmail (Sunucu Ajans uyesi) ayni sayfada "Ajans: Sunucu Ajans" goruyor. RFP sayfalari `rfp_detail` (SECURITY DEFINER) ile ad dondurdugu icin etkilenmiyor. | DB (hijyen_03): `organizations_public` gorunumu (id, slug, display_name, account_type, legacy_profile_id; `security_invoker = false`, authenticated SELECT) — ad zaten pazaryerinde acik; sutun yetkisi genisletilmez (`organizations` SELECT grant'inde abonelik/koltuk/ayar sutunlari var). Uygulama: rezervasyon sayfalari `seller:organizations_public!proposals_seller_organization_id_fkey(display_name)`. asama4'e test: alici satici adini okur, abonelik sutununu okuyamaz. |

## 4. Ajans sahibi yuzeyi (guvenyapicioglu@gmail.com — Sunucu Ajans; platform yoneticisi)

Gezilen: `/profil`, menu, `/ajans/havuz`, `/ajans/ekipler`, `/ajans/teklifler`, `/ajans/teklifler/[id]` (onayli RFP yaniti), `/ajans/rfp`,
`/etkinliklerim` (yonetici tum etkinlikleri gorur — tasarim geregi), `/etkinliklerim/[id]` (lansman: adaylar + ekip + ic maliyet), `/admin`.
Konsol hatasi yok, tasma yok.

| # | Onem | Sayfa | Genislik | Bulgu | Oneri |
|---|------|-------|----------|-------|-------|
| A1 | B | `/profil` (ajans) | hepsi | Baslik kisi adi ("Guven Yapicioglu"), ajans adi (Sunucu Ajans) yok; merkezde yalniz Hesap + Ekibim — havuz/teklif/RFP/etkinlik/ekipler girisi yok. | D1a: ajans merkezi = Event OS gosterge paneli (video `eventos` 1. kare): "Gunaydin, Sunucu Ajans", KPI satiri (acik RFP · bekleyen teklif · bu ay etkinlik · aktif ekip), hizli baglantilar. |
| A2 | B | Menu (☰) | hepsi | ISLERIM altinda 13 duz madde; "Teklifler", "Gelen RFP'ler", "Teklif Talepleri", "RFP Talepleri" (platform yoneticisi oldugu icin) yan yana — ayrim anlasilmiyor. | D1a: panel yan menusu gruplu (Gosterge · Etkinlikler · Teklifler (RFP gelen + teklifler) · Ekip (havuz + ekipler) · Finans · Takvim; Pazaryeri: Kesfet · Ilanlar · Basvurularim); ust menu sade. |
| A3 | B | `/ajans/rfp` | hepsi | Secilen RFP'de ajans "SECIM YAPILDI · YANITLADI · Teklifin gonderildi" goruyor — KAZANDIGI belli degil; iptal edilen RFP'de "IPTAL" + "SECILMEDI" birlikte (yaniltici). | Satici gozuyle sonuc rozeti: "Teklifin secildi" (moss) / "Secilmedi" / "Iptal edildi" (tek rozet). |
| A4 | C | `/ajans/teklifler` | hepsi | Ayni RFP icin kalmis "TASLAK · 28.800 TL · Surum 2" satiri (test artigi) ve "qas / few" test teklifi. | Veri temizligi (Z2 ile). |
| A5 | B | `/ajans/teklifler/[id]` | hepsi | Kalem tablosunda kaynak sutunu yok, ic maliyet/marj ayri kutuda "Ac" arkasinda, toplamlar duz metin; "Musteri gorunumu" onizlemesi yok; alt satir "Etkinlige git (etkinligin sahibi degilsen gorunmez)". | D1b (video `eventos` 4. kare): kalem tablosu KALEM · KAYNAK · IC MALIYET (yetkili) · MUSTERI FIYATI, Kashe kaynakli satir pembe ton; alt uc ozet kutu (Ic maliyet · Marj % · Musteriye teklif — lacivert hero); "Musteri gorunumu" anahtari (portal gorunumu); "PDF indir" (FAZ 9'a not) · "Teklifi gonder" pembe. |
| A6 | B | `/etkinliklerim/[id]` (ajans) | hepsi | Tek sayfada 6 uzun bolum (ihtiyaclar, adaylar, ekip, kapsam, ic maliyet, bagli kayitlar; ~4.000 px); ekip uyesi satirinda 7 metin dugmesi yan yana (Onerildi / Iletisime gecildi / Onaylandi / Reddetti / Degistirildi / Kilitle / Not). "Butce 60000 – 90000 TL" bicimsiz. Durum "ESLESTIRILIYOR" kalmis (ekip onayli + rezervasyon var). | D1b: etkinlik sayfasi sekmeli (Genel · Adaylar · Ekip · Teklif · **Gorevler** · **Aktivite** — son ikisi 8a-P1), uye satirinda durum secimi + "..." menusu; `formatTL`; durum: rezervasyon varsa "Rezerve". |
| A7 | C | `/etkinliklerim` | hepsi | "27 Eylul 2026 → 27 Eylul 2026" (ayni gun iki kez); "Tarih belirtilmedi · 25 kisi". | Ayni gun tek tarih. |
| A8 | — | `/admin` | hepsi | Admin paneli ZATEN videonun kabugunu tasiyor: lacivert yan menu + KPI kutulari (`app/admin/admin-nav.tsx`, `admin/layout.tsx`). | D1a bu kabugu genellestirir (`PanelKabugu`), admin de ayni bilesene gecer. |

## 5. Ozet ve yonlendirme

- **Sayi:** 37 bulgu — A 3 (K2 jargon, Z2 test verisi, P6 DB), B 24, C 10. Konsol hatasi/tasma/kirik gorsel: sifir. Islevsel kirik: yok.
- **Nereye gidiyor:** (1) `21-claude-code-gorevi-hijyen-tarama-1.md` — metin/ham deger/baslik/yonlendirme/kucuk duzen (K2, K4, K5, K8, K14 SQL,
  Z3, Z4, P1, P2, A3, A7, 8-U kozmetik 1-3); main'de, kucuk. (2) **D1a/D1b** (tasarim dili v2, `22-tasarim-dili-v2.md`) — K1, K3, K6, K7, K9,
  K10, K11, K13, K15, K16, P3, P4, P5, A1, A2, A5, A6. (3) **DB hijyen_03** (8a-DB/01 ile ayni tur) — P6 `organizations_public`, K12 kurulus
  rezervasyonlari odeme sayfasinda (uygulama tarafi D1b), K14 eski bildirim metinleri. (4) **Veri temizligi** (Guven, SQL) — Z2, A4.
- **Yontem notlari:** panel gorunur olmali (rAF; Z1); 1280+ genislik bu panelde olculemiyor (Z5); tur hesaplari gercek veriyle (K4 1).
