# Duzeltme 12-14 plani - Fahri'nin tablosu, 18-32. satirlar

Tarih: 6 Kasim 2026. Kaynak: "Sahne bulgulari - Fahri" tablosu (32 satir).
Satir 1-16 (Fahri #1-#15 + tablo notu) Duzeltme 05-11 ile kapandi (bulgu 63-83;
yalniz #8 ana sayfa gorselleri icerik bekliyor). Satir 17 ("fark etmez"
secenekleri) Fahri'nin kendi notuyla dogrulandi: "yapildi sanirim".

Bu belge 18-32. satirlari (bulgu 114-126) uc tura boler. Kural: Fahri'nin
onerisi varsa o uygulanir; onerisi yoksa diger talepleriyle uyumlu secilir.
Karar gerektiren yerler ayrica isaretli.

## Sira

| Tur | Konu | Fahri satirlari | Bulgu | Neden bu sira |
|---|---|---|---|---|
| Duzeltme 12 | Teklif ve rezervasyon akisi ("ucuncu not") | 18, 19, 20, 21, 22, 23, 25, 28 | 114-120 | Ertelenen not; en cok satir; musteri-profesyonel akisinin omurgasi |
| Duzeltme 13 | Kashe AI, sihirbaz ve adaylar | 26, 29, 30, 31, 32 | 121-125 | Iki HATA burada (31, 32); ajans deneyimi |
| Duzeltme 14 | Formlar ve gorunum | 24, 27 | 126 | Veri (ilce listesi) ve tasarim karari gerektirir |

Her tur ayni akisla gider: yerel test -> dal (`guvenlik`/`duzeltme` dali) ->
onizleme turu -> uretim -> main + sahne.

## Duzeltme 12 - Teklif ve rezervasyon akisi

### 12-A Teklif kendi tarihini, saatini ve yerini tasir (satir 19; bulgu 115)
Bugun: teklifte tarih yok; kabulde rezervasyon tarihi SOHBETIN tarihinden gelir
(`on_quote_accepted_create_booking` -> `conversations.event_date`). Musteri
tarih secmediyse rezervasyon "Tarih belirlenmedi" kalir.
Yapilacak:
- `quotes` tablosuna `event_date`, `start_time`, `end_time`, `location`
  sutunlari (yazma yetkisi yalniz eklemede; G01 duzeni korunur).
- Teklif formunda "Tarih / saat / yer" blogu: sohbetteki musteri secimiyle
  DOLU gelir ("Musterinin sectigi tarih"); musteri "belli degil" dediyse
  profesyonel secer (bos birakilabilir, uyari metniyle).
- Rezervasyon tetikleyicisi once teklifin tarihini, yoksa sohbetinkini alir.
- Kabulde iki tarafin takvimi: profesyonel `/takvimim` (zaten rezervasyonlari
  gosterir), musteri `/rezervasyonlarim`; kamu profil takviminde dolu gunler
  (`bookedDates` bugun bos gidiyor) icin kimliksiz RPC
  (`saglayici_dolu_gunler`: yalniz tarih, yayindaki saglayici).

### 12-B Ayni profesyonelle ikinci is: "Yeni talep" karti (satir 18; bulgu 114)
Bugun: musteri-profesyonel cifti basina TEK sohbet; tum isler ayni akista; bir
teklif kabul edilince sohbetteki DIGER bekleyen teklifler de reddediliyor.
Yapilacak (sohbet modeli degismez, is numarasi eklenir):
- `conversations.request_count`; musteri yeni brief / rezervasyon talebi
  gonderdikce artar; teklif olusurken `quotes.request_no` yazilir.
- Her yeni talepte sohbete "Yeni talep · <tur> · <tarih>" sistem karti
  (`sistem_mesaji_ekle` yeni tur `yeni_talep`); ETKINLIK seridi son talebi
  gosterir (bugunku gibi).
- Kabul: yalniz AYNI talep numarasindaki bekleyen teklifler reddedilir.
Fahri'nin "farkli olarak ilerlemesini bekledim" beklentisi sohbeti bolmeden
karsilanir; ayri sohbet (konu basina) daha sonra degerlendirilir.

### 12-C Fotograf / dosya eki: once onizleme, sonra "Gonder" (satir 18; bulgu 114)
Bugun: dosya secilince hemen yukleniyor ve gidiyor. Yapilacak: secilen dosya
kutuda onizleme (gorselde kucuk resim, PDF/Word'de ad) + istege bagli
aciklama; "Gonder"e basinca yuklenir ve gider; "x" ile vazgecilir.

### 12-D Verdigim teklifler / gelen teklifler (satir 25; bulgu 119)
Bugun: profesyonel verdigi teklifleri yalniz sohbette gorur; musteri
"Pro teklifleri" (`/teklif-taleplerim`) sayfasinda yalniz teklif topla
taleplerini gorur, sohbetten gelen teklifler orada yok.
Yapilacak:
- Profesyonel: `/tekliflerim` ("Verdigim teklifler"): tutar, durum, musteri,
  tarih, sohbete baglanti; panel menusune girer.
- Musteri: `/teklif-taleplerim` sayfasina "Sohbetten gelen teklifler" bolumu.
- Ad: menudeki "Pro teklifleri" -> "Gelen teklifler" (Fahri satir 26:
  "Teklif taleplerim ifadesi bana uygun gelmedi"; onerisi yok, kendi sozu
  "talebime iliskin gelen teklifler").

### 12-E Kabulde iki tarafa ayri mesaj (satir 25; bulgu 119)
Bugun: kabulde profesyonele bildirim + e-posta gider; musteriye yalniz
sohbetteki "Bu teklifi onayladin" karti. Yapilacak: musteriye de bildirim +
e-posta ("Teklifi onayladin, rezervasyon olustu" + rezervasyon baglantisi).

### 12-F Tarihten once "tamamlandi": karsi taraf onayi (satir 23; bulgu 118)
Bugun: profesyonel onayli rezervasyonu istedigi an "tamamlandi" yapar.
Yapilacak: etkinlik tarihi gelmemisse (ya da tarih yoksa) profesyonelin
isareti "tamamlanma onayi bekliyor" olur (`bookings.completion_requested_at`),
musteri onaylayinca `completed`; tarih gectiyse bugunku gibi dogrudan.
Sistem satirlari: "Profesyonel isin tamamlandigini bildirdi - onayla" /
"Musteri tamamlanmayi onayladi". G01 gecis tetikleyicisi buna gore genisler.

### 12-G Iptal uyarisi ve yorum hakki (satir 21, 23; bulgu 117)
Bugun: guven puani satici iptallerini zaten dusuruyor (son 12 ay, -15'e kadar)
ama ekranda uyari yok; yorum yalniz tamamlanan iste.
Yapilacak (Fahri'nin onerisi):
- Iptal penceresinde uyari: "Iptal guven puanini dusurur; karsi taraf
  deneyimini yorumlayabilir."
- Profesyonel onayli rezervasyonu iptal ederse musteri yorum birakabilir
  (`reviews` uygunlugu: completed VEYA satici iptali).
- KARAR (Fahri): musterinin de puanlanmasi ("surekli kabul edip iptal eden
  musteri"). Onerim: ilk adimda profesyonele gorunen "musteri iptal gecmisi"
  rozeti (son 12 ayda musteri kaynakli iptal sayisi), kamuya acik musteri
  puani sonra. Fahri onaylarsa 12-G'ye girer; yoksa ayri tur.

### 12-H Panelde beklenen ve kazanilan gelir (satir 20; bulgu 116)
Bugun: profesyonel panelinde "Bu ay kazanc" (tamamlanan, net) ve "Yaklasan
rezervasyon" sayisi; `/kazanclarim` beklenen brutu hesapliyor ama panelde yok.
Yapilacak: panele "Beklenen gelir" (onayli rezervasyonlarin toplami) ve
"Toplam kazanc" kutulari; ajans panelinde ayni.
KARAR (Fahri): "Teklif ile birlikte sozlesme gonderilebilir" - sozlesme
sablonu / e-imza urun karari; bu turda yok, not alindi.

### 12-I Iletisim bilgisi (satir 22, 28; bulgu 120)
Bugun: telefon ve e-posta IKI TARAFA da rezervasyon onaylaninca acilir, iptalde
yeniden kapanir (`contactUnlocked`). Fahri'nin turunda sira: once rezervasyonu
iptal etti (satir 21), sonra sohbette telefon aradi (satir 22) -> kilit
yeniden kapanmisti. Sinan (satir 28) henuz anlasmasi olmayan sohbete bakti.
Yapilacak: kilit metni durumu anlatir ("Rezervasyon onaylaninca iki taraf icin
acilir; iptal edilirse kapanir"); rezervasyon sayfasinda da iletisim kutusu.
Uber tarzi araci numara (maskeli arama) telefon saglayicisi gerektirir -
sonraki donem, not alindi.

## Duzeltme 13 - Kashe AI, sihirbaz ve adaylar

### 13-A Aday kartlari sigmiyor - HATA (satir 31; bulgu 124)
Dogrulandi (Lumen, 1440 px): rol sutunlari 4'lu izgarada, kart ici ad /
fiyat / puan yan yana oldugu icin ad harf harf kiriliyor ("Ca n U."),
gerekce kelime kelime ("Ista nbul"). Yapilacak: kart dikey duzen (ad ve
gerekce tam genislik, fiyat + puan alt satirda); sutunlar en az 260 px, dar
ekranda yatay kaydirma; 1280 / 1440 / 375 px'te kontrol.

### 13-B Secim gorunumu (satir 32; bulgu 125)
Pembe cerceve "Onerilen" anlamina geliyor, secili olan ince siyah halka;
Fahri karisti ("pembe cizgiler olmasin"). Yapilacak: "Onerilen" yalniz kucuk
etiket; SECILI kart belirgin (dolgu + onay isareti); sutun basliginda
"x / n secili" ve "Bu rolden kac kisi?" sayisi duzenlenebilir (5 DJ icin
ihtiyac 5'e cikarilir, `event_requirements.quantity`).

### 13-C Hibrit ekip ve manuel ekleme (satir 32; bulgu 125)
Bugun: hibritte ajans adaylari listelenir ama EKIBE SECILEMEZ (yalniz "Teklif
talebi ac"); "Kashe'de ara" yok; havuzdan / sistem disi kisi ekleme yalniz
Ekip sekmesinde. Yapilacak (Fahri'nin onerisi):
- Adaylar tek listede: her rol sutununda tekil profesyoneller VE o rolu
  kapsayan ajanslar birlikte, ayrim yalniz rozetle ("Ajans"); ajans da
  secilebilir (ekip uyesi olarak ajans kaydi).
- "Tum isi ajansa ver" ayri secenek kalir (bugunku segment).
- Her sutunda "Kashe'den ara ve ekle" (rol + sehir ile saglayici aramasi) ve
  "Havuzdan ekle" (sistem disi kisi; Ekip sekmesindeki ile ayni).

### 13-D Sihirbaz metinleri (satir 30; bulgu 123)
- "medyan" -> "ortalama" (hesap medyan kalir; kucuk aciklama: "pazar
  ortalamasi (medyan)").
- "Veri olmayan rol" -> "Fiyati belirlenemeyen roller".
- "Bu etkinlik kimin adina?" -> "Etkinligi nasil duzenleyeceksin?" secenekler
  "Kendi adima" / "<Kurulus> adina"; kurulus secili gelir (ajans / kurum
  oturumunda varsayilan).

### 13-E Sihirbaza giris yolu (satir 29; bulgu 122)
Bugun: `/etkinliklerim` sayfasinda "Yeni etkinlik" dugmesi var ama ajans
gostergesinde yok; Fahri adresi rehberden yazdi. Yapilacak: ajans ve kurum
gostergesine "Yeni etkinlik - Kashe AI ile anlat" kutusu; panel menusunde
Etkinlikler altina "Yeni etkinlik"; gelen teklif talebi / RFP ekranindan
"Bu talebi Kashe AI'da planla" (brief metni ile sihirbaz dolu acilir).
Ad birligi: ust menu "Etkinligini planla" = Kashe AI; sihirbaz "etkinligi
olustur" adimidir, ayri bir urun gibi gorunmez.

### 13-F Musteri "Yeni talep": anlat, uygun profesyonellere gitsin (satir 26; bulgu 121)
Bugun: "Yeni talep" -> `/teklif-topla` (kategori / sehir suzgeci + brief).
Yapilacak: Kashe AI sonucunda rol bulununca "Bu rol icin teklif topla"
(kategori, sehir, tur, tarih ve anlatim dolu `/teklif-topla`); musteri
panelinde "Yeni talep" yaninda "Kashe AI ile anlat". Menu adi 12-D ile
"Gelen teklifler".

## Duzeltme 14 - Formlar ve gorunum

### 14-A Tarih secimi (satir 27; bulgu 126)
Rezervasyon talebi ve teklif formlarinda tarayici tarih kutusu (bicim
tarayicinin diline bagli). Yapilacak: Turkce takvim acilir kutusu (musaitlik
takvimi bileseni) + hizli secenekler "Gelecek hafta / 2 hafta sonra / Gelecek
ay / Tarih belli degil"; gosterim "27 Kasim 2026".

### 14-B Ilce listesi (satir 27; bulgu 126)
Ilce bugun serbest metin (Duzeltme 10 il secici + istege bagli ilce / mekan).
VERI GEREKLI: 81 il - 973 ilce listesi (resmi kaynak). Liste gelince il
secince ilce acilir kutusu; mekan serbest metin kalir.

### 14-C Renkler, bolum gecisleri, scorecard (satir 24)
Tasarim yonu karari (Fahri + Guven): "daha canli renkler", izleme sayfalarinin
farklilasmasi, dikey balanced scorecard. Bu turlarda kod degismez; karar
sonrasi ayri tasarim turu.

## Kararlar (Fahri) - secenekler ve oneri (*)

1. Musteri puani / iptal gecmisi (12-G)
   - (*) A: Profesyonele gorunen "musteri iptal gecmisi" gostergesi (sohbet ve
     rezervasyonda karsi taraf panelinde "son 12 ayda X musteri iptali");
     kamuya acik puan yok. Kucuk is, Duzeltme 12'nin devamina girer.
   - B: Iki yonlu puanlama (profesyonel de musteriyi puanlar, musteri
     profilinde ortalama). Ayri tur.
   - C: Ikisi de yok; yalniz iptal uyarisi + profesyonel iptalinde yorum
     hakki (Duzeltme 12'de yapildi).
2. Teklifle sozlesme (12-H)
   - (*) A: Bu turda yok; sonraki donemde sistemin urettigi "teklif ozeti" PDF
     (taraflar, tarih / yer, tutar, hizmet, iptal politikasi), kabulde iki
     tarafa e-posta. E-imza yok.
   - B: Profesyonel teklife kendi sozlesme PDF'ini ekler; musteri kabulde
     "okudum, kabul ediyorum" isaretler. Ayri tur.
   - C: E-imza entegrasyonu. Ayri proje.
3. Araci numara ile arama (12-I)
   - (*) A: Numara rezervasyon onayinda acilir, iptalde kapanir (bugunku kural);
     metin bunu yazar, rezervasyon sayfasinda iletisim kutusu (yapildi).
   - B: Kashe icinde maskeli arama (telefon saglayicisi, maliyet, KVKK metni).
     Ayri proje; A'nin ustune gelir.
   - C: Telefon teklif asamasinda da acilsin (onerilmez: platform disi anlasma).
4. Tasarim yonu (14-C)
   - (*) A: Dar "canlilik" turu: canli ikincil palet (durum rozetleri, bolum
     basliklari, bos durumlar), izleme sayfalarina ayirt edici baslik seridi,
     profilde dikey scorecard. Tek tur.
   - B: Tam tasarim yenileme (palet, tipografi, bilesen seti). Haftalar.
   - C: Akis hatalari bitene kadar dokunulmaz.
5. Ilce verisi (14-B)
   - (*) A: Resmi 81 il / 973 ilce listesi repoya statik JSON; il secilince
     ilce acilir kutusu; mekan serbest metin. Liste Claude derler, Fahri
     gozden gecirir.
   - B: Yalniz buyuksehir illerinde (30) ilce listesi.
   - C: Ilce serbest metin kalir.

## Durum (7 Kasim 2026)
Duzeltme 12 uretimde. Migration `20261106160000_duzeltme_12_teklif_rezervasyon.sql`;
kontrol `asama31` dal ve uretimde K1-K10 ESIT; davranis `asama31b` dalda
33/33 (fikstur dalin onceki tur verisinden bagimsiz musteri secer); eski
turlar dalda gecti (asama25b 25/25 - yorum fiksturu mevcut yorumu kullanir,
asama29b 32/32). Onizleme turu (Kaan + Ilker): tarihli teklif, kabulde
rezervasyonun teklif tarihini almasi ve musteri bildirimi, profil takviminde
dolu gunler, "Yeni talep #2" karti ve Talep #2 teklifi, dosya onizleme +
kaldirma + aciklamali gonderim, tarihten once tamamlama onayi (Onay bekliyor
-> musteri onayi), profesyonel iptal uyarisi ve iptal kaydinda yorum
baglantisi, panel gelir kutulari, Verdigim / Gelen teklifler. Turda dort
kucuk duzeltme yapildi (rezervasyon sayfasinda iletisim sohbetle ayni kural;
listelerde eski tekliflere rezervasyon tarihi, kisi bazinda tam ad, tur
rezervasyondan ya da kendi talebinden; yeni tarih saatsiz gelirse eski saat
temizlenir). Uretimde girissiz dolu gun RPC'si 200, talep fonksiyonu 401,
profil sayfasi hatasiz.

Duzeltme 13 kodda ve yerel testte (7 Kasim): migration
`20261107100000_duzeltme_13_ajans_rol_kapsami.sql` (ajansin hangi rolu
kapsadigi, eslestirme kuraliyla; uye kimligi donmez), kontrol `asama32`,
davranis `asama32b` (9 test); onceki 182 test gecti. 13-A..13-F uygulamada.
Dal bekliyor. Fahri kararlari (yukarida) hala bekleniyor; 13 bunlara bagli
degil.
