# Claude Code gorevi — Hijyen H1-ek: dogrulama e-postasindan davet sayfasina donus (sablon + kod)

Asagidaki metni oldugu gibi Claude Code'a ver. Arka plan: `hijyen-2026-10-01-gorevi.md` kapanis notu. Supabase "Confirm signup"
sablonu `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/profil` — `next` SABIT; `emailRedirectTo`
hic kullanilmiyor. Secilen cozum: sablonda `next={{ .RedirectTo }}` (Guven Dashboard'da degistirir), kodda `/auth/confirm` rotasi
`next` icinde AYNI origin'li tam URL'yi kabul edip yola indirir; tum `signUp`/`resend` cagrilari `emailRedirectTo`'yu hedef sayfanin
tam URL'si olarak verir. Bu sayede: parametre allowlist disinda kalirsa Supabase `RedirectTo = SiteURL` koyar -> rota `/profil`'e
duser (yumusak bozulma); eski `/auth/callback?next=...` degerleri de yola indirilip `/profil`'e cevrilir.

---

Kashe reposundasin. Su dosyalari oku: `app/auth/confirm/route.ts`, `app/lib/safe-redirect.ts`, `app/uye-ol/uye-ol-form.tsx`
(satir ~186-195 `emailRedirectTo`), `app/uye-ol/ajans/ajans-uye-ol-form.tsx` (~60-66), `app/giris/giris-form.tsx` (~184-190 `resend`),
`app/sifremi-unuttum/sifremi-unuttum-form.tsx` (DOKUNMA; yalniz oku, recovery akisi ayri sablon).

Yalniz uygulama kodu; migration yok. `git status --short` temiz olmali.

## Yapilacaklar

1. `app/auth/confirm/route.ts`: `next` cozumlemesi yeni bir yardimciyla (`app/lib/safe-redirect.ts` icine `returnPathFromRedirectTo(raw, origin, fallback)`):
   - `raw` bos/NULL -> `fallback`.
   - `raw` `http://` veya `https://` ile basliyorsa `new URL(raw)` dene; `url.origin !== origin` -> `fallback`; aynı origin ise
     yol = `url.pathname + url.search` (hash yok).
   - Yol `/`, `/auth/callback*` veya `/auth/confirm*` ise -> `fallback` (SiteURL'e dusme ve eski callback degerleri).
   - Sonucu mevcut `sanitizeReturnPath(yol, fallback)`'ten gecir (acik yonlendirme sertlestirmesi aynen).
   - `signup` tipinde fallback `/profil`; `recovery` tipinde mevcut davranis (`next=/sifre-sifirla` sablondan geliyor; bozma — eger
     recovery sablonu `next=/sifre-sifirla` sabitse aynen calisir).
2. `emailRedirectTo` degerleri hedef sayfanin TAM URL'si olur (artik `/auth/callback?next=` DEGIL):
   - `uye-ol-form.tsx`: `${window.location.origin}${redirectTo}` (redirectTo zaten `sanitizeReturnPath`'ten gecmis).
   - `ajans-uye-ol-form.tsx`: `${window.location.origin}/profil`.
   - `giris-form.tsx` resend: `${window.location.origin}/profil` (giris sayfasinda `redirect` parametresi varsa onu kullan; yoksa `/profil`).
3. `app/auth/callback/route.ts` DOKUNMA (ucustaki eski baglantilar).
4. Kullaniciya gorunen metin degismiyor.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + `.next/BUILD_ID`.
- Birim mantigi (hizli): `returnPathFromRedirectTo('https://kashe.net/davet/havuz/x', 'https://kashe.net', '/profil') === '/davet/havuz/x'`;
  `('https://kashe.net', ...) === '/profil'`; `('https://kotu.site/x', ...) === '/profil'`; `('https://kashe.net/auth/callback?next=/profil', ...) === '/profil'`;
  `('/profil', ...) === '/profil'`; `(null, ...) === '/profil'`. Sonuclari raporda goster (node ile calistirabilirsin).
- `grep -rn "auth/callback?next" app` -> yalniz `app/auth/callback/route.ts` icindeki yorumlar (varsa).

Rapor: degisen dosyalar, tsc/build, birim sonuclari. Commit ATMA.

## Guven'in adimi (kod deploy olduktan SONRA, Dashboard)

Authentication -> Email Templates -> **Confirm signup**: iki yerde `next=/profil` -> `next={{ .RedirectTo }}` (buton href ve metin
link). Authentication -> URL Configuration -> Redirect URLs: `https://kashe.net/**` listede olmali (yoksa ekle). Canli test: yeni harici
kayit + `+h2` ile profesyonel kayit -> dogrulama -> **davet sayfasina** oturumlu donus -> sahiplen -> Sil -> K14 30000.
