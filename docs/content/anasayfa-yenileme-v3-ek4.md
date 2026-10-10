# Ana sayfa yenileme — v3 EK-4 (yapisal aramada kategori secimi; sihirbazda dolu adimlari atla) — 10 Ekim 2026

Kaynak: EK-3 canli turu (Guven). Iki bulgu:
(a) `#hizmetler`'deki "Ne ariyorsun? / Nerede? / Ara" kutusunda kategori onerisine tiklaninca sehir secmeye firsat
    kalmadan Kesfet'e gidiliyor (`quick-search.tsx` `goToCategory` → `router.push`). Kutu hero'dayken hizli yoldu;
    artik yaninda sehir secimi olan bir arama formu — gezinme yalniz "Ara"da olmali.
(b) Sihirbazda brief'ten cikarilan bilgi ("Istanbul dogum gunu dj 2 gun sonra") Tur ve Sehir adimlarini ONCEDEN
    ISARETLI getiriyor; kullanici yine de her adima bakip Devam'a basiyor. Dolu adimlar atlansin.

## Kararlar

1. **QuickSearch**: oneriye tiklamak kategoriyi SECER (girdiye kategori adi yazilir, `categoryId` dolar, liste kapanir),
   sayfa degismez. Gezinme yalniz form gonderiminde ("Ara" / Enter). Girdi metni degisirse secili kategori sifirlanir
   (metin artik kategoriyle eslesmeyebilir). "Popüler:" cipleri (hero) DEGISMEZ — onlar dogrudan baglanti.
2. **Sihirbaz**: analiz sonrasi `adim` = ilk EKSIK adim; eksik yoksa son adim (Ihtiyac). Atlanan adimlarin degerleri
   gosterilen adimin ustunde **"Brief'ten anladiklarimiz"** seridinde cip olarak durur; cipe tiklamak o adima goturur.
   Yapay zeka cikarimi gorunur ve duzeltilebilir kalir (CLAUDE.md: uydurmaz, sorar; karar kullanicinin).
   Tamamlik kurali: Tur adimi → `tur` dolu; Sehir adimi → `sehir` dolu; Tarih ve olcek adimi → (`tarih` VEYA `esnek=1`)
   VE `katilimci` dolu; Ihtiyac adimi HER ZAMAN gosterilir (roller + ozet + onay).

=== CLAUDE CODE GOREVI ===

Kashe reposundasin. Once `git status` (temiz olmali; `.claude/` izlenmeyen klasor normal). Oku:
`app/components/sections/quick-search.tsx` (tamami, ~165 satir), `app/etkinlik-sihirbazi/sihirbaz-client.tsx`
(`ADIMLAR` ~40, `analizEt` ~403-462 — `yama` nesnesi ve `guncelle(yama, { gecmis: 'push' })`, ilerleme basligi ~568-585,
adim kartlari, `turEtiketi` / `sehirAdi` / `tarih` / `katilimci` turetimleri, Ozet blogu ~940), `CLAUDE.md`.

## 1) `quick-search.tsx`

- `goToCategory(catId)` → `kategoriSec(cat: CategoryOption)`: `setCategoryId(String(cat.id)); setQuery(cat.name_tr);
  setShowSuggestions(false);` — `router.push` YOK. Oneri listesindeki `onClick` bu fonksiyonu cagirir.
- Girdi `onChange`: `setQuery(...)` yaninda `setCategoryId("")` (metin degisince secim duser). Girdi `onFocus` ile liste
  yine acilir; secili kategori adi girdideyken oneri listesi o tek kategoriyi gosterir — `query === secili kategori adi`
  iken listeyi GOSTERME (`showSuggestions && !categoryId`).
- `handleSearch`: `categoryId` doluysa `kategori` gonderilir ve `q` GONDERILMEZ (girdideki metin kategori adidir;
  Kesfet'te serbest metin filtresi olarak tekrar uygulanmasin). `categoryId` bossa bugunku davranis (`q` + `sehir`).
- Secili kategori gorsel geri bildirimi: girdinin sagina kucuk bir temizleme dugmesi (`×`, `aria-label="Kategoriyi temizle"`,
  `type="button"`, `text-ink-50 hover:text-ink`) — tiklaninca `setCategoryId(""); setQuery("")`. Kabuk/siniflar baska
  degismez.
- Klavye: oneri listesi acikken Enter, ilk oneriyi SECER (gezinmez); liste kapaliyken Enter formu gonderir.
  (`onKeyDown` girdide; `e.preventDefault()` yalniz liste acik ve oneri varken.)
- Dosya basi yorumu (ASCII): "Oneri secimi gezinmez (EK-4): kategori + sehir birlikte secilip Ara ile Kesfet'e gidilir."

## 2) `sihirbaz-client.tsx` — dolu adimlari atla + "Brief'ten anladiklarimiz" seridi

- `analizEt` sonunda `yama.adim` sabit `'1'` yerine hesaplanir:
  ```
  const turTamam = !!yama.tur;
  const sehirTamam = !!yama.sehir;
  const tarihTamam = (!!yama.tarih || yama.esnek === '1') && !!yama.katilimci;
  const ilkEksik = !turTamam ? 1 : !sehirTamam ? 2 : !tarihTamam ? 3 : 4;
  yama.adim = String(ilkEksik);
  if (ilkEksik > 1) yama.atlanan = '1'; // serit yalniz atlama olduysa gorunur
  ```
  `atlanan` yeni URL anahtari: `ANLAT_ANAHTARLARI`'na eklenir (yeni analizde sifirlanir), ayna/`guncelle` mantigi
  degismez. Kullanici "Geri" ile atlanan adima donebilir (gecmis `push` zaten var).
- **Serit** (`atlanan === '1'` ve `adim >= 1` iken, adim kartinin USTUNDE, `mb-4`):
  `bg-paper-2 border border-line rounded-xl px-4 py-3` icinde sol etiket `font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72`
  `Brief'ten anladıklarımız` + `flex flex-wrap gap-2` cipler. Her cip `<button type="button">`, sinif
  `kashe-tap inline-flex items-center gap-1.5 bg-card border border-line rounded-full px-3 py-1 text-sm text-ink hover:border-brand-ink`,
  icerik `<etiket>: <deger>` + kucuk kalem ikonu (lucide `Pencil` 12 px, `text-ink-50`); `onClick` → `guncelle({ adim: '<n>' }, { gecmis: 'push' })`.
  Cipler yalniz **gosterilen adimdan ONCEKI ve dolu** adimlar icin: Tur (`turEtiketi`, adim 1), Sehir (`sehirAdi` + varsa `/ ilce`,
  adim 2), Tarih (`tarih` [→ `bitis`] + `(esnek)` + `katilimci kişi`, adim 3). Mevcut turetimler (`turEtiketi`, `sehirAdi`…)
  kullanilir; yeni formatlayici yazilmaz. Ihtiyac adiminda (4) serit uc cipi de gosterebilir (Ozet blogu ayrica durur).
- Adim 0'a (Anlat) ve Ozet'e DOKUNMA. Ilerleme basligi "Adım n / 5" aynen (atlanan adimlar sayida kalir).
- Otomatik tetik (EK-3) degismez; `otomatik=1` ile gelen analiz de ayni atlama kuralini kullanir.
- `analizEt`'in giris duvari ve hata dallari DEGISMEZ.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID` rapora.
- `grep -n "router.push" app/components/sections/quick-search.tsx` → yalniz `handleSearch` icinde (1).
- `grep -n "atlanan" app/etkinlik-sihirbazi/sihirbaz-client.tsx` → anahtar listesi + yama + serit kosulu (≥ 3).
- `grep -n "adim: '1'" app/etkinlik-sihirbazi/sihirbaz-client.tsx` → yalniz Anlat adimindaki "formu kendin doldur"
  dugmesi (`guncelle({ adim: '1' }…)`, ~614); analiz sonucu artik hesaplanmis.
- Sapkali harf 0; yorumlar ASCII; `${`'ye bitisik sinif 0.
- Mantik testi (rapora yaz, kodla izle): "Istanbul dogum gunu dj 2 gun sonra" → `tur` sosyal/dogum gunu, `sehir` Istanbul,
  `tarih` dolu, `katilimci` BOS → `adim=3`, serit: Tur + Sehir cipleri. "250 kisilik bayi toplantisi, 14 Mayis, Ankara"
  → `adim=4`, serit: Tur + Sehir + Tarih cipleri. Hicbir sey cikarilamadiysa → `adim=1`, serit yok.
- `git diff --stat` yalniz: `quick-search.tsx`, `sihirbaz-client.tsx`. Fazlasi varsa gerekce.

## Yapilmayacaklar

Hero, `hero-ai-search.tsx`, `categories.tsx` yerlesimi, Kesfet sayfasi, analiz/onay RPC'leri, `ANLAT_ANAHTARLARI`
disinda URL anahtarlari DOKUNULMAZ. Yeni gradyan YOK. **Commit ATMA.**

## Rapor

Degisen dosyalar, her madde icin 1-2 satir, tsc/build (BUILD_ID), grep sonuclari, mantik testi uc senaryo, sapma varsa
gerekcesiyle. Commit ATMA.
