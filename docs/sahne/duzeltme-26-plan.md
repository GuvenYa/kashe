# Duzeltme 26 - gorsel dil: profil icerigi sayfalari, Davetlerim, Favorilerim, ilan formu

Hazirlayan: Guven + Claude, 14 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24); Guven:
"cevap gelene kadar tasimaya devam edelim". Goc (migration) YOK.

Durum: DALDA (`duzeltme-26`), onizleme turu bekliyor.

## Tarama: ne kalmisti?

Eski baslik vurgusu (egik lacivert: `text-brand-ink not-italic italic font-medium`) `app` altinda 27 dosyada
arandi. Ayrim:

- Calisma yuzeyi, bu turda cevrildi (12 dosya): asagidaki 26-A ... 26-E.
- Vitrin, BILEREK lacivert kaldi (DESIGN.md bolum 9: "vitrinde vurgu lacivert kalir"): Kesfet, kategori, fiyatlandirma,
  Kashe AI girisi, etkinlik sihirbazinin vitrin basligi, profil sayfasi (`/p/...`) ve ustundeki pencereler (teklif
  al, rezervasyon, davet, yorum yaz / yanitla), sifre sayfalari, havuz daveti.
- Uyari durumlari, dokunulmadi: "Erisim yok" / "Hesap askida" tam sayfa uyarilari (`/ilanlar/yeni`, `/teklif-topla`),
  Favorilerim'in girissiz ve "musterilere ozel" durumlari.
- Panel kabugundaki ajans / kurum sayfalari (`PanelBaslik`: musteriler, tedarikciler, kisa liste, gorevler, ayarlar,
  genel bakis, premium) zaten pembe vurgulu; degisiklik gerekmedi.

Bu turdan sonra calisma yuzeyinde eski baslik dili kalmiyor.

## 26-A Profil icerigi sayfalari (bulgu 157)

YAPILDI (`app/profil/hizmetlerim`, `paketler`, `portfoy`, `deneyim`, `kategori-bilgileri` `page.tsx`): "Profilime don"
baglantisinin altinda pembe cizgili `VurguEtiketi` ("Profil icerigi"; paneldeki sutun basligiyla ayni ad) ve baslik
duz pembe. Deneyim ekleme / duzenleme penceresinin basligi da ayni vurguda (`deneyim-client.tsx`).

Durum karti EKLENMEDI (bilerek): Hizmetlerim zaten "N hizmet - M aktif" satirini yaziyor, ayni sayi ikinci kez
yazilirdi; diger dort sayfada ilerleme / adim yok.

## 26-B Davetlerim (bulgu 157)

YAPILDI (`app/davetlerim/page.tsx`):
- Ust etiket ve bolum etiketleri ("Kurumsal ekip davetleri", "Ajans davetleri") `VurguEtiketi`; baslik duz pembe.
- Basligin altinda `DurumKarti`. YENI SORGU YOK; sayilar sayfanin zaten okudugu uc davet listesinden, listelerle
  AYNI kuralla (`status === 'pending'`), yani listelerdeki "Bekleyen ... (n)" sayilariyla ayni.
  - Baslik: "N davet yanitini bekliyor" / "Yanit bekleyen davetin yok".
  - Satirlar yalniz var olan durumu yazar: "N ilan daveti yanitini bekliyor", "N kurumsal ekip daveti ...",
    "N ajans daveti ..."; bekleyen yoksa tek satir ("Sonuclanan davetlerin asagidaki listede").
  - Kutular: Ilan / Kurum / Ajans (bekleyen sayilari). Ilerleme = yanitlanan / toplam davet.
  - Hic davet yoksa kart cizilmez (bos durum eskisi gibi).

## 26-C Favorilerim (bulgu 157)

YAPILDI (`app/favoriler/page.tsx`): giris yapmis musterinin iki durumunda (bos liste, dolu liste) `VurguEtiketi` +
pembe vurgu. Kartlar Kesfet'in karti, degismedi.

## 26-D Ilan olustur / duzenle (bulgu 157)

YAPILDI (`app/ilanlar/yeni/page.tsx`, `app/ilanlar/[id]/duzenle/page.tsx`): form sayfalarinin basligi `VurguEtiketi`
("Yeni ilan", "Ilani duzenle") + pembe vurgu. Form degismedi.

## 26-E Calisma yuzeyi pencereleri (bulgu 157)

YAPILDI: sohbetteki "Teklif gonder" penceresi (`app/mesajlar/[id]/quote-modal.tsx`) ve teklif taleplerindeki
"... icin teklif ver" penceresi (`app/teklif-talepleri/teklif-ver-modal.tsx`): vurgulanan kelime duz pembe.

## Test rehberi

Degisiklik yok: 3.3'teki "bilinen eksikler" 9. madde zaten "eski kalan sayfa gorursen tabloya yaz" diyor.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen 12 dosya) temiz.
- Onizleme turu (yapilacak): profesyonel hesapla bes profil icerigi sayfasi, deneyim penceresi ve Davetlerim
  (karttaki sayilar listelerdeki "(n)" ile ayni mi); musteri hesabiyla Favorilerim ve ilan olustur / duzenle;
  sohbette "Teklif gonder" ve teklif taleplerinde "teklif ver" pencereleri (acilir, GONDERILMEZ); 375 px.

## Bu dala giren dokumanlar

Duzeltme 25 kapanisi (bulgu 156, plan). 21 - 24 planlarinda sayim duzeltmesi: uretim notlarindaki "Kesfet 102 kart"
kart degil profil baglantisi sayisiydi; dogrusu 34 kart.
