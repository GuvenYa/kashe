# Claude Code gorevi — FAZ 5 / P3: pazaryerinden havuza ("Havuza ekle" `/p/[id]` + kesfet kisa yolu)

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/17-faz5-yetenek-havuzu.md` (bolum 3, 8-P3, 9).
ON KOSUL: P2 deploy'da (commit `c3d077f`), canli tur gecti.

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/17-faz5-yetenek-havuzu.md` (bolum 3, 8-P3, 9),
`app/ajans/havuz/havuz-actions.ts` (`addTalentRecord`, `rolleriYaz`, `yonetebilirMi`), `app/ajans/havuz/havuz-data.ts`
(iliski turu etiketleri), `app/lib/org-context.ts` (`getTalentPoolContext`), `app/p/[id]/page.tsx` ve `app/p/[id]/iletisim-button.tsx`
(oturum/rol bilgisinin sayfaya nasil indigi), `app/kesfet/page.tsx` + `app/kesfet/profile-card.tsx`.

Bu is **yalniz uygulama kodu**: migration yok, yeni RPC yok, mevcut RPC imzalari degismez. Iki parca: (A) `/p/[id]`
sayfasinda "Havuza ekle", (B) kesfet kartinda kisa yol. Kesfet/profil filtre ve siralama mantigi DEGISMEZ.

Baslamadan: `git status --short` temiz olmali (yalniz `docs/envanter/17-*.md` degisiklikleri olabilir); degilse dur ve soyle.

## Kesin kurallar (17 bolum 9)

- Havuz kaydi kurulusun kendi verisi: INSERT yalniz RLS ile (`organization_talent_records` + `organization_talent_record_roles`),
  yalniz `talent.manage` yetkisi olan uye adina; action sunucuda `has_org_permission` ile ayrica dogrular (duzgun mesaj icin; asil kapi DB).
- `talent_id` = saglayicinin `providers.talent_id` (sunucuda okunur; istemciden gelen talent_id'ye GUVENILMEZ — istemci yalniz
  `providerId` gonderir). `source = 'marketplace_linked'`, `visibility` dokunulmaz (varsayilan private), `invitation_status` dokunulmaz (none).
- Roller `provider_services`'tan (role_id, is_primary) on dolu; kullanici degistirmez (sonradan `/ajans/havuz`'da duzenler).
- Kisisel iletisim KOPYALANMAZ: kayda `email`/`phone` yazilmaz (Kashe uyesi icin kimlik `talents` aynasindadir); `name` = saglayici
  gorunen adi, `city_id` = saglayicinin sehri.
- Sapkali harf yok; kullaniciya gorunen metinler duzgun Turkce, yorumlar ASCII. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. `/p/[id]`: "Havuza ekle" (yeni: `app/p/[id]/havuza-ekle.tsx` istemci + action `app/ajans/havuz/havuz-actions.ts` icine)

- Sunucu tarafi (`page.tsx`): oturum varsa `getTalentPoolContext()`; `orgs.filter(o => o.canManage)` bos ise HICBIR SEY render etme
  (DOM'da da yok). Saglayici `provider_type = 'professional'` ve `providers.talent_id` dolu degilse yine yok (ajans profilleri ve
  talent'siz kayitlar havuza eklenmez). Kullanicinin kendi profili ise yok.
- Her yonetilebilir kurulus icin o kurulusun bu talent icin kaydi var mi: `organization_talent_records` SELECT (`id, status`)
  `organization_id = org AND talent_id = <providers.talent_id>` (RLS org uyesine acik). Varsa dugme yerine rozet
  **"Havuzunda"** (+ `/ajans/havuz` linki); yoksa dugme **"Havuza ekle"**.
- Dugme (istemci) -> kucuk satir ici panel: kurulus (tek kurulus varsa gosterme), iliski turu secimi (etiketler `havuz-data.ts`'ten;
  varsayilan `occasional`), on dolu roller SALT OKUNUR ozet ("Roller: Fotoğrafçı (birincil), DJ" — rol yoksa "Rol yok; havuzda
  atayabilirsin"), **[Ekle] [Vazgeç]**. `addProviderToTalentPool({ organizationId, providerId, relationshipType })`.
- Action: `yonetebilirMi` kontrolu; `providers` okur (`id, provider_type, talent_id, display_name, city_id`); `provider_type <> 'professional'`
  veya `talent_id` NULL -> hata "Bu profil havuza eklenemez."; `provider_services` okur (`role_id, is_primary`); mevcut `addTalentRecord`
  govdesini TEKRAR YAZMA — ortak bir ic yardimciya cikar ya da `addTalentRecord`'u `talentId` + roller ile cagir (name = display_name,
  cityId, relationshipType, email/phone/instagram/notes bos). `23505` -> "Bu kişi havuzunda zaten var." Basari -> `revalidatePath('/p/<id>')`
  + `revalidatePath('/ajans/havuz')`; panel "Havuza eklendi" + `/ajans/havuz` linki.
- Yer: profil basliginin altindaki eylem satiri (IletisimButton'un yanina), ajans uyesine ozel; musteri gorunumu degismez.

### B. Kesfet kartinda kisa yol (`app/kesfet/page.tsx`, `profile-card.tsx`)

- `page.tsx`: oturum + `getTalentPoolContext()` -> `canManage` kurulus(lar) varsa, o kurulus(lar)in havuzundaki `talent_id` kumesini
  TEK sorguyla cek (`organization_talent_records` SELECT `talent_id` `organization_id IN (...)` `talent_id IS NOT NULL`); kartlara
  `havuz?: { orgId: string; durum: 'havuzda' | 'eklenebilir' }` prop'u gec (kurulus yoksa prop YOK -> kartta hicbir sey degismez).
  Kesfet sorgusu/filtreleri/siralamasi degismez; kartin mevcut tiklama hedefi `/p/[id]` kalir.
- `profile-card.tsx`: prop varsa kartin alt kosesinde kucuk eylem: "Havuzda" (pasif rozet) ya da "Havuza ekle" (tiklaninca kart
  linkine GITMEDEN — `e.preventDefault()`/`stopPropagation` — A'daki action'i `relationshipType: 'occasional'` ile cagirir; basarida
  rozet "Havuzda"ya doner; hata metni kartta kucuk). Birden fazla kurulus varsa kisa yol GOSTERILMEZ (yalniz `/p/[id]` panelinden; raporla).
- Kart `'use client'` ise sunucudan gelen veriyi prop ile al; `kesfet-filters`/`listings-data` kuralina uy (istemci dosyasindan
  sunucuya veri export yok).

### C. Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -rn "from('organization_talent_records')" app` -> yalniz `app/ajans/havuz/havuz-actions.ts`, `app/p/[id]/page.tsx`, `app/kesfet/page.tsx`
  (yeni SELECT'ler) — baska yerde yok. `grep -rn "talent_id" app/p app/kesfet` -> yalniz sunucu dosyalari (istemciye talent_id gitmez).
- `grep -rn "invitation_token\|from('internal" app` -> 0 (yorum haric). Sapkali harf 0 (kod noktasiyla tara).
- **Canli tur (Guven):**
  1. Test Musteri ile `/kesfet` ve bir `/p/[id]`: hicbir havuz dugmesi/rozeti YOK.
  2. Sunucu Ajans (owner) ile `/p/<Test Pro>`: rozet **"Havuzunda"** (Ekibim kaydi var). Havuzda olmayan bir profesyonelin profili:
     "Havuza ekle" -> panel (iliski turu, roller ozeti) -> Ekle -> "Havuza eklendi"; `/ajans/havuz`'da satir: Kashe uyesi,
     roller on dolu, iliski turu sectigin; iliski turu/rol sonradan duzenlenebiliyor.
  3. Ayni profilde sayfa yenile -> rozet "Havuzunda". Tekrar eklemeye calisma yolu yok.
  4. `/kesfet`: Test Pro kartinda "Havuzda", az once eklenen kartta "Havuzda", bir baskasinda "Havuza ekle" -> tikla -> karta
     gitmeden rozet "Havuzda"ya dondu; `/ajans/havuz`'da yeni satir (iliski turu "ara sıra").
  5. Test Pro (viewer, Ekibim uyesi) ile `/kesfet` ve `/p/[id]`: dugme YOK (talent.manage yok).
  6. Temizlik (istege bagli): 2 ve 4'te eklenen iki kaydi `/ajans/havuz`'dan Sil (onay kutusu) — ya da kalsin; asama13 K14 buna gore.
  SQL (uretim, salt okunur, tek tek):
  ```sql
  select r.name, r.source, r.talent_id is not null as bagli, r.relationship_type, r.invitation_status,
         (select count(*) from public.organization_talent_record_roles x where x.record_id = r.id) as rol
    from public.organization_talent_records r order by r.created_at;
  ```
  Beklenen: yeni satirlar `marketplace_linked / true / <sectigin> / none`, rol sayisi = o saglayicinin provider_services sayisi.
  `asama13`: K5 0, K6 0, K13 0, K14 = 30000 + 10000 x (kalan yeni kayit).

## Yapilmayacaklar

- Mukerrer birlestirme, `visibility` degisikligi, pazaryerine acma (FAZ 8). Migration/RPC yok.
- Kesfet siralamasina "havuzda" etkisi yok; filtre eklenmez.
- Istemciden `talent_id` alinmaz; e-posta/telefon kopyalanmaz.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, kesfet kartinin istemci/sunucu durumu, sapma ve nedeni. Commit ATMA.
