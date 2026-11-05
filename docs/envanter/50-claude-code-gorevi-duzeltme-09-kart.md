# 50 - Claude Code gorevi: Duzeltme 09 - Kesfet kart tasarimi (bulgu 66 a/c/e) + kucukler

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/sahne/bulgular.md` #66 (Fahri), `docs/envanter/38-faz10-temizlik.md` 10d
"kalan kucukler". Kararlar Guven (5 Kasim): foto orani 4:5 her yerde; masaustunde KISMI hover paneli (fotograf hep gorunur);
ust menu "Saglayicilar". `main`'den acilan `duzeltme-09` dalinda. Veritabani DEGISMEZ.
Kullanim: Claude Code'a "`docs/envanter/50-claude-code-gorevi-duzeltme-09-kart.md` dosyasini oku, "---" cizgisinin altindaki
gorevi uygula" denir.

---

## Gorev

A) Kesfet kartini (`app/kesfet/profile-card.tsx`) Fahri'nin uc bulgusuna gore yeniden duzenle: fotograf one cikar, metin azalir,
kart dugmesi profile goturdugunu soyler. B) Uc kucuk is. Turkce arayuz metinleri, ASCII kod yorumlari, yeni dosyalarda sapkali
harf yok. Commit ATMA.

### A) Kart tasarimi (bulgu 66 a / c / e)

Bugun: masaustu `default` varyant 4:3 fotograf; hover'da BEYAZ PANEL fotografin tamamini kapatir (ad, meta, tanitim, 3 etiket,
yorum alintisi, "Teklif Al", havuz / kisa liste kisa yolu). Mobil: 16:10 fotograf + beyaz govde (meta, fiyat rozeti, tanitim,
alinti, etiketler, "Teklif Al"). `compact` (ana sayfa) 4:5 foto-hero, panel yok. Fahri: (a) fotograf geri planda, metin cok;
(c) profil gorulmeden "Teklif Al"; (e) daha dikey fotograf.

Hedef - TEK kart dili, uc yuzeyde:

1. **Oran 4:5 her yerde** (`aspect-[4/5]`): masaustu default, mobil default, compact (zaten). `yogun` prop'u ve aciklamasi
   kaldirilir (cagiranlar varsa prop'u da sil). `CoverMedia` degismez (object-cover + bas harf yedegi).
2. **Fotograf hep gorunur.** Masaustu default: fotograf + ust cipler (kategori / kurumsal, premium, favori kalbi) + ALT SERIT
   (gradient ustunde): ad (2 satira kadar) + dogrulanmis + `MetaRow` (puan / is / sehir) + alt rozet (fiyat "N TL'den" ya da
   "Kurumsal profil"). Bugunku alt serit zaten bu; KALIR.
3. **Kismi hover paneli (masaustu):** fare uzerindeyken alt serit buyur, fotografin EN FAZLA %45'ini kaplar (ornegin
   `max-h-[45%]`), geri kalani gorunur kalir. Panel icerigi: ad + meta + alt rozet (ayni), tanitim (`bio`) TEK satir
   (`line-clamp-1`), `Profili incele` dugmesi (tam genislik, brand-ink), havuz / kisa liste kisa yolu VARSA dugmenin altinda
   (bugunku oncelik kurali: havuz varsa kisa liste cizilmez). Panel beyaz degil, ALT SERIT gibi koyu gradient / yari saydam
   koyu zemin (`bg-black/70 backdrop-blur` benzeri) - fotograf arkada okunur kalir. Gecis bugunku gibi yumusak
   (`transition`, 300 ms). Alinti ve etiket cipleri KARTTAN KALKAR (profil sayfasinda var).
4. **Mobil default:** foto-hero 4:5 (cipler, kalp, premium, ad + meta + alt rozet gradient ustunde - compact gibi) + altinda
   INCE beyaz satir: solda hicbir sey (ya da havuz / kisa liste kisa yolu varsa o), sagda kucuk `Profili incele` dugmesi.
   Tanitim, alinti, etiketler mobilde KALKAR. Kartin tamami yine profile baglanti (stretched link; interaktifler z-20).
5. **Dugme metni:** her yerde `Teklif Al` -> `Profili incele` (66 c). Gercek "Teklif Al" profil sayfasinda; kart dugmesi zaten
   `/p/[id]`'ye gidiyordu, metin bunu soylemeli. `?etkinlik=` tasima kurali (`profileHref`) degismez.
6. **Compact (ana sayfa):** degismez (zaten 4:5 foto-hero, tam-kart baglanti). Yalniz ortak parcalar (TopChips / MetaRow /
   alt serit) tek yerden gelsin diye yeniden kullanilan kod varsa birlestirilebilir; gorunum ayni kalir.
7. **Kaldirilan veri:** `quote` prop'u ve kartta alinti; `app/kesfet/page.tsx`'teki yorum alintisi sorgusu (`reviews` -
   `quoteByProfile`) ve `formatReviewAuthor` yalniz bunun icinse SILINIR (Kesfet'e bir sorgu daha az). Diger cagiranlarda
   (`kategori/[slug]`, `favoriler`, `p/[id]` benzer profiller, `kashe-ai`, `featured-profiles`) `quote` geciliyorsa kaldir.
   Etiketler (`attributes` / `category_attributes` -> `tags`) kartta cizilmez; hesaplama ve `ServiceChips` kullanilmiyorsa
   silinir. `services` (fiyat rozeti), `rating`, `jobsCount`, `havuz`, `kisaListe`, `tamAd`, `isFavorited` AYNEN kalir.
8. **Erisilebilirlik / etkilesim:** hover paneli yalniz `hover` olan cihazlarda (`md:` + `group-hover`), klavye odaginda da
   acilir (`group-focus-within`); dugme ve kalp z-20, kart baglantisi z-10 (bugunku kural). Premium cerceve / altin golge
   kurali ayni.

### B) Kucukler

1. **Ust menu etiketi:** `app/lib/nav-links.ts` `MARKETING_LINKS` `'Ajanslar'` -> `'Sağlayıcılar'` (hedef `/#ajanslar` ayni;
   bolum basligi ve alt bilgi zaten "Kurumsal hizmet sağlayıcılar"). Ayni etiketi kullanan baska yer varsa (`category-content`
   `role: "Ajanslar"` kategori icerigidir, DOKUNMA) rapora yaz.
2. **`<a href="/...">` -> `<Link>`:** `app/components/sections/top-nav.tsx` (satir ~115 `link.href`, 133 `/teklif-topla`,
   142 `link.href`, 177 `/giris`, 180 `/uye-ol`), `app/components/sections/mobile-nav.tsx` (99, 153, 158, 165, 185, 194,
   199, 216 - ic yollar), `app/components/sections/footer.tsx` (kalan tum ic yollar; `mailto:` `<a>` kalir). Hepsinde
   `prefetch={false}` (alt bilgi + menu 20'den fazla baglanti; sayfa basina on yukleme firtinasi olmasin). **Mobil menu:**
   bugun menu `pathname` degisince kapaniyor; `<Link>` ile AYNI sayfadaki `/#...` baglantisinda pathname degismez ve menu
   ACIK KALIR -> her menu baglantisina `onClick` ile kapatma ekle (`setOpen(false)`), pathname efekti de kalir. Metin, sinif,
   `target`, `aria` degismez.
3. **Kazanclarim ozet karti** (`app/kazanclarim/page.tsx` ~satir 246): "Komisyon (%10)" karti `summary.commission === 0`
   iken `−0 TL` yerine `—` + altinda kucuk not `Teklif dosyası işlerinde komisyon yok`; komisyon > 0 ise bugunku gibi tutar.

### Kabul olcutleri

- `npx tsc --noEmit`, `npx eslint app` 0 hata, `npm run build` temiz. Kural ayari degismez, kural kapatilmaz.
- Rapor: kart icin eski / yeni yapi ozeti (masaustu varsayilan, masaustu hover, mobil, compact), kaldirilan prop / sorgu /
  bilesenler, cagiran dosyalarda degisen satirlar; B maddelerinde dosya:satir.
- Yerel sunucuda (Sahne verisi, oturumsuz) ekran goruntusu ALMA gerekmez; ama su olculer raporda: Kesfet'te 1280 px'te bir
  satirda kart sayisi (bugun 3; `xl:grid-cols-4` 1280'de 4) ve kart yuksekligi; mobil 375 px'te kart genisligi / yuksekligi.
- Smoke icin acik sunucu birakma.

### Onizleme turu (Claude yapacak)

Kesfet (anonim ve musteri): masaustu varsayilan + hover + klavye odagi, mobil 375 px, premium cerceve, fiyat rozeti, "Kurumsal
profil" rozeti, favori kalbi (musteri), havuz kisa yolu (ajans sahibi: Nova), kisa liste (kurum: Teknopark); kategori sayfasi,
favoriler, `/p/[id]` benzer profiller, Kashe AI adaylari, ana sayfa one cikanlar (degismemeli). Ust menu "Sağlayıcılar"
(genis ekran, girissiz), alt bilgi / mobil menu baglantilari tam sayfa yenilemeden gecer, mobil menu `/#...` tiklaninca
kapanir. Kazanclarim ozet karti (Lumen).
