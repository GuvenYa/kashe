# 52 - Claude Code gorevi: Duzeltme 11 - Fahri turu 2, oneriler (bulgu 73, 76 b/d, 77, 80, 72)

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/sahne/bulgular.md` #72, #73, #76, #77, #80 ve Fahri'nin tablosu
(satir 6, 9, 10, 13). Karar Guven (5 Kasim): "Fahri'nin onerilerine gore; onerisi yoksa diger talepleriyle uyumlu".
Duzeltme 10'un USTUNE (`duzeltme-10` birlestikten sonra `main`'den acilan `duzeltme-11` dalinda). Veritabani DEGISMEZ
(Sahne verisi ayri: `docs/sahne/08-sahne-ilanlar-paketler.sql`, dal - ilan, basvuru, paket, eklenti).
Kullanim: Claude Code'a "`docs/envanter/52-claude-code-gorevi-duzeltme-11.md` dosyasini oku, "---" cizgisinin altindaki
gorevi uygula" denir.

---

## Gorev

Bes bolum (A-E) + kabul. Turkce arayuz metinleri asagida yazildigi gibi; ASCII kod yorumlari; yeni dosyalarda sapkali harf
yok. Commit ATMA.

### A) Bulgu 73 - sade ust menu, "Etkinligini planla" one cikar

Fahri: ust menude sade gorunum (Kesfet, Etkinligini planla, Fiyatlandirma gibi), sag ust koseden planlamaya gidebilmek;
bugun girissizde xl'de 9 baglanti var ve "planlamaya itmiyor".

1. `app/lib/nav-links.ts` (tek kaynak, ust bar + mobil parite kurali korunur):
   - `DISCOVERY_LINKS` (herkes): `Keşfet` (/kesfet), `İlanlar` (/ilanlar). Blog ve Kashe AI buradan CIKAR.
   - Yeni `PLANLA_LINK`: `{ href: '/kashe-ai', label: 'Etkinliğini planla', ai: true }`.
   - `MARKETING_LINKS` (girissiz ust bar): yalniz `Fiyatlandırma`. Sayfa ici capalar (Hizmetler, Nasil calisir, Kurumsal,
     Saglayicilar) ve Blog yeni `HAKKINDA_LINKS` listesine tasinir (alt bilgi + mobil menu). `xlOnly` kullanilmiyorsa kalkar.
2. `top-nav.tsx` masaustu:
   - Girissiz: orta `Keşfet · İlanlar · Fiyatlandırma`; sag `Giriş yap` (metin) · `Üye ol` (ikincil / cerceveli) ·
     `Etkinliğini planla` (birincil vurgu dugmesi, isilti ikonu, en sagda).
   - Girisli: orta `Keşfet · İlanlar · Etkinliğini planla` (isiltili baglanti) · `Teklif Topla` (yetkisi varsa, bugunku
     kural); sag degismez (Mesajlar, zil, hesap menusu).
3. `mobile-nav.tsx`: ustte tam genislik `Etkinliğini planla` dugmesi; sonra `Keşfet`, `İlanlar`, (girissizde)
   `Fiyatlandırma`; sonra "Kashe hakkında" grubu (`HAKKINDA_LINKS`); en altta giris / uye ol (girissiz). Mevcut
   `kapat()` / `<Link prefetch={false}>` kurallari aynen.
4. `footer.tsx`: Kesfet sutunu `Tüm sağlayıcılar` (/kesfet), `DJ'ler` (/kategori/dj), `Fotoğrafçılar`
   (/kategori/fotografci), `Sunucular` (/kategori/sunucu), `Kurumsal hizmet sağlayıcılar` (/kesfet?tip=ajans),
   `İlanlar` (/ilanlar), `Etkinliğini planla` (/kashe-ai). Bugunku `/kesfet?kategori=1|6|4` SABIT KIMLIK baglantilari
   kalkar (kimlik ortama gore degisiyor; dalda yanlis kategoriye gidiyor). `HAKKINDA_LINKS` alt bilgide de listelenir
   (Blog dahil); mevcut diger baglantilar (Hakkimizda, Yardim, yasal) kalir; tekrar eden baglanti olmasin.
5. Hero (Kashe AI kutusu) DEGISMEZ.

### B) Bulgu 76 b/d - ajans uzerinden ekipten teklif, paket detayi, paket rezervasyonu

Fahri (#9): paketi secince detaylari gelsin; Mavi Sahne araciligiyla ekibinden birinden hizmet almak, paketi ekibinden hangi
kisiden alacagini secmek; uye sayfasinda "kimle anlasacagimi anlamadim"; paketi secip teklif ya da rezervasyon.

1. Secenek tipi: Duzeltme 10'daki `hizmetSecenekleri: string[]` -> `HizmetSecenegi[]`
   (`{ baslik: string; tur: 'paket' | 'hizmet'; fiyat: string | null; icerik: string[]; kategoriSlug: string | null }`;
   paket icerigi `includes`, hizmette bos). Modalda secim yapilinca hemen altinda kisa ozet: fiyat + en fazla 4 icerik
   maddesi. `brief_data.hizmet` yine BASLIK (degismez).
2. Ajans modalinda (`ajansMi`) "Hangi hizmet ya da paket?"in altinda istege bagli **"Ekipten tercih"** secimi:
   ilk secenek `Fark etmez — ajans önersin`; sonra ekip uyeleri `Ad S. · Rol` (kamu ad kurali `gosterilecekAd`). Secili
   hizmetin kategorisi varsa o kategorideki uyeler ustte, digerleri "Diğer ekip üyeleri" grubunda. Kayit:
   `brief_data.tercih_uye` (uye kimligi) + `brief_data.tercih_uye_adi`. Ozet etiketi "Tercih edilen ekip üyesi"
   (`brief-ozet.ts` ve iki teklif talebi sayfasi).
3. SUNUCU (`startConversation`): `tercih_uye`, sohbetin saglayicisinin (ajans) `organization_team_public` listesinde
   (`agency_id` = ajans, `user_id` = uye) DEGILSE iki anahtar da duser; `tercih_uye_adi` sunucuda kamu ad kuraliyla YENIDEN
   uretilir (istemci metnine guvenilmez). `briefVeriTemizle` ya da yanindaki yardimci.
4. Ajans sayfasi ekip karti (`page.tsx` "Ekibimiz"): kart profile gitmeye devam eder; kartin altinda kucuk ikincil dugme
   `<Ajans adı> üzerinden teklif al` -> ajans modali o uye secili acilir (kendi profili degilse; diger CTA kurallari ayni).
5. Uye profili (`professional-profile.tsx` "Üye olduğu ajans" karti): altina tek satir "Doğrudan teklif alabilir ya da
   <Ajans adı> üzerinden çalışabilirsin." + baglanti `<Ajans adı> üzerinden teklif al →` ->
   `/p/<ajansId>?tercih=<uyeId>` (`?etkinlik=` varsa o da tasinir). Ajans sayfasi `tercih` gecerli bir ekip uyesiyse
   teklif modalini ACIK ve uye SECILI getirir; gecersizse yok sayar.
6. Paket rezervasyonu: fiyati belli (talep uzerine OLMAYAN) paket satirlarinda ikinci kucuk dugme `Rezervasyon talebi`
   (profesyonel ve ajans dali) -> `RezervasyonButton`; modal basliginin altinda "Seçilen: <paket>", gonderimde
   `brief_data: { hizmet: <paket> }` (bugun `null`). `briefVeriTemizle` sunucuda ayni.

### C) Bulgu 77 - ilanlar

Fahri: ilan acmak, ilanlara bakmak, basvurmak; girissizken ilan acmaya yonlendiren yol yok.

1. `/ilanlar`: `Yeni ilan aç` dugmesi girissiz kullaniciya da gorunur -> `/uye-ol?redirect=/ilanlar/yeni`. Girisli
   profesyonel / ajansta gorunmez (onlar basvurur). Bos durumda eylem: girissiz `Üye ol ve ilan aç`, musteri / kurum
   `İlk ilanı aç`.
2. Baslik altinda tek satir (yoksa): "Müşteri ve kurumların açtığı ilanlar; profesyoneller ve ajanslar başvurur."
3. Ilan detayi (`/ilanlar/[id]`): girissiz kullanicida basvuru yeri `Başvurmak için giriş yap` ->
   `/giris?redirect=/ilanlar/<id>` (bugun ne yapiyorsa rapora yaz; yoksa ekle). Musteri / kurumda basvuru dugmesi yok,
   bugunku kural.
4. Veri dalda: Sahne 08 (12 ilan, 18 basvuru) - kod bunu varsaymaz.

### D) Bulgu 80 - profil iskeleti ve bolum gezintisi

Fahri (#13): kategoriye gore farklilassin ama ana basliklar (aciklama, deneyim, hizmetler...) her profilde sabit kalsin,
bir profili nasil inceleyecegini anlasin.

1. Profesyonel profili SABIT SIRA: `Hakkımda` -> `Hizmetler ve paketler` -> `<Kategori adı> bilgileri` (kategori
   modulleri bu TEK baslik altinda; modul basliklari alt baslik olur) -> `Deneyim` -> `Eğitim ve sertifikalar` ->
   `Öne çıkanlar ve ödüller` -> `Yorumlar`. Ozet bandi / medya ustte kalir. Duzeltme 10'daki `BolumBasligi` kurali aynen
   (slogan varsa ust etiket + slogan).
2. Dort ana bolum HER profilde gorunur; veri yoksa tek satir: Hakkimda "Henüz tanıtım eklenmemiş.", Hizmetler ve paketler
   "Henüz hizmet eklenmemiş; teklif isteyerek fiyat alabilirsin.", Deneyim "Henüz deneyim eklenmemiş.", Yorumlar
   "Henüz yorum yok.". Kategori bilgileri / egitim / oduller bossa cizilmez.
3. Bolum gezintisi: kimlik blogunun altinda yatay serit, ust menunun altinda yapiskan (`sticky`), sayfada OLAN bolumlere
   capa: `Hakkımda · Hizmetler · <Kategori> bilgileri · Deneyim · Yorumlar` (egitim / oduller seritte yok). Mobilde yatay
   kaydirilir, ekran disina tasmaz. Capalarin hedefi yapiskan seridin altinda kalmasin (`scroll-margin-top`).
4. Ajans sayfasi ayni dil: sira `Hakkımda` (tanitim) -> `Ekibimiz` -> `Hizmetler ve paketler` -> `Portföy` ->
   `Yorumlar` (bugun Portfoy, Hizmetler'in ustunde); ayni gezinti seridi.

### E) Bulgu 72 - Kesfet kart cipi kesiliyor (kucuk)

Dar kartta (4 sutun, ~210 px) kategori cipi "ORGANIZASYO" diye kesiliyor. Cip en fazla iki satira kirilsin (kelime
kirilmadan), premium rozeti ve kalp yerinde kalsin; 1280 / 1440 / 375 px'te "Organizasyon", "Etkinlik Koordinatörü",
"Saç & Makyaj & Styling" tam okunur.

### Kabul olcutleri

- `npx tsc --noEmit`, `npx eslint app` 0 hata, `npm run build` temiz. Kural ayari degismez, kural kapatilmaz.
- Rapor: bolum bolum degisen dosya:satir, yeni / degisen ekran metinleri; B3 sunucu dogrulamasinin nasil sinandigi
  (gecerli uye, baska ajansin uyesi, uydurma kimlik); D icin bir profesyonel ve bir ajans sayfasinin bolum listesi.
- Smoke icin acik sunucu birakma.

### Onizleme turu (Claude yapacak; dalda Sahne 08 calistiktan sonra)

Girissiz ve girisli ust menu (1024 / 1280 / 1440 px, 375 px mobil menu), alt bilgi baglantilari; Mavi Sahne: paket secince
ozet, ekipten tercih (DJ paketi -> DJ'ler ustte), ekip kartindan "Mavi Sahne üzerinden teklif al", Naz G. profilinden
ajans baglantisi -> modal acik + uye secili, sohbet seridinde "Tercih edilen ekip üyesi"; Kerem Oz paket satirindan teklif ve
rezervasyon; `/ilanlar` girissiz (12 ilan, "Yeni ilan aç" -> uye ol), ilan detayinda basvuru yolu; profil bolum gezintisi
(Hakan Ates dansci, Kerem Oz, Mavi Sahne); Kesfet kart cipi.
