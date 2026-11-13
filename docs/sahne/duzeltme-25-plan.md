# Duzeltme 25 - gorsel dil: Basvurularim, bildirimler + test rehberi 3.3

Hazirlayan: Guven + Claude, 14 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24); Guven:
"cevap gelene kadar tasimaya devam edelim". Goc (migration) YOK.

Durum: DALDA (`duzeltme-25`), onizleme turu bekliyor.

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

Onizleme turundan SONRA, ikinci commit ile: "bilinen eksikler" 9. madde (gorsel dil artik hangi sayfalarda) ve
Bolum 13'e "Sorular" sekmesi notu.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen uc dosya) temiz.
- Onizleme turu (yapilacak): Ilker ile Basvurularim (karttaki sayilar sekme sayilariyla ayni mi) ve bildirimler;
  Kaan ile bildirimler; 375 px.

## Bu dala giren dokumanlar

Duzeltme 24 kapanisi (bulgular 154 - 155, plan).
