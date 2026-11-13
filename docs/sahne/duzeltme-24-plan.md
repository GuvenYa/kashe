# Duzeltme 24 - gorsel dil: Ilanlarim, profil duzenleme, takvim + selamlama

Hazirlayan: Guven + Claude, 14 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24), rehber 3.2
"bilinen eksikler" 9. madde ve Duzeltme 23 turundaki gozlem (gece "Gunaydin"). Goc (migration) YOK.

Durum: URETIMDE (14 Kas; main = sahne = b6478e5; uretim derlemesi `dpl_7C9u9Tx8ps1EXGkwD9uRvchpbcYv`, Sahne adresi
`dpl_9Rr8UJfiaDTw71vnHCwy4eXXaN9u`). Turda duzeltme cikmadi; ikinci commit yalniz tur notlari.

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

YAPILDI (14 Kas, uretim sonrasi): tasarim satirinin "Durum" hucresi (K24) guncellendi - dil artik Teklif topla,
Etkinliklerim, Islerim, rezervasyon, sohbet, Ilanlarim, profil duzenleme, takvim ve panelde. Yazmadan once tablo
okundu: Fahri hucrelere not eklememis, yeni satir yok. Geri okuma: yalniz K24 degisti, metin birebir.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen dort dosya) temiz.
- Onizleme turu (14 Kas, Istanbul 01:47):
  - Ilanlarim (Kaan): "1 ilan yayinda", satir "1 ilan yayinda, 1 basvuru geldi", kutular 1 / 1 / 0, ilerleme 100;
    listeyle ayni (Tumu 1, Yayinda 1, ilanda "1 basvuru"). 375 px: uc kutu yan yana (90 px), tasma yok.
    GORULMEDI: revizyon / onay bekleyen / taslak basliklari (Kaan'da yalniz yayinda ilan var).
  - Profil duzenleme (Kaan): pembe cizgili etiket, vurgulu "guncelle", kart "Profilini tamamla" (ilerleme 80,
    "Hakkimda (en az 20 karakter)", Tamlik %80 / Eksik 1); 375 px tasma yok. Ilker'de (profil tam) kart yok.
    GORULMEDI: hizmet eksigi satirindaki "Hizmetlerim" baglantisi.
  - Takvim (Ilker): "Musaitlik takvimi", "Yaklasan (1)", "Gecmis (7)" pembe cizgili; uc h2 ekran okuyucuda duruyor.
  - Selamlama: 01:47'de Kaan ve Ilker'in panelinde "Iyi geceler". Diger saat araliklari GORULMEDI (kural dort
    satir; okunarak dogrulandi).
- Uretim sonrasi (14 Kas, 02:00): kashe.net girissiz Kesfet 34 kart (102 profil baglantisi; "102 kart" yanlis sayimdi, 14 Kas duzeltildi), `fra1::fra1`. Sahne adresi, Kaan: Ilanlarim
  karti, profil duzenleme karti, "Iyi geceler", merkez 11 / 8 / 6.

## Bu dala giren dokumanlar

Duzeltme 23 kapanisi (bulgular 151 - 153, plan).
