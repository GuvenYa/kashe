# Duzeltme 26 - gorsel dil: profil icerigi sayfalari, Davetlerim, Favorilerim, ilan formu

Hazirlayan: Guven + Claude, 14 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24); Guven:
"cevap gelene kadar tasimaya devam edelim". Goc (migration) YOK.

Durum: URETIMDE (14 Kas; main = sahne = bd3d7b8; uretim derlemesi `dpl_AyFqLGFxvv2ECo85JqTFPkaJeTEG`, Sahne adresi
`dpl_BD1m74CedFv5ozhZoCPbLvAyfNKz`). Ilk onizleme turu bir bulgu cikardi (158: suresi dolan davet); duzeltmesi ikinci
commit'te, ikinci turda goruldu.

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
  AYNI kuralla (bekleyen = `pending` ve suresi dolmamis; bkz. 26-F), yani listelerdeki "Bekleyen ... (n)"
  sayilariyla ayni.
  - Baslik: "N davet yanitini bekliyor" / "Yanit bekleyen davetin yok".
  - Satirlar yalniz var olan durumu yazar: "N ilan daveti yanitini bekliyor", "N kurumsal ekip daveti ...",
    "N ajans daveti ..."; suresi dolan varsa "N davetin suresi doldu; yanit verilemez"; ikisi de yoksa tek satir
    ("Sonuclanan davetlerin asagidaki listede").
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

## 26-F Suresi dolan davet "Bekleyen"de kaliyordu (bulgu 158; onizleme turunda bulundu)

Sorun (bu daldan ONCE de vardi): suresi dolan kurulus daveti veritabaninda `pending` kalir (RPC suresi dolmus
davette kabul ve reddi geri cevirir: "davetin suresi dolmus"). Davet EDEN tarafin listesi bunu biliyor
(`isInvitationExpired`, "Suresi doldu" rozeti); davetLI tarafin sayfasi (`/davetlerim`) bilmiyordu: davet "Bekleyen
(n)" altinda, "Bekliyor" rozeti ve calismayan "Kabul et" / "Reddet" dugmeleriyle duruyordu. Yeni ozet karti da
ayni kuralla "1 davet yanitini bekliyor" diyordu (Fatih Keskin: Lumen daveti, 30 Eyl; Derya Celik: Anadolu Ilac
daveti).

YAPILDI (`app/davetlerim/davetlerim-listesi.tsx`, `kurumsal-davetler-listesi.tsx`, `page.tsx`): davet eden taraftaki
kuralin aynisi. Suresi dolan davet "Gecmis" bolumune duser, rozeti "Suresi doldu", dugme yok. Ozet karti onu bekleyen
saymaz; ayri satirda yazar. Veritabani ve RPC degismedi. Ilan davetlerinde sure alani yok; onlar eskisi gibi.

## Fahri'nin tablosu

YAPILDI (14 Kas, uretim sonrasi): tasarim satirinin "Durum" hucresi (K24) guncellendi - "Tamam"; dilin gectigi
calisma sayfalarinin tam listesi, vitrin sayfalarinin bilerek lacivert kaldigi notu. Geri okundu. Fahri hucreye not
eklememisti. "Sorular" sekmesinde yanit sutunu (E2 - E6) hala bos.

## Test rehberi

Degisiklik yok: 3.3'teki "bilinen eksikler" 9. madde zaten "eski kalan sayfa gorursen tabloya yaz" diyor.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen 12 dosya) temiz.
- Onizleme turu (14 Kas, `dpl_CPU32tAGrxRAwoywn9RUm9kMVV11`, ilk commit):
  - Ilker Sezer: bes profil icerigi sayfasi (etiket "Profil icerigi", baslik duz pembe), deneyim ekleme penceresi
    ("Ekle - Is Deneyimi"), sohbette "Teklif gonder" ve teklif taleplerinde "Kaan Erol icin teklif ver" pencereleri
    (acildi, GONDERILMEDI); Davetlerim bos durum (kart yok).
  - Fatih Keskin: Davetlerim'de kart "1 davet yanitini bekliyor", kutular 0 / 0 / 1, liste "Bekleyen davetler (1)" -
    sayilar ayni; AMA davet "Suresi doldu" yaziyor (bulgu 158).
  - Derya Celik (musteri): Davetlerim'de kart 0 / 1 / 0, "Kurumsal ekip davetleri" ve "Ajans davetleri" etiketleri;
    ayni bulgu. Favorilerim (6 kart) ve ilan olustur basliklari.
  - Kaan Erol: ilan duzenle basligi ("Ilani duzenle" / "Ilanini guncelle").
  - 375 px: Portfoyum, Davetlerim, Favorilerim, ilan olustur - yatay tasma yok.
  - GORULMEDI: Favorilerim'in bos durumu.
  - Gozlem (bu turun isi degil): `/ilanlar/yeni` ve ilan duzenle sayfalarinda sekme basligi genel ("Kashe - ...")
    ve `main` etiketi yok.
  - Tur sonunda tum test hesaplarindan cikis yapildi; veri yazilmadi.
- Ikinci commit (26-F) icin `tsc --noEmit` ve `eslint` temiz.
- Ikinci onizleme turu (14 Kas, `dpl_CQpvf52vNefz3oa9MN6cuFqreqAY`, ikinci commit), TAMAM:
  - Fatih Keskin (ajans daveti, suresi dolmus): "Gecmis davetler (1)", rozet "Suresi doldu", dugme yok; kart "Yanit
    bekleyen davetin yok" (yesil nokta), satir "1 davetin suresi doldu; yanit verilemez", kutular 0 / 0 / 0.
  - Derya Celik (kurumsal ekip daveti, suresi dolmus): "Gecmis (1)", rozet "Suresi doldu", dugme yok; kart ayni.
  - Damla Demir (Lumen daveti, suresi DOLMAMIS; 3 gun kalmis): "Bekleyen davetler (1)", rozet "Bekliyor", "Reddet" /
    "Kabul et" dugmeleri yerinde; kart "1 davet yanitini bekliyor", kutular 0 / 0 / 1. Dugmelere BASILMADI.
  - 375 px (Fatih): yatay tasma yok. Tum hesaplardan cikis yapildi; veri yazilmadi.
- Uretim sonrasi (14 Kas, 03:20): kashe.net girissiz Kesfet "34 sonuc", 34 kart, `fra1::fra1`; girissiz Favorilerim
  uyarisi lacivert (bilerek). Sahne adresi, Fatih Keskin: Davetlerim'de "Gecmis davetler (1)", "Suresi doldu", dugme
  yok; Hizmetlerim'de "Profil icerigi" etiketi ve pembe baslik; cikis yapildi.

## Bu dala giren dokumanlar

Duzeltme 25 kapanisi (bulgu 156, plan). 21 - 24 planlarinda sayim duzeltmesi: uretim notlarindaki "Kesfet 102 kart"
kart degil profil baglantisi sayisiydi; dogrusu 34 kart.
