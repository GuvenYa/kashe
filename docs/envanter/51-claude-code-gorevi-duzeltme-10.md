# 51 - Claude Code gorevi: Duzeltme 10 - Fahri turu 2 (bulgu 74, 76 a/b/e, 78, 79, 80, 81, 82, 83)

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/sahne/bulgular.md` #73-#83 (Fahri tablosu satir 6-15 + not).
Karar gerektirmeyen hata ve iyilestirmeler. Karar bekleyenler (73 ust menu, 76d ajans ekip akisi, 77 ilanlar,
80 iskelet / bolum gezintisi, 75 hero gorselleri) bu gorevin DISINDA. `main`'den acilan `duzeltme-10` dalinda.
Veritabani DEGISMEZ (Sahne verisi ayri: `docs/sahne/07-sahne-duzeltme-04-ozet-ciplari.sql`, dal).
Kullanim: Claude Code'a "`docs/envanter/51-claude-code-gorevi-duzeltme-10.md` dosyasini oku, "---" cizgisinin altindaki
gorevi uygula" denir.

---

## Gorev

Yedi bolum (A-G). Turkce arayuz metinleri, ASCII kod yorumlari, yeni dosyalarda sapkali harf yok. Gorunen metinler asagida
yazildigi gibi. Commit ATMA.

### A) Bulgu 78 - profil sayfasi cokuyor (React #31, ozet bandi cipleri)

Kok neden: `app/p/[id]/professional-profile.tsx` (~satir 162, 520-526) `category_attributes.summary.stats`'i `string[]`
sayip `{st}` diye ciziyor. Duzenleyici (`app/profil/kategori-bilgileri`) metin yaziyor; ama `app/lib/category-fields.ts`
satir 17'deki sema yorumu eski `[{ "label", "value" }]` bicimini anlatiyor ve Sahne ureteci bunu yazmisti. Nesne gelince
sayfa istemcide "This page couldn't load" ile cokuyor (sunucu 200 doner).

1. Yeni saf yardimci (or. `app/lib/ozet-cipleri.ts`): `ozetCipleri(ham: unknown): string[]` - dizi degilse `[]`;
   metin -> `trim`; `{ label, value }` nesnesi -> `"<value> <label kucuk harf, tr>"` (or. `{label:'Etkinlik', value:'160+'}`
   -> `"160+ etkinlik"`); bos / baska tip atlanir; en fazla 3.
2. Kullanan iki yer: kamu profili (ozet bandi) ve `kategori-form.tsx` (`summaryInit.stats` - duzenleyici acilinca metin
   gorur, kaydedince metin yazar). `actions.ts` zaten metin yaziyor; dokunma.
3. `category-fields.ts` sema yorumu: `"stats": ["9 yil deneyim", "400+ etkinlik", "12 sehir"]` (string[], en fazla 3).
4. Ayni dosyada (`professional-profile.tsx`) jsonb'den (`attrs`, `category_attributes`, `modules`, `quick`, `skills`...)
   gelip DOGRUDAN `{...}` ile cizilen diger degerleri tara; nesne gelebilecek olanlari ayni yaklasimla koru (metne cevir ya
   da atla - sayfa asla cokmesin). Rapor: deger / satir / onlem tablosu.

### B) Bulgu 74 - logo

Kilavuz logo: oynat ucgeni + kucuk harf "kashe" kelime isareti (ozel cizim). Sitede isaretin yaninda `font-display`
buyuk harf "Kashe" METNI var; ayrica isaret PNG'si (359x471) `w-8 h-8` kutuda `object-fit: fill` ile yatay basiliyor.
Kelime isareti dosyalari hazir (lockup'tan kesildi): `public/kashe-wordmark.png` (lacivert, 325x96) ve
`public/kashe-wordmark-white.png` (beyaz, 326x96).

1. `app/components/ui/kashe-mark.tsx`: `img`'e varsayilan `object-contain` (kutu boyutu ve cagiran siniflari degismez).
2. Yeni `app/components/ui/kashe-wordmark.tsx`: `KasheWordmark({ variant?: 'default' | 'dark', className?, title? })`,
   `img` (`default` -> `/kashe-wordmark.png`, `dark` -> `/kashe-wordmark-white.png`), `alt="Kashe"`, yukseklik
   siniftan, genislik `w-auto`.
3. Isaretin yanindaki "Kashe" metnini kelime isaretiyle degistir: `app/components/sections/top-nav.tsx` (~105-108),
   `app/components/sections/footer.tsx` (~14-17, dark), `app/components/ui/brand-mark.tsx`, `app/portal/layout.tsx`
   (~32-35), `app/components/panel/panel-yan-menu.tsx` (~350-352, ~519-521, dark). Oran: isaret `h-8` -> kelime isareti
   `h-4` (lockup'ta kelime isareti isaretin ~%50'si); BrandMark `lg` (isaret `h-12`) -> `h-6`. Isaret dekoratif olur
   (`title=""`), baglantinin erisilebilir adi bir kez "Kashe". Hover kipirtisi (`kashe-logo-mark`) kalir.
4. Cumle icindeki marka adina (or. `kashe-ai-section.tsx` "Kashe sana yardim etsin") ve e-posta sablonlarina DOKUNMA;
   baska logo-metin yeri bulursan rapora yaz.

### C) Bulgu 81 - arama etkinlik turlerini bulmuyor ("Gala")

Bugun arama yalniz `arama_metni` (ad + sirket + baslik + tanitim + kategori adi) ve el yazimi es anlamli sozlugunde
(acilis, nikah, dogum gunu, kina, organizator, menajer). "Gala" yazan, Gala turunu profilinde beyan eden saglayicilari
bulmuyor (dal: metin 17, beyan 38, birlesim 49).

1. `app/lib/arama.ts`: saf `etkinlikTuruEslesmesi(terim, turler: { key: string; name_tr: string }[]): string[]` -
   ad `aramaKatla` ile katlanir; kural `esAnlamliEslesme` ile AYNI (`n === ad || n.includes(ad) || (n.length >= 4 &&
   ad.includes(n))`, `n.length >= 3`); `other` (Diger) HARIC; yalniz aktif turler.
2. `app/kesfet/page.tsx`: eslesen anahtarlar sozluk turleriyle birlesir (tekrarsiz) ve ayni
   `category_attributes.cs.{"etkinlik_turleri":["k"]}` VEYA kosuluna girer. Tur listesi sayfanin zaten kullandigi
   `event_types` kaynagindan (ikinci sorgu acma; varsa mevcut listeye `name_tr` ekle). Sozluk satirlari KALIR.
3. Beklenen (dal, yerel olcum): q=Gala 17 -> 49, kongre 9 -> 17, konser 10 -> 31, fuar 15 -> 34, sunnet 1 -> 3,
   mezuniyet 0 (yakin sonuclar seridi - degismez), acilis 78 (degismez). Rapor: en az 8 terim icin `etkinlikTuruEslesmesi`
   girdi -> cikti (gala, gala gecesi, kon, kong, konser, dugun, diger, xyz).

### D) Bulgu 82 - sehir serbest metin

Profil sag kartinda (`app/components/fiyat-takvim-karti.tsx` ~172-180 "Sehir" input) ve teklif / rezervasyon brief'inde
(`location` / `city` anahtarli `text` alanlar, `app/lib/brief-config.ts`) il elle yaziliyor.

1. Iki yerde de il SECICI (81 il, `turkish_cities`; aranabilir - mevcut `app/components/sections/city-select.tsx`
   kullanilabilir ya da ayni davranista hafif bir bilesen). Brief'te secicinin altinda istege bagli metin
   "İlçe / mekan (isteğe bağlı)" (en fazla 80 karakter). Kaydedilen deger: mekan varsa `"<mekan>, <İl>"`, yoksa `"<İl>"`
   (legacy `location` sutunu ve `brief_data` ayni anahtar - alan adi DEGISMEZ). Zorunluluk bayragi aynen.
2. Saglayici kurali (`category_attributes.service_region`): `Yalnızca kendi şehri` ise secici yalniz saglayicinin ili
   (secili gelir) + not "Bu profesyonel yalnız <İl> içinde hizmet veriyor."; diger degerlerde 81 il, saglayicinin ili
   listenin basinda; secilen il saglayicinin ilinden farkliysa not "Şehir dışı: ulaşım ve konaklama teklife eklenebilir."
3. Kartta secilen il modala on-dolgu olarak gecer (bugunku `onDolgu` yolu); eski metin dolgusu bir il adiyla (Turkce harf
   duyarsiz) eslesirse secili gelir, eslesmezse bos.
4. `IletisimButton` ve `RezervasyonButton`'da ayni davranis. Il listesi sayfaya bir kez gelir (profil sayfasi zaten
   cekiyorsa onu kullan). Ajans sayfasi (page.tsx dali) ve profesyonel dali ikisi de.

### E) Bulgu 83 - brief formu: "Fark etmez", tarih esnek, "Diger" aciklamasi

1. `brief-config.ts`: etiketi "süre" iceren `select` alanlarina (Cekim suresi, Etkinlik suresi, Calisma suresi,
   Performans suresi, Gosteri suresi, Sure, Teslim suresi beklentisi) son secenek `{ value: 'no_pref', label: 'Fark etmez' }`
   (zaten varsa ekleme). Rapor: eklenen alan listesi.
2. Her `date` brief alaninin altinda onay kutusu "Tarih henüz belli değil" ; isaretliyse tarih girisi devre disi ve bos,
   `brief_data[<key>_esnek] = true`, legacy `event_date` null; zorunlu tarih alaninda isaretliyken zorunluluk kalkar.
   Profil kartindan gelen tarih dolgusu varsa kutu bos baslar.
3. Herhangi bir `select`te `other` secilince hemen altinda zorunlu metin alani acilir: etiket "<Alan etiketi> - kısaca
   yaz", en fazla 120 karakter, `brief_data[<key>_aciklama]`. Baska secenege donulunce alan ve deger temizlenir.
4. `app/lib/brief-ozet.ts`: `<key>_aciklama` ana alanin HEMEN ARKASINDA "<Alan etiketi> açıklaması" etiketiyle;
   `<key>_esnek` -> "<Alan etiketi>: Esnek / belli değil". Sohbet seridinde ve brief gosteren diger sayfalarda (teklif
   talepleri / taleplerim) ham anahtar ("Event type aciklama") gorunmez.
5. Sunucu tarafi (brief'i kaydeden eylem): yeni anahtarlarda tip ve uzunluk siniri (metin 120, boolean).

### F) Bulgu 79, 80, 76 (a)(b)(e) - hizmet secimi, basliklar, ajans profili

1. Profesyonel profili `OfferRow` (`professional-profile.tsx` ~489-512, ~851): kendi profili degilse her paket / hizmet
   satirinda "Teklif al" dugmesi (sagda; dar ekranda alta); `IletisimButton` `packageContext` / `serviceContext` ile
   (ajans dalindaki paket kalibi). Modal basliginin altinda "Seçilen: <başlık>".
2. Ajans dali (`page.tsx` "Sunulan hizmetler" + `hizmet-secici.tsx`): eklentisi OLMAYAN hizmette de "Bu hizmet için
   teklif al" dugmesi (bugun yalniz eklenti varsa). `hizmet-secici.tsx` satir ~36 `console.log` SILINIR.
3. Teklif modalinda (`IletisimButton`) saglayicinin paket / hizmeti varsa formun basinda istege bagli secim
   "Hangi hizmet ya da paket?" (secenekler: paketler + hizmetler + "Henüz bilmiyorum"); satirdan gelindiyse secili gelir.
   `brief_data.hizmet` (baslik metni); brief-ozet etiketi "Seçilen hizmet". Sag karttaki genel "Teklif Al" de bu secimi
   gosterir.
4. Ajans (rol `agency`) brief'i: intro kategori metni yerine "Etkinliğinin detaylarını paylaş, <Ajans adı> sana uygun bir
   teklif hazırlasın."; alanlar kategori-ozel sorular degil `DEFAULT_BRIEF_FIELDS` + madde 3 secimi (+ D, E kurallari).
5. Ajans profil basligi: adin altindaki tek birincil kategori ("🎸 Müzisyen") yerine ajansin kategorileri - hizmetlerinin
   ve ekip uyelerinin rollerinden, tekrarsiz, en fazla 4, " · " ile (or. "Müzisyen · DJ · Dansçı · Akrobat"); hic yoksa
   birincil kategori. Ekmek kirintisi "Keşfet · Kurumsal hizmet sağlayıcılar · <Ad>" (orta halka Kesfet'in kurumsal
   suzgecine gider; Kesfet'in mevcut parametresini kullan).
6. Basliklar (80): varsayilan ikinci basliklar ("Çalışma modelleri", "Öne çıkan işler", "Teknik altyapı" -
   `professional-profile.tsx` ~236-238) KALKAR. Kural: buyuk baslik (h2) = kategori slogani (`section_taglines`) varsa o,
   yoksa bolumun standart adi; kucuk ust etiket (eyebrow) yalniz slogan varken. Standart adlar: "Hizmetler ve paketler",
   "Hakkımda", "Deneyim", "Eğitim ve sertifikalar", "Öne çıkanlar ve ödüller", "Yorumlar". Bolum SIRASI degismez
   (iskelet karari ayri). Ajans dalindaki "Sunulan hizmetler" -> "Hizmetler ve paketler", "Paketler" bolumu ayni karta
   birlesebilir (paketler ustte).

### G) Kabul olcutleri

- `npx tsc --noEmit`, `npx eslint app` 0 hata, `npm run build` temiz. Kural ayari degismez, kural kapatilmaz.
- Rapor: her bolum icin degisen dosya:satir, yeni / degisen ekran metinleri, A4 tablosu, C3 ornekleri, E1 listesi.
- Girissiz brief akisi (sessionStorage -> uye ol -> otomatik gonderim) yeni anahtarlari tasir; rapora nasil dogruladigini yaz.
- Smoke icin acik sunucu birakma.

### Onizleme turu (Claude yapacak; dalda Sahne 07 calistiktan sonra)

Esra Tekin / Burcu Ozkan / Sinan Polat profilleri aciliyor, ozet ciplerinde "8 yıl deneyim" gibi metin; Kesfet q=Gala
49, kongre 17; il secici (kart + brief, "Yalnızca kendi şehri" olan bir saglayici); brief'te Fark etmez / tarih esnek /
Diger aciklamasi ve sohbet seridinde etiketleri; Kerem Oz hizmet satirindan teklif; Mavi Sahne baslik kategorileri,
ajans brief'i ve hizmet secimi; ust menu / alt bilgi / panel logosu (genis, 375 px, koyu zemin).
