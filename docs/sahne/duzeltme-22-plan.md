# Duzeltme 22 - hiz turu (fonksiyon bolgesi, etkinlik sayfasinda es zamanli okuma)

Hazirlayan: Guven + Claude, 13 Kasim 2026. Kaynak: Duzeltme 21 olcumu (bulgu 147: etkinlik sayfasinda sekme gecisi
5,2 - 5,9 saniye). Goc (migration) YOK. Kullaniciya gorunen metin / duzen degisikligi YOK; yalniz hiz.

Durum: DALDA (`duzeltme-22`), onizleme turu bekliyor.

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

## Yapilmayan: yalniz acik sekmenin verisini cekmek

21 planindaki ucuncu yol (risk en buyuk: kisisel etkinlik bolumleri tek sayfada cizer, rozetler her sekmede sayi
ister). 22-A + 22-B sonrasi olcum hedefin (2 saniyenin alti) altindaysa YAPILMAZ.

## Dogrulama

- `tsc --noEmit` ve `eslint` (degisen iki dosya) temiz.
- Onizleme turu (yapilacak):
  - Bolge: yanit basliginda `x-vercel-id` ikinci kod `fra1`.
  - Sure: Lumen etkinliginde (`b6398872-...`) sekme gecisi ayni yontemle (tiklama -> adres degisimi) olculur;
    once 5,2 - 5,9 sn.
  - Icerik: ayni etkinlikte alti sekmenin metni Sahne adresi (eski kod) ile dal onizlemesi (yeni kod) arasinda
    karsilastirilir; ayni veritabani, fark cikmamali. Uc hesap: Lumen (ajans; adaylar + ekip dolu), Anadolu Ilac
    (kurum), Kaan (kisisel etkinlik, sekmesiz duzen).
  - Gerileme: merkez sayilari (Kaan 11 / 8 / 6 / 8; Lumen 2 / 1 / 3).
- Uretim sonrasi: kashe.net girissiz Kesfet'te `x-vercel-id` ikinci kod `fra1`.

## Bu dala giren dokumanlar

Duzeltme 21 kapanisi (bulgular 147 - 148, plan).
