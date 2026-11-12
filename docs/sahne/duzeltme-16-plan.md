# Duzeltme 16 - Is merkezi ajans ve kurum panelinde

Kaynak: Duzeltme 15-A / 15-B'nin acik maddesi ("kurum ve ajans panellerinde ayni merkez"), bulgu 134.
Karar kurali (Guven, 12 Kas): Fahri'nin onerisi varsa o, yoksa diger talepleriyle uyumlu olan.
Onceki tur: `docs/sahne/duzeltme-15-plan.md`.

## Ozet

Musteri "Etkinliklerim" (15-A) ve profesyonel "Islerim" (15-B) merkezleri yalniz kurulussuz
hesaplarda aciktir. Ajansin kendi hesabi ve kurum hesaplari eski, daginik sayfalarda kaldi.
Iki tur:

- 16-A Ajans: ajansin kendi hesabi "Islerim" merkezini kullanir (bu tur).
- 16-B Kurum: kurumun kendi hesabi "Etkinliklerim" merkezini kullanir; ajans teklifinden dogan
  rezervasyonlar merkeze girer.

## 16-A Ajans hesabinda "Islerim"

Bugun: pazaryerinden ajansa gelen dogrudan talepler, teklif topla talepleri, sohbetten verilen
teklifler ve bunlardan dogan rezervasyonlar ajansin hesabina yazilir ama ajans panelinde bunlarin
yeri yoktu: `/ajans` genel bakisi ve menusu yalniz etkinlik / RFP / teklif (proposal) akisini
gosterir. 15-E ile "Teklif talepleri" maddesi eklenmisti; verilen teklifler ve rezervasyonlar icin
yine yol yoktu. 15-E'den sonra ajansa daha cok talep dusuyor (uyesine gelen talepler).

YAPILDI (13 Kas, dal `duzeltme-16a`; migration yok).
- Kapi (`app/lib/satici-merkezi.ts`): `saticiMerkeziAcik` artik ajansin KENDI hesabinda da acik
  (rol `agency` + ajans kurulusunun sahibi). Ajans uyeleri (rol `professional`) zaten kendi
  merkezini gorur; ajansin sohbetleri onlara acik degildir. `ajansPanelindeMerkez()` sayfaya
  "ajans panelinden acildi" bilgisini verir.
- Menu (`app/lib/panel-menu.ts`): ajans grubunda, ajansin kendi hesabinda "Teklif talepleri" yerine
  "Islerim" (`/islerim`). "Teklif talepleri" sayfasi yasiyor (merkezin altindaki "Ayri listeler").
- Sayfa (`app/islerim/*`): ayni sayfa, ayni sekmeler (Yanit bekleyen / Teklif verdiklerim /
  Anlasilan / Tamamlanan / Sonuclanmayan). Ajans hesabinda ustte not: buradakiler pazaryeri
  isleri; kurumsal RFP teklifleri "Teklifler" sayfasinda (baglantili).
- Kartta tercih edilen ekip uyesi: sohbetin guncel talebinde brief'te "tercih edilen ekip uyesi"
  varsa (profilden "ajans uzerinden teklif al" ya da 15-E yonlendirmesi) kart ayrintisinda
  "Tercih: <ad>" yazar. 15-E'nin acik maddesiydi ("uyeniz X icin geldi" rozeti).
- Geri baglantilari: rezervasyon sayfasi sohbet sekli rezervasyonda ajans hesabini da "Islerim"e
  dondurur (ayni kapi). Teklif sekli (RFP) rezervasyonlar merkezde gorunmez, eski yolunda kalir.
- Yerel deneme: satici merkezi sahte veri testi onceki ciktiyla birebir ayni (regresyon yok);
  tercih uyesi olan sohbette yalniz o kartin ayrintisi degisiyor ("Tercih: Ilker S."), metin
  olmayan deger yok sayiliyor. tsc + eslint temiz.
- Bu turda degismeyenler: `/ajans` genel bakis kutulari (merkeze baglanti yok; menuden gidilir),
  kurumsal RFP / teklif akisi, ajans uyelerinin menusu.

### Onizleme turu 16-A (13 Kas, dal `duzeltme-16a`; Lumen sahibi + Ilker; 1280 ve 375 px)

- Lumen sahibi: ajans grubunda "Islerim" var, "Teklif talepleri" yok. `/islerim` aciliyor (eskiden
  `/profil` -> `/ajans`a donuyordu); ustte ajans notu ve "Teklifler" baglantisi. Sekmeler: Yanit
  bekleyen 3, Teklif verdiklerim 0, Anlasilan 0, Tamamlanan 0 (Lumen'in sohbet sekli teklifi /
  rezervasyonu yok; gecmis isleri RFP / teklif akisinda).
- Yanit bekleyen: Kaan'in teklif topla talebi ("Drone Pilotu, Lansman, Istanbul", "Yeni talep"),
  Kaan'in dogrudan talebi ("Lansman, 10 Nisan 2027, Istanbul, Tercih: Ilker S.", "Teklif bekliyor")
  ve Beren Kara'nin dogrudan talebi (rehber hesabi; yalniz goruntulendi).
- `/ajans` genel bakis ve `/teklif-talepleri` aciliyor; 375 px'te not ve kartlar sigiyor, tasma
  yok; konsol temiz.
- Ilker ile gerileme: `/islerim` 3 / 1 / 1 / 3 / 6 (ayni), ajans notu ve "Tercih" yazisi yok;
  menusu ayni (kisisel grupta "Islerim", Lumen grubunda uye olarak yok).
- DENENEMEDI: ajans hesabinda rezervasyon sayfasinin "Islerim" geri baglantisi (Lumen'in sohbet
  sekli rezervasyonu yok). Kapi profesyonelle ortak; profesyonelde 15-B turunda dogrulanmisti.

## 16-B Kurum hesabinda "Etkinliklerim" (bulgu 135)

Bugun kurum hesabinda `/etkinliklerim` eski etkinlik listesiydi; talepler, gelen teklifler ve
rezervasyonlar ayri sayfalarda ("Gelen teklifler", "Rezervasyonlar"). Ayrica ajans teklifinden
(RFP) dogan rezervasyonlar musteri merkezinde HIC gorunmuyordu - bireysel musteride de (15-A'da
menuden "Rezervasyonlar" kalkinca yalniz "Ayri listeler"den ulasiliyordu).

Inceleme (13 Kas, kod + yerel veritabani):
- Kurumsal menu: Genel bakis, Etkinlikler, Yeni etkinlik, Teklif talepleri (`/kurumsal/rfp` -
  ajanslara acilan RFP'ler), Kisa liste, Rezervasyonlar, Gelen teklifler, Ilanlarim, Ekip,
  Gorevler, Odemeler, Ayarlar.
- Merkez sorgusu kurulus etkinliklerini (`organization_id`) ve adina islem yapilan kurumlarin
  sohbet / talep / rezervasyonlarini (`teamBusinessIds`) zaten okuyor; kurum uyeleri kendi
  rolleriyle kisisel merkezde bunlari goruyor. Eksik olan kapi ve teklif sekli rezervasyonlardi.
- Teklif sekli rezervasyon: `booking_from_proposal` yazar; `quote_id` ve `professional_id` bos,
  karsi taraf `seller_provider_id` / teklifin satici kurulusu, alici `buyer_organization_id` +
  `customer_id` (teklifin alici kullanicisi), `event_id` teklifin etkinligi, durum `confirmed`.

YAPILDI (13 Kas, dal `duzeltme-16b`; migration yok).
- Kapi (`app/lib/musteri-merkezi.ts`): `musteriMerkeziAcik` kurumun KENDI hesabinda da acik (rol
  `business` + kurum kurulusunun sahibi). `kurumPanelindeMerkez()` sayfaya kurulusu verir.
- Veri (`app/etkinliklerim/musteri-isleri.ts`): teklif sekli rezervasyonlar ayri sorguyla okunur
  (alici kisi ya da etkinliklerini gorebildigi alici kurulus; satici kurulus adi ve teklif basligi
  gomulu). Sohbet birimine baglanmaz: etkinligi varsa etkinlik kartina girer ("N rezervasyon",
  kart "Yaklasan"a gecer; ajansin adi + tutari + durumu ayri satir), yoksa kendi kartiyla gorunur
  (baslik ajans adi, ayrintida teklif basligi). Bu parca butun merkez kullanicilarinda gecerli
  (bireysel musteri ve kurum uyeleri dahil).
- Menu (`app/lib/panel-menu.ts`): kurumun kendi hesabinda "Rezervasyonlar" ve "Gelen teklifler"
  yazilmaz (merkezin sekmeleri); "Etkinlikler" merkezi acar. Uyelerin kurum grubunda iki madde
  durur.
- Sayfa (`app/etkinliklerim/*`): kurum hesabinda ustte not (ajans teklif talepleri ayri sayfada,
  "Teklif talepleri" baglantisi); "Yeni etkinlik" kurulusa bagli acilir (`?kurulus=`).
- Geri baglantilari: rezervasyon sayfasi teklif sekli rezervasyonda da alici tarafini (alici kisi
  ya da alici kurulus uyesi) merkeze dondurur; `/kurumsal` genel bakisindaki "Onayli rezervasyon"
  kutusu merkezin "Yaklasan" sekmesine gider. Teklif karsilastirma ve teklif topla donus yollari
  ayni kapiyi kullandigi icin kurum hesabinda da merkeze doner.
- Yerel deneme (sahte veri): teklif sekli rezervasyon yokken kartlar ve ozet onceki ciktiyla
  birebir ayni; dort ornekle - etkinlige bagli onayli (kart "Teklif istenmedi"den "1 rezervasyon"a,
  ajans satiri), etkinliksiz onayli (kendi karti, baslik 60 karakterde kisaliyor), tamamlanmis
  etkinlikte tamamlanan (satir "Tamamlandi"), iptal (Sonuclanmayan; satici adi yoksa "Ajans").
  tsc + eslint temiz.
- Degismeyenler / sonraki adim: RFP'ler merkezde kart degil (not + baglanti); bekleyen ajans
  teklifinin etkinlik kartinda "N ajans teklifi geldi" olarak gorunmesi; ajans hesabinin ALICI
  oldugu isler (ajansin `/etkinliklerim`i eski liste); kurum uyelerinin kurum grubundaki iki madde.

Onizleme turu plani: Anadolu Ilac sahibi (`sahne+kurum-anadolu-ilac@kashe.net`) - menude
"Rezervasyonlar" / "Gelen teklifler" yok; `/etkinliklerim` merkez (not, sekmeler, kurulus
etkinlikleri, varsa ajans teklifi rezervasyonu satiri); `/kurumsal` kutusu merkeze gidiyor;
rezervasyon geri baglantisi; 1280 / 375 px. Deniz Erol (uye): kisisel merkez ve kurum grubu
menusu ayni. Kaan (bireysel): sayilar ayni (teklif sekli rezervasyonu yoksa).

## Durum (13 Kas)

16-A uretimde (13 Kas): main = sahne = 7b432ae, migration yok. Uretimde girissiz, salt okuma:
ana sayfa aciliyor, `/islerim` ve `/ajans` girise yonlendiriyor, konsol temiz; yayin kimligi 15-F
dogrulamasindakinden farkli (yeni yayin). Ajans hesabi uretimde DENENMEDI (giris gerekir). Sahne
adresinde Lumen sahibi ile: menude "Islerim", `/islerim` aciliyor (ajans notu, yanit bekleyen 3,
"Tercih: Ilker S.").
16-B dalda: `duzeltme-16b`, migration yok; onizleme turu bekliyor. Sonra: RFP tekliflerinin
etkinlik kartinda gorunmesi, ajansin alici oldugu isler.
