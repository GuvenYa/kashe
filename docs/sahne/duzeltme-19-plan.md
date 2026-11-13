# Duzeltme 19 - Ajans hesabinda "Etkinlikler" merkezi (ajans hatti)

Kaynak: Duzeltme 15-A / 16-A / 16-B'nin acik maddesi ("ajansin ALICI oldugu islerde merkez"),
bulgu 144.
Karar kurali (Guven, 12 Kas): Fahri'nin onerisi varsa o, yoksa diger talepleriyle uyumlu olan.
Calisma duzeni: `docs/sahne/duzeltme-17-plan.md`. Dal: `duzeltme-19`. Goc YOK.

## Bugun

Musteri (15-A), profesyonel (15-B), ajansin satici tarafi (16-A) ve kurum (16-B) kendi merkezini
kullaniyor. Ajans panelindeki "Etkinlikler" ise duz bir liste: etkinlik adi, tarih, ihtiyac
sayisi. Etkinligin nerede durdugu (ekip kuruldu mu, musteriye teklif gitti mi, musteri ne dedi)
listede yazmiyor; bunun icin "Teklifler", "Ekip yonetimi" ve etkinlik sayfasi ayri ayri aciliyor.

Ajansin etkinliginde is sirasi musteri hattindan farkli: etkinlik kurulur -> ekip kurulur ->
musteriye teklif dosyasi gonderilir -> musteri onaylar / revizyon ister. Bu turda merkez bu
"ajans hattini" ogrendi.

## 19-A Ajansin kendi hesabi merkezi kullanir - YAPILDI (13 Kas)

- Kapi (`app/lib/musteri-merkezi.ts`): `musteriMerkeziAcik` ajansin KENDI hesabinda da acik
  (rol `agency` + ajans kurulusunun sahibi). `ajansPanelindeEtkinlikMerkezi()` sayfaya kurulusu
  verir. Ajans UYELERI (rol profesyonel) eski etkinlik listesini gormeye devam eder.
- Veri (`app/etkinliklerim/musteri-isleri.ts`): iki yeni sorgu - ajansin musterilerine
  gonderdigi teklif dosyalari (`proposals`, satici = ajans) ve etkinlik ekipleri (`crews` +
  uye durumlari). Yalniz kullanicinin AJANS kuruluslari icin; ajansi olmayan hesapta sorgu
  atilmaz. RLS neyi gosteriyorsa o.
- Kart: etkinlik ajansin kurulusununsa
  - musteriye giden her teklif bir satir: "<alici> | <tutar> | Gonderildi / Goruntulendi /
    Onaylandi / Revizyon istendi / Reddedildi / Suresi doldu / Taslak" -> teklif sayfasi;
  - en yeni (iptal olmayan) ekip bir satir: "Ekip | n kisi | Taslak / Onerildi / Onaylandi"
    -> etkinligin Ekip sekmesi (reddeden / degistirilen uyeler sayilmaz).
- Asama (ajans hatti; gelen teklif ve onayli rezervasyon kurallari onceliklidir):
  - musteri revizyon istedi -> "Devam eden", "Revizyon istendi" (vurgulu, en ustte);
  - musteri onayladi -> "Yaklasan", "Musteri onayladi" (tarihi gectiyse "Tamamlanan");
  - teklif musteride -> "Devam eden", "Musteri yaniti bekleniyor";
  - teklif yok / taslak / kapandi -> "Devam eden": "Teklif hazirlaniyor", "Teklif kapandi",
    "Ekip hazir", "Ekip kuruluyor"; ekip de yoksa "Ekip kurulmadi" (eslestirme suruyorsa
    "Eslestiriliyor"). Ilk yazimda burada etkinligin kendi durumu ("Onaylandi") yaziyordu;
    "musteri onayladi" sanilacagi icin onizleme turunda degistirildi.
- Ozet (`MusteriIsleri.ozet`): uc yeni sayac - musteri yaniti bekleyen, revizyon istenen,
  hazirlanan etkinlik. Ajans hattinda bekleyen kartlar musterinin "acik is / teklif geldi"
  sayimina GIRMEZ (onlar teklif beklemiyor). Ajansi olmayan hesapta uc sayac da 0.
- Sayfa (`app/etkinliklerim/musteri-merkezi.tsx`, `page.tsx`): ajans panelinde
  - durum karti ajans hattini anlatir ("n teklifte revizyon istendi", "n etkinlikte musteri
    yaniti bekleniyor", "n etkinlik hazirlik asamasinda");
  - ilk sekmenin adi "Devam eden" (musteride "Teklif bekleyen");
  - ustte tek eylem "Yeni etkinlik" (kurulusa bagli); "Teklif topla" yok (ajans talep acamaz);
  - not: pazaryeri isleri "Islerim"de (baglantili); alttaki ayri listede "teklifler".
- Menu (`app/lib/panel-menu.ts`): ajans sahibi ayni zamanda bir kurumun uyesiyse kurum grubunda
  "Rezervasyonlar" ve "Gelen teklifler" yazilmaz (17-C ile ayni olcut; merkez artik acik).

Dokunulmayan: etkinlik sayfasi, ekip kurma, teklif editoru, `/ajans` genel bakisi; kurum ve
musteri merkezinin davranisi (ajansi olmayan hesapta kartlar ve sayilar ayni).

## Yerel deneme

- `test-19a` (sahte veri, ajans hesabi): 11 etkinlikle butun dallar - revizyon en ustte,
  musteri yaniti, ekip kuruluyor, eslestiriliyor, taslak teklif, kapanan teklif, taslak
  etkinlik, onaylanan (Yaklasan), gecmis onayli (Tamamlanan), gecmis yanitsiz (Sonuclanmayan);
  ajansa ait olmayan etkinlige ve baska etkinligin / etkinliksiz teklife satir yazilmadi; iptal
  ekip sayilmadi. Ozet: acik is 1 (kisisel etkinlik), musteri yaniti 1, revizyon 1, hazirlik 5.
- Musteri ve kurum sahte veri testleri (`test-16b`, `test-17a`, `test-18c`): kartlar onceki ile
  ayni; ozete yalniz uc yeni sayac eklendi (hepsi 0).
- Menu testi 18 / 18 (ajans sahibi + kurum uyesi, yalniz uye olan ajans rolu, kurulussuz ajans).
- tsc + eslint temiz.

## Onizleme turu 19 (13 Kas, dal `duzeltme-19`; Lumen sahibi + Ilker; 1280 ve 375 px)

Lumen (ajansin kendi hesabi), `/etkinliklerim`:
- Merkez acildi: baslik, tek eylem "+ Yeni etkinlik", ajans notu ("Islerim" baglantili), durum
  karti, sekmeler "Devam eden 1 - Yaklasan 1 - Tamamlanan 3".
- Tohum verisiyle (gercek ajans verisi):
  - Yaklasan: "Urun lansmani - Lumen sahne ve yayin" - "Musteri onayladi"; satirlar "Beren Kara
    - 145.800 TL - Onaylandi" ve "Ekip - 5 kisi - Onaylandi".
  - Tamamlanan (3): giden teklifler durumlariyla (Onaylandi / Reddedildi / Suresi doldu),
    satirlar teklif sayfasina gidiyor.
- Tek "Devam eden" etkinlikte hat adim adim yurutuldu:
  - ekip ve teklif yokken kart etkinligin durumunu ("Onaylandi") yaziyordu -> "Ekip kurulmadi"
    yapildi (ikinci build);
  - "Ekip kur" -> "Ekip kuruluyor" + "Ekip - 0 kisi - Taslak" (Ekip sekmesine gidiyor);
  - "Teklif olustur" (taslak) -> "Teklif hazirlaniyor" + "Musteri - (tutar yok) - Taslak";
  - teklif gonderildi (alici adi "Tur 19-A Musteri", e-posta YOK: ileti gitmedi, yalniz portal
    baglantisi uretildi) -> "Musteri yaniti bekleniyor" + "60.000 TL - Gonderildi"; durum karti
    "1 etkinlikte musteri yaniti bekleniyor";
  - portal baglantisindan musteri olarak "Revizyon iste" -> kart en ustte "Revizyon istendi"
    (vurgulu), durum karti "Revizyon bekleyen teklif var - 1 teklifte revizyon istendi".
- 375 px: yatay tasma yok, satir etiketleri kesilmiyor.
- "Islerim" (satici merkezi) degismedi: 3 / 0 / 0 / 0. Ajansin SATICI oldugu teklif sekli
  rezervasyonda geri baglantisi "Rezervasyonlarim"da kaldi (merkeze donmuyor; dogru).

Ilker (Lumen uyesi, rol profesyonel): `/etkinliklerim` eski liste ("Planladigin etkinlikler").

Turdan cikan duzeltmeler (ikinci build): "Ekip kurulmadi" etiketi; ajans panelinde baslik
altindaki cumle ("Etkinliklerin is is bir arada: devam edenler, yaklasanlar, tamamlananlar").

Gorulmeyen: teklifin musteri tarafindan ONAYLANMASI bu turda yapilmadi (onayli durum tohum
verisinde goruldu); birden cok ekip; "Teklif kapandi" durumu (yalniz sahte veri testinde).
Musteri ve kurum hesaplari bu onizlemede yeniden gezilmedi (sahte veri testinde ciktilar ayni).
Konsol hatasi yok.

Sahne'de kalan tur verisi: Lumen'in "Istanbul'da 80 kisilik kurumsal urun tanitimi" etkinliginde
taslak bir ekip (0 uye) ve "Tur 19-A Musteri" alicili, 60.000 TL, "Revizyon istendi" durumunda
bir teklif.

## Durum (13 Kas)

- 19-A: onizlemede dogrulandi (dal `duzeltme-19`).
- Turdan cikan iki metin duzeltmesi ikinci build'de; sahte veri testi yeniden gecti.

## Acik kalanlar

- Ajans UYESININ (rol profesyonel) etkinlik listesi eski halinde; uyenin merkezi "Islerim".
- Ajansin RFP'ye verdigi teklifler alicinin etkinligine baglidir, ajansin etkinlik kartina
  girmez ("Teklifler" sayfasinda).
- Onaylanan teklifin rezervasyonuna kart satirindan dogrudan gidilmiyor (teklif sayfasi aciliyor).
