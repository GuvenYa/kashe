# Duzeltme 16 - Is merkezi ajans ve kurum panelinde

Kaynak: Duzeltme 15-A / 15-B'nin acik maddesi ("kurum ve ajans panellerinde ayni merkez"), bulgu 134.
Karar kurali (Guven, 12 Kas): Fahri'nin onerisi varsa o, yoksa diger talepleriyle uyumlu olan.
Onceki tur: `docs/sahne/duzeltme-15-plan.md`.

## Ozet

Musteri "Etkinliklerim" (15-A) ve profesyonel "Islerim" (15-B) merkezleri yalniz kurulussuz
hesaplarda aciktir. Ajansin kendi hesabi ve kurum hesaplari eski, daginik sayfalarda kaldi.
Iki tur:

- 16-A Ajans: ajansin kendi hesabi "Islerim" merkezini kullanir (bu tur).
- 16-B Kurum: kurum hesabi "Etkinliklerim" merkezini kullanir (sonraki tur; once inceleme).

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

Onizleme turu plani (Lumen sahibi, 1280 / 375 px): menude "Islerim"; `/islerim` aciliyor, ustte
ajans notu; "Yanit bekleyen"de Kaan'in dogrudan talebi ("Tercih: Ilker S.") ve Lumen'e dusen
teklif topla talebi; diger sekmelerde Lumen'in gecmis isleri; rezervasyon sayfasindan geri
baglantisi "Islerim". Ilker ile gerileme: `/islerim` sayilari ayni, ajans notu yok.

## 16-B Kurum hesabinda "Etkinliklerim" (PLAN - once inceleme)

Bugun kurum hesabinda `/etkinliklerim` eski etkinlik listesidir; talepler, gelen teklifler ve
rezervasyonlar ayri sayfalarda. Merkeze gecis icin bakilacaklar:

- Kimlik: kurum adina acilan sohbet / talep / rezervasyonlarda musteri kimligi kurumun kendisidir
  (`on_behalf_business_id`); merkez sorgulari "kullanici + adina islem yapabildigi kurumlar"
  kumesiyle calismali (bugun yalniz `userId`).
- Yetki: kurum uyelerinin gorebildigi kayitlar (RLS: `has_business_role`) ile kartlarin tutarli
  olmasi; salt izleyici uyede eylem dugmeleri.
- RFP akisi: kurumun ajanslara actigi RFP'ler ve gelen teklifler (proposal) ayri tablolarda;
  merkezde ayri kart turu mu, yoksa "RFP'ler" sayfasina baglanti mi - karar.
- Menu: kurumsal grupta "Etkinlikler" + ayri "Gelen teklifler" / "Rezervasyonlar" maddeleri var
  mi, hangileri merkeze sekme olur.

## Durum (13 Kas)

16-A dalda: `duzeltme-16a`, migration yok; onizleme turu bekliyor.
16-B: inceleme ve plan sonraki turda.
