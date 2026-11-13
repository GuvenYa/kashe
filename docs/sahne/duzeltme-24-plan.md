# Duzeltme 24 - gorsel dil: Ilanlarim, profil duzenleme, takvim + selamlama

Hazirlayan: Guven + Claude, 14 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24), rehber 3.2
"bilinen eksikler" 9. madde ve Duzeltme 23 turundaki gozlem (gece "Gunaydin"). Goc (migration) YOK.

Durum: DALDA (`duzeltme-24`), onizleme turu bekliyor.

## 24-A Ilanlarim'da durum ozeti (bulgu 155)

YAPILDI (`app/ilanlarim/page.tsx`): basligin altinda `DurumKarti`. YENI SORGU YOK; sayilar sayfanin zaten okudugu
ilanlardan ve basvuru sayilarindan.
- Baslik (oncelik sirasi): "Revizyon istenen ilanin var" > "Ilanin onay bekliyor" > "N ilan yayinda" > "Taslak
  ilanin var" > "Acik ilanin yok".
- Satirlar yalniz var olan durumu yazar: "N ilan yayinda, M basvuru geldi" (tamam), "N ilanda revizyon istendi:
  duzenleyip yeniden gonder", "N ilan yonetici onayini bekliyor", "N taslak yayina gonderilmeyi bekliyor"; acik ilan
  yoksa tek satir ("Kapanan ve tamamlanan ilanlarin asagidaki listede").
- Kutular: Yayinda / Basvuru (yayindaki ilanlara gelen) / Taslak. Ilerleme = yayinda / (yayinda + onay bekleyen +
  revizyon + taslak). Hic ilan yoksa kart cizilmez (bos durum eskisi gibi listede).

## 24-B Profil duzenleme sayfasi (bulgu 155)

YAPILDI (`app/profil/duzenle/page.tsx`): baslik pembe cizgili `VurguEtiketi` + vurgulu kelime (calisma yuzeyi
kurali); profil tam degilse formun ustunde paneldeki kartla AYNI `DurumKarti` ("Profilini tamamla", eksik alanlar,
Tamlik / Eksik kutulari). Kaynak ayni (`getCompletenessPercent`, `getMissingPublishFields`). Profesyonelde "en az 1
aktif hizmet" kurali icin hizmetlerin etkinlik bayragi okunur (tek kucuk sorgu; diger rollerde sorgu yok). Hizmet
eksigi "Hizmetlerim" sayfasina baglanir; diger eksikler ayni sayfadaki formda oldugu icin duz metin.

## 24-C Takvim (bulgu 155)

YAPILDI (`app/takvimim/page.tsx`): "Musaitlik takvimi", "Yaklasan (n)", "Gecmis (n)" bolum basliklari pembe cizgili
etiket; baslik seviyesi ekran okuyucu icin korunur (`sr-only` h2). "Bu ay" ozet kutusu ve kartlar degismedi: orada
ilerleme / adim yok, durum karti uydurma olurdu.

## 24-D Selamlama (bulgu 154)

YAPILDI (`app/lib/tarih.ts`, `selamlama`): 00 - 05 arasi "Gunaydin" yaziyordu (saat < 12). Yeni araliklar
(Istanbul): 05 - 12 "Gunaydin", 12 - 18 "Iyi gunler", 18 - 23 "Iyi aksamlar", 23 - 05 "Iyi geceler". Uc panel
basligi ayni fonksiyonu kullanir (profesyonel / musteri merkezi, ajans ve kurum genel bakisi).

## Fahri'nin tablosu

Tasarim satirinin (24) "Durum" hucresi uretim SONRASI guncellenecek (rezervasyon, sohbet, panel ve bu turun uc
sayfasi); Fahri'nin hucreye ekledigi not varsa korunur.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen dort dosya) temiz.
- Onizleme turu (yapilacak): Kaan ile Ilanlarim (karttaki sayilar sekme sayilariyla ayni mi), profil duzenleme
  (Kaan'da "Hakkimda" eksigi); Ilker ile takvim ve profil duzenleme (profil tam: kart yok); panel basliginda
  selamlama (o andaki Istanbul saatine gore); 375 px.

## Bu dala giren dokumanlar

Duzeltme 23 kapanisi (bulgular 151 - 153, plan).
