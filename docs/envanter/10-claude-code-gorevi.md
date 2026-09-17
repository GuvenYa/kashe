# Claude Code gorevi — FAZ 2 on kosulu: profil tiplerinin tekillestirilmesi

Asagidaki metni oldugu gibi Claude Code'a ver. Spec: `docs/envanter/10-faz2-onkosul-tipler.md`
(bolum 3 hedef yapi, bolum 4 sinirlar, bolum 5 dogrulama).

---

Kashe reposundasin. `docs/envanter/10-faz2-onkosul-tipler.md` dosyasini oku; bolum 2 tarama, bolum 3 hedef,
bolum 4 sinirlar, bolum 5 dogrulama. Bu is **yalniz TypeScript**: veritabani, migration, RPC, sorgu veya
davranis degisikligi YOK. Amac: FAZ 2'de `profiles`'tan `providers`'a alan tasinirken derleyicinin her
kullanimi gostermesi.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

Yapilacaklar:

1. `app/lib/types.ts`
   - `ProfileApprovalStatus`, `PremiumTier`, `ApplicantRole` tiplerini ekle.
   - `ProfileOpen` (23 acik sutun) ve `ProfilePrivate` (7 kapali sutun) tiplerini spec bolum 3'teki
     tabloya gore yaz; nullability tabloyla birebir (ornek: `premium_tier: PremiumTier` null DEGIL,
     `attributes: Record<string, string | string[]>` null DEGIL, `approved_at: string | null`).
   - `Profile = ProfileOpen & ProfilePrivate` olsun; mevcut `Profile` govdesi silinir. `ProfileWithCity` korunur.
   - `CityEmbed`, `CategoryEmbed`, `ProfileCard`, `ProfileListing`, `ProfilePublic` tiplerini ekle (bolum 3).
   - `app/lib/own-profile.ts` icindeki `OwnPrivateProfile` tipini `export type OwnPrivateProfile = ProfilePrivate`
     olarak birak (import edenler kirilmasin).

2. Yerel profil sekillerini `types.ts` tiplerinden turet (yerel `= { ... }` govdeleri kalkar):
   - `app/components/sections/featured-profiles.tsx` `FeaturedProfile`
   - `app/components/sections/marquee-profiles.ts` `MarqueeProfile`
   - `app/kesfet/page.tsx` ve `app/kategori/[slug]/page.tsx` `PublishedProfile` -> `ProfileListing`
     (kesfet sorgusu `category_attributes` secmiyorsa `Omit<ProfileListing, 'category_attributes'>`; sorguya
     alan EKLEME)
   - `app/p/[id]/page.tsx` `PublicProfile` -> `ProfilePublic`
   - `app/p/[id]/yorumlar/page.tsx` `PublicProfile` -> `ProfileCard & Pick<ProfileOpen, 'is_published'>`
   - `app/admin/rapor/route.ts` `ProfileRow` -> `Pick<ProfileOpen, ...> & Pick<ProfilePrivate, 'email' | 'phone'>
     & CityEmbed & { service_categories: { name_tr: string } | null }`
   Her birinde secilen sutun listesi ile tipin alanlari ayni olmali; fazla/eksik alan varsa tipi sorguya
   uydur, sorguyu tipe UYDURMA. `role: string`, `approval_status: string | null`, `premium_tier: string | null`
   gibi gevsek alanlar dar tiplere doner; bunun kirdigi karsilastirmalar (ornek `p.role === 'x'`) zaten
   dogru ise degismez, yanlis degerle karsilastiriyorsa DUR ve raporla (davranis sorusu).

3. `app/lib/own-profile.ts` sutun kilidi:
   ```ts
   export const PROFILE_OPEN_COLUMN_LIST = ['id', 'full_name', ...] as const satisfies readonly (keyof ProfileOpen)[];
   type EksikSutun = Exclude<keyof ProfileOpen, (typeof PROFILE_OPEN_COLUMN_LIST)[number]>;
   const _sutunKilidi: EksikSutun extends never ? true : never = true;
   export const PROFILE_OPEN_COLUMNS = PROFILE_OPEN_COLUMN_LIST.join(', ');
   ```
   Liste ICERIGI degismez (23 sutun, ayni sira). `PROFILE_OPEN_COLUMNS` string olarak ayni degeri uretmeli.
   Kilidin calistigini kanitla: `ProfileOpen`'a gecici `deneme_alani: string` ekle -> `tsc` hata vermeli;
   geri al. Raporda hata satirini goster.

4. Dogrulama (bolum 5):
   - `npx tsc --noEmit` ciktisi bos.
   - `grep -rn "type PublishedProfile\|type PublicProfile\|type FeaturedProfile\|type MarqueeProfile\|type ProfileRow" app`
     -> yalniz `= ProfileListing`, `= Pick<...>` gibi turetimler; hicbirinde `= {` govde yok.
   - `grep -rn "role: string" app --include=*.ts --include=*.tsx | grep -i profil` -> 0 satir.
   - `grep -rn "select('\*')" app --include=*.ts --include=*.tsx` -> profiles baglaminda 0 (listeyi goster,
     hangileri baska tablo).
   - `npm run build` (veya `next build`) basarili.

Kurallar: dosyalarda sapkali harf yok (a, i, u uzerinde ^ isareti olan harfler yasak, duz a/i/u); JSX icinde
`<` iceren kod PowerShell'e yapistirilmaz, dosyaya yazilir; migration dosyalarina dokunma; `app/lib/own-profile.ts`
liste icerigi ve `fetchOwnProfile` davranisi degismez; hicbir `.select(...)` listesi degismez. Bittiginde:
degisen dosyalarin listesi, grep ciktilari, sutun kilidi kaniti ve `tsc --noEmit` ciktisini goster; commit
YAPMA, Guven yapacak.
