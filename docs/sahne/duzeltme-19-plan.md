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
    "Ekip hazir", "Ekip kuruluyor" ya da etkinligin kendi durumu.
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

## Onizleme turu 19 (dal `duzeltme-19`)

Push sonrasi doldurulacak.

## Durum (13 Kas)

- 19-A: kod hazir, yerel denemeler gecti; onizleme bekliyor.

## Acik kalanlar

- Ajans UYESININ (rol profesyonel) etkinlik listesi eski halinde; uyenin merkezi "Islerim".
- Ajansin RFP'ye verdigi teklifler alicinin etkinligine baglidir, ajansin etkinlik kartina
  girmez ("Teklifler" sayfasinda).
- Onaylanan teklifin rezervasyonuna kart satirindan dogrudan gidilmiyor (teklif sayfasi aciliyor).
