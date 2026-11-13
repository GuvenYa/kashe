# Duzeltme 21 - toplu tur (bekleme isareti, rezervasyon sayfasinda gorsel dil)

Hazirlayan: Guven + Claude, 13 Kasim 2026. Kaynak: Duzeltme 20 onizleme turundaki gozlem (sekme gecisi yavas ve
isaretsiz) ve 14-C karari A (gorsel dil sayfa sayfa). Goc (migration) YOK.

Durum: DALDA (`duzeltme-21`), onizleme turu bekliyor.

## Olcum: etkinlik sayfasinda sekme gecisi (13 Kas, Sahne adresi, Lumen sahibi)

Etkinlik `b6398872-...` uzerinde sekme baglantisina tiklayip adres degisene kadar gecen sure (ms), art arda bes gecis:
Ekip 5703, Adaylar 5356, Genel 5151, Adaylar 5896, Ekip 5298. Yani her gecis 5,2 - 5,9 saniye; ilk / sonraki farki
yok (soguk baslatma degil). Bu sirada ekranda hicbir sey degismiyordu.

Neden: `app/etkinliklerim/[id]/page.tsx` hangi sekme acik olursa olsun BUTUN sekmelerin verisini cekiyor ve sorgularin
cogu sirali (dosyada 30 `await`; yalniz iki yerde `Promise.all`). Bloklar: baglantili isler (249), eslestirme ve
adaylar (297 - 470, yedi sirali sorgu), ekip (489 - 720, sekiz sirali sorgu), RFP / gorev / tedarikci (861 - 913),
menu (949 - 952).

## 21-A Tiklanan baglantida bekleme isareti (bulgu 147)

YAPILDI: `app/components/ui/baglanti-bekleme.tsx` (`BaglantiBekleme`). `next/link` icine cocuk olarak konur;
`useLinkStatus` (Next 16) ile o baglantiya tiklanip yeni sayfa gelene kadar metnin yaninda kucuk donen halka cizer.
Eklendigi yerler:
- Etkinlik sayfasinin sekme seridi (Genel / Adaylar / Ekip / Tedarikciler / Gorevler / Aktivite).
- Is kartlarinin ana baglantisi (`app/components/panel/is-karti.tsx`: "Etkinligi ac", "Teklifi ac", "Sohbeti ac" ...);
  musteri, profesyonel, kurum ve ajans merkezlerinin hepsinde.
- Adaylar ekraninda Ekip sekmesine giden iki baglanti ("Kendi ekibimle devam et", "Havuzdan ekle").

SINIR: isaret bekleyisi KISALTMAZ; yalnizca tiklamanin alindigini gosterir. Asil is 21-D.

## 21-B Rezervasyon sayfasinda durum ozeti (bulgu 148; gorsel dil)

YAPILDI (`app/rezervasyon/[id]/page.tsx`): baslik kartinin altinda is merkezlerindeki `DurumKarti`. Baslik:
"Rezervasyon onayli" / "Etkinlik gunu geldi" / "Tamamlanma onayi bekleniyor" / "Is tamamlandi" / "Rezervasyon iptal
edildi". Satirlar: teklif onaylandi; iletisim acik / kapali (sohbetli rezervasyonda); etkinlik gunu (ya da "tarih
henuz belirlenmedi"); tamamlanma (bildirildi - onay bekleniyor / tamamlandi); musteri tarafinda yorum (bekleniyor /
yayinda). Sagda tutar kutusu. Yeni sorgu YOK: satirlar sayfanin zaten hesapladigi bayraklardan gelir. Alttaki bloklar
(iptal kaydi, tamamlanma kaydi, etkinlik, tutar, aksiyonlar) degismedi.

## 21-C Iki formda ortak `KonumAlani` - YAPILMADI (bilerek)

`brief-alanlari` ve `fiyat-takvim-karti` konum alanlari saglayiciya ozel davranis tasiyor ("Sehir disi: ulasim ve
konaklama teklife eklenebilir" notu, yalniz kendi sehrinde calisanlarda kilitli il, saglayicinin ili basta).
`KonumAlani` bunlari bilmiyor; birlestirmek icin bilesene uc yeni ozellik gerekir ve kullaniciya gorunen hicbir sey
degismez. Iki core formda gerileme riski, kazanctan buyuk. Kapatildi; ileride bu formlara dokunan bir is olursa
birlikte ele alinir.

## 21-D Etkinlik sayfasini hizlandirma - SIRADAKI TUR

Hedef: sekme gecisini 5 - 6 saniyeden 2 saniyenin altina indirmek. Yol (riskten buyuge):
1. Bagimsiz bloklari es zamanli calistirmak (baglantili isler, eslestirme, ekip, RFP / gorev / tedarikci, menu).
2. Blok icinde birbirine bagli olmayan sorgulari `Promise.all` ile toplamak.
3. Yalniz acik sekmenin verisini cekmek.
Dikkat edilecek capraz bagimliliklar (13 Kas taramasi): ekip blogu `rolGruplari`ni (eslestirme blogundan) kullaniyor
(satir 675); `ajansAdaylari` satir 773'te; sekme rozetleri `gorevler.length` ve tedarikci atama sayisini istiyor (bu
ikisi her sekmede lazim). Dogrulama: ayni etkinlikte alti sekmenin ciktisi once / sonra karsilastirilir; sure ayni
yontemle yeniden olculur.

## Dogrulama (bu tur)

- `tsc --noEmit` ve `eslint` (degisen bes dosya) temiz.
- Onizleme turu (yapilacak): Lumen ile sekme seridinde ve merkez kartinda isaret; Kaan ile onayli, tamamlanma onayi
  bekleyen, tamamlanmis ve iptal edilmis rezervasyonlarda durum ozeti; 375 px.

## Bu dala giren dokumanlar

Duzeltme 20 kapanisi (bulgular 145 - 146, plan), test rehberi 3.1, `.gitattributes` (`*.html text eol=lf`).
