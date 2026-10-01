# Claude Code gorevi — Hijyen turu H1 (1 Ekim 2026): FAZ 5 kalanlari + kucuk temizlik

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/17-faz5-yetenek-havuzu.md` bolum 10 "acik kalanlar",
`16-faz4c-yeni-talep-akisi.md` bolum 8. FAZ 10'a ait isler (eski `EVENT_TYPES` sabiti, cift sutunlar) BU TURDA YOK.

---

Kashe reposundasin. Su dosyalari oku: `app/uye-ol/page.tsx`, `app/uye-ol/uye-ol-form.tsx` (`redirect` parametresi ve
`emailRedirectTo`), `app/auth/callback/route.ts`, `app/lib/safe-redirect.ts`, `app/davet/havuz/[token]/page.tsx`,
`app/components/cerez-banner.tsx`, `app/profil/havuz-bandi.tsx` (useSyncExternalStore ornegi), `app/p/[id]/page.tsx`.

Bu is **yalniz uygulama kodu + repo ayari**: migration yok, RPC yok, davranis degisikligi yalniz H1'de ve kucuk.
Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle. Her madde AYRI commit'e girecek sekilde calis ama
commit ATMA; raporda madde basina dosya listesi ver.

## H1. Kayit sonrasi davet sayfasina donus (`/uye-ol` redirect)

Bugun: `uye-ol-form.tsx` `redirect` parametresini okuyor (satir ~102) ve oturum donerse `router.push(redirectTo)` yapiyor,
ama e-posta dogrulamasi ACIKKEN kullanici dogrulama baglantisindan `/auth/callback?next=/profil` ile profile dusuyor
(`emailRedirectTo` sabit). Yapilacak:
- `emailRedirectTo: \`${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}\`` — `redirectTo` zaten
  `sanitizeReturnPath` ile temizlenmis olmali (degilse temizle; varsayilan `/profil`). Callback tarafinda `next` yine
  `sanitizeReturnPath`'ten geciyor; dokunma.
- `app/uye-ol/page.tsx` `searchParams` tipine `redirect?: string` ekle (yalniz tip; form `useSearchParams` ile okuyor).
- `app/davet/havuz/[token]/page.tsx`: "Profesyonel olarak kaydol" -> `/uye-ol?rol=profesyonel&redirect=<donusYolu>`
  (`encodeURIComponent`); sayfadaki "kayit sonrasi profilindeki bant seni karsilar" cumlesini "kayit ve e-posta dogrulamasi
  sonrasi bu sayfaya donersin" anlamina gelecek duzgun Turkce ile degistir (bant yine kalir; metin ikisini de soyleyebilir).
- Ajans kaydi (`/uye-ol/ajans`) ayni `redirect` desenini kullaniyorsa ayni duzeltme; kullanmiyorsa dokunma, raporla.

## H2. `cerez-banner.tsx` lint hatasi (`react-hooks/set-state-in-effect`)

`useEffect` icinde `setMounted(true)` + `setVisible(true)` yerine `havuz-bandi.tsx`'teki `useSyncExternalStore` deseni
(sunucu anlik goruntusu: gizli; istemci: `localStorage` okunur, okunamazsa gorunur). Davranis ayni: onay verilmisse
gorunmez, verilmemisse gorunur; hidrasyon uyarisi yok. `STORAGE_KEY` ve onay yazma mantigi degismez.

## H3. `.gitattributes` (satir sonu)

Once olc ve RAPORLA, sonra uygula: `git config core.autocrlf`, `git ls-files --eol -- 'supabase/migrations/*.sql' 'docs/**/*.md' | awk '{print $1, $2}' | sort | uniq -c`.
Yeni dosya `.gitattributes`:
```
*.sql text eol=lf
*.md  text eol=lf
```
Sonra `git add --renormalize -- '*.sql' '*.md'` ve `git status --short | wc -l`. **10'dan fazla dosya degisiyorsa DUR** ve
raporla (ne kadar, hangi tur); degismiyorsa veya azsa devam. `* text=auto` EKLEME (toplu yeniden normalize riski).

## H4. Uygulama metinlerinde sapkali harf (Guven karari: sapkasiz)

Tarama kod noktasiyla (Windows'ta bayt bazli grep yaniltir): desen `[\u00E2\u00EE\u00FB\u00C2\u00CE\u00DB]`
(sapkali a/i/u, kucuk + buyuk) -> `app` altinda `*.ts`/`*.tsx` -> bugun 23 dosya. Yalniz kullaniciya gorunen metinlerde ve
yorumlarda: sapkali a -> a, sapkali i -> i, sapkali u -> u (buyukleri de). Beklenen sozcukler (sapkali bicimlerinden):
zeka (17), hikaye (11), hal / hali / halinde / halin (10), mekan (3), imkansiz, hakim. Tanimlayici (degisken/anahtar/slug)
icinde bu harfler varsa DEGISTIRME, raporla. Sonra ayni tarama -> 0 dosya. `app/lib/category-content.ts` ve
`category-fields.ts` icerik verisi; `slug`/anahtar alanlarina dokunulmadigini `git diff` ile goster.

## H5. Bilinen lint kalintilari (`app/p/[id]/page.tsx`)

`formatDuration` kullanilmayan import -> kaldir; `customerMap`/`replyMap` `prefer-const` -> `const`. Baska dosyaya dokunma.
`npm run lint` toplam hata/uyari sayisini ONCE ve SONRA raporla (geri kalan liste bir sonraki tur icin).

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- Sapkali: `grep -rl` -> 0 (app). `npm run lint` once/sonra sayilari.
- H1 canli tur (Guven): `/ajans/havuz`'da yeni harici kayit "Deneme Harici 3" (`guvenyapicioglu+h1@gmail.com`) -> Davet gonder
  -> gizli pencerede baglanti (`?onizleme=` ile) -> "Profesyonel olarak kaydol" -> form profesyonel secili -> kaydol ->
  dogrulama e-postasi -> tikla -> **davet sayfasina** oturumlu donus -> "Kaydi sahiplen" -> basari. Sonra `/ajans/havuz`'da
  Deneme Harici 3 "Kashe uyesi"; Sil (P3-ek kurali: silinebilir; onay metninde "ic oran kayitlari da silinir") -> 3 kayit.
  `asama13` K14 30000.

Rapor: madde basina degisen dosyalar, H3 olcumleri, tsc/build (BUILD_ID), grep ve lint sayilari, sapma ve nedeni. Commit ATMA.

---

## Kapanis (1 Ekim 2026)

Commit'ler: H1 `478de87`, H2 `85efc11`, H3 `5bf05b7`, H5 `91e04f5`, H4 (+ek: 'Hikaye anlatimi' saklanan degeri uc dosyada birden,
veritabaninda bu degeri tasiyan satir yok) `12cc4f0`. Lint 118 -> 115 (kalanlar sonraki tur). Sapkali harf `app` altinda 0
(docs/content/kategori-genisleme-set1.md kaynak dokuman, dokunulmadi). Canli (H1): yeni harici kayit + `+h1` ile profesyonel kayit
-> dogrulama -> **profil sayfasina** dustu (davet sayfasina DEGIL) -> profil bandi karsiladi -> sahiplen basarili -> Sil -> 3 kayit,
K14 30000.

**Acik: H1-ek.** Dogrulama baglantisi `/auth/confirm?token_hash=...&type=signup&next=...` (token_hash akisi; Supabase e-posta sablonu
uretir). `emailRedirectTo` yalniz sablon `{{ .RedirectTo }}` kullaniyorsa etkilidir; bugunku sablon buyuk olasilikla `next=/profil`
sabit tasiyor. Cozum adaylari: (a) sablon `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup` + uygulama
`emailRedirectTo = ${origin}/auth/confirm?next=<yol>` (kod degisikligi kucuk, Redirect URLs allowlist `kashe.net/**` ise yeter);
(b) sablon `next={{ .RedirectTo }}` + `sanitizeReturnPath` ayni origin'li tam URL'yi yola indirir. Karar icin once Dashboard
"Authentication -> Email Templates -> Confirm signup" govdesi okunacak. Bu arada profil bandi akisi tasiyor; is ENGELLEYICI DEGIL.

