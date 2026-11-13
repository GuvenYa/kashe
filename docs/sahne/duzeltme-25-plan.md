# Duzeltme 25 - gorsel dil: Basvurularim, bildirimler + test rehberi 3.3

Hazirlayan: Guven + Claude, 14 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24); Guven:
"cevap gelene kadar tasimaya devam edelim". Goc (migration) YOK.

Durum: DALDA (`duzeltme-25`), onizleme turu TAMAM (14 Kas); uretim bekliyor.

## 25-A Basvurularim'da durum ozeti (bulgu 156)

YAPILDI (`app/basvurularim/page.tsx`): basligin altinda `DurumKarti`. YENI SORGU YOK; sayilar sayfanin zaten okudugu
basvurulardan.
- Baslik (oncelik sirasi): "N basvurun kabul edildi" > "N basvurun kisa listede" > "N basvurun yanit bekliyor" >
  "Acik basvurun yok".
- Satirlar yalniz var olan durumu yazar: "N basvuru kabul edildi" (tamam), "N basvuru kisa listeye alindi" (tamam),
  "N basvuru ilan sahibinin yanitini bekliyor"; acik basvuru yoksa tek satir ("Sonuclanan basvurularin asagidaki
  listede").
- Kutular: Bekleyen / Kisa liste / Kabul. Ilerleme = (kabul + kisa liste) / (bekleyen + kisa liste + kabul).
  Hic basvuru yoksa kart cizilmez.

## 25-B Kazanclarim - DEGISIKLIK YOK (bilerek)

Sayfa 18-C'de calisma yuzeyi vurgusunu almisti; ustte uc tutar kutusu zaten ozet goruyor. Durum karti ayni
sayilari ikinci kez yazardi.

## 25-C Bildirimler (bulgu 156)

YAPILDI (`app/bildirimler/bildirim-listesi.tsx`, `page.tsx`): "Bildirimler" ust etiketi ve gun gruplari (Bugun, Dun
...) pembe cizgili `VurguEtiketi`; basliktaki "N yeni" vurgusu calisma yuzeyi kuralina gecti (egik lacivert yerine
duz pembe). Liste, okundu isaretleme ve canli sayac degismedi.

## Fahri'ye sorular (tablo)

YAPILDI (14 Kas): "Sahne bulgulari - Fahri" dosyasina ikinci sekme "Sorular (Fahri yanitlar)". Bes satir: musteriyi
tanima (puan / iptal gecmisi rozeti), teklifle sozlesme, telefonla gorusme (araci numara), ana sayfa duvari
gorselleri, ikinci tur zamani. Sutunlar: konu, sorumuz, secenekler ve onerimiz, "Senin yanitin (Fahri doldurur)",
ilgili bulgu satiri. Geri okundu: bulgu sekmesi degismedi (36 satir), yanit sutunu bos.

## Test rehberi 3.3

YAPILDI (ikinci commit; 36 sayfa, "Bu surumde ne degisti" tek sayfa):
- Kapak ve degisiklik sayfasi 3.3; 3.2 satiri "3.2 ve 3.3" oldu (Ilanlarim ve Basvurularim'da durum ozeti eklendi).
- "Yeniden denerken" kutusu ve Bolum 12 "Karar bekleyenler": sorular artik tablonun "Sorular (Fahri yanitlar)"
  sekmesinde, yanit oraya.
- Bolum 12 madde 9: gorsel dilin gectigi sayfalar guncel (Ilanlarim, Basvurularim, profil, takvim, bildirimler);
  "sirada" listesi yerine "eski kalan sayfa gorursen tabloya yaz".
- Bolum 13: "Sorular" sekmesi maddesi. Ek turlar / ilan tahtasi: Ilanlarim ve Basvurularim'daki ozet kartini
  sekme sayilariyla karsilastirma notu.
- Yeni ekran goruntusu yok.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen uc dosya) temiz.
- Onizleme turu (14 Kas, `dpl_DZNz7CBVboRW7zrp2shBeZ2CNHDA`), TAMAM:
  - Basvurularim, Lumen (ajans; 1 basvuru kisa listede): baslik "1 basvurun kisa listede", satir "1 basvuru kisa
    listeye alindi" (tamam), kutular 0 / 1 / 0, ilerleme 100; sekmeler Tumu 1, Kisa listede 1.
  - Basvurularim, Selin Unal (profesyonel; 1 basvuru bekliyor): baslik "1 basvurun yanit bekliyor", satir "1 basvuru
    ilan sahibinin yanitini bekliyor", kutular 1 / 0 / 0, ilerleme 0; sekmeler Tumu 1, Bekleyen 1.
  - Basvurusu olmayan hesapta (Ilker Sezer, Halil Aydin) kart yok, bos durum eskisi gibi. Musteri hesabinda sayfa
    eskisi gibi panele yonleniyor.
  - Bildirimler: Ilker (11 yeni), Kaan (15 yeni; Bugun / Bu hafta) ve Selin ("Tumu okunmus"; Daha eski): etiketler
    pembe cizgili, "N yeni" duz pembe.
  - 375 px: Basvurularim (Lumen) ve bildirimler (Ilker) yatay tasma yok; uc kutu basligin altinda yan yana.
  - GORULMEDI (Sahne'de boyle kayit yok): "N basvurun kabul edildi" ve "Acik basvurun yok" basliklari;
    bildirimlerin bos durumu (hic bildirimi olmayan hesap bulunmadi).
  - Gozlem (bu turun isi degil, onceden de boyle): 375 px'te "Tarayici bildirimleri" kartinda metin sutunu dugmenin
    yaninda cok dar kaliyor.
  - Tur sonunda onizleme adresindeki tum test hesaplarindan cikis yapildi; veri yazilmadi.

## Bu dala giren dokumanlar

Duzeltme 24 kapanisi (bulgular 154 - 155, plan).
