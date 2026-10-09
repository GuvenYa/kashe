# Ana sayfa yenileme — v3 EK-3 (hero: Kashe AI one cikar; One cikanlar 4x4) — 9 Ekim 2026

Kaynak: brief v3 + EK (`e66bee7`) + EK-2 (`2715660`, `c52f4b4`) + baslik (`layout.tsx`). Guven'in canli ekran goruntusu
uzerinden istegi: "Bizim one cikan arama motorumuz Kashe AI. Kashe AI arama bolumunu en uste alalim, Kesfet'e yonlendiren
arama motoru daha asagida olabilir; gorsel butunlugu ve yapiyi bozmayalim." + "One cikanlar kartlarini biraz daha
kucultelim, 4x4 olsun."

## Kararlar

1. **Hero'daki arama kutusu Kashe AI olur.** Ayni kabuk (beyaz kart, `border-line rounded-xl` golge, sol etiket + girdi,
   sagda koyu dugme) korunur; icerigi degisir: etiket `KASHE AI` (yildiz ikonu), tek satir serbest metin girdisi, dugme
   **`Başlayalım →`**. Gonderim → `/etkinlik-sihirbazi?metin=<metin>&otomatik=1`. Sihirbaz `metin` parametresini zaten
   okuyor (`sihirbaz-client.tsx` ~255); `otomatik=1` yeni: girisli kullanicida ilk analiz kendiliginden baslar, girissizde
   mevcut giris duvari metni koruyarak calisir (`girisYolu(true)`).
2. **Yapisal arama (Ne ariyorsun? / Nerede? / Ara) asagiya, `#hizmetler` bolumune iner** — "Hangi yetenegi ariyorsun?"
   basliginin hemen altina, kategori grid'inin ustune. Bilesen (`QuickSearch`) AYNEN kullanilir; yalniz yeri degisir.
3. Hero'daki tek satir yardimci metin tersine doner: eskiden sihirbaza yonlendiriyordu, simdi yapisal aramaya:
   `Kimi aradığını biliyor musun?` + `Kategoriye göre ara →` (`/#hizmetler`). "Popüler:" cipleri KALIR (Kesfet kategori
   baglantilari — hizli yol).
4. **One cikanlar 4 sutun x 4 satir = 16 kart**; `yogun` kartin masaustu foto alani `aspect-square` → `aspect-[4/3]`
   (284 x 213 px). Hover paneli ~170 px → kartin icinde kalir (alinti bu bolumde zaten null). Telefon/tablet 8 kart.
5. Istisna kaydi: brief v3 "Degismeyecekler"deki "Hero" ve "CTA metni" bu gorevde Guven'in 9 Ekim istegiyle degisir
   (H1 ve alt metin DEGISMEZ; yalniz arama kutusu ve yardimci satir).

=== CLAUDE CODE GOREVI ===

Kashe reposundasin. Once `git status` (temiz olmali; `.claude/` izlenmeyen klasor normal). Oku:
`app/components/sections/hero.tsx`, `hero-mobile.tsx`, `quick-search.tsx` (kabuk sinifi ve `md:` davranisi — yeni
bilesen bu kabugu kopyalar), `categories.tsx`, `featured-profiles.tsx`, `app/kesfet/profile-card.tsx` (`yogun`),
`app/etkinlik-sihirbazi/sihirbaz-client.tsx` (`metin` state ~255, `analizEt` ~403, `oturumVar`, `girisYolu`),
`app/etkinlik-sihirbazi/page.tsx` (Suspense siniri), `app/lib/city-order.ts`, `CLAUDE.md` (yapay zeka kurallari).

Brief v3 "Degismeyecekler" gecerli; bu gorevin istisnalari: hero arama kutusu + yardimci satir (madde 1-3) ve One
cikanlar (madde 4). H1 `Türkiye'nin yetenek sahnesi.`, hero alt metni, kolaj, sayaclar, "Popüler:" cipleri DEGISMEZ.
Fiyat, uydurma sayac, marka/kisi adi YOK. Gradyan EKLENMEZ.

## 1) Yeni bilesen `app/components/sections/hero-ai-search.tsx` (`'use client'`)

- Props yok. `useRouter`. `<form onSubmit>`; kabuk `quick-search.tsx` ile AYNI:
  `relative z-40 bg-card border border-line rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] p-2 flex flex-col md:flex-row md:items-stretch gap-1.5`.
- Sol blok (`flex-1`): `px-4 py-2.5 rounded-xl`; etiket `<label htmlFor="hero-ai">` sinifi QuickSearch etiketiyle ayni
  (`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-ink mb-1`), icerigi `inline-flex items-center gap-1.5`:
  top-nav'daki 4 kollu yildiz SVG'si (14 px, `text-brand-ink`) + `Kashe AI`. Girdi `<input id="hero-ai" type="text">`,
  `placeholder="Etkinliğini anlat: tür, tarih, şehir, kişi sayısı…"`, sinif QuickSearch girdisiyle ayni
  (`w-full bg-transparent text-ink text-base placeholder:text-ink-32 focus:outline-none`), `autoComplete="off"`, `maxLength={400}`.
- Sag dugme (`type="submit"`): QuickSearch "Ara" dugmesiyle AYNI sinif (`shrink-0 bg-brand-ink text-white rounded-lg px-7 py-4 md:py-0 …`),
  icerik: yildiz SVG (18 px) + `Başlayalım →`.
- Gonderim: `const m = metin.trim(); const p = new URLSearchParams(); if (m) p.set('metin', m); if (m.length >= 10) p.set('otomatik', '1');
  router.push(p.size ? '/etkinlik-sihirbazi?' + p.toString() : '/etkinlik-sihirbazi');` — bos gonderim de sihirbaza goturur.
- Dosya basi yorumu (ASCII): "Hero'nun birincil aramasi Kashe AI (9 Ekim 2026): serbest metin sihirbaza tasinir; yapisal
  arama #hizmetler'de (QuickSearch)."

## 2) `hero.tsx` + `hero-mobile.tsx`

- `<QuickSearch categories cities />` → `<HeroAiSearch />` (ayni sarmalayici `div`, ayni `kashe-rise` gecikmeleri).
- Yardimci satir: `Ne arayacağına karar veremedin mi? Etkinliğini adım adım kuralım →` →
  `Kimi aradığını biliyor musun? ` + `<a href="/#hizmetler" …ayni sinif…>Kategoriye göre ara →</a>`.
- `hero.tsx` artik `cities` ve `orderCities`'e ihtiyac duymaz: `turkish_cities` listesi sorgusu (`select("id, name").order("name")`)
  KALDIRILIR (sayac icin olan `count` sorgusu KALIR); `HeroMobile`'a `cities` prop'u gecilmez, tipinden silinir.
  `categories` KALIR (Popüler cipleri + Kategori sayaci).
- Mobilde `HeroAiSearch` dikey yigilir (kabuk `flex-col md:flex-row` oldugu icin kendiliginden).

## 3) `categories.tsx` — yapisal arama buraya

- `turkish_cities` sorgusu buraya tasinir (`select("id, name").order("name")` + `orderCities`); `QuickSearch` import edilir.
- Yerlesim: H2 `Hangi <em>yeteneği</em> arıyorsun?` bloğunun altina, grid'in ustune:
  `<div className="relative z-30 max-w-3xl mb-10 md:mb-12"><QuickSearch categories={allCategories.map(c => ({ id: c.id, name_tr: c.name_tr }))} cities={cities} /></div>`
  (`allCategories` — grid'de gizlenen kategoriler de aranabilir olmali). Baslik blogunun alt boslugu buna gore ayarlanir
  (bugun H2 ile grid arasindaki bosluk neyse, arama kutusu o boslugun icine yerlesir; bolum toplam yuksekligi en fazla
  ~90 px artar).
- `#hizmetler` capasi `scroll-mt-20` tasir (sticky nav altinda kalmasin; yoksa ekle).

## 4) Sihirbaz otomatik baslangic — `sihirbaz-client.tsx`

- Tek `useEffect`, bir kez (`useRef` bayragi): `params.get('otomatik') === '1' && !params.get('adim') && metin.trim().length >= 10`
  ise `analizEt()` cagrilir. `analizEt` girissizde zaten `router.push(girisYolu(true))` yapar (metin korunur); girisli
  kullanicida analiz baslar ve mevcut akis `adim=1`'e gecer. Bagimlilik dizisi: `[]` + eslint yorumu (bilerek tek sefer).
- `girisYolu(true)` donus URL'sinde `otomatik=1` korunuyorsa giris sonrasi analiz kendiliginden baslar (istenen); korunmuyorsa
  ek bir sey yapma, raporda belirt.
- `ANLAT_ANAHTARLARI` / URL ayna mantigina DOKUNMA; `otomatik` anahtari URL'de kalabilir (bayrak tekrar calistirmaz).

## 5) One cikanlar 4x4 — `featured-profiles.tsx` + `profile-card.tsx`

- `HOME_LIMIT` 12 → **16**; havuz `.limit(36)` → `.limit(48)`; `MOBIL_LIMIT` 8 kalir (`hidden lg:block` 9-16).
- `profile-card.tsx` `yogun` dali: `aspect-square` → `aspect-[4/3]`; yorum guncellenir ("4 sutun x 4 satir").
- Baska degisiklik yok (Kesfet 3/4 kalir).

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID` rapora.
- `grep -n "QuickSearch" app/components/sections/hero.tsx app/components/sections/hero-mobile.tsx` → 0;
  `grep -n "QuickSearch" app/components/sections/categories.tsx` → import + 1 kullanim;
  `grep -n "HeroAiSearch" app/components/sections/hero.tsx app/components/sections/hero-mobile.tsx` → her birinde import + 1 kullanim.
- `grep -n "turkish_cities" app/components/sections/hero.tsx` → yalniz `count` satiri (1).
- `grep -n "otomatik" app/etkinlik-sihirbazi/sihirbaz-client.tsx app/components/sections/hero-ai-search.tsx` → her ikisinde var.
- `grep -n "HOME_LIMIT = 16\|limit(48)" app/components/sections/featured-profiles.tsx` → 2; `grep -n "aspect-\[4/3\]" app/kesfet/profile-card.tsx` → 1 (yogun).
- Sapkali harf 0; yorumlar ASCII; `${`'ye bitisik sinif 0.
- Duman testi (onizleme gerekmiyor, site acik): `/` HTML'inde `Başlayalım →`, `Kategoriye göre ara →`, `Hangi` basligindan
  SONRA `Ne arıyorsun?` etiketi (hero'da DEGIL; `grep -o` sira kontrolu), 16 tekil `/p/<uuid>`, 8 adet `hidden lg:block`;
  `/etkinlik-sihirbazi?metin=250%20kişilik%20bayi%20toplantısı%2C%2014%20Mayıs%2C%20Ankara&otomatik=1` → 200 (girissiz: metin
  dolu, analiz baslamaz — giris duvari tiklamada).
- `git diff --stat` yalniz: `hero.tsx`, `hero-mobile.tsx`, `categories.tsx`, `featured-profiles.tsx`, `app/kesfet/profile-card.tsx`,
  `app/etkinlik-sihirbazi/sihirbaz-client.tsx`, yeni `hero-ai-search.tsx`. Fazlasi varsa gerekce.

## Yapilmayacaklar

H1, hero alt metni, kolaj, sayaclar, Popüler cipleri, kayan serit, Kashe AI bolumu, kategori grid mantigi, Nasil calisir,
guvenlik, yorumlar, SSS, FooterCTA DOKUNULMAZ. `quick-search.tsx` icerigi DEGISMEZ (yalniz yeri). Sihirbazin analiz/onay
mantigi degismez (yalniz otomatik tetik). Yeni gradyan/glow YOK. Portal ve FAZ 7 dosyalarina DOKUNMA. **Commit ATMA.**

## Rapor

Degisen/yeni dosyalar (sayi), her bolum icin 1-2 satir, tsc/build (BUILD_ID), grep sonuclari, duman testi, `girisYolu`
donusunde `otomatik`in korunup korunmadigi, sapma varsa gerekcesiyle. Commit ATMA.
