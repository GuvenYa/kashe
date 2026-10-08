# Ana sayfa yenileme — v3 EK-2 (ikinci canli tur, 9 Ekim 2026)

Kaynak: `docs/content/anasayfa-yenileme-brief-v3.md` + `anasayfa-yenileme-v3-ek.md` (uygulandi: `e66bee7`).
Canli olcum (EK sonrasi, kendi tarayicimda): ust nav 1024 px'te 5 baglanti, 1280/1920 px'te 9 baglanti,
hepsi 16 px yuksekliginde (tek satir), yatay tasma yok → nav kalemi KAPANDI, bu belgede nav yok.
Telefonda Kashe AI kartlarinin alt alta gelmesi beklenen davranis → kalem yok.

## Kararlar

1. **Kashe AI metni** sadelesir (3 kisa cumle); kart altindaki "Sihirbazı aç → / Profesyonel bul →" metin
   baglantilari **dugme** olur (beyaz, buyuk, kartin tam genisliginde mobilde).
2. **Ajanslar listesi**: "iç ücret" ve "teklifinizi sürümleyin" ifadeleri sade Turkceyle yeniden yazilir.
3. **Girisli kullaniciya "üye ol / hesap aç" gosterilmez** — tek bir yerde degil, SITE GENELINDE:
   ana sayfa (Profesyonel CTA, Kurumsal CTA, FooterCTA), `/fiyatlandirma`, `/hakkimizda`. Girisli
   kullanici `/uye-ol`'a tiklayinca middleware zaten `/profil`'e yolluyor; sorun kirik baglanti degil,
   yanlis cagri. Her CTA role gore "mevcut yuzeye git" baglantisina doner (asagida tablo).
4. **One cikanlar**: brief v3 "Degismeyecekler" listesindeydi; Guven'in 9 Ekim istegiyle ISTISNA. Kompakt
   kart yerine Kesfet'teki standart `ProfileCard` (hover paneli: kisa tanitim + etiketler + Teklif Al)
   kullanilir; 12 kart, masaustunde 4 sutun x 3 satir; kartlar kucultulur (`aspect-[4/5]`).
   Not: 3 satirin tek ekrana (≈900 px) sigmasi icin kart ~230 px olmali — foto kart icin cok kucuk;
   `aspect-[4/5]` ile satir ~355 px, bolum ~1.3 ekran. Guven daha kucuk isterse tek deger degisir.

=== CLAUDE CODE GOREVI ===

Kashe reposundasin. Once `git status` (temiz olmali; `.claude/` izlenmeyen klasor normal). Oku:
`app/components/sections/kashe-ai-section.tsx`, `ajanslar-section.tsx`, `pro-cta-section.tsx`,
`b2b-section.tsx`, `footer-cta.tsx`, `featured-profiles.tsx`, `app/kesfet/profile-card.tsx` (standart
varyantin masaustu hover paneli ~satir 405-480; `Props` ~satir 198), `app/kesfet/page.tsx` (ProfileCard
besleme ~satir 496-515 ve 640-655; `getFavoritedIds`), `app/lib/types.ts` (`PROVIDER_LISTING_COLUMNS`),
`app/page.tsx`, `app/fiyatlandirma/page.tsx`, `app/hakkimizda/page.tsx`, `app/lib/org-context.ts`
(`hasProposalAccess`, `hasRfpBuyerAccess`), `app/lib/auth.ts` (`getCachedUser`), `CLAUDE.md`.

Brief v3 "Degismeyecekler" listesi gecerli; TEK istisna bu gorevde One cikanlar (madde 4). Fiyat, gercek
marka/kisi adi, uydurma sayac YOK. Gradyan eklenmez (mevcut iki ince cizgi kalir).

## 1) Kashe AI — `kashe-ai-section.tsx`

- Giris paragrafi (ayni sinif) su metinle degisir:
  `Etkinliğini bir iki cümleyle anlat, gerisini Kashe'ye bırak: hangi rollere ihtiyacın olduğunu çıkarır,
  eksik bilgiyi uydurmaz, sorar. Kimi aradığını söyle; en uygun profilleri nedeniyle önersin.`
- Kart altindaki `bag` metni (`<p className="mt-5 text-sm font-medium text-brand-accent …">`) **dugme
  gorunumlu `<span>`** olur (kartin tamami zaten `<Link>`; icine ikinci `<a>` KONMAZ):
  `inline-flex w-full sm:w-auto justify-center items-center gap-2 mt-6 rounded-lg bg-paper text-ink
  font-display font-semibold text-base px-6 py-3 transition-colors group-hover:bg-brand-accent-soft`
  Metinler ayni: `Sihirbazı aç →` / `Profesyonel bul →`. (Beyaz dugme + ink metin: footer-cta'daki koyu
  zemin dugme deseni; hover `brand-accent-soft` #FDEAF5 uzerinde ink metin kontrasti sorunsuz.)
- Baska bir sey degismez (H2, cipler, sinir notu ayni).

## 2) Ajanslar — `ajanslar-section.tsx` (yalniz iki madde metni)

- `Özel yetenek havuzu` → `Kashe hesabı olmayan profesyonellerinizi de kaydedin; onlarla anlaştığınız
  ücretleri not alın. Havuz yalnız size görünür, pazaryerine açılmaz.`
- Baslik `Teklif, iç maliyet ve marj` → `Teklif, maliyet ve marj`; metin → `Teklifinizi hazırlayın,
  gerekirse düzenleyip yeniden gönderin; her gönderim kayıt altında kalır. Maliyetiniz ve marjınız yalnız
  ekibinize görünür, müşteri yalnız teklifi görür.`

## 3) Girisli kullaniciya "üye ol" yok — site geneli

`app/page.tsx` zaten `user` ve `ajansPaneli` hesapliyor; buna `rol` (profiles.role: professional | client |
agency | business | null) ve `kurumsalPanel` (`await hasRfpBuyerAccess()` — events.view yetkili kurulus)
eklenir, bolumlere prop olarak gecer. Ayni hesaplama `/fiyatlandirma` ve `/hakkimizda` sayfalarinda
(sunucu bilesenleri) tekrarlanir — ortak kucuk yardimci: `app/lib/ziyaretci.ts` →
`export async function getZiyaretci(): Promise<{ girisli: boolean; rol: string | null; ajansPaneli: boolean; kurumsalPanel: boolean }>`
(`getCachedUser` + tek `profiles` sorgusu + iki yetki yardimcisi; girissizde sorgu YOK).

| Yer | Girissiz (bugunku) | Girisli |
|---|---|---|
| `pro-cta-section` birincil | `Profilini aç →` `/uye-ol?rol=profesyonel` | professional/agency: `Profilini düzenle →` `/profil`; client/business: `Profesyonel bul →` `/kesfet` |
| `pro-cta-section` ikincil | `Nasıl çalışır?` `/#nasil-calisir` | ayni |
| `b2b-section` | `Kurumsal hesap aç →` `/uye-ol?rol=kurumsal` | `kurumsalPanel`: `RFP Talepleri →` `/kurumsal/rfp`; degilse `Etkinliklerim →` `/etkinliklerim` (etkinlik akisi tum girisli rollerde) |
| `footer-cta` (dugmeler) | `Hizmet ver →` / `Hizmet ara` | professional/agency: `Profilim →` `/profil` + `İlanlara bak` `/ilanlar`; client/business: `Profesyonel bul →` `/kesfet` + `Teklif topla` `/teklif-topla` |
| `footer-cta` (H2 + alt metin + guven satiri) | ayni | H2 `Sıradaki etkinliğin için hazır mısın?`; alt metin `Profilini güncel tut, ilanlara göz at, teklif topla — hepsi tek yerde.`; `Ücretsiz kayıt · KVKK uyumlu …` satiri GIZLENIR |
| `ajanslar-section` | (EK'te yapildi) | (EK'te yapildi); `Giriş yapın` satiri girisli HER kullanicida gizli (bugun yalniz `ajansPaneli` kosulu — `girisli` kosulu eklenir) |
| `/fiyatlandirma` plan dugmeleri (`Ücretsiz başla` / `Üye ol`) | `/uye-ol…` | professional/agency: `Planı seç` → `/premium`; client/business: dugme GIZLENIR (paketler saticiya ait) |
| `/fiyatlandirma` alt blok `Ücretsiz üye ol` | `/uye-ol?rol=profesyonel` | professional/agency: `Premium sayfası →` `/premium`; client/business: blok GIZLENIR |
| `/hakkimizda` `ctas` | `Kurumsal hesap aç` / `Profilini aç` / `Ajans hesabı oluştur` | kurumsal: `kurumsalPanel` ? `RFP Talepleri →` `/kurumsal/rfp` : `Etkinliklerim →` `/etkinliklerim`; profesyonel: `Profilim →` `/profil`; ajans: `ajansPaneli` ? `Ajans paneli →` `/ajans/teklifler` : `Ajanslar bölümü →` `/#ajanslar` |

Kurallar: `top-nav`/`mobile-nav` zaten dogru (girissizde Üye ol) — DOKUNMA. `kategori-talep-cta` zaten
`isLoggedIn` farkinda — DOKUNMA. `app/bildirimler` ve `app/favoriler` icindeki `/uye-ol` baglantilari
girissiz dallarda (bos durum) — DOKUNMA. Metin disinda tasarim degismez; dugme sinif/boyutlari ayni kalir.
FooterCTA'nin girisli metni Degismeyecekler'deki "CTA metni" kuralini bozmaz: girissiz metin AYNEN kalir,
girisli kullanici farkli bir metin gorur.

## 4) One cikanlar — `featured-profiles.tsx` + `profile-card.tsx`

- `ProfileCard`'a yeni prop `yogun?: boolean` (varsayilan false). `yogun` iken yalniz standart varyantin
  masaustu foto alani `aspect-[3/4]` → `aspect-[4/5]`; hover paneli ve mobil duzen AYNI (Kesfet degismez).
- `featured-profiles.tsx`:
  - Sorgu: `select` icine `PROVIDER_LISTING_COLUMNS` (bio, attributes, category_attributes dahil) +
    `turkish_cities(name)` + `service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)`;
    havuz `.limit(36)`, premium one alma siralamasi AYNI, `.slice(0, 12)`.
  - `variant="compact"` KALKAR; standart varyant `yogun` ile. `cover={p.avatar_url ?? null}` (bugunku
    davranis: portfoy fallback yok). `rating` ayni. `jobsCount` 0 (Kesfet'teki bookings sayimi bu bolume
    EKLENMEZ — sorgu agirligi). `quote` null. `isLoggedIn` + `currentUserRole` `getZiyaretci`'den;
    `isFavorited` yalniz client rolunde `getFavoritedIds()` ile (Kesfet ~satir 500-512 ile ayni kalip).
  - Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`. 9-12. kartlar `hidden lg:block`
    sarmalayicida (telefon/tablet 8 kart, masaustu 12). Kart kokunu `<div>` ile sarmak gerekir (standart
    varyantin koku `div.relative.group`; sarmalayici `className` alir).
  - Bolum ici yorum guncellenir: "kompakt foto-hero" aciklamasi → "Kesfet ile ayni standart kart, hover
    paneli (tanitim + etiket + Teklif Al), 4 sutun".
- `Reveal` sarmalayicisi hover panelini etkilemez (panel kartin `overflow-hidden` kutusunda kayar);
  degistirme.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID` rapora.
- `grep -rn "uye-ol" app/components/sections app/fiyatlandirma app/hakkimizda` → her satir `girisli`/`user`
  kosullu bir dalda (raporda dosya:satir + kosul).
- `grep -n "variant=\"compact\"" app/components/sections/featured-profiles.tsx` → 0;
  `grep -n "yogun" app/kesfet/profile-card.tsx` → prop + tek `aspect-[4/5]` kullanimi.
- `grep -n "iç ücret\|sürümleyin\|serbest metinle" app/components/sections/*.tsx` → 0.
- Kashe AI kartinda `<a` ic ice YOK: `grep -c "<Link\|<a " app/components/sections/kashe-ai-section.tsx` → 1.
- Sapkali harf 0; yorumlar ASCII; UI metni duzgun Turkce.
- Duman testi (onizleme cerezi): `/` girissiz → "Profilini aç →", "Kurumsal hesap aç →", "Hizmet ver →",
  12 profil karti HTML'de (`aria-label` sayisi ≥ 12 ya da kart kok sayisi); `/fiyatlandirma` → "Ücretsiz üye ol"
  var. Girisli dallar sende olculemez → raporda belirt; canli tur Guven'de.
- `git diff --stat` yalniz: `kashe-ai-section.tsx`, `ajanslar-section.tsx`, `pro-cta-section.tsx`,
  `b2b-section.tsx`, `footer-cta.tsx`, `featured-profiles.tsx`, `app/kesfet/profile-card.tsx`, `app/page.tsx`,
  `app/fiyatlandirma/page.tsx`, `app/hakkimizda/page.tsx`, yeni `app/lib/ziyaretci.ts`. Fazlasi varsa gerekce.

## Yapilmayacaklar

Hero, kayan serit, kategori grid, Nasil calisir, guvenlik, yorumlar, SSS DOKUNULMAZ. Kesfet sayfasinin kart
davranisi degismez (`yogun` varsayilan false). Nav bilesenlerine DOKUNMA. Yeni gradyan/glow YOK. Portal ve
FAZ 7 dosyalarina DOKUNMA. **Commit ATMA.**

## Rapor

Degisen dosyalar (sayi), her bolum icin 1-2 satir, tsc/build (BUILD_ID), grep sonuclari, `uye-ol` satir
listesi (dosya:satir + kosul), sapma varsa gerekcesiyle. Commit ATMA.

## Kapanis (9 Ekim 2026)

- Uygulandi ve canliya cikti: EK `e66bee7`, EK-2 `2715660`, kare kart `c52f4b4` (+ gorev belgeleri `a9b0998`, `a679665`).
- Canli dogrulama: nav 1024/1280/1920 px tek satir (olculdu, 16 px). Girissiz, ajans (Sunucu Ajans) ve kurum (Test Pro / Test Guven)
  turlari sorunsuz: role gore CTA'lar, FooterCTA girisli metni, fiyatlandirma/hakkimizda rol davranisi, One cikanlar 4 sutun x 3 satir
  (kare kart; "bu sekilde idare edelim"), telefonda 8 kart tek sutun ve tam genislik Kashe AI dugmeleri.
- Footer "Profesyonel ol" -> "Profesyoneller için" (`/#profesyoneller`, sorgu yok) ayni commit'te.
- Acik kalan: lansman adimlari (Vercel `NEXT_PUBLIC_BAKIM_MODU` kaldir -> Redeploy -> `/sitemap.xml` + portal baglantisi kontrolu) — Guven/Fahri karari.
- Istisna kaydi: One cikanlar brief v3 "Degismeyecekler" listesindeydi; 9 Ekim istegiyle degisti (kompakt kart -> standart kart + hover paneli, 6 -> 12).
