# Duzeltme 17 - Toplu tur: merkez ve teklif akisinin tamamlayicilari

Kaynak: Duzeltme 16-B ve 16-C'nin acik maddeleri + kod incelemesi (bulgu 137 - 140).
Karar kurali (Guven, 12 Kas): Fahri'nin onerisi varsa o, yoksa diger talepleriyle uyumlu olan.
Onceki tur: `docs/sahne/duzeltme-16-plan.md`.

## Calisma duzeni (Guven, 13 Kas)

"Biraz daha fazla is yapip sonrasinda push ve kontrol / test yapalim." Bu turdan itibaren:

- Bir dalda BIRKAC madde toplanir; tek onizleme turu, tek uretim itisi yapilir.
- Her madde yine kendi basligiyla, kendi yerel denemesiyle yazilir (hangi degisiklik hangi
  bulgu icin, geri almak gerekirse hangi dosya).
- AYRI dalda kalanlar: goc (migration) iceren isler (once veritabani, sonra kod kurali) ve
  bekletilmeyecek yuksek onemli duzeltmeler.

Bu tur: dort madde, hepsi kod; goc YOK. Dal: `duzeltme-17`.

## 17-A Etkinlik kartinda ajans teklif talebi (RFP) - bulgu 137

Bugun: kurum (ve kurum adina calisan uye) bir etkinlik icin ajanslardan teklif istediginde (RFP)
bu, merkezde hic gorunmuyordu. Etkinlik karti "Taslak / Hazirlaniyor" ya da yalniz pazaryeri
tekliflerini sayiyordu; ajanslardan yanit geldigini gormek icin `/kurumsal/rfp` listesine gitmek
gerekiyordu. 16-B'de RFP'ler bilerek disarida birakilmis, ustteki notla yonlendirilmisti.

YAPILDI (13 Kas; `app/etkinliklerim/musteri-isleri.ts`).
- Yedinci sorgu: kullanicinin etkinlik gorebildigi kuruluslarin RFP'leri (`rfps`) ve davetleri
  (`rfp_invites`; yanit = `responded`). RLS neyi gosteriyorsa o.
- ACIK RFP (durum `sent` / `collecting` / `evaluating`) etkinlik kartinda bir satir olur:
  "Ajanslar | <yanit> / <davet> yanit | Gonderildi / Yanit toplaniyor / Degerlendirmede".
  Satir karsilastirma sayfasina (`/kurumsal/rfp/<id>`) gider. (Etiket ilk yazimda "Ajans teklif
  talebi" idi; 375 px'de "Ajans t..." diye kesildigi icin onizleme turunda kisaltildi.)
- Kurum hesabindaki ust not guncellendi: "Ajanslara actigin teklif talepleri etkinligin kartinda
  gorunur; ajans tekliflerini karsilastirmak ve yeni talep acmak icin: Teklif talepleri".
- Sayim: yanit gelmis acik RFP'nin yanitlari kartin "n teklif geldi" sayisina eklenir (kart
  "Teklif bekleyen" sekmesine girer, ozetteki "karar bekleyen teklif" sayisi artar). Yanit
  gelmemis acik RFP "Teklif bekleniyor" sayilir. Tarihi gecmis etkinlikte asama degismez (satir
  yine gorunur).
- Taslak, sonuclanmis (`awarded`) ve iptal RFP satir uretmez: sonuclanan RFP'nin rezervasyonu
  16-B'den beri kartta ajans satiri olarak gorunuyor.
- Uydurma sayac yok: sayilar `rfp_invites` satirlarindan.

Yerel deneme: sahte veri testi (`test-17a`): RFP'siz veride cikti onceki ile birebir ayni;
RFP'li veride beklenen farklar (yanitli RFP: "1 teklif geldi" -> "3 teklif geldi" + satir
"2 / 3 yanit"; yanitsiz RFP: taslak etkinlik "Teklif bekleniyor" + "0 / 2 yanit"; gecmis
etkinlik asamasi degismedi; taslak / sonuclanmis RFP satir uretmedi).

Dokunulmayan: RFP listesi ve karsilastirma sayfasi (`/kurumsal/rfp`); ajans tarafi.

## 17-B Karsilastirma sayfasinda "En uygun" yalniz karar bekleyen teklifte - bulgu 138

Bugun (16-C sonrasi): `/teklif-taleplerim/[id]` teklifleri yalniz tutara gore siraliyor ve en
dusuk tutarli teklife "En uygun" rozeti + yesil cerceve veriyordu; teklif REDDEDILMIS, suresi
dolmus ya da rezervasyonu iptal edilmis olsa bile. Baslik da her durumda "En uygun teklifi sec"
diyordu (Kaan'in kapanmis taleplerinde tek teklif "Reddedildi" + "En uygun" gorunuyordu).

YAPILDI (13 Kas; `app/lib/talep-teklifleri.ts`, `app/teklif-taleplerim/[id]/page.tsx`).
- `teklifKarari` (saf): `onayli` (onaylandi, rezervasyonu iptal degil) / `acik` (bekliyor, suresi
  dolmamis) / `kapali` (reddedildi, geri cekildi, suresi doldu, onaylanip iptal edildi).
- "En uygun" rozeti ve yesil cerceve yalniz ACIK tekliflerin en dusuk tutarlisinda; onayli bir
  teklif varsa hic gosterilmez (secim yapilmis).
- Sira: onayli teklif en ustte, sonra karar bekleyenler, sonra kapananlar; her grupta dusuk
  tutar once.
- Baslik cumlesi duruma gore: "En uygun teklifi sec, mesajlasmaya devam et." / "Onayladigin
  teklif en ustte." / "Karar bekleyen teklif kalmadi."
- Gorsel dil: baslik calisma yuzeyi vurgusunu aldi ("Gelen" pembe; liste sayfasiyla ayni).

Yerel deneme: `test-17b` 13 / 13 (karar durumlari; reddedilen en dusuk teklif "En uygun"
olmaz; hepsi kapaliysa rozet yok; onayli varsa en ustte ve rozet yok; onaylanip iptal edilen
kapali sayilir; esit tutarda iki teklif de rozet alir). 16-C testi 13 / 13 (regresyon yok).

## 17-C Kurum uyesinin menusu merkezle ayni - bulgu 139

Bugun: 16-B'de "Rezervasyonlar" ve "Gelen teklifler" kurumun KENDI hesabinda menuden kalkmis,
uyelerde birakilmisti. Musteri rolundeki uye kisisel grubunda "Etkinliklerim" merkezini zaten
kullaniyor (iki sayfa merkezin sekmeleri); kurum grubundaki iki madde ayni icerige ikinci yoldu.

YAPILDI (13 Kas; `app/lib/panel-menu.ts`).
- Kurum grubunda iki madde, kullanicida musteri is merkezi ACIKSA yazilmaz. Olcut
  `musteriMerkeziAcik` ile ayni: musteri rolu, ya da bir kurumun sahibi olan isletme rolu.
- Merkezi OLMAYAN uyede (profesyonel / ajans rolu) iki madde durur.
- Sayfalar yasiyor (merkezin altindaki "Ayri listeler").

Yerel deneme: `test-17c` 15 / 15 (kurum hesabi, musteri uye, profesyonel uye, ajans rolunde
uye, yalniz uye olan isletme rolu, sahip + baska kurumda uye, ajans grubu degismedi).

## 17-D Teklif topla yaniti onceki isin bilgisini devralmasin - bulgu 140

Bugun: profesyonel bir teklif topla talebine, ayni musteriyle MEVCUT sohbetinden yanit
verdiginde sohbetin yalniz tarih / tur / butce / brief alanlari yazilir; yer, kisi sayisi, saat
ve (talepte etkinlik yoksa) etkinlik bagi ONCEKI isten kalirdi. Sonuc:
- "Yeni talep #n - Teklif topla" karti onceki isin yeriyle yazilir.
- Musteri bu teklifi onaylayinca rezervasyon onceki isin kisi sayisini, teklifte yer / saat
  olmadigi icin onceki isin yerini ve saatini alir (yanlis yer ve saatle rezervasyon).
- Etkinlik bagi kaldigi icin yeni is musteri merkezinde eski etkinligin kartina girer.
15-F ayni sorunu musterinin dogrudan gonderiminde cozmustu; teklif topla yaniti ayri yoldu.

YAPILDI (13 Kas; `app/teklif-topla/actions.ts`, `respondToQuoteRequest`).
- Onceki talep teklif aldiysa (`fn_duz12_talep_yanitlandi`) yanit YENI IStir: yer, kisi sayisi,
  baslangic / bitis saati temizlenir, talep turu `quote` olur, etkinlik bagi talebinkiyle
  degisir (yoksa temizlenir).
- Onceki talep teklif almamissa eski kural aynen kalir (ayni talebin yaniti).
- Onceki isin teklifi ve rezervasyonu kendi satirinda durur; etkilenmez.
- Goc yok: on alanin hepsi tarafa yazilabilir (Guvenlik 01 sutun yetkisi).

Yerel deneme: `docs/envanter/asama35b-duzeltme17d-davranis.sql` (eylemin yazdigi satirlari
profesyonelin kimligiyle tekrarlar; BEGIN ... ROLLBACK) yerel veritabaninda 13 / 13. Ayni dosya
ESKI yazimla calistirildiginda uc test kaliyor (kartta "Eski Mekan", rezervasyonda onceki isin
yeri / 120 kisi / 18:00 - 23:00): hata dogrulandi. Yerel veride musterinin etkinligi olmadigi
icin etkinlik baginin temizlenmesi yalniz "bos kaldi" olarak goruldu.
Dalda calistirmak istege bagli (Sahne SQL Editor; URETIMDE CALISTIRILMAZ).

## Onizleme turu 17 (13 Kas, dal `duzeltme-17`, commit 6019901; 1280 ve 375 px)

17-A (gercek veriyle; Anadolu Ilac sahibi + uyesi Deniz Erol + Lumen):
- Anadolu Ilac'in ve Baskent Egitim'in RFP'si yoktu; Anadolu'nun uc etkinligi de gecmis tarihli.
  Tur icin Anadolu adina "Tur 17-A Lansman" (13 Aralik 2026, Istanbul) etkinligi kuruldu.
  Kart: "Teklif istenmedi" (Teklif bekleyen 5 -> 6).
- TASLAK RFP acildi: kart degismedi, satir yok (dogru).
- RFP Lumen'e gonderildi: kart "Teklif bekleniyor" + satir "0 / 1 yanit - Gonderildi"; satir
  `/kurumsal/rfp/<id>` sayfasina gidiyor.
- Lumen teklif hazirlayip gonderdi (72.000 TL): kart "1 teklif geldi" (vurgu) + satir
  "1 / 1 yanit - Yanit toplaniyor"; ozet "1 teklif kararini bekliyor". Uye (Deniz Erol) ayni
  karti goruyor; satirdan acilan sayfada Lumen'in teklifi var.
- 375 px: yatay tasma yok; etiket "Ajans t..." diye kesiliyordu -> "Ajanslar" yapildi (ikinci
  build). Onizleme sayfasinda olculdu: "Ajanslar" 51 px, yer 53 px - "Gonderildi", "Yanit
  toplaniyor" ve "Degerlendirmede" durumlarinda kesilmiyor; 10 ve uzeri davetli ajansta
  ("10 / 12 yanit") kesilebilir.
- Gorulmeyen: birden cok ajans / birden cok RFP, "Degerlendirmede" durumu, gecmis tarihli
  etkinlikte RFP (yalniz sahte veri testinde).

17-B (Kaan):
- Iptal edilmis (13.000) ve reddedilmis (9.000) teklifli taleplerde rozet ve yesil cerceve yok;
  baslik "Karar bekleyen teklif kalmadi."
- Onayli teklifli talepte (8.500) "Onayladigin teklif en ustte."; rozet yok.
- Teklifsiz talepte baslik yalniz "1 profesyonele gonderildi, 0 teklif geldi."
- Bekleyen teklifli talepte (17-D turunda dogan 7.700) "En uygun" rozeti + yesil cerceve +
  "2 gun kaldi"; baslik "En uygun teklifi sec, mesajlasmaya devam et."
- Baslikta "Gelen" pembe (rgb(250, 11, 150)), italik degil.
- Gorulmeyen: ayni talepte birden cok teklif (siralama yalniz yerel testte).

17-C (Deniz Erol, musteri rolunde Anadolu uyesi):
- Kurum grubu: Genel bakis, Etkinlikler, Yeni etkinlik, Teklif talepleri, Kisa liste, Ilanlarim.
  "Rezervasyonlar" ve "Gelen teklifler" yok. Kisisel grupta "Etkinliklerim" duruyor.
- `/kurumsal` "Onayli rezervasyon" kutusu merkezin "Yaklasan" sekmesine gidiyor.
- Gorulmeyen: profesyonel / ajans rolunde kurum uyesi (iki madde durmali; yalniz yerel testte).

17-D (Ilker + Kaan):
- Hazirlik: Kaan - Ilker sohbetinde guncel talep #5 (Mezuniyet, 15 Aralik, Istanbul, 30 kisi)
  teklif almamisti; Ilker #5'e 5.500 TL teklif verdi (talep yanitlandi).
- Ilker, Kaan'in yanitlanmamis teklif topla talebine (Lansman, tarihsiz) "Teklif ver" ile
  7.700 TL yanit verdi. Sohbet basligi: "Tur: Lansman - Butce: Acik"; onceki isin "Lokasyon:
  Istanbul" ve "Kisi: 30" satirlari KALKTI. Kart: "Yeni talep #6 - Teklif topla - Lansman -
  Tarih belli degil" (yer yok). Teklif "Talep #6", yer / saat satiri yok.
- Ilker `/islerim`: Yanit bekleyen 3 -> 1, Teklif verdiklerim 1 -> 3.
- Kaan merkezi: teklif topla isi kendi kartinda ("1 teklif geldi - Ilker Sezer 7.700"), eski
  bir etkinligin kartina girmedi; ozet "3 teklif kararini bekliyor".
- Denenmedi: teklifin onaylanmasi (rezervasyonun alanlari yalniz yerel `asama35b` ile).

Konsol hatasi yok.

Sahne'de kalan tur verisi: Anadolu Ilac etkinligi "Tur 17-A Lansman" + RFP "Tur 17-A ajans
teklif talebi" (Yanit toplaniyor; Lumen davetli ve yanitladi) + Lumen'in 72.000 TL teklifi;
Kaan - Ilker sohbetinde talep #5 icin 5.500 TL ve talep #6 (teklif topla) icin 7.700 TL bekleyen
teklif.

## Durum (13 Kas)

- 17-A, 17-B, 17-C, 17-D: onizlemede dogrulandi (commit 6019901).
- Turdan cikan duzeltme (ikinci build): 17-A satir etiketi "Ajanslar" + kurum ust notu.

## Acik kalanlar

- Teklif topla formunda ilce (14-B'nin acik maddesi; formda yer alani yok).
- Ajansin ALICI oldugu islerde merkez (ajans etkinlikleri eski listede).
- Gorsel dil: sayfa sayfa (14-C karari A).
- Profesyonelin sohbet teklif formunda yer alani.
