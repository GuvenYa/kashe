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

- Tekrarlar: uyede ajans grubunda "Takvim" ve "Kazanclar" gizlenir (kisisel olanlar zaten var);
  kurulus sahibinde degisiklik yok.
- "Gosterge" -> **"Genel bakis"** (Fahri "Analiz" onerdi; sayfa analizden cok ozet: ilk satirda
  ne oldugu yazar). KARAR 2.
- "Ekipler" -> **"Ekip yonetimi"**: sayfadan dogrudan "Yeni ekip" (etkinlik secerek), bugunku
  "etkinliklere git" yonlendirmesi yerine.
- Grup basligi (kurulus adi) tiklanir: kurulusun profili + **"Bu ajanstaki uyeligin"** (rol,
  katilma tarihi, neleri gorebildigin, ajanstan cikma).

## 15-D Teklif gecerliligi: 48 saat (satir 34)

Musteri teklif topla'da "Teklif donus suresi" 24 saat / 48 saat / 3 gun / 1 hafta seciyor;
profesyonelin teklif formunda gecerlilik 24 saat / 3 gun / 7 / 14 / 30 gun, 48 saat yok.
Yapilacak: 48 saat secenegi; teklif topla talebinden acilan formda gecerlilik musterinin
suresiyle dolu gelir ve ustte "Musteri 48 saat icinde donus bekliyor" yazar.

## Kararlar (Fahri) - secenekler ve oneri (*)

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
