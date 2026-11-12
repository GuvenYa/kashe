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

## 15-B Profesyonel: "Islerim" merkezi (satir 34)

Bugun: `/teklif-talepleri`, `/tekliflerim` (Verdigim teklifler), `/rezervasyonlarim`, sohbetler.
Fahri'nin onerisi: tek "Islerim"; sekmeler **Yanit bekleyen** (gelen talepler, yanitlanmamis sohbet
talepleri) / **Teklif verdiklerim** / **Anlasilan** (yaklasan rezervasyonlar) / **Tamamlanan**.
15-A ile ayni kart ve detay yapisi (iki taraf ayni dili konusur).

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

## Kararlar (Fahri) - secenekler ve oneri (*)

KARARLAR (12 Kas, Guven + Fahri): 1-A, 2-A, 3-A.

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
