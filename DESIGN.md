# Kashe — Tasarım Sistemi (DESIGN.md)

> Bu dosya Kashe'nin görsel tasarım anayasasıdır. Her yeni bileşen, sayfa veya
> düzenleme bu kurallara uymalıdır. Amaç: premium, tutarlı, "yapay zeka ürünü
> gibi durmayan" (anti-slop) bir arayüz. Kashe Next.js 16 + React + Tailwind v4
> + TypeScript ile geliştirilir.

---

## 0. Felsefe

Kashe bir **etkinlik & yetenek pazaryeridir** — düğün, kurumsal etkinlik ve
özel kutlamalar için profesyoneller (DJ, fotoğrafçı, sunucu, müzisyen,
organizasyon vb.) ile müşterileri ajanssız, şeffaf fiyatla buluşturur.

Tasarım dili **"sofistike ama davetkâr"** olmalı: editöryel bir dergi kadar
özenli, ama bir pazaryeri kadar kullanışlı ve sıcak. Premium hissi
gösterişten değil; **tipografi disiplini, cömert boşluk, tutarlı detaylar ve
kararlı renk kullanımından** gelir.

### İki katman (KRİTİK)
Kashe iki farklı tür ekran içerir ve her birinin tasarım tonu farklıdır:

- **VİTRİN (brand) sayfaları** — ziyaretçiyi etkileyen, premium editöryel yüzler.
  Ana sayfa, kategori sayfaları, blog, giriş/kayıt, Kashe AI sayfaları, nasıl
  çalışır, fiyatlandırma. Burada: büyük tipografi, görsel ağırlık, sinematik
  hero, cömert boşluk, ince animasyon.
- **UYGULAMA (product) sayfaları** — her gün iş için kullanılan işlevsel ekranlar.
  İlanlarım, mesajlar, profil düzenle, teklif formları, rezervasyonlar, admin
  paneli, istatistikler, takvim. Burada: temiz, hızlı, yoğun-bilgi-dostu,
  Linear/Stripe Dashboard estetiği. **Gösteriş değil, netlik ve verimlilik.**
  Vitrin sayfalarının büyük hero'ları, dramatik boşlukları burada KULLANILMAZ.

Aynı renk paleti ve tipografi ailesi ikisinde de kullanılır, ama yoğunluk
farklıdır. Bir parfüm sitesi gibi görünen bir admin paneli yanlıştır; bir
admin paneli gibi görünen bir ana sayfa da yanlıştır.

---

## 1. Renk Paleti

> **KURAL:** Brief'lerde, kod yorumlarında ve tasarım notlarında **hex değil
> TOKEN ADI** kullanılır (`brand-ink`, `brand-accent`, `sky`). Hex yalnız bu
> tablodadır. Palet değişirse tek yer güncellenir; hex yazan her yorum
> rebrand'de sessizce yalanlanır.

Tek doğruluk kaynağı: `app/globals.css` → `@theme`. Aşağıdaki tablo onun
okunabilir hâlidir; çelişki olursa `globals.css` kazanır.

### Marka renkleri
| Token | Hex | Kullanım |
|---|---|---|
| `brand-ink` | `#040D26` | Ana lacivert. Birincil butonlar, linkler, vurgular, eyebrow. `ink` ile aynı değer. |
| `brand-ink-deep` | `#0D1F4E` | Hover dibi — lacivertte hafif **açılma** (koyulaşma değil). |
| `brand-ink-soft` | `#EAF0F8` | Açık lacivert zemin. Yumuşak arka plan, seçili durum. |
| `brand-ink-08` | `rgba(4,13,38,.08)` | Hover/zemin tint. |
| `brand-ink-12` | `rgba(4,13,38,.12)` | Seçili zemin. |
| `brand-accent` | `#FA0B96` | Pembe aksan. CTA, yıldız, küçük vurgu. Hover: **`#D50880`** (token YOK, hardcode). |
| `brand-accent-soft` | `#FDEAF5` | `brand-ink-soft`'un pembe karşılığı. Yan yana durduklarında görsel ağırlık denk olsun diye luminans eşlendi: **L 0.8632** vs `brand-ink-soft` **L 0.8659**. |
| `sky` | `#00ACE2` | Cyan — bilgi/link tonu, gradyan başı. |
| `sky-soft` | `#E5F6FC` | Cyan yumuşak zemin. |
| `sky-12` | `rgba(0,172,226,.12)` | Cyan tint. |
| `--gradient-brand` | `linear-gradient(135deg, #00ACE2, #FA0B96)` | Marka gradyanı (cyan → pembe). `bg-gradient-brand` yardımcı sınıfı. |

### Nötrler
| Token | Hex | Kullanım |
|---|---|---|
| `paper` | `#F7F9FC` | Ana sayfa zemini. **Soğuk** kırık beyaz. |
| `paper-2` | `#EDF2FA` | İkincil soğuk zemin (bölüm değişimi). |
| `card` | `#FFFFFF` | Kart/panel zemini. Saf beyaz. |
| `ink` | `#040D26` | Ana metin. Lacivert. |
| `ink-2` | `#2A3452` | İkincil koyu ton. |
| `ink-72 / 50 / 32 / 20 / 12` | `rgba(4,13,38,.72 …)` | Metin kademeleri. `ink-72` gövde-altı metin, `ink-50` meta. |
| `paper-72 / 50 / 24 / 14` | `rgba(247,249,252,…)` | Koyu zemin üstü açık metin kademeleri. |
| `line` | `rgba(4,13,38,.12)` | Kenarlık, ayırıcı. |
| `line-strong` | `rgba(4,13,38,.20)` | Belirgin kenarlık. |

### İkincil lacivert-mavi (`ink-blue`)
Marka lacivertinden (`brand-ink`) **kasıtlı olarak ayrı** ikinci bir
lacivert-mavi. İki ayrı anlamı taşır:

1. **İşlem yüzeyleri** — ilan, başvuru, davet, teklif akışı (marka vitrini değil).
2. **Ajans / kurumsal kimlik** — ajans profilleri, ekip kartları, rozetleri
   (`p/[id]` ajans dalı, `profil/ekibim`, `profil/kurumsal-ekip`).

Bu ikinci anlam yüzünden ad `listing-*` değil `ink-blue`: renk yalnız ilanlara
ait olsaydı adı onu söylerdi, ama ajans kimliği de aynı tonu kullanıyor.

| Token | Hex | Kullanım |
|---|---|---|
| `ink-blue` | `#1E3A5F` | İlan/başvuru/davet butonları ve rozetleri; ajans avatar zemini, kart kenarlığı, ekip vurguları. |
| `ink-blue-deep` | `#142745` | Hover dibi. |

> `ink-blue`, `ink`'in bir **tonu DEĞİLDİR** — ayrı bir hue (`#1E3A5F`). İki anlam
> taşır: **ajans kimliği** + **ilan/başvuru/davet yüzeyleri**. Semantik ayrım
> gerekirse takma ad kullanılır: `--color-agency-ink: var(--color-ink-blue);`
> **117 kullanım yeniden sınıflandırılmaz.**

---

## 1b. Marka İşareti

> Bu bölüm **ölçülmüş gerçeği** yazar. Ölçülemeyen şey "Boşluklar" altında
> açıkça boş bırakılmıştır — uydurulmaz.

### İşaret
**İç içe geçmiş play üçgeni.** Dış çerçeveler `ink #040D26`; iç halka
**`--gradient-brand`** (cyan `#00ACE2` → magenta `#FA0B96`); ortası **negatif**
(boş) play şekli. Zemin **saydam** — açık zeminde (`paper` / `card`) kullanılır.

**Geçerli değerler yalnızca şunlardır:** `sky #00ACE2` → `brand-accent #FA0B96`.

#### Ölçüm kaydı (TOKEN DEĞİL — kullanılmaz)

> Aşağıdaki değerler `kashe-mark.png`'den **okunmuş raster ölçümleridir**.
> PNG sıkıştırma ve kenar yumuşatma artefaktı taşırlar. **Hiçbiri token değildir,
> hiçbir yerde kullanılmaz** — yalnız işaretin `--gradient-brand`'i taşıdığını
> kanıtlamak için kayda geçirilmiştir. Kural gereği (bkz. §1 KURAL) hex yalnız
> renk tablolarında yaşar; bu blok bir *ölçüm tutanağıdır*, palet değildir.

| Ölçülen | Nerede | Karşılığı |
|---|---|---|
| `#02ABE1` · `#02ABE2` | cyan uç | `sky #00ACE2` |
| `#F90C96` · `#F80C97` · `#F30F98` | magenta uç | `brand-accent #FA0B96` |
| `#A244B1` | gradyan ortası (mor) | ara ton, token yok |

**Sonuç: uçlar `--gradient-brand` ile aynıdır** (fark ±1-3/kanal, sıkıştırma
artefaktı). Cyan sol/alt-sol tarafta, magenta sağ tepe ve dış halkanın üst
kenarında.

⚠️ **Gradyanın tam açısı ve durakları rasterden ölçülemedi** — işaret birden çok
iç içe halka taşıyor ve her biri gradyanın bir parçasını gösteriyor.
`globals.css`'teki `135deg` **doğrulanmadı, değiştirilmedi**; kesin açı için
kaynak vektör dosyası gerekir (repoda yok).

### Koyu zemin varyantı
`kashe-mark-white.png` — aynı play üçgeni, **tamamı beyaz**, gradyan yok.
Koyu zeminde (ink) kullanılır.

### Wordmark
"Kashe" **canlı HTML metnidir**, PNG'ye gömülü değil — `KasheMark` yalnız işareti
basar, yazı ayrı bir `<span>`'de durur. Kaynak dosyaya gerek kalmadan koddan
okunabildi:

| Özellik | Değer | Nerede |
|---|---|---|
| Font | `font-display` → **Gilroy** | `top-nav.tsx:110` · `footer.tsx:14` |
| Ağırlık | `font-semibold` → **600** | aynı |
| Harf aralığı | `tracking-tight` → **−0.025em** | aynı |
| Boyut | `text-xl` → **20px** | aynı |
| Renk | açık zemin `text-ink` · koyu zemin `text-paper` | aynı |
| İşaret–yazı boşluğu | `gap-2.5` → **10px** | `<a>` sarmalayıcı |
| İşaret boyutu | `w-8 h-8` → **32×32** | aynı |

### `sky` ATIL DEĞİLDİR
`sky #00ACE2` UI'da yalnız 4 yerde geçiyor, ama **`--gradient-brand`'in başlangıç
rengidir** ve marka işareti bu gradyanı taşır. Yani markanın yarısı bu renk.
UI'da tek başına az kullanılması **ayrı bir tasarım sorusudur**, atıl token değil.

### Dosya envanteri

| Dosya | Boyut | İçerik |
|---|---|---|
| `public/kashe-mark.png` | 359×471 | Play üçgeni, gradyanlı, saydam |
| `public/kashe-mark-white.png` | 359×471 | Play üçgeni, tam beyaz |
| `public/icon-192.png` · `icon-512.png` | kare | Play üçgeni |
| `public/apple-touch-icon.png` | 180×180 | Play üçgeni |
| `public/icon-maskable-512.png` | 512×512 | Play üçgeni, güvenli alan |
| `public/favicon.ico` | 16/32/48 | Play üçgeni (3 çözünürlük) |

**Yedi varlığın tamamı görüntü olarak açılıp doğrulandı** — hiçbirinde eski "k"
işareti yok.

### Boşluklar — TANIMLI DEĞİL (uydurulmayacak)
- clear-space kuralı
- minimum boyut
- varyant seti (mono / tek renk var mı?)
- wordmark kilidi (işaret–yazı mesafesi, harf aralığı)
- **ikon üretim hattı** — mevcut ikonların KAYNAK dosyası repoda **yok**;
  `docs/archive/scripts/generate-icons.mjs.disabled` o kaynak **değildi** (eski
  "k" işaretini çiziyordu)
- ton-of-voice · ikonografi · fotoğrafi yönü

Eski "k" işaretinin kılavuzu `docs/marka-kilavuzu_legacy.html`'de dondurulmuştur; içeriği **GEÇERSİZDİR** (renk de, işaret de).

---

### Çok renkli kategori sistemi
Kategoriler kimliklerini renkle kazanır. SADECE kategori ikonu arka planı +
ikon renginde kullanılır (ana paleti bozmaz, sayfaya canlılık katar). Her
kategoriye sabit bir renk atanır:

| Kategori | İkon arka planı | İkon rengi |
|---|---|---|
| DJ | `#EAE4F5` | `#6D4FB0` (mor) |
| Fotoğrafçı | `#E2EEFB` | `#2D6FB8` (mavi) |
| Sunucu | `#FFF1DC` | `#B5851F` (sarı/altın) |
| Organizasyon | `#FCEAE4` | `#FA0B96` (brand-accent) |
| Müzisyen | `#E6F6EE` | `#1F8A5F` (yeşil) |
| (diğerleri) | — | Yukarıdaki paletten döngüsel ata; tutarlı kalsın. |

### Durum renkleri
| Token | Hex | Kullanım |
|---|---|---|
| `moss` | `#1F8A5F` | Başarı, onay. Semantik — rebrand'den etkilenmez. |
| `danger` | `#DC2626` | Hata, silme, iptal. Semantik. |
| `danger-08` | `rgba(220,38,38,.08)` | Hata zemini. |

### Korunan özel renkler (token DIŞI, kasıtlı hardcode)
- **Premium/altın:** `#F4E9C8` zemin · `#D9C179` kenarlık · `#8A6D1F` metin
  (`badges.ts` → `BADGE_TONE_CLASS.premium`, `/fiyatlandirma`). Semantik.
- **Admin grafik serisi:** `#D98C3F` · `#8C6B4F` · `#4F6B8C` · `#A86B2E`
  (`admin/istatistikler`). Grafik ayırt ediciliği için — marka paleti değil.
- **`brand-accent` hover:** `#D50880`. Token'ı yok; `button.tsx`,
  `giris-form.tsx`, `p/[id]/iletisim-button.tsx` bu değeri paylaşır.

### Tipografi & şekil
- **Display + gövde:** Gilroy (`--font-display`, `--font-body`).
- **Mono / eyebrow:** Inter (`--font-mono`) — **kasıtlı** fark, Gilroy'a çekilmez.
- **Pill radius:** `9999px` (`--radius-pill`).

### Dark mode
Aydınlık ana tema. Dark mode toggle ile açılır (sonra eklenecek). Dark
değerleri ayrı bir token seti olarak tanımlanacak. Şimdilik aydınlık tema
önceliklidir.

### Renk yasakları (anti-slop)
- ❌ Mor/pembe gradyanlar (eski Kashe kimliği — terk edildi, "AI slop" işareti).
- ❌ Çok sayıda gradyan, glow/parıltı efektleri, glassmorphism.
- ❌ Rastgele/çok renk. Renk her zaman amaçlı: marka, aksan, kategori, durum.

---

## 2. Tipografi

### Fontlar
Tek kaynak: `app/layout.tsx` (`next/font/local`) + `globals.css` `@theme`.

- **Gilroy** — marka fontu. `--font-display` **ve** `--font-body`, yani hem
  başlık hem gövde. **4 woff2 dosyası / 5 bildirilen ağırlık** — `Bold.woff2`
  hem 600 hem 700'e bağlanır (ağırlıklar elle atanır, dosyaların OS/2 tablosuna
  güvenilmez): `Regular→400` · `Medium→500` · `Bold→600` · `Bold→700` ·
  `Heavy→800`.
- **Inter** — `--font-mono`. Yalnız **eyebrow / label / mono** yüzeylerde.
  Gilroy'a çekilmez; bu fark **kasıtlıdır** (editöryel ritmi Gilroy'un dışından
  gelen bir ses taşır).

Fallback zinciri: `Gilroy → Inter → system-ui → -apple-system → sans-serif`.

### YASAK fontlar (anti-slop)
- ❌ `Fraunces` ve benzeri "warm serif" — AI default refleksi, "Claude kokusu".
- ❌ Eski `Bricolage Grotesque` — terk edildi.
- ❌ Eski `Space Grotesk` — Gilroy'a geçildi, geri dönülmez.

### Ölçek (vitrin sayfaları)
| Eleman | Boyut | Ağırlık | Font | Not |
|---|---|---|---|---|
| Hero H1 | 64–76px | 600 | Gilroy (display) | `letter-spacing: -0.035em`, `line-height: 1.0` |
| Bölüm H2 | 36–44px | 600 | Gilroy (display) | `letter-spacing: -0.03em` |
| Kart başlığı H3 | 18–21px | 600 | Gilroy (display) | `letter-spacing: -0.01em` |
| Gövde | 15–18px | 400 | Gilroy (body) | `line-height: 1.6` |
| Küçük/meta | 12–14px | 400–500 | Gilroy (body) | açıklamalar, etiketler |
| Eyebrow/label | 11–12px | 600 | **Inter** (mono) | `letter-spacing: 0.2em`, `uppercase` |
| İstatistik sayı | 28–36px | 600 | Gilroy (display) | büyük rakamlar |

### Ölçek (uygulama sayfaları)
Daha küçük, yoğun. H1 28–32px, H2 20–24px, gövde 14–15px. Aynı fontlar, daha
sıkı hiyerarşi (Linear/Stripe gibi).

### Kurallar
- Başlıklarda negatif letter-spacing (sıkı, modern).
- Eyebrow/label'larda geniş letter-spacing + uppercase (editöryel), font Inter.
- Bir ekranda en fazla 2 font (Gilroy + Inter). Başka font ekleme.

---

## 3. Boşluk & Düzen

- **Maksimum genişlik:** vitrin `max-w-7xl` (1280px) içerik; hero/bölümler tam
  genişlik zemin + içerik ortalı. Uygulama sayfaları daha dar olabilir.
- **Bölüm dikey boşluk:** vitrin 64–90px (cömert). Uygulama 32–48px (sıkı).
- **Yatay padding:** 36px (masaüstü), 20–24px (mobil).
- **Kart iç padding:** 20–26px.
- **Grid boşluğu:** 14–22px.
- **Cömert boşluk premium hissin #1 kaynağıdır.** Sıkışıklıktan kaçın, ama
  uygulama sayfalarında verimlilik için daha sıkı ol.

### Köşe yuvarlama
- Kartlar/paneller: `rounded-2xl` (16px) — büyük, yumuşak.
- Butonlar/inputlar: `rounded-lg` (9–10px) veya `rounded-full` (pill).
- Büyük bölümler (koyu "nasıl çalışır", CTA): `rounded-3xl` (28px).
- Tutarlı ol — rastgele radius karışımı "slop" işaretidir.

---

## 4. Bileşenler

### Butonlar
- **Birincil:** zümrüt zemin (`--brand`), beyaz metin, `rounded-lg`,
  `font-family: Space Grotesk`, `font-weight: 600`. Hover: `--brand-deep`.
- **İkincil:** beyaz/şeffaf zemin, `--ink` metin, `--line` kenarlık. Hover:
  kenarlık zümrüt.
- **Pill nav CTA:** `--ink` zemin, beyaz metin, `rounded-full`.
- Asla mor/pembe gradyan buton kullanma.

### Kartlar (profil/ilan)
- Beyaz zemin, `--line` kenarlık, `rounded-2xl`, `overflow: hidden`.
- Hover: hafif yükselme (`translateY(-3px)`) + yumuşak gölge + kenarlık zümrüt.
- Profil kartı görseli: `aspect-ratio: 4/5` (dikey, editöryel).
- Görsel hover: hafif `scale(1.05)` zoom.
- Premium rozeti: sol üst, beyaz zemin, zümrüt/altın metin, uppercase, küçük.

### Hero (vitrin — ana sayfa)
- **Kolaj düzeni:** sol sütun (başlık + alt metin + arama çubuğu +
  istatistikler), sağ sütun (asimetrik 3 görsel kolaj + altın "★4.9 puan"
  rozeti). Bu sağ kolaj alanı **ileride 3D spiral galeri** (react-three-fiber)
  olacak — şimdilik statik görsel kolajı.
- Eyebrow → H1 (vurgulu kelime zümrüt) → alt metin → arama → istatistik.

### Arama çubuğu
- Beyaz zemin, `--line` kenarlık, `rounded-xl`, hafif gölge. İçinde input +
  zümrüt "Ara" butonu. Pazaryeri işlevselliğinin merkezi — belirgin olmalı.

### Koyu bölüm ("nasıl çalışır")
- `--brand-deep` zemin, beyaz metin, `rounded-3xl`. Numaralı adımlar
  (`01 — KEŞFET` mercan etiket + başlık + açıklama). Sayfaya ritim/kontrast katar.

### Yorumlar
- Beyaz kart, alıntı (Space Grotesk), altında avatar (baş harfler,
  `--brand-soft` zemin) + isim + bağlam.

### CTA bölümü
- Zümrüt gradyan zemin (`--brand` → `--brand-deep`), `rounded-3xl`, ortalı
  büyük başlık + alt metin + beyaz pill buton.

### Güven şeridi
- İnce, üst/alt çizgili, ortalı "binlerce etkinlikte tercih edildi" + soluk
  marka isimleri (sosyal kanıt).

---

## 5. Görseller

- Gerçek, kaliteli etkinlik fotoğrafları (DJ sahne, düğün, konser, çekim).
  Atmosferik, sıcak ışıklı tercih edilir.
- Kategori ikonları: `public/icons/<slug>.png` — kiremit `#C0361C` line-art
  tarzı (mevcut set), saydam zemin. (Not: kategori ikon RENGİ line-art kiremit;
  kategori KARTINDAKİ renkli arka plan ayrı — yukarıdaki çok renkli sistem.)
- Logo: mor-pembe gradyan "k" amblemi MEVCUTTU ama yeni kimlikte **zümrüt
  zemine** güncellenecek (logo da redesign kapsamında — eski gradyan terk).

---

## 6. Hareket / Animasyon

- **İnce ve amaçlı.** Hover geçişleri (0.2s), kart yükselmesi, görsel zoom,
  scroll-reveal (yumuşak fade+yukarı). Ağır/dikkat dağıtan animasyon yok.
- Vitrin sayfalarında biraz daha cömert (scroll reveal, parallax dokunuşları).
- Uygulama sayfalarında minimal (sadece işlevsel geçişler).
- **3D spiral hero** (en son aşama): react-three-fiber + GLSL, ana sayfa
  hero'sunun sağ alanında. Mobilde performans için hafifletilmiş/statik
  fallback. LCP'yi bloklamamalı (lazy/idle yükleme).
- Emil Kowalski (animations.dev) prensipleri referans: doğal easing, amaca
  hizmet eden hareket.

---

## 7. Anti-Slop Kontrol Listesi

Her ekran için kontrol et — bunlar "AI ürünü gibi durma" işaretleridir:

- ❌ Mor/pembe gradyan (her yerde). ✅ Zümrüt + mercan + nötr.
- ❌ Fraunces / warm serif başlık. ✅ Space Grotesk.
- ❌ Glassmorphism, glow, gereksiz gölge. ✅ Net, düz, kararlı yüzeyler.
- ❌ Her kart aynı tek-tip generic düzen. ✅ Editöryel ritim, asimetri (vitrin).
- ❌ Tutarsız boşluk/radius. ✅ Sistemden gelen tutarlı değerler.
- ❌ Zayıf tipografi hiyerarşisi. ✅ Net boyut/ağırlık farkları.
- ❌ Emoji'lerle doldurulmuş başlıklar. ✅ Ölçülü, gerektiğinde.
- ❌ "Lorem ipsum" hissi veren içerik. ✅ Gerçek, Türkçe, bağlama uygun.
- ❌ Merkeze yığılmış, dar içerik. ✅ Cömert, nefes alan düzen (vitrin).

---

## 8. Teknik Notlar

- **Tailwind v4** kullanılıyor. Renkler CSS değişkeni olarak tanımlanmalı
  (`@theme` veya `:root`), Tailwind utility'leriyle eşlenmeli. Mevcut token
  isimleri (terracotta/ember/plum) YENİ değerlere güncellenmeli VEYA yeni
  semantik isimler (brand/accent) eklenmeli — kod tabanı genelinde tutarlı.
- **Mevcut kod tabanı** eski mor-pembe token'ları her yerde kullanıyor
  (memory: terracotta=#9333EA vb.). Redesign bunları zümrüt sistemine
  taşımalı — global token değişimi + bileşen bazlı düzeltme.
- Mevcut işlevsellik (auth, ödeme, AI, push, admin, formlar) KORUNMALI —
  bu bir görsel yenilemedir, sıfırdan yazım değil.
- Fontlar `next/font/google` ile yüklenmeli (Space Grotesk + Inter).

---

## Kasıtlı palet istisnaları

Aşağıdaki dosyalar **bilerek** eski palet hex'lerini taşır. Sonraki palet
denetimi bu listenin üzerinden diff alır: burada olmayan bir sonuç çıkarsa
**gerçek bulgudur**, temizlenmelidir.

Denetlenen eski hex listesi:
`1F5C4A` · `143D31` · `E2674A` · `C7522F` · `FBF8F4` · `FAF7F0` · `EEF3F0`
`1A120E` · `6B5F58` · `5C665F` · `3F6B47` · `1D2723` · `F3EEE3`

| Yol | Adet | Neden kasıtlı |
|---|---|---|
| `docs/design/profil-mockup-v2.html` | 291 | Tarihsel referans — o tarihteki tasarımın kaydı. |
| `docs/marka-kilavuzu_legacy.html` | 70 | Dondurulmuş eski marka kılavuzu; görünür uyarı bandı taşır. |
| `docs/archive/logo-k-mark/*.svg` (4) | 8 | Terk edilmiş "k" işareti — orijinal renkleriyle. |
| `docs/archive/hero-secenekleri/*.html` (12) | 48 | Eski hero denemeleri; public/'ten çıkarıldı (canlı URL veriyorlardı). |
| `public/*_legacy.png` (4) | — | Rebrand öncesi ikon yedekleri. ⚠️ public/'te durmaları YANLIŞ KALIP — docs/archive'a taşınmalı (backlog). |

### Token dışı ama güncel (eski palet DEĞİL)
Bunlar denetim listesinde yok, hardcode olmaları kasıtlı:
- **Premium/altın:** `#F4E9C8` · `#D9C179` · `#8A6D1F` (`badges.ts`, `/fiyatlandirma`)
- **Admin grafik serisi:** `#D98C3F` · `#8C6B4F` · `#4F6B8C` · `#A86B2E`
- **`brand-accent` hover:** `#D50880`
- **Kategori ikon pastelleri:** yukarıdaki "Çok renkli kategori sistemi" tablosu

### Denetim kuralı (kalıcı)

> **"N dönüştürüldü" KANIT DEĞİLDİR. Kanıt: kalan 0 grep'idir.**
>
> Hedefli hex listesi taban çizgisi vermez — yalnız *aradığın* şeyi bulur.
> Gerçek envanter, **tüm hardcode hex'lerin sınıflandırılmasıyla** kurulur:
> (A) `@theme` karşılığı var → sınıfa çevrilebilir · (B) kasıtlı istisna ·
> (C) sınıflandırılamadı → şüpheli.
>
> Aynı disiplin görsel varlıklara da uygulanır: **renk örneklemesi yeterli
> değildir, dosya görüntü olarak açılır.** Baskın-renk ölçümü bir kez eski
> logonun hâlâ yerinde olduğunu düşündürdü; dosyaya bakınca işaretin tamamen
> değiştiği görüldü.
>
> **Hex envanteri turun ORTASINDA alınmaz.** Taban çizgisi, tüm değişiklikler
> bittikten sonra SON ağaç üzerinde alınır — aksi hâlde aynı turda silinen değer
> sayımda kalır.
>
> **Envanter yorumları AYIKLAR.** Kod yorumlarında geçen hex (`// eski #XXXXXX`,
> `/* … */` blokları) gerçek kullanım değildir; ayıklanmazsa sayım şişer ve taban
> çizgisi güvenilmez olur. Satır bazlı `//`/`*` filtresi yetmez — çok satırlı
> `/* … */` blokları gerçekten çıkarılmalıdır.
>
> **Envanter betiği repoda tutulur** (`scripts/`), aksi hâlde her denetim onu
> yeniden yazar ve aynı hatayı tekrarlar.

**Hex envanteri taban çizgisi:** 2026-07-28 · `app/` + `supabase/` (yorumlar ayıklanmış)
**198 hardcode kullanım / 50 benzersiz değer** —
A: 105 (16 değer) · B: 79 (23 değer) · C: 14 (11 değer)
(+yanlış pozitifler hariç: `&#039;` HTML entity, yorum içi hex'ler)
