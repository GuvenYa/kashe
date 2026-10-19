# Claude Code gorevi — Tamamlayici 3: Inter yerel dosyadan (derleme Google'a cikmaz) + takvim ikonu

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `next/font/google` derleme hatasi ("next/font/google queries have exactly one entry",
Turbopack font indirme) bugun ucuncu kez dustu (Vercel 1, yerel 2); Tamamlayici 2 turunda takvim ikonuna tiklayinca takvim acilmadi.

---

Kashe reposundasin. Once `git status` (temiz olmali). Oku: `app/layout.tsx` (Gilroy `localFont` blogu ~12-23, `Inter` import ~2 ve tanimi
~24-29), `app/globals.css` ~64-66 (`--font-inter` kullanimlari), `app/fonts/` (Gilroy woff2'ler), `app/lib/tarih-girdisi.ts` (`takvimiAc`),
`CLAUDE.md`.

## 1) Inter yerel — `app/layout.tsx` + `app/fonts/`

- Inter'in resmi surumunu indir (SIL OFL): `https://github.com/rsms/inter/releases` → en son 4.x `Inter-4.x.zip`. Windows'ta
  `curl.exe -L -o inter.zip <url>` ve `Expand-Archive`. Zip icinden **`InterVariable.woff2`** (degisken font, tek dosya, tum agirliklar) ve
  `LICENSE.txt` alinir → `app/fonts/InterVariable.woff2`, `app/fonts/LICENSE-Inter.txt`. Zip ve gecici klasor repoya GIRMEZ (sil / `.gitignore`
  gerekmez, repo disinda calis). Dosya kontrolu: ilk 4 bayt `wOF2`, boyut 200-450 KB arasi. Zip yapisi farkliysa (dosya `web/` altinda vb.)
  bul; `InterVariable.woff2` yoksa statik `Inter-Regular/Medium/SemiBold/Bold.woff2` dortlusunu al ve `src` dizisiyle tanimla — raporda yaz.
- `layout.tsx`: `import { Inter } from "next/font/google"` KALKAR. Yerine Gilroy ile ayni desende:
  ```
  const inter = localFont({
    src: './fonts/InterVariable.woff2',
    weight: '100 900',
    variable: '--font-inter',
    display: 'swap',
  });
  ```
  (`subsets` yok — yerel fontta anlamsiz.) `inter.variable` kullanimi aynen (html/body class). Yorum (ASCII): "Inter yerel: derleme
  Google Fonts'a cikmaz (next/font/google indirme hatasi 19 Ekim'de uc kez dusurdu); OFL lisansi app/fonts/LICENSE-Inter.txt."
- `grep -rn "next/font/google" app` → 0 olmali (tek kullanim layout'tu).
- `globals.css` DEGISMEZ (`--font-inter` adi ayni).

## 2) Takvim ikonu — `app/lib/tarih-girdisi.ts`

Sorun: `onClick` → `showPicker()`, tarayicinin kendi ikon tiklamasiyla CAKISIYOR (ikon tiklaninca tarayici takvimi acar, ardindan bizim
cagri tekrar tetiklenir → kapanir/hata). Duzeltme:
```
export function takvimiAc(e: React.MouseEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  if (el.disabled || el.readOnly) return;
  if (typeof el.showPicker !== 'function') return; // destek yok: tarayici varsayilani (ikon) calisir
  e.preventDefault(); // tarayicinin kendi acma davranisini bastir; TEK acilis bizden
  try { el.showPicker(); } catch { /* kullanici hareketi disinda cagrildiysa sessiz */ }
}
```
Yorumu guncelle (ASCII): neden `preventDefault` (cift tetik). Cagiran 11 girdi degismez.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID` (artik font indirme adimi yok; derleme cevrimdisi da gecer —
  istersen ag kapaliyken bir kez daha `npm run build` ile kanitla, raporda yaz).
- `grep -rn "next/font/google" app` → 0; `ls -la app/fonts` → Gilroy 4 + InterVariable.woff2 + LICENSE-Inter.txt.
- Uretilen CSS'te `--font-inter` tanimi ve `@font-face` `InterVariable` (`grep -o "font-family:[^;]*Inter[^;]*" .next/static/css/*.css | head`).
- `grep -n "preventDefault" app/lib/tarih-girdisi.ts` → 1.
- Sapkali harf 0; yorumlar ASCII.
- **Canli (Guven):** sayfa fontlari ayni gorunur (eyebrow/etiketler Inter); DevTools → Network'te `fonts.googleapis.com` / `fonts.gstatic.com`
  istegi YOK (yalniz `/_next/static/media/InterVariable…woff2`). Teklif editorunde Gecerlilik kutusu: govdeye tiklayinca VE ikona tiklayinca
  takvim bir kez acilir.

## Yapilmayacaklar

Gilroy'a dokunma. `globals.css` degismez. Baska font/agirlik ekleme. Commit ATMA.

Rapor: indirilen surum/dosya boyutu, degisen dosyalar, tsc/build (BUILD_ID; mumkunse cevrimdisi derleme), grep sonuclari, sapma ve nedeni.
Commit ATMA.
