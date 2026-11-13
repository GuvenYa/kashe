# Duzeltme 22 - hiz turu (fonksiyon bolgesi, etkinlik sayfasinda es zamanli okuma)

Hazirlayan: Guven + Claude, 13 Kasim 2026. Kaynak: Duzeltme 21 olcumu (bulgu 147: etkinlik sayfasinda sekme gecisi
5,2 - 5,9 saniye). Goc (migration) YOK. Kullaniciya gorunen metin / duzen degisikligi YOK; yalniz hiz.

Durum: URETIMDE (13 Kas; main = sahne = ca3b500; uretim derlemesi `dpl_F9tvXsPUnwNFMiwkiQkPx2Pjvs4c`, Sahne adresi
`dpl_A2A71zpWmRnYAnDSPreZGUZaEQLs`).

## Bulgu: fonksiyonlar veritabanindan uzakta calisiyor (bulgu 149)

13 Kas, Sahne adresinde yanit basligi: `x-vercel-id: fra1::iad1::...`. Ilk kod istegin girdigi kenar noktasi
(Frankfurt), ikincisi fonksiyonun calistigi bolge: `iad1` = Washington, D.C. (Vercel'in varsayilani; repoda
`vercel.json` yoktu, proje ayari da degismemis). Veritabani (Supabase) Frankfurt'ta (`CLAUDE.md`). Sonuc: sunucudaki
HER Supabase sorgusu ve her oturum dogrulamasi Atlantik'i gecip geri donuyor; sorgu basina yaklasik 100 ms ve ustu
bekleme. Bu yalniz etkinlik sayfasini degil, sunucuda veri okuyan BUTUN sayfalari (uretim dahil) yavaslatiyor.

Etkinlik sayfasinda etki en buyuk, cunku okumalar sirali: oturum, profil, etkinlik, bagli kayitlar, kosular, adaylar
(alti adim), kurulus baglami (uc adim), ekip (alti adim), teklif, RFP, gorevler (iki adim), tedarikciler (iki adim),
menu, hesap karti. Yaklasik otuz adim x ~130 ms = 4 saniye + sayfa cizimi; olculen 5,2 - 5,9 saniye ile uyumlu.

Vercel belgesi (13 Kas okundu): varsayilan bolge `iad1`; bolge "veri kaynagina yakin" secilmeli; `vercel.json`
icindeki `regions` proje ayarinin onune gecer; Hobby planinda tek bolge secilebilir.

## 22-A Fonksiyon bolgesi Frankfurt (`vercel.json`)

YAPILDI: repo kokune `vercel.json`:

    { "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["fra1"] }

Etki: sunucu bilesenleri, sunucu eylemleri ve API yollari Frankfurt'ta calisir; veritabaniyla arasi birkac
milisaniyeye iner. Duragan dosyalar (CDN) ve kenar katmani etkilenmez. Yan etki: ABD'deki dis servislere (Anthropic
API, e-posta) giden cagrilar ~100 ms uzar; bu cagrilar saniyeler surdugu icin fark gorunmez.
Geri alma: dosya silinirse bolge varsayilana (`iad1`) doner.

## 22-B Etkinlik sayfasinda okumalar uc dalga halinde es zamanli (bulgu 147)

YAPILDI (`app/etkinliklerim/[id]/page.tsx`). Sorgularin ICERIGI ve kosullari degismedi; yalniz bekleme sirasi:
- Dalga 1: aski kontrolu + etkinlik.
- Dalga 2: bagli kayitlar (dort sorgu) + eslestirme kosulari + kurulus baglami + ekip.
- Dalga 3: aday verisi + "kimin adina" listesi + ekip verisi + ekipten acilmis teklif + RFP'ler + gorevler +
  atanabilirler + tedarikci listeleri + tedarikci tutarlari + menu + hesap karti.
Aday ve ekip okumalari iki fonksiyona alindi (`adayBlogu`, `ekipBlogu`); icerde de birbirini beklemeyen okumalar
birlikte gider (saglayici + hizmet fiyati + ajans rol kapsami; sehir + kategori; uyeler + havuz kayitlari; uye
saglayicilari + havuz adlari). `rolBloklari` iki kaynagi (aday gruplari, ekip uyeleri) birlestirdigi icin dalga 3'ten
sonra kurulur. Sirali adim sayisi otuzdan yediye iner.

Capraz bagimliliklar (21 planindaki tarama) korunarak: `rolGruplari` -> `rolBloklari`; `ajansAdaylari` -> "kimin
adina" listesi (aday sozune zincirli); sekme rozetleri (`gorevler.length`, aktif tedarikci atamasi) her sekmede.
Kucuk fark: askiya alinmis kullanicida etkinlik sorgusu artik aski kontroluyle birlikte gidiyor (sonuc
kullanilmaz; salt okuma).

## 22-C Kurulus baglaminda istek basina tek oturum dogrulamasi

YAPILDI (`app/lib/org-context.ts`): `getTalentPoolContext`, `getCrewContext` ve `tekIzinVarMi` kendi
`supabase.auth.getUser()` cagrisi yerine istek basina onbellekli `getCachedUser()` kullanir. Panel sayfalarinda
(menu iki izin sorgusu + kurulus baglami) uc fazladan oturum dogrulamasi kalkar. Dogrulanan kullanici ayni.

## 22-D Gorev atama listesinde sabit sira (bulgu 150)

Onizleme karsilastirmasinda bulundu (22'den bagimsiz, eski kodda da var): `atanabilirler` uyelik sorgusunda sira
yoktu; Gorevler sekmesindeki "atanan" listesi ayni sayfanin iki yuklemesinde farkli sirada gelebiliyordu (ornek:
Ilker Sezer bir yuklemede ucuncu, digerinde yedinci). YAPILDI (`app/lib/gorev-data.ts`): uyeler ada gore (Turkce
siralama), esitlikte kimlige gore dizilir. Havuz kayitlari zaten ada gore geliyordu.

## Yapilmayan: yalniz acik sekmenin verisini cekmek

21 planindaki ucuncu yol (risk en buyuk: kisisel etkinlik bolumleri tek sayfada cizer, rozetler her sekmede sayi
ister). Olcum hedefin (2 saniyenin alti) altinda cikti (asagida); YAPILMADI, gerek kalmadi.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen iki dosya) temiz.
- Onizleme turu (13 Kas; dal onizlemesi = yeni kod, Sahne adresi = eski kod, AYNI veritabani):
  - Bolge: onizlemede `x-vercel-id` = `fra1::fra1`; Sahne adresinde `fra1::iad1`.
  - Sekme gecisi (Lumen etkinligi `b6398872-...`, tiklama -> adres degisimi, dokuz gecis): 794 - 1075 ms
    (once 5151 - 5896 ms). Hedef (2 saniyenin alti) tuttu.
  - Sayfanin tamami (alti sekme, sunucu yaniti sonuna kadar): once 4,6 - 6,5 sn, sonra 0,7 - 1,1 sn.
  - Diger sayfalar da hizlandi (yalniz bolge etkisi): Lumen Etkinlikler 1,7 - 2,1 -> 0,9 - 1,0 sn; ajans Genel
    bakis 2,9 -> 1,2 sn; ajans Islerim 2,4 -> 0,9 sn; kurum Etkinliklerim 1,8 - 2,1 -> 1,0 - 1,1 sn; Kaan
    Etkinliklerim 1,2 - 1,4 -> 0,5 - 0,7 sn; Ilker Islerim 1,3 - 1,4 -> 0,7 - 0,8 sn.
  - Icerik: sayfanin sunucudan gelen TUM verisi (cizilen agac + istemci bilesenlerine giden ozellikler; derleme
    kimlikleri ayiklanarak) iki adreste karsilastirildi. Dort hesap, 14 etkinlik gorunumu, 93 sayfa cizimi:
    Lumen (ajans sahibi; 5 etkinlik x 7 sekme hali), Anadolu Ilac (kurum sahibi; 4 x 7), Ilker Sezer (Lumen uyesi;
    4 x 7), Kaan (kisisel etkinlik; 1 x 2). Hepsi AYNI. Tek fark gorev atama listesinin sirasiydi; eski kodda da
    yuklemeden yuklemeye degisiyor (22-D). Merkez sayfalari (19 sayfa) da birebir ayni.
  - Gerileme: Kaan merkezi 11 / 8 / 6; Lumen merkezi 2 / 1 / 3.
- Uretim sonrasi (13 Kas):
  - kashe.net (girissiz): `x-vercel-id` = `fra1::fra1`; Kesfet 102 kart.
  - Sahne adresi (Lumen): `fra1::fra1`; sekme gecisi dokuz geciste 726 - 1232 ms.
  - 22-D: Gorevler sekmesinde atama listesi alfabetik (Can Uysal, Enes Aksoy, Ilker Sezer, Levent Avci, Mert Sari,
    Tarik Cakir, Zehra Simsek; ardindan havuz kayitlari) ve bes yuklemede ayni sirada.
- Uretim sonrasi: kashe.net girissiz Kesfet'te `x-vercel-id` ikinci kod `fra1`.

## Bu dala giren dokumanlar

Duzeltme 21 kapanisi (bulgular 147 - 148, plan).
