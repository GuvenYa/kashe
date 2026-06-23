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

### Marka renkleri
| Token | Hex | Kullanım |
|---|---|---|
| `--brand` | `#1F5C4A` | Ana zümrüt. Birincil butonlar, linkler, vurgular, logo. |
| `--brand-deep` | `#143D31` | Koyu zümrüt. Koyu bölüm zeminleri ("nasıl çalışır"), hover, gradyan. |
| `--brand-soft` | `#E9F1ED` | Açık zümrüt. Yumuşak arka planlar, avatar zeminleri, seçili durumlar. |
| `--accent` | `#E2674A` | Mercan. İkincil aksan — yıldızlar, küçük vurgular, "01—" etiketleri, bazı butonlar. Dozunda kullan (sıcaklık katar, baskın olmaz). |

### Nötrler
| Token | Hex | Kullanım |
|---|---|---|
| `--bg` | `#FBF8F4` | Ana sayfa zemini. Sıcak kırık beyaz (saf beyaz değil). |
| `--bg-2` | `#FBEEE8` | İkincil sıcak zemin (bölüm değişimi için, hafif şeftali). |
| `--card` | `#FFFFFF` | Kart/panel zeminleri. Saf beyaz. |
| `--ink` | `#16140F` | Ana metin. Neredeyse siyah, hafif sıcak. |
| `--ink-soft` | `#6E665C` | İkincil metin, açıklamalar, meta bilgi. |
| `--line` | `#ECE3D8` | Kenarlıklar, ayırıcılar. Sıcak açık ton. |

### Çok renkli kategori sistemi
Kategoriler kimliklerini renkle kazanır. SADECE kategori ikonu arka planı +
ikon renginde kullanılır (ana paleti bozmaz, sayfaya canlılık katar). Her
kategoriye sabit bir renk atanır:

| Kategori | İkon arka planı | İkon rengi |
|---|---|---|
| DJ | `#EAE4F5` | `#6D4FB0` (mor) |
| Fotoğrafçı | `#E2EEFB` | `#2D6FB8` (mavi) |
| Sunucu | `#FFF1DC` | `#B5851F` (sarı/altın) |
| Organizasyon | `#FCEAE4` | `#E2674A` (mercan) |
| Müzisyen | `#E6F6EE` | `#1F8A5F` (yeşil) |
| (diğerleri) | — | Yukarıdaki paletten döngüsel ata; tutarlı kalsın. |

### Durum renkleri
| Token | Hex | Kullanım |
|---|---|---|
| `--success` | `#1F8A5F` | Başarı, onay. |
| `--danger` | `#DC2626` | Hata, silme, iptal. |
| `--warning` | `#B5851F` | Uyarı, beklemede. |
| `--gold` | `#C7A04E` | Premium rozeti, puan vurgusu (mevcut premium kimliğiyle uyumlu). |

### Korunan özel renkler (mevcut sistemden)
- **Ajans:** lacivert tonları (ajans profilleri/rozetleri) — korunur.
- **Premium:** altın `#C7A04E` — korunur.

### Dark mode
Aydınlık ana tema. Dark mode toggle ile açılır (sonra eklenecek). Dark
değerleri ayrı bir token seti olarak tanımlanacak (zümrüt korunur, zeminler
koyulaşır). Şimdilik aydınlık tema önceliklidir.

### Renk yasakları (anti-slop)
- ❌ Mor/pembe gradyanlar (eski Kashe kimliği — terk edildi, "AI slop" işareti).
- ❌ Çok sayıda gradyan, glow/parıltı efektleri, glassmorphism.
- ❌ Rastgele/çok renk. Renk her zaman amaçlı: marka, aksan, kategori, durum.

---

## 2. Tipografi

### Fontlar
- **Başlıklar:** `Space Grotesk` (weights: 400, 500, 600, 700). Karakterli,
  modern grotesk. Kashe'nin sesi.
- **Gövde:** `Inter` (weights: 400, 500, 600). Net, okunaklı, nötr.

### YASAK fontlar (anti-slop)
- ❌ `Fraunces` ve benzeri "warm serif" — AI default refleksi, "Claude kokusu".
- ❌ Eski `Bricolage Grotesque` — terk edildi.

### Ölçek (vitrin sayfaları)
| Eleman | Boyut | Ağırlık | Font | Not |
|---|---|---|---|---|
| Hero H1 | 64–76px | 600 | Space Grotesk | `letter-spacing: -0.035em`, `line-height: 1.0` |
| Bölüm H2 | 36–44px | 600 | Space Grotesk | `letter-spacing: -0.03em` |
| Kart başlığı H3 | 18–21px | 600 | Space Grotesk | `letter-spacing: -0.01em` |
| Gövde | 15–18px | 400 | Inter | `line-height: 1.6` |
| Küçük/meta | 12–14px | 400–500 | Inter | açıklamalar, etiketler |
| Eyebrow/label | 11–12px | 600 | Inter | `letter-spacing: 0.2em`, `text-transform: uppercase` |
| İstatistik sayı | 28–36px | 600 | Space Grotesk | büyük rakamlar |

### Ölçek (uygulama sayfaları)
Daha küçük, yoğun. H1 28–32px, H2 20–24px, gövde 14–15px. Aynı fontlar, daha
sıkı hiyerarşi (Linear/Stripe gibi).

### Kurallar
- Başlıklarda negatif letter-spacing (sıkı, modern).
- Eyebrow/label'larda geniş letter-spacing + uppercase (editöryel).
- Bir ekranda en fazla 2 font (Space Grotesk + Inter). Başka font ekleme.

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
