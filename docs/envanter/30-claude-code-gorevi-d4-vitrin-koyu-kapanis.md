# Claude Code gorevi — Tasarim dili v2 / D4: Vitrin koyu kapanis bolumleri (`KoyuBolum`)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` desen 8 ve D4 dilimi; video `kashe_eventai_v4`
son kare: lacivert zemin (`ink`), sag altta pembe, sol ustte cyan hafif radyal isima, ortada beyaz Kashe isareti + yazi, pembe mono eyebrow
("KATMAN 2 · EVENT AI"), h2 "Turkiye'nin <em pembe>yetenek</em> sahnesi.", alt satir soluk, altta mono baglanti. ON KOSUL: main'de D3.
Dal: `tasarim/d4` (Guven acti). Migration/RPC YOK. Metinler ve CTA hedefleri DEGISMEZ (brief v3 "Degismeyecekler": kapanis CTA metni).

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d4`). Oku: `DESIGN.md` (renk tablolari, `--gradient-brand` kurali, bolum 9),
`docs/envanter/22-tasarim-dili-v2.md` (desen 8), `app/components/sections/footer-cta.tsx` (bugun: tum zemin `--gradient-brand`, beyaz
yazi — kodda T7 notu: gradyan uzerinde beyaz/75 4,5:1 altinda kaliyordu), `app/components/sections/kashe-ai-section.tsx` ve
`ajanslar-section.tsx` (`bg-ink` + ust ince gradyan serit kalibi — mevcut koyu dil), `app/premium/page.tsx` (63), `app/hakkimizda/page.tsx`
(186), `app/page.tsx` (bolum sirasi), `public/kashe-mark-white.png` (beyaz isaret), `app/components/kashe-mark.tsx` varsa (`KasheMark
variant="dark"` panel yan menude kullaniliyor).

**Kirmizi cizgi:** metinler, CTA etiketleri/hedefleri ve girisli/girissiz dallanma (`footer-cta.tsx`) AYNEN; yeni renk/hex YOK — yalniz
token'lar (`ink`, `ink-2`, `paper`, `paper-72`, `paper-50`, `brand-accent`, `sky`); `--gradient-brand` DUZ ZEMIN olarak kullanilmaz
(DESIGN kurali: isaret + ince serit); erisilebilirlik: koyu zeminde govde metni en az `paper-72` (kontrast ≥ 4,5:1), beyaz dugme metni `ink`.

## 1) `KoyuBolum` bileseni — `app/components/koyu-bolum.tsx` (sunucu; `'use client'` yok)

Props: `eyebrow` (mono, `text-brand-accent`, pembe; cizgisiz), `baslik: ReactNode` (h2; vurgu `<em className="not-italic text-brand-accent">`),
`altMetin?`, `isaret?: boolean` (ustte beyaz Kashe isareti 56 px — `KasheMark variant="dark"` ya da `kashe-mark-white.png`), `children?`
(CTA dugmeleri), `baglanti?: { href, etiket }` (altta mono `text-sky` kucuk baglanti, videodaki "KASHE.NET" gibi), `yogunluk?: 'tam' |
'kart'` — `tam`: kenardan kenara bolum (`bg-ink`, `py-20 md:py-28`), `kart`: `rounded-3xl` kart (`max-w-7xl` icinde; bugunku FooterCTA
cercevesi). Zemin: `bg-ink` + iki radyal isima `absolute` katman: sag alt pembe (`radial-gradient(circle at 85% 90%, rgba(250,11,150,.35),
transparent 55%)`) ve sol ust cyan (`radial-gradient(circle at 10% 10%, rgba(0,172,226,.22), transparent 50%)`) — rgba degerleri DESIGN
token'larinin alfa turevleridir (`brand-accent`, `sky`); `globals.css`'e `--glow-accent` / `--glow-sky` degiskeni olarak eklenir, bilesen
degiskeni kullanir (hex bilesende yazilmaz). Ust kenarda ince `bg-gradient-brand` serit (`h-[3px]`, mevcut koyu bolum kalibi). Icerik
ortali, `max-w-3xl`. Dugmeler: birincil beyaz zemin `text-ink`, ikincil `border-paper-14 text-paper hover:border-brand-accent`.

## 2) Uygulama (her sayfada EN FAZLA bir `KoyuBolum` — "olculu")

- **Ana sayfa `FooterCTA`:** gradyan kart → `KoyuBolum yogunluk="kart"`; eyebrow "Hemen basla" (var), baslik/alt metin/dugmeler ve
  girisli/girissiz mantigi AYNEN (yalniz kabuk degisir). `<span className="text-brand-accent">` vurgu kalir. Kontrast sorunu (T7) boylece
  kokten biter: duz lacivert zemin.
- **`/premium`:** sayfanin ust basligi `KoyuBolum yogunluk="tam"` olur: eyebrow "Premium", baslik mevcut h1 metni (h1 olarak kalir —
  bilesen `basliketiketi?: 'h1' | 'h2'` prop'u alir, varsayilan h2), alt metin mevcut paragraf, `isaret`; planlar/kartlar altinda AYNEN.
- **`/hakkimizda`:** sayfa sonuna kapanis `KoyuBolum yogunluk="tam"`: eyebrow "Kashe", baslik "Turkiye'nin <em>yetenek</em> sahnesi.",
  alt metin "Etkinligini anlat; Kashe AI ekibini kursun ya da isi dogru firmaya versin." (video), dugmeler: "Kesfet →" (`/kesfet`),
  "Etkinlik sihirbazi" (`/etkinlik-sihirbazi`); `isaret`; `baglanti` YOK (sitede kendine baglanti anlamsiz). Mevcut icerik ustte AYNEN.
- `kashe-ai-section.tsx` ve `ajanslar-section.tsx` DEGISMEZ (zaten koyu; iki koyu bolum ust uste gelmesin diye ana sayfada yalniz FooterCTA
  donusur).

## 3) `DESIGN.md`

Bolum 9'a "Koyu kapanis (desen 8)": `KoyuBolum`, isima degiskenleri, "sayfa basina en fazla bir", gradyan duz zemin yasagi hatirlatmasi.

## 4) Yapilmayacaklar

Yeni hex/renk YOK (alfa turevleri `globals.css` degiskeni); metin/CTA degisikligi YOK; footer (`footer.tsx`) degismez; panel sayfalari
degismez. Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "var(--gradient-brand)" app/components/sections/footer-cta.tsx` → 0 (duz zemin kalkti); `grep -rn "#[0-9A-Fa-f]\{6\}" app/components/koyu-bolum.tsx` → 0;
  `grep -rn "KoyuBolum" app --include=*.tsx -l | wc -l` → 4 (bilesen + 3 kullanim).
- Sapkali harf 0; yorumlar ASCII; UI metinleri Turkce.
- **Onizleme turu (Claude):** anonim `/` alt CTA (lacivert kart, pembe isima sag altta, baslik "Profilini <pembe>ac</pembe>, calismaya
  basla.", dugmeler beyaz/kenarlikli), `/premium` koyu ust blok + planlar, `/hakkimizda` kapanis; 375 px; kontrast: `paper-72` govde
  metni; konsol 0, tasma 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
