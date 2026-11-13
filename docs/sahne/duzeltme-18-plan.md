# Duzeltme 18 - Toplu tur: ilce ve mekan kalan formlarda

Kaynak: Duzeltme 14-B'nin acik maddeleri (bulgu 126'nin devami; bulgu 141 - 143).
Karar kurali (Guven, 12 Kas): Fahri'nin onerisi varsa o, yoksa diger talepleriyle uyumlu olan.
Calisma duzeni: `docs/sahne/duzeltme-17-plan.md` (bir dalda birkac madde, tek onizleme turu).
Dal: `duzeltme-18`. Goc YOK.

## Ozet

14-B ile ilce listesi uc formda acildi (profilden talep / rezervasyon talebi, brief, sihirbaz).
Iki form disarida kalmisti: musterinin "Teklif topla" formu (yalniz sehir seciliyordu) ve
profesyonelin sohbetteki teklif formu ("Yer" serbest metin). Bu turda ikisi de ayni kaliba
gecti; deger her yerde ayni bicimde: "<mekan>, <ilce>, <Il>".

## 18-A Teklif topla formunda ilce ve mekan - bulgu 141

Bugun: formda yalniz "Sehir" var. Musteri ilceyi ya da mekani yazamiyor; profesyonel teklif
verirken isin sehrin neresinde oldugunu bilmiyor. Teklif onaylaninca rezervasyon yersiz
olusuyor (17-D oncesinde onceki isin yeriyle olusuyordu).

YAPILDI (13 Kas).
- Form (`app/teklif-topla/teklif-topla-formu.tsx`): sehir secilince altinda "Ilce ve mekan"
  satiri acilir. Sehir 30 buyuksehirden biriyse ilce LISTEDEN secilir + "Mekan" metni; diger
  illerde tek "Ilce / mekan" metni. Ikisi de istege bagli. Sehir degisince yeni sehrin listesinde
  olmayan ilce ve eski mekan temizlenir. Altindaki not: bilgi olarak gider, talep sehre gore
  iletilir (eslestirme degismedi).
- Kayit: ilce ya da mekan yazildiysa brief'in konum alanina yazilir (`brief_data.location`;
  butun kategori brief'lerinde ayni anahtar). Yalniz sehir secildiyse yazilmaz. Yeni sutun yok.
- Sunucu (`app/lib/brief-anahtarlari.ts`): `briefVeriTemizle` konumu kirpar ve 200 karakterle
  sinirlar (metin olmayan deger duser); `briefKonumu` brief'ten konumu okur.
- Yanit (`app/teklif-topla/actions.ts`, `submitOffer`): profesyonel yanit verince talebin konumu
  sohbetin yeri olur (yeni sohbette, ve mevcut sohbette yeni is acilirken; ayni talebin
  yanitinda yalniz dolu gelirse yazilir). Boylece "Yeni talep #n" karti ve teklif onaylaninca
  dogan rezervasyon talebin yerini tasir.
- Kartlar (`app/etkinliklerim/musteri-isleri.ts`, `app/islerim/satici-isleri.ts`): teklif topla
  isinin kartinda sehir yerine, yazildiysa konum gorunur ("Kadikoy, Istanbul").
- Sihirbaz (`app/etkinlik-sihirbazi/sihirbaz-client.tsx`): "Teklif topla" cikisi ilceyi de tasir
  (`?ilce=`); form sehirle birlikte okur.
- Gorunum: karsilastirma sayfasi ve profesyonelin "Teklif talepleri" listesi brief alanlarini
  zaten yaziyor; konum orada kategori etiketiyle ("Sehir / mekan") gorunur.

Yerel deneme:
- `test-18a` 13 / 13 (`briefKonumu`, `briefVeriTemizle` konum kurali; konumsuz brief degismedi).
- `docs/envanter/asama36b-duzeltme18a-davranis.sql` yerel veritabaninda 14 / 14: sohbetin yeri
  talebin konumu oldu, kart talebin yeriyle yazildi (onceki isin yeri yok), onaydan dogan
  rezervasyon talebin yerini aldi; kisi sayisi / saat bos. `asama35b` 13 / 13 (degismedi).
- Merkez sahte veri testleri: konumsuz veride musteri ve satici ciktilari onceki ile birebir
  ayni; konumlu talepte kart satiri konumu gosterdi.
- Formun kendisi yerelde cizilmedi (onizlemede bakilacak).

## 18-B Profesyonelin teklif formunda il, ilce, mekan - bulgu 142

Bugun: sohbetteki "Teklif olustur" formunda "Yer" tek serbest metin. Musteri formlarinda il ve
ilce listeden seciliyor; profesyonel ayni yeri elle yaziyor, yazim farki olusuyor.

YAPILDI (13 Kas).
- Yeni bilesen `app/components/ui/konum-alani.tsx` (`KonumAlani`): il secici + buyuksehirde ilce
  secici + mekan metni; tek metin degeri uretir. Rezervasyon talebi ve brief formlarindaki
  kalibin tasinabilir hali (o iki form oldugu gibi birakildi).
- Teklif formu (`app/mesajlar/[id]/quote-modal.tsx`): "Yer" artik `KonumAlani`. Kutular
  sohbetteki guncel konumla dolu acilir; dokunulmazsa kayitli metin aynen gider.
- Il listesi (`app/mesajlar/[id]/page.tsx`): yalniz teklif verebilen tarafa yuklenir.
- Eski yazim (`app/lib/ilceler.ts`): `konumCoz` "Il / Ilce" bicimini de cozer ("Istanbul /
  Sisli"; Sahne tohum verisi ve eski kayitlar) - uc formda da kutular dolu gelir.
  Yeni `konumKutulari`: cozulemeyen metin kaybolmaz ("Ankara Caddesi 12" -> il secili gelmez,
  metin mekan kutusunda).

Yerel deneme:
- Ilce birim testleri 68 / 68 (51 eski + 17 yeni: egik cizgili yazim, kutulara dagitim,
  519 ilce x 2 gidis-donus).
- Bilesen testi (Playwright, `konum.html`) 37 / 37: bos baslangic, il / ilce / mekan secimi, il
  degisince ilcenin bosalmasi, listesiz il, tohum yazimi, cozulemeyen metin, il listesi yokken
  tek kutu, etiket baglantisi; konsol hatasi yok.

## 18-C Gorsel dil: kalan iki panel basligi - bulgu 143

Panel basligi (`PanelBaslik`) kullanan sayfalardan ikisinde calisma yuzeyi vurgusu yoktu:
`/kazanclarim` ("Kazanclarim") ve `/odemelerim` ("Odeme Gecmisi"). Ikisi de diger liste
sayfalariyla ayni kaliba gecti (vurgulu kelime pembe; "Odeme gecmisi" kucuk harfle).
Bu turda dokunulan diger sayfalar (`/teklif-topla`, `/teklif-talepleri`) kalibi zaten tasiyor.

## Onizleme turu 18 (dal `duzeltme-18`)

Push sonrasi doldurulacak.

## Durum (13 Kas)

- 18-A, 18-B, 18-C: kod hazir, yerel denemeler gecti; onizleme bekliyor.

## Acik kalanlar

- Rezervasyon talebi ve brief formlari `KonumAlani`na tasinabilir (ayni kalibin uc kopyasi var).
- Ajansin ALICI oldugu islerde merkez.
- Gorsel dil: ayrinti sayfalari (rezervasyon, etkinlik, RFP ayrintisi) baslik kalibi tasimiyor;
  bunlar kart baslikli sayfalar, ayri karar ister.
