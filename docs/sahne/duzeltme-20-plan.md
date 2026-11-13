# Duzeltme 20 - toplu tur (Fahri tablosu gozden gecirmesinden cikanlar)

Hazirlayan: Guven + Claude, 13 Kasim 2026. Kaynak: `docs/sahne/bulgular.md` 145 (gozden gecirme) ve 144'un acik
maddesi. Goc (migration) YOK; uc madde de uygulama katmaninda.

Durum: ONIZLEME TURU TAMAM (13 Kas; dal `duzeltme-20`, derleme `dpl_2iSVXzJ6DDHVoicp6WaKpQpZTBfk`); turda bulunan metin
duzeltmesi ikinci commit ile girer, sonra uretim.

## 20-A Adaylar ekraninda "kendi ekibimle devam et" (Fahri satir 32; bulgu 145-a)

Fahri: "begenmedim, isi ben kendim yapacagim deyip tek ajans ben devam edeyim." Yol vardi (Ekip sekmesinde
"Ekip kur" bos ekip acar, "Havuzdan ekle" ile ekip havuzdan kurulur, "Teklif olustur" teklife gecer) ama Adaylar
ekraninda yazmiyordu.

YAPILDI: eslesme sonucu basliginin altinda, yalniz havuzu olan ajans kurulusunun etkinliginde (`havuzYolu` kosulu;
Duzeltme 13-C'deki "Havuzdan ekle" baglantisiyla ayni) bir satir:
"Adaylar uymadiysa isi kendi ekibinle de yapabilirsin: Ekip sekmesinde ekibini havuzundan kurarsin, buradan aday
secmen gerekmez. Kendi ekibimle devam et ->" (Ekip sekmesine gider). Kisisel etkinlikte ve kurum etkinliginde satir
cikmaz (havuz yok). Dosya: `app/etkinliklerim/[id]/aday-paneli.tsx`.

Bilinen sinir: satir yalniz eslestirme kosulduktan sonra gorunur ("Henuz eslestirme yapilmadi" durumunda Ekip sekmesi
zaten yanindaki sekmedir).

## 20-B Kesfet arama kutusu metni (bulgu 145-b)

Kutu "Isim ile ara..." yaziyordu; arama Duzeltme 05 / 10'dan beri kategoriye, tanitim yazisina ve etkinlik turune de
bakiyor. YAPILDI: "Isim, rol ya da etkinlik ara" + ekran okuyucu etiketi. Dosya: `app/kesfet/kesfet-filters.tsx`.

## 20-C Ajans merkezinde bagimsiz teklif dosyalari (bulgu 144'un acik maddesi; yeni bulgu 146)

Duzeltme 19-A'da ajansin musterilerine giden teklifler yalniz AJANSIN KENDI etkinliginin kartinda satirdi. Kurumun
acik talebine (RFP) verilen yanit kurumun etkinligine bagli oldugu icin, etkinliksiz hazirlanan teklif de etkinlik
kimligi olmadigi icin merkezde hic gorunmuyordu; ajans bunlari yalniz "Teklifler" sayfasinda goruyordu.

YAPILDI (`app/etkinliklerim/musteri-isleri.ts`, `app/lib/isler.ts`):
- Ajansin kendi etkinligine bagli OLMAYAN her teklif dosyasi merkezde kendi kartidir. Etiket: talebe yanitsa
  "RFP yaniti", degilse "Teklif dosyasi". Baslik teklifin basligi, alt satir musteri adi, sagda tutar, "Teklifi ac ->".
- Asama: revizyon istendi -> Devam eden (vurgu, en ustte); gonderildi / goruntulendi -> Devam eden "Musteri yaniti
  bekleniyor"; taslak -> Devam eden "Taslak"; reddedildi / suresi doldu -> Sonuclanmayan.
- Onaylanan teklifin asamasi REZERVASYONUNDAN okunur (teklifin kendi tarihi yok): rezervasyon tamamlandiysa
  Tamamlanan, iptal edildiyse Sonuclanmayan, tarihi gectiyse Tamamlanan "Tarihi gecti", aksi halde Yaklasan "Musteri
  onayladi" (tarih alt satirda, "Rezervasyon" ikinci baglanti). Rezervasyon henuz acilmadiysa Yaklasan'da kalir.
  Bunun icin yalniz onayli bagimsiz teklif varsa calisan tek ek sorgu var (`bookings`, `proposal_version_id`).
- Ikinci baglanti: rezervasyon varsa "Rezervasyon", yoksa RFP yanitinda "Talep" (`/ajans/rfp/<id>`).
- Ozet satirlari (revizyon / musteri yaniti / hazirlanan) bu kartlari da sayar; musterinin "acik is" sayimina girmez
  (19-A kurali).
- Iki not metni guncellendi: ajans merkezinde "bir etkinligine bagli olmayan teklif dosyalarin ayri kart", ajansin
  "Islerim"inde "teklif dosyalarin etkinliklerinle birlikte: Etkinlikler".

Kapsam disi: ajans UYESI eski etkinlik listesini goruyor (19-A'dan beri; merkez yalniz ajansin kendi hesabinda).

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen alti dosya) temiz.
- Yerel sahte veri testi `test-20c` 18 / 18: RFP yaniti (yanit bekliyor, revizyon), taslak, onayli (rezervasyonsuz,
  gelecek tarihli, tarihi gecmis, tamamlanmis, iptal), reddedilen, suresi dolan; kendi etkinligindeki teklif ayri kart
  uretmiyor; ozet sayilari; rezervasyon sorgusu yalniz onayli surumlerle.
- Eski merkez testleri (16-B, 17-A, 18-C musteri) calisti; ajans olmayan hesapta yeni kart cikmadi. `test-19a`
  ciktisinda beklenen fark: etkinliksiz / baska etkinlige bagli uc teklif artik kart.
- Onizleme turu (13 Kas, 1024 ve 375 px):
  - 20-C: Lumen sahibinin merkezinde "RFP yaniti" karti cikti ("Tur 17-A ajans teklif talebi", Anadolu Ilac, 72.000 TL,
    "Musteri yaniti bekleniyor", "Teklifi ac" + "Talep"); "Devam eden" 1 -> 2; 375 px'te tasma yok. Onayli / rezervasyonlu
    bagimsiz teklif gercek veriyle GORULMEDI (yalniz `test-20c`).
  - 20-A: Lumen etkinliginin Adaylar sekmesinde satir ve "Kendi ekibimle devam et" baglantisi; tiklayinca Ekip sekmesi
    acildi. Gozlem: onizlemede sekme gecisi 4 - 9 saniye surdu ve bu sirada yukleniyor isareti yok (bu turun
    degisikligi degil; ustteki sekme baglantilari da ayni sayfayi yeniden ceker).
  - 20-B: girissiz Kesfet'te kutu "Isim, rol ya da etkinlik ara" (metin 159 px, kutu 241 px; sigiyor).
  - Gerileme: Kaan'in merkezi 11 / 8 / 6 / 8 (Sahne adresiyle ayni), yeni kart turu yok; Lumen "Islerim" 3 / 0 / 0.
  - Turda bulunan: ajans ozet satiri bagimsiz teklif icin "1 etkinlikte musteri yaniti bekleniyor" diyordu ->
    "1 iste ..."; "n etkinlik hazirlik asamasinda" -> "n is ..."; baslik "Hazirlanan islerin var"; bos durum metni
    teklif dosyalarini da anar (`app/etkinliklerim/musteri-merkezi.tsx`).

## Bu dala giren dokumanlar

Fahri tablosu gozden gecirmesi (bulgu 145), test rehberi surum 3.0 (`docs/sahne/test-rehberi/`; `shots/03-iletisim-acik.jpg`
artik kullanilmiyor, `git rm`), Duzeltme 19 kapanis notlari. Uretime alindiktan sonra rehberde "Bilinen eksikler"
10 ve 11. maddeler kalkar (rehber 3.1).

## Sirada

Rezervasyon sayfasina yeni gorsel dil (14-C karari A), kalan iki formda (`rezervasyon-button`, `brief-alanlari`)
ortak `KonumAlani` (kullaniciya gorunmeyen sadelestirme).
