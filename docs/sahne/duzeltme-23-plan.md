# Duzeltme 23 - gorsel dil turu (sohbet sayfasi, profil paneli) + test rehberi 3.2

Hazirlayan: Guven + Claude, 13 Kasim 2026. Kaynak: 14-C karari A (gorsel dil sayfa sayfa; Fahri satir 24) ve rehberdeki
"bilinen eksikler" 9. madde (rezervasyon, sohbet ve profil paneli sirada; rezervasyon 21-B ile yapildi).
Goc (migration) YOK.

Durum: DALDA (`duzeltme-23`), onizleme turu bekliyor.

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

## 23-A (ek) Karsi tarafin acik sohbeti kendiliginden guncellenir (bulgu 152)

Kod incelemesinde bulundu (canli denenmedi; onizlemede iki hesapla denenecek): canli akis yalniz MESAJ satirini
getiriyor. Karsi taraf teklif gonderdiginde acik sohbette kart "Teklif yukleniyor..." yazisinda kaliyor; onay, ret,
iptal ve tamamlanmada da rezervasyon koprusu, iletisim kutusu ve (yeni) durum ozeti sayfa elle yenilenene kadar eski
kaliyor. Islemi yapan tarafta sorun yok (eylem sayfayi zaten yeniliyor).

YAPILDI (`app/mesajlar/[id]/konusma-detay.tsx`): canli akistan TEKLIF ya da SISTEM mesaji gelince sunucu verisi
yeniden okunur (`router.refresh()`). Duz metin mesajinda yenileme yok. Yazilan metin, acik form ve kaydirma konumu
istemci durumunda oldugu icin korunur.

## 23-B Profil panelinde gorsel dil (bulgu 153)

YAPILDI (`app/profil/page.tsx`):
- "Profil tamligi" karti ortak `DurumKarti` oldu: baslik "Profilini tamamla", ilerleme = tamlik yuzdesi, her eksik
  alan bir satir (kendi duzenleme sayfasina baglanti, "Tamamla"), sagda iki kutu (Tamlik %, Eksik sayisi). Kaynak
  ayni (`getCompletenessPercent`, `getMissingPublishFields`); kart profil tamamlaninca kalkar (eskisi gibi).
- "Yapilacaklar" ve "Profil icerigi" sutun basliklari pembe cizgili `VurguEtiketi`.

## Test rehberi 3.2

Onizleme turundan SONRA, ikinci commit ile: Duzeltme 21 - 23'un gorunen degisiklikleri (bekleme isareti,
rezervasyonda ve sohbette durum ozeti, hiz, profil panelindeki kart) rehbere islenir; ekran goruntuleri onizlemeden
alinir (gorulmemis ekran rehbere yazilmaz).

## Dogrulama

- Yerel test `test-23a` (durum kurali): 59 / 59. Kapsam: teklifsiz, bekleyen, suresi gecmis, reddedilen, geri
  cekilen, onayli, tamamlanma bildirilmis, tamamlanmis (yorumlu / yorumsuz), iptal, ikinci talep, ayni talepte
  anlasma sonrasi yeni teklif, rezervasyonu gorunmeyen onayli teklif; iki bakis (musteri / profesyonel).
- `tsc --noEmit` ve `eslint` (degisen dort dosya + yeni modul) temiz.
- Onizleme turu (yapilacak): Kaan (musteri) ve Ilker (profesyonel) ile teklifsiz, teklifli, onayli, tamamlanmis ve
  iptal edilmis sohbetler; iki hesap ayni anda acikken yeni teklifin karsi tarafta kendiliginden gorunmesi; 375 px
  serit; profil panelinde eksigi olan bir hesapta kart; gerileme (merkez sayilari).

## Bu dala giren dokumanlar

Duzeltme 22 kapanisi (bulgular 147, 149, 150 ve plan).
