# Duzeltme 23 - gorsel dil turu (sohbet sayfasi, profil paneli) + test rehberi 3.2

Hazirlayan: Guven + Claude, 13 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24) ve rehberdeki
"bilinen eksikler" 9. madde (rezervasyon, sohbet ve profil paneli sirada; rezervasyon 21-B ile yapildi).
Goc (migration) YOK.

Durum: ONIZLEME TURU TAMAM (14 Kas; dal `duzeltme-23` d1685e6, derleme `dpl_8TtrrPtt265M7WgnWez3PJPjR4gt`). Turda cikan
uc kucuk is ve test rehberi 3.2 ikinci commit ile girer, sonra uretim.

## 23-A Sohbet sayfasinda "Isin durumu" (bulgu 151)

YAPILDI. Sohbetin GUNCEL isi (son talebin son parcasi) dort adimda okunur: talep, teklif, rezervasyon, tamamlanma;
musteri tarafinda tamamlanan iste besinci satir yorum.

- Kural: `app/lib/sohbet-durumu.ts` (saf fonksiyon). Parca kurali is merkezleriyle AYNI (`birimleriKur`): kabul edilen
  teklif isi kapatir, ardindan gelen teklif yeni istir; yeni talep (#n) yeni istir. Suresi gecmis bekleyen teklif
  "suresi doldu" sayilir (`gorunenDurum`).
- Baslik (bakan tarafa gore): "Teklif bekleniyor" / "Teklifin bekleniyor"; "Teklif geldi, yanitin bekleniyor" /
  "Teklif gonderildi, yanit bekleniyor"; "Teklif reddedildi" / "Teklifin suresi doldu" / "Teklif geri cekildi";
  "Rezervasyon onayli"; "Tamamlanma onayin bekleniyor" / "Musteri onayi bekleniyor"; "Is tamamlandi"; "Rezervasyon
  iptal edildi".
- Satirlar gercek kayda bakar (uydurma sayac yok): teklif tutari, rezervasyon durumu, tamamlanma bildirimi, yorum.
  Ilerleme = tamam satir / toplam satir; iptal edilen iste 0.
- Yer: genis ekranda sag sutunda "Konusulan kisi" kartinin USTUNDE `DurumKarti` (pembe cizgili "Isin durumu"
  etiketi; ikinci ve sonraki talepte "Isin durumu - talep #n"); rezervasyon varsa altinda "Rezervasyonu ac".
  Dar ekranda sag sutun sohbetin ALTINDA kaldigi icin baslik ayrica sohbetin ustunde tek satirlik seritte
  (durum noktasi + baslik + "Rezervasyon" baglantisi).
- YENI SORGU YOK: teklifler ve rezervasyonlar sayfada zaten okunuyordu; rezervasyon sorgusuna iki kolon eklendi
  (`completion_requested_at`, `created_at`).
- Sinir: teklif topla yanitlarinin parca ayrimi burada yok (ek sorgu isterdi); yalniz ayni talep numarasinda birden
  cok talebin yanitlandigi eski kayitlarda merkezdeki kartla fark edebilir.

## 23-A (ek) Acik sohbetin kendiliginden guncellenmesi (bulgu 152) - ILK TESPIT YANLISTI, DUZELTILDI

Ilk tespit (kod incelemesi): "karsi taraf teklif gonderince acik sohbette kart 'Teklif yukleniyor...' yazisinda
kaliyor". Onizleme turunda ESKI kodla denendi ve DOGRU CIKMADI: iki tarafta kart kendiliginden geliyor. Neden: yeni
mesaj gelince calisan okundu isaretleme eylemi (`markConversationRead`) `revalidatePath` cagiriyor, bu da acik
sayfanin sunucu verisini yeniliyor (teklif karti, rezervasyon koprusu, iletisim kutusu ve yeni durum ozeti).

Gercek acik yalniz okundu ISARETLEMEYEN bakista: kurum adina salt goruntuleyen ekip uyesi (`isTeam && !canWrite`).
Ikinci commit ile kod buna gore daraltildi (`app/mesajlar/[id]/konusma-detay.tsx`): o bakista TEKLIF ya da SISTEM
mesaji gelince sunucu verisi yeniden okunur (`router.refresh()`); iki tarafta eski yol aynen calisir (cift yenileme
yok). Salt goruntuleyen uyeyle DENENMEDI (Sahne'de bu rolde bildigimiz hesap yok).

## 23-B Profil panelinde gorsel dil (bulgu 153)

YAPILDI (`app/profil/page.tsx`):
- "Profil tamligi" karti ortak `DurumKarti` oldu: baslik "Profilini tamamla", ilerleme = tamlik yuzdesi, her eksik
  alan bir satir (kendi duzenleme sayfasina baglanti, "Tamamla"), sagda iki kutu (Tamlik %, Eksik sayisi). Kaynak
  ayni (`getCompletenessPercent`, `getMissingPublishFields`); kart profil tamamlaninca kalkar (eskisi gibi).
- "Yapilacaklar" ve "Profil icerigi" sutun basliklari pembe cizgili `VurguEtiketi`.
- Ikinci commit (turda goruldu: profili tam profesyonelde "Yapilacaklar" sutunu bos kaliyordu): yapilacak
  kalmadiysa ayni sutunda durum karti - "Profilin yayinda" / "Profilin yayina hazir"; satirlar gercek kayittan
  (tamlik %100, etkinlik turleri isaretli, `is_published`).

## 23-A (ikinci commit) "Etkinlik gunu geldi"

Turda goruldu: tarihi gecmis onayli iste kart "Rezervasyon onayli" diyordu; rezervasyon sayfasi ayni is icin
"Etkinlik gunu geldi" diyor. Kural esitlendi (`event_date <= bugun`, Istanbul gunu): baslik "Etkinlik gunu geldi",
tamamlanma satiri musteride "is tamamlaninca burada isaretlenir", profesyonelde "isi tamamlandi olarak
isaretleyebilirsin" (is ondan bekleniyor). Rezervasyon sorgusuna bir kolon daha (`event_date`).

## Test rehberi 3.2

YAPILDI (ikinci commit; 36 sayfa): "Bu surumde ne degisti" sayfasina 3.2 satiri (sohbette ve rezervasyonda isin
durumu karti, panelde "Profilini tamamla", bekleme isareti, hiz); Hikaye 1'in 8, 9 ve 10. adimlarina durum karti
notlari; iki yeni ekran goruntusu (`20-sohbet-durum.jpg`, `21-rezervasyon-durum.jpg`; ikisi de onizlemeden);
bilinen eksikler 9. madde guncellendi. Rehber yalniz onizlemede GORULEN ekranlari anlatir ("Etkinlik gunu geldi"
basligi ve "Profilin yayinda" karti rehberde yok).

## Dogrulama

- Yerel test `test-23a` (durum kurali): 59 / 59. Kapsam: teklifsiz, bekleyen, suresi gecmis, reddedilen, geri
  cekilen, onayli, tamamlanma bildirilmis, tamamlanmis (yorumlu / yorumsuz), iptal, ikinci talep, ayni talepte
  anlasma sonrasi yeni teklif, rezervasyonu gorunmeyen onayli teklif; iki bakis (musteri / profesyonel).
- `tsc --noEmit` ve `eslint` (degisen dort dosya + yeni modul) temiz.
- Onizleme turu (14 Kas):
  - Kaan'in 17 sohbetinin hepsinde kart gercek veriyle: teklifsiz 2, teklif gelmis 1 ("Isin durumu - talep #7",
    8.500 TL), suresi dolmus 1, onayli 8, tamamlanmis 2 ("Yorumun bekleniyor", ilerleme 80), iptal 3 (ilerleme 0).
    Rezervasyonu olan 13 sohbette "Rezervasyonu ac" baglantisi.
  - Ilker (profesyonel bakisi) 2 sohbet: "Teklif gonderildi, yanit bekleniyor", "Talep #7 geldi".
  - 375 px: sohbetin ustunde tek satir serit (35 px; "Is tamamlandi" + "Rezervasyon"), yatay tasma yok; kart
    sohbetin altinda tam genislikte.
  - Canli guncelleme (uc sekme: Kaan yeni kod, Kaan eski kod, Lumen): Lumen 6.200 TL teklif gonderdi; Kaan'in acik
    sohbetinde sayfa yenilenmeden teklif karti (Reddet / Onayla) geldi, kart "Teklif bekleniyor"dan "Teklif geldi,
    yanitin bekleniyor"a dondu. Eski kodda da teklif karti kendiliginden geldi (bulgu 152 duzeltmesi).
  - Profil paneli: Kaan'da "Profilini tamamla" (ilerleme 80, "Hakkimda" satiri baglantili, Tamlik %80 / Eksik 1);
    Ilker'de iki pembe cizgili baslik.
  - Gerileme: Lumen merkezi 2 / 1 / 3.
  - GORULMEDI: "Tamamlanma onayi bekleniyor" basligi (Sahne'de o durumda kayit yok); ikinci commit'in uc isi
    ("Etkinlik gunu geldi", "Profilin yayinda" karti, salt goruntuleyen uye) - uretim sonrasi Sahne adresinde
    bakilacak. Yerel test ikinci commit ile 70 / 70.
- Sahne'de birakilan veri: Kaan - Lumen sohbetinde (`1562b136-...`) Lumen'den 6.200 TL bekleyen test teklifi
  ("Tur 23 test teklifi"; 7 gun gecerli).

## Bu dala giren dokumanlar

Duzeltme 22 kapanisi (bulgular 147, 149, 150 ve plan).
