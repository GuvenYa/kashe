# Ana sayfa yenileme — v3 EK (canli geri bildirim turu, 9 Ekim 2026)

Kaynak: `docs/content/anasayfa-yenileme-brief-v3.md` (uygulandi: commit `830309f`). Bu belge, canli sayfa
turunda (onizleme kapisi ile) verilen geri bildirimi Claude Code gorevine cevirir. Brief v3'un
"Degismeyecekler" listesi AYNEN gecerlidir; burada yalniz asagidaki 6 nokta degisir.

Olcum notu (nav): 1920 px genislikte canli sayfada olculdu — `max-w-7xl` + `px-12` ile orta nav'a kalan
alan **874 px**; 9 baglantinin tek satir ihtiyaci (gap-7, tracking 0.16em) **894 px** → "Kashe AI" ve
"Nasil calisir" iki satira kiriliyor. `gap-5` + `whitespace-nowrap` ile ihtiyac **830 px** (sigar).
1024 px'te (lg) kalan alan ~618 px → 9 baglanti HICBIR ayarla sigmaz; 4 sayfa-ici capa xl'den itibaren
gosterilir (asagida).

## Kararlar (Guven'in geri bildirimi + bu belgeyle alinan kararlar)

1. **Kashe AI bolumu**: "Yapay zeka" yerine **"Kashe"** ozne olur ("Kashe sana yardim etsin"); "Kashe"
   sozcugu farkli gorunur (brand-accent + yaninda marka isareti). Bolum **koyu lacivert bant** olur
   (sayfadaki en dikkat cekici bolumlerden biri; bugun duz beyaz kart).
2. **Ajanslar bolumu**: "Gelistiriliyor — 2027 pilot programi" blogu ve "Erken erisim / Bugun"
   etiketleri KALKAR. Liste, bugun uretimde calisan 5 yetenegi simdiki zamanla anlatir. Henuz
   olmayan ozellikler (operasyon asistani, marj kisitli alternatifler) ana sayfaya YAZILMAZ —
   "yakinda" etiketi de yok (TUBITAK basvurusu ayri belge; ana sayfa urunu oldugu gibi anlatir).
3. **Ajanslar CTA**: "Tasarim ortagi olun" KALKAR. Birincil dugme role gore: ajans paneli olan
   kullaniciya **"Ajans paneline gidin →"** (`/ajans/teklifler`), digerlerine **"Ajans hesabi acin →"**
   (`/uye-ol/ajans`). Ikincil dugme **"Demo isteyin"** (`mailto:info@kashe.net?subject=Ajans%20demo`).
4. **Ornek kartlar**: "↑ Ornek bir ajans teklif kartı" alt yazisi KALKAR; tutarlilik icin Kurumsal
   bolumundeki "↑ Ornek bir kurumsal ilan karti" alt yazisi da KALKAR (ORNEK rozeti yeterli; rozet
   KALIR). Ajans karti koyu lacivert + marka renkleriyle yeniden tasarlanir; FIYAT YOK.
5. **Footer slogani**: "seffaf fiyat" ibaresi kalkar; yeni metin hero H1'i yankilar (asagida).
6. **Ust nav**: tek satir; `whitespace-nowrap` + anonim kullanicida `gap-5` + 4 capa `xl`'den itibaren.

Tasarim sinirlari (DESIGN.md "Renk yasaklari"): mor/pembe gradyan buton YOK; cok sayida gradyan,
glow, glassmorphism YOK. `--gradient-brand` sayfada zaten FooterCTA kartinda kullaniliyor; bu gorevde
gradyan yalniz **tek ince cizgi** (3 px) olarak kullanilabilir, baska yerde kullanilmaz. Koyu zeminde
`<em>` gorunmez (brand-ink) → `<span className="text-brand-accent">` kullanilir (footer-cta ile ayni ders).

=== CLAUDE CODE GOREVI ===

Kashe reposundasin. Once `git status` (temiz olmali; `.claude/` izlenmeyen klasor normal). Su dosyalari oku:
`app/components/sections/kashe-ai-section.tsx`, `app/components/sections/ajanslar-section.tsx`,
`app/components/sections/b2b-section.tsx` (koyu ornek kart deseni: `bg-ink-2 border-paper-14`, `MockupRow`,
`OrnekRozeti ton="koyu"`), `app/components/sections/footer-cta.tsx` (koyu zeminde baslik/dugme deseni),
`app/components/sections/footer.tsx`, `app/components/sections/top-nav.tsx`, `app/components/sections/mobile-nav.tsx`,
`app/lib/nav-links.ts`, `app/lib/org-context.ts` (`hasProposalAccess`), `app/page.tsx`, `app/globals.css`
(token'lar: `ink #040D26`, `ink-2`, `paper-*`, `brand-accent #FA0B96`, `sky #00ACE2`, `--gradient-brand`,
`.bg-gradient-brand`), `DESIGN.md` → "Renk yasaklari", `CLAUDE.md`.

Brief v3'un "Degismeyecekler" listesi gecerli: Hero H1, One cikanlar, kayan serit, kategori grid mantigi,
guvenlik kartlari, yorumlar, komisyon cumleleri, SSS, CTA metinleri DOKUNULMAZ. Fiyat, gercek marka/kisi adi,
uydurma sayac YOK. Ajans bolumunde FIYAT YOK.

## 1) Kashe AI bolumu — `kashe-ai-section.tsx` (yeniden tasarim)

Dis bolum ayni kalir (`bg-paper px-6 md:px-12 py-16 md:py-20`, `max-w-7xl`). Ic kart **koyu bant** olur:

- Kart: `relative overflow-hidden rounded-3xl bg-ink text-paper p-8 md:p-12 lg:p-14`. Kartin ust kenarinda
  tek ince gradyan cizgi: `<span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-brand" />`.
  Baska gradyan, glow, blur YOK.
- Eyebrow: `Sparkles` yerine marka isareti: `<KasheMark variant="dark" title="" className="w-5 h-5" />` +
  `Kashe AI` (`font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-paper-72`).
- H2 (`font-display font-semibold text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.03em] text-paper max-w-2xl`):
  `Ne aradığını bilmiyor musun?` + satir sonu (`<br className="hidden md:block" />`) +
  `<span className="text-brand-accent">Kashe</span> sana yardım etsin.`
  "Kashe" sozcugu brand-accent; istenirse onune `KasheMark variant="dark"` 0.9em boyunda inline isaret
  (`inline-block align-[-0.1em] mr-2`) konur — tek yerde, abartisiz.
- Giris metni (`text-base md:text-lg text-paper-72 leading-[1.6] max-w-xl`):
  `Etkinliğini kendi cümlelerinle anlat: tür, tarih, şehir, katılımcı sayısı. Kashe ihtiyaç duyduğun rolleri
  çıkarır; eksik bilgiyi uydurmak yerine sorar. Ya da nasıl biri aradığını söyle, sana en uygun profilleri
  gerekçesiyle bulsun.`
- Iki buyuk kart (`grid gap-5 md:grid-cols-2`), her biri tamami `<Link>`:
  `group block bg-ink-2 border border-paper-14 rounded-2xl p-6 md:p-7 hover:border-brand-accent transition-colors`.
  Icerik sirasi:
  1. Ikon kutusu `w-11 h-11 rounded-xl bg-brand-accent/15 text-brand-accent` (lucide `Calendar` / `Users`).
  2. Baslik `font-display font-semibold text-xl text-paper` + bir satir aciklama `text-sm text-paper-72`.
  3. **Ornek diyalog blogu** (bolumu "sade" olmaktan cikaran parca): ustte `font-mono text-[10px] uppercase
     tracking-[0.16em] text-paper-50` etiket `Örnek`; altinda tirnakli girdi (`text-sm text-paper italic
     border-l-2 border-brand-accent pl-3`); altinda cikti **cipleri** (`flex flex-wrap gap-2`, cip:
     `font-body text-xs text-paper bg-paper-14 rounded-full px-2.5 py-1`).
     - Etkinlik Planlama (`/etkinlik-sihirbazi`): girdi `"250 kişilik bayi toplantısı, 14 Mayıs, Ankara"`;
       cipler `1 sunucu` · `4 hostes` · `1 DJ` · `Teknik ekip` · `Eksik: başlangıç saati?`
       (son cip sky tonunda: `bg-sky/15 text-sky` — "uydurmaz, sorar" davranisini gosterir).
     - Profesyonel Bulma (`/pro-bul`): girdi `"Düğünde caz repertuvarı olan bir şarkıcı arıyorum, İstanbul"`;
       cipler `Şarkıcı` · `İstanbul` · `Caz repertuvarı` · `Gerekçeli 5 öneri`.
     Ornekler kurgusaldir; sayi/fiyat/marka icermez (butce yazilmaz).
  4. Alt satir baglanti metni: `Sihirbazı aç →` / `Profesyonel bul →` (`text-sm font-medium text-brand-accent
     group-hover:underline`).
- Sinir notu metni DEGISMEZ, rengi `text-paper-50`:
  `Kashe AI öneri üretir; fiyat belirlemez, rezervasyon yapmaz. Son karar her zaman sende.`
- Mobil: kartlar alt alta; cipler sarilir; H2 `text-3xl`; `kashe-tap` sinifi Link'lerde kalir.
- Erisilebilirlik: koyu zeminde `paper-72` ve `brand-accent` metin kontrasti 4.5:1 ustunde (brand-accent
  #FA0B96 / ink #040D26 ≈ 5.9:1 — OK). Ikinci bir gradyan/parilti eklenmez.

## 2) Ajanslar bolumu — `ajanslar-section.tsx`

### 2a) Metin ve liste
- Eyebrow, H2, giris paragrafi KALIR.
- `BUGUN` + `GELISTIRILIYOR` dizileri ve "Erken erişim / Bugün / Geliştiriliyor / 2027 pilot programı"
  etiketleri KALKAR. Yerine tek dizi `YETENEKLER: Madde[]` (5 madde, simdiki zaman, hepsi bugun uretimde):
  1. `Ekip ve profil` — `Ekibinizi davet edin; kabul eden her üyenin profilinde ajansınız görünür.`
  2. `Özel yetenek havuzu` — `Kashe hesabı olmayan profesyonellerinizi ve iç ücretlerini kaydedin. Havuz yalnız size görünür, pazaryerine açılmaz.`
  3. `Teklif, iç maliyet ve marj` — `Teklifinizi sürümleyin. İç maliyet ve marjınız yalnız ekibinize görünür; müşteri yalnız teklifi görür.`
  4. `Müşteri onayı tek bağlantıyla` — `Müşteriniz teklifi bağlantıdan inceler, onaylar ya da revizyon ister. Onaylanan teklif rezervasyona dönüşür.`
  5. `Kurumsal teklif taleplerine yanıt` — `Kurumların açtığı taleplere davetle katılın, yanıtınızı aynı teklif editöründen gönderin.`
  `MaddeListesi` `soluk` parametresi kaldirilir (artik tek ton). Dosya basi yorumundaki "Gelistiriliyor"
  aciklamasi guncellenir (ASCII).

### 2b) Dugmeler (role gore)
- `AjanslarSection` bir prop alir: `ajansPaneli: boolean`. `app/page.tsx` bunu hesaplar:
  `const user = await getCachedUser(); const ajansPaneli = !!user && (await hasProposalAccess());`
  (`hasProposalAccess` top-nav'da zaten kullaniliyor; `proposals.view` yetkili ajans kurulusu demek).
- Birincil (`Button variant="primary" size="lg"`):
  - `ajansPaneli` → `Ajans paneline gidin →` → `/ajans/teklifler`
  - degilse → `Ajans hesabı açın →` → `/uye-ol/ajans`
- Ikincil (`Button variant="secondary" size="lg" className="border-ink"`): `Demo isteyin` →
  `mailto:info@kashe.net?subject=Ajans%20demo`.
- Girissiz kullanici icin dugmelerin altina kucuk satir: `Ajans hesabınız var mı? ` +
  `<a href="/giris?redirect=/ajans/teklifler" className="underline text-ink">Giriş yapın</a>`
  (`text-sm text-ink-50`; `/giris` `redirect` parametresini `sanitizeReturnPath` ile zaten destekliyor).
  `ajansPaneli` true iken bu satir gosterilmez.

### 2c) Ornek teklif karti (sag sutun) — yeniden tasarim, FIYAT YOK
- Alt yazi `↑ Örnek bir ajans teklif kartı` ve onu tasiyan `<p>` KALKAR.
- Kart koyu lacivert: `relative overflow-hidden bg-ink border border-paper-14 rounded-2xl p-6 md:p-8
  shadow-[0_24px_60px_-28px_rgba(4,13,38,0.45)]`; ust kenarda tek ince cizgi `h-[3px] bg-gradient-brand`
  (Kashe AI kartıyla ayni imza; sayfada baska gradyan eklenmez). Kurumsal bolumun karti `bg-ink-2` ve
  `paper-2` zeminde; bu kart `bg-ink` ve `paper` zeminde → iki kart yan yana gelmedigi icin ayrim yeterli.
- Baslik satiri: eyebrow `Ajans paneli · Teklif` (`font-mono text-[9px] uppercase tracking-[0.2em] text-sky`),
  baslik `Teklif · Kurumsal yıl sonu daveti` (`font-display text-base text-paper`), sagda `<OrnekRozeti ton="koyu" />`.
- Satirlar (`KartSatiri` koyu zemine uyarlanir: etiket `text-paper-50`, deger `text-paper`):
  `Ekip` → `1 sunucu · 1 DJ · 4 hostes`; `Kaynak` → `3 özel havuz · 3 pazaryeri`; `Sürüm` → `2 · müşteriye gönderildi`.
- En altta **durum seridi** (fiyat satirinin yerine; bolumun ozu "musteri onayi"): 3 adim yan yana,
  `grid grid-cols-3 gap-2 pt-4 border-t border-paper-14`; her adim ustte ince cubuk (`h-1 rounded-full`) +
  altta `font-mono text-[9px] uppercase tracking-[0.14em]` etiket:
  `Taslak` (cubuk `bg-paper-50`, etiket `text-paper-50`) · `Gönderildi` (cubuk `bg-sky`, etiket `text-paper-72`) ·
  `Müşteri onayı` (cubuk `bg-brand-accent`, etiket `text-brand-accent`, yaninda kucuk nokta `animate-pulse`
  `w-1.5 h-1.5 rounded-full bg-brand-accent` — tek hareketli oge, `motion-reduce:animate-none`).
- Kartin ustune/altina aciklama yazisi eklenmez. Rakam yalniz kisi sayilari; para birimi, marka, kisi adi YOK.

### 2d) Kurumsal bolum — `b2b-section.tsx`
- Yalniz `↑ Örnek bir kurumsal ilan kartı` alt yazisi (ve `<p>`'si) KALKAR. Kartin kendisi ve ORNEK rozeti
  DOKUNULMAZ.

## 3) Footer slogani — `footer.tsx` (satir ~19-20)
Eski: `Türkiye'nin etkinlik ve yetenek pazaryeri. Doğru profesyoneli, ekibi ya da organizasyon firmasını şeffaf fiyatla bul.`
Yeni: `Türkiye'nin yetenek sahnesi. Etkinliğin için doğru profesyonel, ekip ve organizasyon firması — tek yerde.`
(`İstanbul, Türkiye` satiri kalir. "seffaf fiyat" footer'da gecmez; hero alt metnindeki "şeffaf fiyatla"
DOKUNULMAZ — Degismeyecekler.)

## 4) Ust nav tek satir — `top-nav.tsx` + `nav-links.ts` (+ `mobile-nav.tsx` dokunulmaz)
- `navLinkClass` sonuna ` whitespace-nowrap` eklenir (Kashe AI baglantisi `inline-flex items-center gap-1.5`
  ile birlikte tek satir kalir).
- Orta nav sarmalayicisi: `hidden lg:flex items-center ` + (`user ? "gap-7" : "gap-5"`) — anonim kullanicida
  9 baglanti var, girisli kullanicida 5.
- `nav-links.ts`: `NavLink` tipine `xlOnly?: boolean` eklenir; `MARKETING_LINKS` icinde `/#hizmetler`,
  `/#nasil-calisir`, `/#kurumsal`, `/#ajanslar` → `xlOnly: true` (`/fiyatlandirma` degil). Yorum: "1024-1279
  px arasinda orta nav'a sigmiyor (olculdu: 874 px alan / 894 px ihtiyac 1920'de; lg'de ~618 px); capalar
  sayfa icinde kaydirmayla zaten ulasilir."
- `top-nav.tsx` masaustu dongusunde: `link.xlOnly ? navLinkClass + " hidden xl:inline-flex" : navLinkClass`.
  `mobile-nav.tsx` bayragi YOK SAYAR (hamburger hepsini gosterir; parite kurali: liste tek kaynak kalir).
- Hedef: 1024, 1280, 1440, 1920 px'te orta nav tek satir; hicbir baglanti `h` 16 px'i asmaz
  (`getBoundingClientRect().height`), yatay tasma yok.

## 5) Kucuk duzeltmeler (ayni commit)
- `app/fiyatlandirma/page.tsx` → `plus` planinda `'Sponsorlu alanda öne çıkma (organik sıralama değişmez)'`
  satiri Premium'da zaten var ve Plus `'Premium'un tüm özellikleri'` ile basliyor → Plus'tan bu satir SILINIR
  (3 madde kalir). Baska plan metni degismez.
- `app/hakkimizda/page.tsx` → `kurumsal` bolumunun iki paragrafi sen/siz karisik ("davet et… takip edin…
  yürütsen… listeleyebilirsin"). Tamami **siz** diline cevrilir (anlam ayni): "Kurumsal hesabınızla ekip
  arkadaşlarınızı Kashe'ye davet edin. … Aynı anda birden çok etkinlik yürütseniz de … Kurumsal davet deneyimi
  olan profesyonelleri etkinlik türü filtresiyle ayrıca listeleyebilirsiniz." Diger bolumler DOKUNULMAZ.

## Dogrulama
- `npx tsc --noEmit` bos; `npm run build` → route tablosu + hata yok + `.next/BUILD_ID` degeri rapora.
- `grep -rn "Tasarım ortağı\|pilot programı\|Geliştiriliyor\|Örnek bir \|Yapay zeka sana\|şeffaf fiyatla bul" app/components/sections` → 0.
- `grep -rn "Yapay zeka" app/components/sections/kashe-ai-section.tsx` → 0; `grep -c "text-brand-accent" app/components/sections/kashe-ai-section.tsx` ≥ 2.
- `grep -rn "₺\|TL\b" app/components/sections/ajanslar-section.tsx app/components/sections/kashe-ai-section.tsx` → 0.
- `grep -n "gradient" app/components/sections/kashe-ai-section.tsx app/components/sections/ajanslar-section.tsx` → her dosyada yalniz 1 satir (`bg-gradient-brand` ince cizgi).
- `grep -n "xlOnly" app/lib/nav-links.ts app/components/sections/top-nav.tsx app/components/sections/mobile-nav.tsx` → ilk ikisinde var, mobile-nav'da YOK.
- `grep -n "whitespace-nowrap" app/components/sections/top-nav.tsx` → 1.
- Sapkali harf: `LC_ALL=C.UTF-8 grep -rc '[âîûÂÎÛ]' <degisen dosyalar>` → 0. Yorumlar ASCII; UI metni duzgun Turkce.
- Degismeyecekler kontrolu: `git diff --stat` yalniz su dosyalari gostermeli: `kashe-ai-section.tsx`,
  `ajanslar-section.tsx`, `b2b-section.tsx`, `footer.tsx`, `top-nav.tsx`, `nav-links.ts`, `page.tsx`,
  `fiyatlandirma/page.tsx`, `hakkimizda/page.tsx`. Baska dosya degistiyse rapora yaz ve gerekcelendir.

## Yapilmayacaklar
Hero, One cikanlar, kayan serit, kategori grid, Nasil calisir, guvenlik, yorumlar, SSS, FooterCTA'ya DOKUNMA.
Mobil nav bilesenine DOKUNMA. Yeni gradyan, glow, blur, glassmorphism EKLEME. Fiyat, sayac, marka/kisi adi EKLEME.
Portal (`app/portal/**`) ve FAZ 7 dosyalarina DOKUNMA. **Commit ATMA** — Guven commit atar.

## Rapor
Degisen dosyalar (sayi), her bolum icin 1-2 satir ne yapildi, tsc/build (BUILD_ID), yukaridaki grep sonuclari,
sapma varsa gerekcesiyle. Commit ATMA.
