# Claude Code gorevi — FAZ 7a / P2-cila: portal kabugu ve belge duzeni, kalem satiri etiketleri, liste tarihi

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/19-faz7-ticari-katman.md` (bolum 9 kurallar, bolum 10 P2/P2-ek kapanisi).
ON KOSUL: P2 + P2-ek deploy'da; canli tur gecti. Bu is **yalniz gorunum**: davranis, RPC, veri akisi degismez.

---

Kashe reposundasin. Su dosyalari oku: `app/portal/layout.tsx`, `app/portal/teklif/[token]/page.tsx`, `portal-islemleri.tsx`, `portal-data.ts`;
`app/components/sections/top-nav.tsx` (logo blogu: `KasheMark` + "Kashe" yazisi), `app/components/ui/kashe-mark.tsx`, `app/components/ui/eyebrow.tsx`,
`app/components/sections/footer.tsx` (alt baglantilar), `app/components/legal-page-shell.tsx` (sade sayfa dili); `app/ajans/teklifler/page.tsx`,
`app/ajans/teklifler/[id]/teklif-editoru.tsx` (kalem satiri), `app/ajans/teklifler/teklif-data.ts`; `DESIGN.md` varsa (marka dili); `CLAUDE.md`.

Baslamadan `git status --short` temiz olmali; degilse dur ve soyle.

## Bulgular (P2-ek canli turu, 7 Ekim 2026)

1. Portal sayfasinda sol ustte yalniz "Kashe" yazisi var; logo yok, baska hicbir baglanti yok. Musteri Kashe'nin ne oldugunu gorup
   ogrenemiyor. Sayfa "belge" gibi degil, duz liste gibi duruyor.
2. Editorde "Kalem ekle" ile gelen satirda kutular dolu geliyor ("Yeni kalem", "1", "0"); hangi kutuya ne girilecegi anlasilmiyor
   (placeholder'lar deger oldugu icin gorunmuyor, sutun basligi yok).
3. Listede "Sürüm 3 · 3 Ekim 2026" yaziyor: tarih teklifin `created_at`'i; surumun yanina yazilinca surum tarihi sanilir.

## Kesin kurallar (degismez)

- Portal AYRI YUZEY: yalniz 3 anon RPC; tabloya sorgu yok, `internal` yok, `has_org_permission` yok; istemciye yalniz RPC alanlari gider.
  Jeton loglanmaz, baska URL'ye yazilmaz. `force-dynamic`, noindex, referrer no-referrer korunur. Oturum zorunlulugu yok.
- Portalda PDF/indirme/yazdirma dugmesi YOK (05 ileride). Onay akisi (ad soyad + kutu) ve revizyon notu zorunlulugu aynen kalir.
- Sapkali harf yok; UI metinleri duzgun Turkce, yorumlar ASCII. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. Portal kabugu (`app/portal/layout.tsx`)

- Ust bar: TopNav'daki logo blogunun aynisi — `KasheMark` (w-8 h-8) + "Kashe" (font-display semibold) — `/`'a baglanti (ayni sekme; referrer
  no-referrer jetonu korur). Sagda iki sade baglanti: **"Kashe nedir?"** -> `/hakkimizda`, **"Yardım"** -> `/yardim`. Mobilde de sigacak
  (metinler kucuk, `gap` dar). TopNav bileseni KULLANILMAZ (oturum/menu tasir).
- Alt bilgi: mevcut cumle ("Bu sayfa Kashe üzerinden size iletilen bir teklifi gösterir. Bağlantı kişiseldir, paylaşmayın.") + ayri satirda
  baglantilar: Gizlilik (`/gizlilik`) · KVKK (`/kvkk`) · Kullanım koşulları (`/kullanim-kosullari`) · İletişim (`mailto:kasheofficial@gmail.com`).
  Footer bileseni KULLANILMAZ (pazaryeri gezinmesi tasir).

### B. Portal belge duzeni (`page.tsx`; icerik ve alanlar ayni, yalniz dizilis)

- Icerik tek **belge karti** icinde (beyaz/paper zemin, `border border-line rounded-2xl`, ic bosluk genis). Kart ustu: solda eyebrow "TEKLİF" +
  satici adi (`seller_name`) buyuk baslik; sagda **durum rozeti** (Gönderildi / Görüntülendi / Onaylandı / Revizyon istendi / Süresi doldu /
  Kapatıldı — mevcut durum bandi renkleriyle). Altinda "Sayın <client_name>," ve teklif basligi; kucuk satir "Sürüm N · gönderim <tarih saat>".
- Etkinlik ozeti (varsa) kendi kutusunda, etiketli: Etkinlik / Tür / Tarih / Şehir / Katılımcı (yalniz dolu olanlar).
- Kalem tablosu: baslik satiri belirgin (font-mono kucuk buyuk harf, alt cizgi); satirlar ayrilmis; **mobilde** (`sm` alti) her kalem bir kutu:
  aciklama ustte, altinda "N adet · birim X TL" ve sagda toplam. Masaustunde tablo aynen.
- Toplamlar sagda hizali blok: Ara toplam / KDV (%N) / **Genel toplam** (buyuk, font-display). Gecerlilik toplamlarin altinda; gecmisse kirmizi
  "süresi doldu" etiketi aynen.
- Satici notu (`notes`) "Not" baslikli sade kutu. Durum bandi (onaylandi / revizyon / expired / declined) kartin ustunde, rozetle uyumlu.
- Islem dugmeleri (`PortalIslemleri`) kartin altinda: "Teklifi onayla" birincil (dolgulu), "Revizyon iste" ikincil (cerceveli); onay paneli
  ve revizyon alani ayni, yalniz hizalama/aralik duzeni karta uyar. `scope` yoksa bilgi metni aynen.
- Durum sayfalari (`DurumSayfasi`) ayni kabukta, ortali, bir satir aciklama + "Sorun sürerse teklifi gönderen kuruluşla iletişime geç." aynen.

### C. Editor kalem satiri (`teklif-editoru.tsx`)

- Kalem listesinin ustune **sutun basligi satiri** (yalniz `sm` ve ustu; font-mono [10px] uppercase): Açıklama · Adet · Birim fiyat (TL) · Toplam.
- `sm` altinda her girdinin ustunde kucuk etiket (Açıklama / Adet / Birim fiyat (TL)); toplam satiri "Toplam: X TL".
- Yeni eklenen kalemde birim fiyat **0 ise girdi bos gelir** (`defaultValue` '' ; placeholder "Birim fiyat (TL)" gorunur); kayit mantigi ayni
  (bos birakilirsa 0 kalir). Aciklama "Yeni kalem" gelmeye devam eder ama **yeni satir eklenince aciklama girdisine odak + metin secili**
  (kullanici dogrudan ustune yazar). Odak icin `autoFocus` yerine ref + `useEffect` (son eklenen kalem id'si) kullan; `onFocus` ile `select()`.
- `placeholder="Birim (TL)"` -> "Birim fiyat (TL)". Kaydet geri bildirimi (P2-ek) aynen.

### D. Liste tarihi (`app/ajans/teklifler/page.tsx`)

- "Sürüm N · <tarih>" satirinda tarih **gecerli surumun** tarihi olsun: gonderildiyse "Sürüm N · gönderim <sent_at tarihi>", degilse
  "Sürüm N · taslak <surum created_at tarihi>". Teklifin `created_at`'i ayri, soluk "Açıldı: <tarih>" olarak kalabilir (istege bagli, tek satir).
  Surum verisi zaten cekiliyor (`sent_at`, `created_at`); yeni sorgu ekleme.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- Portal kurallari degismedi: `grep -rn "from('" app/portal` 0; `grep -rn "rpc('" app/portal` yalniz 3 portal RPC'si;
  `grep -rn "internal\|has_org_permission\|TopNav\|Footer" app/portal` -> 0 (yorum haric); `console` satirlarinda jeton yok.
- Sapkali harf 0. Metinler duzgun Turkce.
- **Canli (Guven):** 3. baglanti (onayli lansman): logo + "Kashe" solda, "Kashe nedir?" ve "Yardım" sagda; belge karti, sagda yesil "Onaylandı"
  rozeti, etkinlik kutusu, 4 kalem, toplamlar blogu 42.000 / 8.400 / 50.400, alt bilgi baglantilari. Pencereyi daraltinca (telefon genisligi)
  kalemler kutu kutu. Iptal edilmis baglanti -> ayni kabukta durum sayfasi. Editor: bos taslak -> "Kalem ekle" -> aciklama secili geliyor, birim
  fiyat bos + placeholder, sutun basliklari var; taslagi sil. Liste: lansman "Sürüm 3 · gönderim 6 Ekim 2026", "qas" "Sürüm 1 · gönderim 3 Ekim 2026".

## Yapilmayacaklar

- Yazdir/PDF, belge seti, mesajlasma. RPC/migration. Davranis degisikligi (onay/revizyon/silme). TopNav/Footer bilesenlerini portala almak.

Rapor: degisen dosyalar, tsc/build (BUILD_ID), grep ciktilari, sapma ve nedeni. Commit ATMA.
