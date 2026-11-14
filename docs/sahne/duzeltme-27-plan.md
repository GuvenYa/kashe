# Duzeltme 27 - kucuk gozlemler: sekme basliklari, `main` etiketi, dar ekranda bildirim karti

Hazirlayan: Guven + Claude, 14 Kasim 2026. Kaynak: Duzeltme 25 ve 26 onizleme turlarinda not edilen gozlemler (Fahri'nin
"Sorular" sekmesindeki yanitlar beklenirken). Goc (migration) YOK.

Durum: DALDA (`duzeltme-27`), onizleme turu TAMAM (14 Kas); uretim bekliyor. Turda taramanin kacirdigi altinci sayfa
(`/ilanlar`) bulundu; ikinci commit'te.

## Tarama

`app` altindaki 93 sayfa iki soru icin tarandi: sekme basligi (`metadata` / `generateMetadata`) var mi, sayfa govdesi
`main` etiketinde mi (ya da `PanelKabugu` icinde mi)?

- Sekme basligi olmayan uc sayfa: `/ilanlar/yeni`, `/ilanlar/[id]`, `/ilanlar/[id]/duzenle` (sekmede genel "Kashe -
  Turkiye'nin Yetenek Sahnesi" yaziyordu).
- `main` etiketi olmayan bes sayfa: yukaridaki uc sayfa + `/teklif-topla` + `/teklif-taleplerim/[id]`. Yonetici
  sayfalari (kabuk), yasal sayfalar (`LegalPageShell`) ve portal (`layout`) zaten `main` icinde.
- DUZELTME (onizleme turunda goruldu): ilk tarama klasordeki TUM dosyalara bakiyordu; `/ilanlar` (ilan tahtasi)
  klasorunde `main` yalniz `loading.tsx`'te oldugu icin sayfa "var" sayildi. Canli sayfada `main` yoktu. Tarama
  sayfa dosyasina ve cizdigi kabuga bakacak sekilde yenilendi (yukleme / hata dosyalari haric; `TopNav` sayisi ile
  `main` sayisi karsilastirildi): eksik kalan tek sayfa `/ilanlar`. Toplam ALTI sayfa.

## 27-A Sekme basliklari (bulgu 159)

YAPILDI:
- `/ilanlar/yeni`: "Yeni ilan - Kashe". `/ilanlar/[id]/duzenle`: "Ilani duzenle - Kashe".
- `/ilanlar/[id]` (`generateMetadata`): YAYINDAKI ilanda ilanin adi ("<ilan adi> - Kashe"); taslak, onay bekleyen ya da
  kapali ilanda ve bulunamayan ilanda genel "Ilan - Kashe". Okuma sayfayla ayni sunucu istemcisiyle (RLS); yalniz
  `title, status` (tek kucuk sorgu).

## 27-B `main` etiketi ve ilan duzenlede ust menu (bulgu 159)

YAPILDI: alti sayfada govdeyi saran `div` -> `main` (sinif ayni; gorunum degismez). Ekran okuyucu ve "icerige atla"
icin sayfanin ana bolgesi artik isaretli. Altincisi (`app/ilanlar/page.tsx`) ikinci commit'te.

Ilan duzenle sayfasinda ust menu (`TopNav`) HIC yoktu (ilan olusturda var): eklendi. Kullanici duzenleme sayfasindan
yalniz "Ilan detayi" baglantisiyla cikabiliyordu.

## 27-C Dar ekranda "Tarayici bildirimleri" karti (bulgu 159)

YAPILDI (`app/bildirimler/push-toggle.tsx`): metin blogu `flex-1` + `min-w-0` oldugu icin 375 px'te dugmenin yaninda
birkac harflik sutuna sikisiyordu. Bloga taban genislik verildi (`basis-64`): dar ekranda dugme alt satira iner, metin
tam genislige yayilir; genis ekranda yerlesim ayni.

## Bakildi, DOKUNULMADI

Rehberdeki "bilinen eksikler" 18. madde (Ekip sekmesinde "Onayla" sonrasi basliktaki "Taslak" etiketi): basliktaki
etiket ETKINLIGIN durumu, ekibin degil; eylem sayfayi zaten yeniliyor (`revalidatePath`). Davranisi gormek icin
Sahne'de bir ekibi onaylamak gerekir (veri yazar); bu turda denenmedi.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen yedi dosya) temiz.
- Onizleme turu (14 Kas, `dpl_GEXW7UBtU6Cnz1CpKDgCVw3gHdBw`, ilk commit), TAMAM:
  - Girissiz: `/ilanlar/<yayindaki ilan>` sekme basligi "Kizimin 7. yas gunu icin palyaco - Kashe", tek `main`,
    gorunum ayni; olmayan ilanda "Ilan - Kashe" ve 404 sayfasi.
  - Kaan Erol: ilan olustur ("Yeni ilan - Kashe", `main`), ilan duzenle ("Ilani duzenle - Kashe", ust menu geldi,
    `main`), Teklif topla ve teklif talebi detayi (`main`, gorunum ayni).
  - 375 px: bildirim kartinda metin tam genislikte (251 px), dugme alt satirda; genis ekranda dugme sagda ayni
    satirda. Ilan duzenle 375 px'te yatay tasma yok.
  - Bulundu: `/ilanlar` listesinde `main` yok (yukaridaki tarama duzeltmesi). Ikinci commit: tek satirlik ayni
    degisiklik; `tsc` ve `eslint` temiz. Uretim sonrasi Sahne adresinde bakilacak.
  - Tur sonunda cikis yapildi; veri yazilmadi.

## Bu dala giren dokumanlar

Duzeltme 26 kapanisi (bulgular 157 - 158, plan).
