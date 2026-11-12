# Duzeltme 15 - Fahri'nin tablosu, 33-36. satirlar (Hikaye 1b turu, 10 Kasim)

Kaynak: "Sahne bulgulari - Fahri" tablosu (10 Kas aksami eklenen 4 satir), bulgu 128-131.
Kurallar: Fahri'nin onerisi varsa o uygulanir; yoksa diger talepleriyle uyumlu duzenlenir.
Karar gerektirenler en altta, secenekler ve oneri (*) ile.

## Ozet

| Satir | Bulgu | Kim | Konu | Is |
|---|---|---|---|---|
| 33 | 128 | Musteri (Irem) | Talepler, gelen teklifler ve rezervasyonlar ayri menulerde; teklifin hangi ise ait oldugu yazmiyor | 15-A: musteri "Etkinliklerim" merkezi |
| 34 | 129 | Profesyonel (Burcu) | Ayni sekilde tek "Islerim" bekleniyor; teklif formunda 48 saat secenegi yok (Irem 48 saat istemisti) | 15-B: profesyonel "Islerim" merkezi; 15-D: 48 saat |
| 35 | 130 | Profesyonel + ajans uyesi (Burcu) | Panel menusu: iki "Takvim", iki "Kazanclar", "Gosterge" anlasilmiyor, "Ekipler" ekip kurmak icin etkinliklere yolluyor | 15-C: menu sadelestirme |
| 36 | 131 | Ayni | Menudeki "Ekim Kreatif" basligi tiklanmiyor; ajansa bagli profesyonelin teklif kurali | 15-C (baglanti) + KARAR 1 |

## 15-A Musteri: "Etkinliklerim" merkezi (satir 33)

Bugun musterinin isi dort yere dagilmis: `/etkinliklerim` (yalniz sihirbaz etkinlikleri),
`/teklif-taleplerim` "Gelen teklifler" (teklif topla + sohbet teklifleri), `/rezervasyonlarim`,
sohbetler. Gelen teklif kartinda isin adi (tur / tarih / talep no) yok.

Fahri'nin onerisi (uygulanacak): menude tek "Etkinliklerim"; sekmeler
**Teklif bekleyen / Yaklasan / Tamamlanan**; her is bir kart (etkinlik turu, tarih, sehir, durum,
gelen teklif sayisi), tiklayinca detay ve teklifler altinda.

- Is = teklif topla talebi, sohbetteki talep (`request_no`), sihirbaz etkinligi ya da rezervasyon.
  Ayni ise ait parcalar tek kartta (teklif kabul edilince kart "Yaklasan"a gecer, rezervasyon ona baglanir).
- "Gelen teklifler" ve "Rezervasyonlar" sayfalari kalkmaz, kartin detayina doner; menude tek madde.
- Hizli kazanc (once): teklif kartlarina isin adi ("Dugun - 12 Aralik - Talep #2").

YAPILDI (12 Kas, dal `duzeltme-15a`; onizlemede uc turda dogrulandi, asagida). Migration yok,
yalniz okuma.
- Kimde: musteri hesabi (rol `client`, ya da kurulusu olmayan `business`); olcut tek yerde
  (`app/lib/musteri-merkezi.ts`), menudeki musteri grubuyla ayni. Kurum ve ajans panelinde
  `/etkinliklerim` eski etkinlik listesi, menuleri ayni (ayni merkez onlara ayri turda).
- Sayfa: ustte durum karti (acik islerin kacina teklif geldi, karar bekleyen teklif, tamamlanma
  onayi bekleyen rezervasyon; kutular Bekleyen / Yaklasan / Tamamlanan), altinda segment sekmeler
  (`?sekme=`; "Sonuclanmayan" yalniz doluysa) ve is kartlari. Sekme secilmediyse ilk dolu sekme.
- Kart turleri: Etkinlik (sihirbaz), Teklif topla, Dogrudan talep, Rezervasyon. Kartta tur, baslik,
  tek satir ayrinti (etkinlik turu, tarih, sehir / yer, talep no), durum, tutar, altinda en cok uc
  teklif (bekleyen once) ve "Teklifleri karsilastir / Teklifi incele / Rezervasyonu ac / Etkinligi ac".
- Birlestirme (`app/etkinliklerim/musteri-isleri.ts`): sohbetteki is birimi (sohbet, talep no)
  icinde bir PARCA. Parca iki yerde biter / baslar: kabul edilen teklif isi kapatir, bir teklif
  topla talebinin yaniti yeni is baslatir. (Duzeltme 12 oncesi kayitlarda ve tur verisinde ayni
  profesyonelle yapilan butun isler 1 numarada duruyor; parcalanmazsa tek karta sikisiyordu.)
  Teklif `request_no`, rezervasyon `quote_id` ile birime baglanir; ayni birime ikinci rezervasyon
  duserse kendi kartiyla gorunur (kaybolmaz).
- Teklif topla yaniti: yanit akisi once teklifi yazar, hemen ardindan aliciya `responded_at` koyar;
  bu yuzden yanit anindan onceki SON teklif (30 sn saat payi) o talebin teklifidir. `responded_at`
  bos eski kayitta talepten sonraki ilk bos teklif alinir. Yanitin birimi talebin kartina girer.
- Etkinlige bagli talep / birim / rezervasyon (`event_id`) etkinlik kartina girer, ayri kart
  acilmaz; kartta "N talep" yazar, tek rezervasyon varsa "Rezervasyon" baglantisi cikar.
- Asama kurallari: bekleyen teklif varsa "N teklif geldi" (pembe, ustte); onayli rezervasyon ->
  Yaklasan (satici tamamlanma onayi istediyse "Onayin bekleniyor", pembe); tamamlanan -> Tamamlanan;
  onayli ama tarihi gecmis is de Tamamlanan'da "Tarihi gecti" diye durur (rezervasyon listesindeki
  "Gecmis" ayrimi). Iptal, kapatilan / suresi dolan talep, teklifsiz kalip tarihi gecen ya da 30
  gundur sessiz dogrudan talep, tarihi gecmis rezervasyonsuz etkinlik -> Sonuclanmayan. Onayli
  rezervasyonu olan etkinlik, baska ihtiyaci icin teklif beklese de Yaklasan'dadir (teklif gelince
  "Teklif bekleyen"in ustune cikar). Kabul edilip rezervasyonu iptal olan teklif satirda "Iptal
  edildi" yazar. Gecmis sekmeler etkinlik gunune gore (yakin gecmis once), Yaklasan yakin tarihe gore.
- Menu: musteri grubunda "Etkinlikler" -> "Etkinliklerim"; "Gelen teklifler" ve "Rezervasyonlar"
  maddeleri kalkti. Sayfalar duruyor (merkezin altinda "Ayri listeler"; bildirim ve e-posta
  baglantilari calisir). Rezervasyon ve teklif karsilastirma sayfalarinin geri baglantisi, teklif
  topla sonrasi yonlendirme ve Merkez'deki iki kutu musteride merkeze gider.
- Hizli kazanc: `/teklif-taleplerim` sohbet tekliflerinde isin turu ("Dugun · 12 Aralik 2026").
- Ortak parcalar 15-B icin hazir: `app/lib/isler.ts` (kart modeli), `IsKarti` / `IsSekmeleri`.
- Test: tsc + eslint temiz; birlestirme mantigi sahte veriyle (6 etkinlik, 11 talep, 11 sohbet,
  19 teklif, 12 rezervasyon; eski tek-numarali sohbet, dakikalar arayla iki yanit, rezervasyonlu
  etkinlik dahil) calistirildi, 27 kart beklenen asamada.
- Yan bulgu 132: musteri Merkez'inde "Gelen teklif" hep 0 idi (yanlis durum degeri), duzeltildi.

### Onizleme turu 15-A (12 Kas, dal `duzeltme-15a`; 1280 ve 375 px)

Hesaplar: Kaan Erol (musteri), Ilker Sezer (profesyonel). Rehber hesaplara girilmedi.

- Merkez: sekmeler ve sayilar, kartlar, durum karti, "Ayri listeler"; uretilen CSS'te yeni siniflar
  var (`max-w-[45%]`, `divide-line`, `px-2.5`, `tracking-[0.1em]` vb.); konsol temiz; 375 px'te
  yatay tasma yok, durum karti sayisi 18 px (ilk turdan kalan punto kontrolu de boylece kapandi).
- Menu: musteride tek "Etkinliklerim"; hesap menusu Panel / Etkinliklerim / Profili duzenle.
- Geri baglantilari: rezervasyon -> "Etkinliklerim" (durdugu sekme), teklif karsilastirma ->
  "Etkinliklerim". Merkez'de "Gelen teklif" 3 (eskiden 0, bulgu 132), kutular merkeze gidiyor.
- Uctan uca: sihirbazla etkinlik -> etkinlikten teklif topla (yalniz Ilker'e dussun diye Drone
  Pilotu) -> gonderince merkezin "Teklif bekleyen" sekmesi, etkinlik karti "Teklif bekleniyor",
  talep ayri kart acmadi -> Ilker teklif verdi -> kart en ustte "1 teklif geldi", satirda Ilker /
  8.500 TL -> Kaan onayladi -> kart "Yaklasan"da "1 rezervasyon", "Rezervasyon" baglantisi.
- Ilker'de (profesyonel + Lumen uyesi) `/etkinliklerim` eski liste; degisiklik yok.

Turda bulunup duzeltilenler (uc derleme):
1. Kaan'in 20 rezervasyonundan 5'i gorunmuyordu ve Ilker'in yanitladigi uc talepten ikisi teklifsiz
   gorunuyordu: eski kayitlarda butun isler tek talep numarasinda. Parcalama (yukarida) eklendi.
2. Dakikalar arayla verilen iki yanit ayni teklife baglaniyordu (5 dakikalik pay): yanit anindan
   onceki son teklif kurali.
3. Teklifi kabul edilen etkinlik "Teklif bekleyen"de kaliyordu (talep `active` kaliyor): anlasilan
   talep acik sayilmaz; rezervasyonlu etkinlik Yaklasan.
4. Tarihi gecmis onayli is "Yaklasan"in basindaydi -> Tamamlanan / "Tarihi gecti".
5. Talep kartinda gonderim gunu ve (varsa) rezervasyonun tarihi; iptal edilen is rezervasyona gider;
   etkinlik kartinda talep sayisi.
6. Dar ekranda kutu etiketi: "Tamamlanan" sigmiyordu -> "Biten"; `truncate` eklenince "YAKLASAN"
   kirpildi -> dar ekranda ic bosluk ve harf araligi daraltildi (olculdu: 61 / 68 px).

Sahne'de kalan tur verisi: Kaan'in "Tur 15-A: 40 kisilik dogum gunu" etkinligi (2 ihtiyac), ona
bagli Drone Pilotu talebi (alici yalniz Ilker), Ilker'in 8.500 TL teklifi ve 12 Aralik 2026 tarihli
onayli rezervasyon (Kaan - Ilker).

Acik kalan: kurum ve ajans panelinde ayni merkez (ayri tur); teklif karsilastirma sayfasi teklifi
hala "sohbetteki en yeni teklif" diye seciyor (merkezdeki yanit eslestirmesi oraya tasinabilir).

## 15-B Profesyonel: "Islerim" merkezi (satir 34)

Bugun: `/teklif-talepleri`, `/tekliflerim` (Verdigim teklifler), `/rezervasyonlarim`, sohbetler.
Fahri'nin onerisi: tek "Islerim"; sekmeler **Yanit bekleyen** (gelen talepler, yanitlanmamis sohbet
talepleri) / **Teklif verdiklerim** / **Anlasilan** (yaklasan rezervasyonlar) / **Tamamlanan**.
15-A ile ayni kart ve detay yapisi (iki taraf ayni dili konusur).

YAPILDI (12 Kas, dal `duzeltme-15b`; onizleme turu bekliyor). Migration yok, yalniz okuma.
- Sayfa: yeni `/islerim`. Kimde: rol `professional`, ya da ajans kurulusu olmayan `agency`
  (olcut tek yerde, `app/lib/satici-merkezi.ts`; menudeki satici grubuyla ayni). Digerleri
  `/profil`e doner. Ajans panelinde sayfalar ve menu oldugu gibi.
- Sekmeler: Yanit bekleyen / Teklif verdiklerim / Anlasilan / Tamamlanan (+ doluysa Sonuclanmayan).
  Ustte durum karti: acik taleplerin kacina teklif verildi, yanit bekleyen talep, "tamamlandi"
  isaretlenmeyi bekleyen is; kutular Bekleyen / Teklif / Onayli.
- Kartlar musteri merkeziyle ayni (`IsKarti`); kartta musterinin adi yazar. Pembe durum
  profesyonelden is beklenen yerdir: "Yeni talep" / "Teklif bekliyor" (teklif ver), tarihi gecmis
  onayli iste "Tamamlanmayi bekliyor". Teklif verilince "Yanit bekleniyor" (sira musteride);
  onayli rezervasyon Anlasilan; tamamlanma onayi istendiyse "Musteri onayi bekleniyor".
- Ortak mantik: is birimleri, teklif / rezervasyon baglari ve teklif topla yanit eslesmesi
  `app/lib/is-birimleri.ts`e tasindi; musteri merkezi de onu kullanir (iki taraf ayni isi ayni
  kartta gorur). Tasima sonrasi musteri modulunun sahte veri ciktisi birebir ayni (27 kart).
- Kapsam: kisinin KENDI sohbetleri (`professional_id` = kendisi). Ajansin atadigi sohbetler ajans
  panelinde kalir.
- Menu: satici grubunda "Teklif talepleri", "Verdigim teklifler", "Rezervasyonlar" kalkti; tek
  "Islerim". Sayfalar duruyor (merkezin altinda "Ayri listeler"). Teklif topla karti
  `/teklif-talepleri#talep-<id>` capasina iner (brief, ek ve teklif formu orada). Rezervasyonun
  geri baglantisi ve Merkez'deki iki kutu profesyonelde "Islerim"e gider.
- Model: `IsAsamasi`ya `teklif` eklendi (yalniz profesyonel merkezinde dolar).
- Test: tsc + eslint temiz; satici modulu sahte veriyle (6 alici, 6 sohbet, 7 teklif, 5 rezervasyon)
  calistirildi, 12 kart beklenen asamada. Onizlemede Ilker (profesyonel) ve Kaan (musteri
  merkezinde gerileme var mi) ile bakilacak.

## 15-C Ajans uyesi menusu (satir 35-36)

Burcu, Ekim Kreatif'in "izleyici" uyesi; menude kendi profesyonel grubu + Ekim Kreatif grubu ust uste.

YAPILDI (12 Kas):
- Tekrarlar: kullanicinin kendi satici grubu varsa ajans grubunda "Takvim" ve "Kazanclar"
  yazilmaz (ikisi de zaten kisisel sayfaya gidiyordu); kurulus sahibinde degisiklik yok.
- "Gosterge" -> **"Genel bakis"** (karar 2-A): ajans ve kurum menusu, sayfa ust basliklari,
  "Genel bakisa don" baglantilari.
- "Ekipler" -> **"Ekip yonetimi"** (`/ajans/ekipler`): ustte "Yeni ekip kur" - ekibi olmayan,
  suren etkinlikler listelenir, "Ekip kur" dogrudan etkinligin Adaylar sekmesine gider; etkinlik
  yoksa "Yeni etkinlik". Altta kurulan ekipler (satir etkinligin Ekip sekmesine gider).
- Grup basligi (kurulus adi) tiklanir -> yeni `/kurulus/uyelik?kurulus=<id>`: kurulus, rol,
  uyelik baslangici, acik / kapali yetkiler (sunucudaki yetki bayraklarindan), ajans uyesi
  profesyonele "baglanti nasil calisir", ve ayrilma (iki adimli onay; eylem FAZ 10a'dan beri
  vardi, ekrani yoktu).

## 15-D Teklif gecerliligi: 48 saat (satir 34)

Musteri teklif topla'da "Teklif donus suresi" 24 saat / 48 saat / 3 gun / 1 hafta seciyor;
profesyonelin teklif formunda gecerlilik 24 saat / 3 gun / 7 / 14 / 30 gun, 48 saat yok.
YAPILDI (12 Kas): gecerlilik seceneklerine 48 saat (sohbetteki teklif formunda da); teklif topla
talebinden acilan formun ustunde "Musterinin teklif bekledigi son tarih: ..." yazar. Gecerlilik
varsayilani musterinin suresiyle AYNI degil, son tarihten en az bir gun sonrasina uzanan ilk
secenek: musteri teklifleri son tarihe kadar toplayip sonra karsilastiriyor, ayni sure secilseydi
erken verilen teklif tam o anda dolardi. Daha kisa secilirse form uyarir (engellemez).

## 15-E Ajansa bagli profesyonelin teklifi (karar 1-A; SONRAKI TUR)

Profesyonel secer: uyelik sayfasinda "Bana gelen talepler: kendim teklif veririm / ajansim
uzerinden" (varsayilan kendim). "Ajansim uzerinden" secilirse profesyonele gelen talep ajansin
teklif akisina duser ve teklifi ajans verir; musteri ayni kisi icin iki ayri teklif almaz.
Veritabani (uyelik tercihi + talep yonlendirme) ve davranis testi gerektirir; 15-A / 15-B ile
birlikte ya da hemen ardindan.

## Gorsel dil (12 Kas, Guven + Fahri)

"Ekip kurma sayfasindaki gorunum iyi; tum sayfalara uygulayalim." Calisma yuzeyleri sayfa sayfa
ayni dile tasinir; her Duzeltme turunda dokunulan sayfalar da gecirilir. Ortak parcalar:
`VurguEtiketi`, `DurumKarti`, `SegmentSecici` / `SecimKutulari` / `SecimCipleri`, koyu `OzetSerit`
(DESIGN.md bolum 9, "Ortak parcalar"). Ilk sayfa: `/teklif-topla` (durum karti, adimli bolumler,
segment / kutu / cip secimler, koyu gonder seridi; alanlar ve eylem ayni). Sirada: 15-A / 15-B
merkez sayfalari bu dille kurulur; ardindan gelen teklifler, teklif talepleri, rezervasyonlar.

## Onizleme turu (12 Kas, dal `duzeltme-15`; 1280 ve 375 px)

Hesaplar: Ilker Sezer (profesyonel + Lumen ekip koordinatoru), Kaan Erol (musteri), Lumen sahibi.
Rehber hesaplara girilmedi; "Ajanstan ayril" onaylanmadi.

- Menu (Ilker): Lumen grubunda "Takvim" / "Kazanclar" yok, "Genel bakis", "Ekip yonetimi", baslik
  `/kurulus/uyelik`e gidiyor. Lumen sahibinde "Takvim" ve "Kazanclar" duruyor (kisisel grup yok).
- Uyelik sayfasi: Ilker'de rol "Ekip koordinatoru", baslangic 28 Agustos 2026, acik / kapali
  yetkiler, baglanti aciklamasi, ayrilma; sahipte "sahip kurulustan ayrilamaz".
- Ekip yonetimi: sahipte "Yeni etkinlik"; sihirbazla acilan ekipsiz etkinlik "Yeni ekip kur"
  listesine dustu ("Ekip kur" -> Adaylar sekmesi); kurulan ekip altta.
- Teklif topla: durum karti (8 / 55 / 100), segment, secili kutu (ok tuslariyla da), cipler, koyu
  serit ve ozet; eksik zorunlu alanda hata gorunur alana geliyor; talep gonderildi (yalniz Ilker'e).
  375 px'te yatay tasma yok, serit tek satir ("Gonder").
- 15-D: 48 saatlik talepte son tarih notu, varsayilan "3 gun"; "24 saat" secilince uyari.
- Uretilen CSS'te yeni siniflar var (`has-[:focus-visible]:ring-2`, `sm:min-w-24` vb.).

Turda uc kucuk duzeltme: son tarihi GECMIS talepte not "son tarih gecti, talep acik duruyor" der
(eskiden gelecekmis gibi yaziyordu); gecerlilik alt notu secime gore dogru kalir ("secili geldi"
yerine yonerge); durum kartindaki sayi kutusu dar ekranda kucuk punto. Bu ucu onizlemede degil,
kod + tsc / eslint ile kontrol edildi; Sahne adresinde bakilacak.

Sahne'de kalan tur verisi: Kaan'in Drone Pilotu / Istanbul teklif topla talebi (alici yalniz
Ilker), Lumen'in "Istanbul'da 80 kisilik kurumsal urun tanitimi" etkinligi (ekipsiz).

## Durum (12 Kas)

Ilk tur (15-C, 15-D, teklif topla gorsel dil) uretimde: main = sahne = 8edb3a2, migration yok.
Uretimde girissiz: yeni derleme yayinda (yeni CSS siniflari var, `/kurulus/uyelik` girise
yonlendiriyor, olmayan sayfa 404). Sahne'de Ilker ile: gecmis son tarih notu ve gecerlilik alt notu
dogru. Durum karti puntosu (dar ekran) musteri hesabiyla sonraki turda bakilacak.
15-A (musteri "Etkinliklerim" merkezi) uretimde (12 Kas): main = sahne = 5b16d33, migration yok.
Uretimde girissiz: yeni derleme yayinda (yeni CSS siniflari var, `/etkinliklerim` girise
yonlendiriyor, ana sayfa ve konsol temiz). Sahne adresinde Kaan ile merkez onizlemedeki sayilarla
ayni (7 / 8 / 6 / 8), menu tek "Etkinliklerim". Ayrinti yukarida, 15-A basligi altinda.
Sirada: 15-B, 15-E, 14-B; kurum panelinde ayni merkez.

## Kararlar (Fahri) - secenekler ve oneri (*)

KARARLAR (12 Kas, Guven + Fahri): 1-A, 2-A, 3-A.
Ayni gun: 14-C = A (gorsel dil sayfa sayfa, yukarida), 14-B = B (30 buyuksehirde ilce listesi).

1. Ajansa bagli profesyonelin teklifi (satir 36)
   - (*) A: Profesyonel secer: profilde "Bana gelen talepler: kendim teklif veririm / ajansim
     uzerinden" ayari (varsayilan kendim). Ajans uzerinden secilirse talep ajansa da duser, teklifi
     ajans verir. Musteri iki ayri teklif almaz.
   - B: Ikisi de bagimsiz teklif verir (bugunku durum); musteri ajans teklifinde "ekipte X var" gorur.
   - C: Ilk gelen: biri teklif verince digeri o talebe veremez.
   - D: Fahri'nin taslagi: ikisi de verebilir ama ajans profesyonelin fiyatinin altina inemez.
     Onerilmez: ajansin profesyonelin fiyatini gormesi gerekir (gizlilik), fiyat tabani rekabet
     acisindan da tartismali.
2. "Gosterge" adi
   - (*) A: "Genel bakis"   - B: "Analiz" (Fahri)   - C: "Ozet"
3. Uygulama sirasi
   - (*) A: 15-D + 15-C (kucuk, 1 tur) -> 15-A + 15-B (merkez sayfalar, ortak yapi, 2 tur)
   - B: Once 15-A / 15-B, sonra kucukler

Bekleyen eski kararlar: Duzeltme 14-B (ilce verisi) ve 14-C (tasarim yonu), plan
`docs/sahne/duzeltme-12-14-plan.md`.
