# Sahne test rehberi — Fahri icin (manuel urun incelemesi)

> GUNCEL REHBER: `docs/sahne/test-rehberi/kashe-sahne-test-rehberi.pdf` (surum 3.0, 13 Kasim 2026; kaynak `test-rehberi.html`).
> Bu dosya ilk taslaktir (3 Kasim); ekran adlari ve menuler o gunden beri degisti (Etkinliklerim / Islerim merkezleri vb.).

Hazirlayan: Guven + Claude, 3 Kasim 2026. Kaynak: `docs/envanter/39-sahne-sentetik-dunya.md`, `docs/sahne/hesaplar.md`,
`docs/sahne/bulgular.md` (onceki turlarin bulgulari, 1-38).

## 1. Amac

Kashe'yi gercek bir kullanici gibi, ama gercek veriye dokunmadan denemek: ajans sahibi, kurum yetkilisi, musteri, profesyonel ve yonetici
gozuyle. Aranan sey yalniz "hata" degil: anlasilmayan ekran, guven vermeyen metin, eksik adim, fazla tiklama, "burada ne yapmam
bekleniyor?" belirsizligi. Teknik bilgi gerekmez; "ben bu ekranda ne hissettim, ne beklerdim" en degerli girdi.

## 2. Ortam ve kurallar

- **Adres:** `https://kashe-git-sahne-guvenyapicioglu-8124s-projects.vercel.app` (Sahne onizlemesi; canli site `kashe.net` ile ayni kod,
  ayri ve sahte veritabani). `kashe.net`'te sahte hesapla test YAPILMAZ.
- **Hesaplar:** `docs/sahne/hesaplar.md` (171 hesap). Parola hepsinde ayni (dosyanin ilk satirinda). Bu rehberdeki senaryolar icin
  secilmis hesaplar bolum 4'te.
- **E-posta kutusu yok:** Sahne hesaplarina gercek e-posta gitmez; sifre sifirlama calismaz; teklif/portal baglantilari ekrandan
  kopyalanir (teklif sayfasinda "musteri baglantisi" olarak gorunur).
- **Kum havuzu:** burada yapilan her sey sahtedir, gercek kullaniciya hicbir sey gitmez. Istedigin gibi davet gonder, teklif yaz, onayla,
  reddet, cikar. Davet ve formlara yalniz `sahne+...@kashe.net` adresleri; gercek telefon, TC, kisi verisi girilmez.
- **Veri yeniden yuklenir:** Sahne zaman zaman sifirlanir; yaptiklarin silinir. Bulguyu gordugun anda kaydet (bolum 5).
- **Ekran goruntusu:** her bulguya bir ekran goruntusu + sayfa adresi (tarayici cubugundaki URL) eklenir; en cok zaman kazandiran sey bu.

## 3. Yontem

1. **Senaryo kartlari (bolum 4):** rol basina bir kart, 8-12 adim; her adimda "ne gormelisin" yazar. Kartlari sirayla, ayri
   oturumlarda yap (rol basina 25-40 dk). Senaryo disina cikmak serbest; cikinca nereye gittigini not et.
2. **Serbest kesif (her rolde 15-20 dk):** kartlar bitince o rolde dolasmaya devam et: menuler, bos sayfalar, mobil genislik (tarayiciyi
   daralt ya da telefondan ac), geri tusu, yenileme.
3. **Her ekranda uc soru:** (a) Ne yapacagimi anladim mi? (b) Gordugum bilgi dogru ve yeterli mi? (c) Guven verdi mi (fiyat, rozet,
   metin, zamanlama)? "Hayir" dedigin her yer bir bulgudur.
4. **Bulgu = gozlem, yorum degil:** "Teklif gonderince ne oldugunu anlamadim; sayfa yenilendi, mesaj gormedim (URL ..., ekran goruntusu)"
   iyi bir bulgu. "Teklif akisi kotu" yetersiz.
5. **Onem:** Y = akis kiriliyor / veri yanlis; O = eksik ozellik / yaniltici; D = kozmetik, metin, hizalama.
6. **Tur:** hata / oneri (urun fikri) / Sahne verisi (sahte verinin tuhafligi: uydurma isim, tarih cakismasi — uygulama hatasi degil).

## 4. Senaryo kartlari

Hesaplar Guven'in 3 Kasim turunda kullanilmayanlardan secildi; boylece temiz baslarsin. Parola: `hesaplar.md` ilk satir.

### Kart A — Musteri: Beren Kara (`sahne+beren-kara@kashe.net`, Istanbul)

1. Cikis yapmis halde ana sayfa ve `/kesfet`: kartlar, rozetler (AJANS / PREMIUM / YENI), suzgecler (kategori, sehir, etkinlik turu).
   Bos kategori listede olmamali.
2. Bir fotografci profili ac (orn. Kerem Oz): ust cipler ("N TAMAMLANMIS IS", "YUKSEK PUANLI"), paketler, portfoy, yorumlar. Cikis
   yapmisken de ayni cipler gorunmeli.
3. Giris yap (Beren). `/profil`: ozet kartlari, "Uye oldugum kuruluslar" bos olmali.
4. `/etkinlik-sihirbazi`: once "Analiz et" ile serbest metin (orn. "Aralikta Istanbul'da 150 kisilik kurumsal yilbasi yemegi, DJ ve
   sunucu lazim"), sonra adimlari gez. 5. adimda rolleri secince "PAZAR KIYASI" kutusu (bazi roller icin veri yoksa "Veri olmayan rol"
   satiri). "Onayla ve etkinligi olustur" -> `/etkinliklerim/<id>`: Genel, Adaylar (eslestirme sonucu, 3 yol, onerilen ekip), Ekip.
5. Bir profesyonelde "Teklif Al": brief formunu doldur (tarih ve kisi sayisi dahil) -> konusma acilir; karttaki TUR/TARIH/LOKASYON/KISI/
   BUTCE dogru mu? "Iletisim kilitli" uyarisi anlasilir mi?
6. `/rezervasyonlarim`: yaklasan ve tamamlanan hizmetler; tamamlanan birinde "Yorum birak" -> profilde yorum penceresi acilir; yorum
   gonder, listede ve ortalamada gorunur.
7. `/bildirimler`, `/mesajlar`: liste, okunmamis sayaci, konusma sekme basligi ("Mesaj — <ad> — Kashe").
8. Serbest kesif: `/ilanlar` (ilan ac), favoriler, paylas, sikayet.

### Kart B — Profesyonel: Kerem Oz (`sahne+kerem-oz@kashe.net`, fotografci, Istanbul)

1. Giris; `/profil`: ozet, guven puani dokumu (ne anlama geldigi aciklaniyor mu?), itiraz baglantisi.
2. `/profil/duzenle`: avatar yukle (JPG/PNG, 2 MB alti), bir alan degistir, kaydet, `/p/<kendi profilin>`'de gor.
3. `/profil/portfoy`: 1-2 gorsel yukle, aciklama ekle, sirala, sil.
4. `/profil/kategori-bilgileri`: calistigin etkinlik turleri ve kategoriye ozel alanlar; kaydet; Kesfet suzgeciyle kendini bul.
5. `/profil/hizmetler` (paketler): fiyat/aciklama degistir; profil sayfasinda "X TL'den" degisti mi?
6. `/mesajlar`: gelen talep; hazir mesajlar; bir konusmada "Teklif gonder" (fiyat teklifi) -> musteri tarafinda nasil gorunur (Kart A
   ile capraz kontrol edilebilir).
7. `/davetlerim`: ajans daveti varsa kabul/ret; `/profil`'de "Uye oldugum ajanslar".
8. `/bildirimler`: "ekibine ekledi", "is kesinlesti" gibi ekip bildirimleri (Kart C'de bir ajans seni ekibe alirsa gorursun).
9. Serbest kesif: musaitlik takvimi, premium, dogrulama rozetleri.

### Kart C — Ajans: Mavi Sahne (`sahne+ajans-mavi-sahne@kashe.net`, Istanbul)

1. Giris; `/ajans` panel: bekleyen teklif, acik isler (suresi gecmis teklif gorunmemeli), kurulus uyesi sayisi, havuz.
2. `/profil/ekibim`: uyeler ve roller (Sahip/Yonetici/Satis/...), bekleyen davetler (suresi dolan "SURESI DOLDU"). Yeni davet gonder:
   `sahne+kerem-oz@kashe.net` (Izleyici, kisa not) -> listede "13 gun icinde dolacak", "Iptal et". Ayni adrese ikinci davet -> uyari.
   (Kabul icin Kart B'de Kerem ile `/davetlerim`.)
3. `/ajans/havuz`: yetenek havuzu; ekip uyeleri "Ekibim'den yonetilir", disaridan eklenenler silinebilir; rol/etiket duzenle.
4. `/etkinliklerim`: bir etkinlik ac -> Adaylar: "SURE", rol basina adaylar, ajans onerileri (kismi kapsam uyarisi), "Ekibi olustur".
   Ekip sekmesi: kapsam ("0/1 onayli · 1 onerildi"), uye durumlari, "Havuzdan sec" (rolu olmayan kayitlar dugmeyle acilir), "Teklif
   olustur".
5. `/ajans/teklifler/<id>`: kalemler, fiyatlar, musteriye gorunur isareti, ic maliyet (gizli), KDV, gecerlilik; alici adi/e-postasi
   (`sahne+beren-kara@kashe.net`); "Teklifi gonder" -> onay penceresi -> gonderildi; musteri baglantisini kopyala, cikis yapmis bir
   tarayicida ac (portal): goruntule, onayla ("Teklifi okudum" kutusu + ad). Ajansa don: teklif ONAYLANDI -> "Rezervasyon olustur".
6. `/ajans/teklifler` listesi: durumlar (taslak, gonderildi, goruntulendi, onaylandi, suresi doldu, reddedildi).
7. `/ajans` guven dokumu, fiyat kiyas ipuclari (teklif kaleminde "Pazar: medyan ..." satiri).
8. Serbest kesif: `/kurumsal`-tarzi kurum ozellikleri ajansta var mi (RFP alma), gorevler, aktivite, CRM, tedarikciler.

### Kart D — Kurum: Marmara Perakende (`sahne+kurum-marmara-perakende@kashe.net`, Istanbul)

1. Giris; `/kurumsal` panel: acik teklif talebi, gelen teklif, yaklasan etkinlik, onayli rezervasyon, kurulus uyesi.
2. `/profil/kurumsal-ekip`: uyeler ve roller; davet gonder (`sahne+beren-kara@kashe.net`, Proje yoneticisi, not) -> bekleyen listesi.
   (Kabul: Kart A hesabiyla `/davetlerim`; sonra Beren `/kurumsal` paneli gorebilmeli, "Gorevler" karti uyede "Modul kapali".)
3. `/etkinlik-sihirbazi`: kurum adina etkinlik olustur (5. adimda "Bu etkinlik kimin adina?" -> kurum) -> `/etkinliklerim/<id>` ->
   "Teklif talebi ac (RFP)": ajanslara talep gonder (kisa liste), son tarih; `/kurumsal/rfp` listesi.
4. Gelen teklifler (Kart C ile capraz: ajans RFP'ye teklif verir) -> karsilastir, sec, reddet.
5. `/rezervasyonlarim`: "Kurulusunuz adina alinan" bolumu; rezervasyon detayinda sozlesme/portal baglantilari.
6. `/mesajlar`: kurum konusmalari ("KURUM: ..." etiketi).
7. Serbest kesif: gorevler modulu (Ayarlar'dan ac), aktivite, tedarikciler, kisa liste.

### Kart E — Yonetici: `sahne+admin@kashe.net`

1. `/admin` dashboard: kartlar (bugun yeni kayit, haftalik rezervasyon, kategori talebi, askidaki kullanici, sikayet, onay bekleyen
   profil + revizyon). Kart sayilari `/admin/profiller` sekmeleriyle ayni olmali.
2. `/admin/profiller`: bekleyen bir profesyoneli (orn. Melih Basak, DJ) onizle, "Revizyon iste" (not yaz), sonra baska birini "Onayla";
   `/admin/kullanicilar` ile capraz. Onaylanan profil Kesfet'te gorunmeye baslamali (yayinda isaretliyse).
3. `/admin/zeka`: gunluk olaylar, fiyat kiyas hucreleri (yayinlanan / esige yakin), guven puani dagilimi, itiraz kuyrugu, huni (baslik
   oranlari %100'u asmamali), adalet. Anlasilir mi? Hangi rakam isine yarar, hangisi gurultu?
4. `/admin/sikayetler`, `/admin/kategori-talepleri`, askiya alma / kaldirma; rapor indir (.xlsx).
5. Serbest kesif: admin olarak bir profesyonel profilini duzenlemeye calis — ne kadari admin yetkisinde olmali?

## 5. Bulgu kaydi

Tek yer: "Sahne bulgulari — Fahri" tablosu (Google Sheet ya da paylasilan sayfa; Guven baglantiyi verir). Sutunlar `bulgular.md` ile
ayni, Claude oradan aktarir ve 39'dan itibaren numaralar:

| # | Tarih | Hesap / rol | Sayfa (URL) | Ne yaptim | Ne bekledim | Ne gordum | Ekran goruntusu | Onem (Y/O/D) | Tur (hata / oneri / Sahne verisi) |

Kurallar: her satir tek gozlem; ayni sorunu iki yerde gorduysen iki satir (sayfa farkli); "bence soyle olmali" yazacaksan Tur = oneri.

## 6. Ritim

- Fahri: haftada bir oturum (2-3 saat, kartlar + serbest kesif) ya da gunde bir kart.
- Her oturumdan sonra 20 dk uclu triyaj (Guven, Fahri, Claude): hata mi, urun karari mi, sonraya mi. Hatalar "Duzeltme 02" dalinda
  toplanir; onizleme guncellenince Fahri ayni adreste yeniden dener ("DOGRULANDI" / "HALA VAR").
- Sahne verisi sifirlandiginda Guven haber verir; yarim kalan senaryo bastan alinir.
