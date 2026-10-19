# Claude Code gorevi — FAZ 8-U / P1: ekip sayfalarinda "Kurulus rolu" secimi

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/20-faz8-event-os-modulleri.md` bolum 2.
ON KOSUL: `20261020120000_faz8u_01_uyelik_rolu.sql` dal + uretimde (Guven; asama4 26/26, asama18 K1-K3 ESIT). Migration/RPC YOK.

---

Kashe reposundasin. Once `git status` (temiz olmali). Oku: `app/profil/ekibim/page.tsx` + `uye-listesi.tsx` (uye karti: ad, kategori,
eski rol rozeti `getMemberRoleLabel(member.member_role)`, "Cikar"), `app/profil/kurumsal-ekip/page.tsx` + `kurumsal-uye-listesi.tsx`,
`app/ajans/agency-actions.ts` (`updateMemberRole` — eski rol; UI'da KULLANILMIYOR, dokunma), `app/kurumsal/business-actions.ts`,
`app/lib/org-context.ts` (`getCrewContext`, `CrewOrg`), `supabase/migrations/20261020120000_faz8u_01_uyelik_rolu.sql` (RPC kurallari ve
hata metinleri), `supabase/migrations/20260915150100_faz0_02_fonksiyonlar_aynalama.sql` ~151-174 (`org_role_permissions` — rol -> yetki
listesi; UI'daki yetki ozeti BU listeden turetilir, elle yazilmaz), `CLAUDE.md`.

Baglam: ekip sayfalari bugun kurulus SAHIBININ sayfasi (`agency_id = user.id` / `business_id = user.id`); bu dilimde oyle kalir (admin
icin kurulus-yerli uyeler sayfasi FAZ 10 tek tablo gecisiyle). Eski rol (owner/manager/member) FAZ 0 aynasiyla kurulus rolune eslenir;
ince roller (sales, project_manager, crew_coordinator, finance) yalniz kurulus rolunde vardir. `organization_memberships.id` = eski
`agency_members.id` / `business_members.id` (ayna ayni id ile yazar) — uye kartindan RPC'ye dogrudan `member.id` gecilir.

## Yapilacaklar

1. **Veri**: iki `page.tsx` uyeleri cektikten sonra `organization_memberships` (RLS: `organization_memberships_select_member`) ile
   `id IN (uye idleri)` -> `role` haritasi; her uyeye `kurulusRolu` eklenir (satir yoksa `viewer` goster + "aynalanmamis" uyarisi
   `title`). Sahibin kendi satiri listede yok (eski tabloda sahip yoktur) — degismez.
2. **Rol secimi** (`uye-listesi.tsx` / `kurumsal-uye-listesi.tsx`): eski rol rozeti yerine `<select>` "Kurulus rolu" — 7 deger, etiketler:
   `owner` Sahip · `admin` Yonetici · `sales` Satis · `project_manager` Proje yoneticisi · `crew_coordinator` Ekip koordinatoru ·
   `finance` Finans · `viewer` Izleyici (Turkce karakterli UI: Yönetici, Satış, Proje yöneticisi, Ekip koordinatörü, İzleyici).
   Secenek `title`/alt satirinda yetki ozeti: `org_role_permissions` listesinin Turkce karsiligi (ornek sales: "Etkinlikleri yonetir, ekibi
   ve havuzu gorur, teklif acar/gonderir"). Ozet metinleri `app/lib/org-roles.ts` (yeni; `'use client'` YOK) icinde tek kaynak:
   `ORG_ROLE_LABELS`, `ORG_ROLE_SUMMARIES`, `ORG_ROLES` (sira). Business sayfasinda `crew_coordinator` ve `sales` de listelenir
   (yetki matrisi ortak) — ama aciklamada "ajans yuzeyi" notu yok; sade kalsin.
   Secim degisince `setOrgMemberRole(memberId, role)` (yeni action, `app/lib/org-actions.ts` ya da mevcut actions dosyalarina ek) ->
   `supabase.rpc('org_member_set_role', { p_membership_id, p_role })` -> `revalidatePath`. Basarida satir yeni rolu gosterir; hata RPC
   metninden Turkce: `kendi rolunu degistiremezsin` -> "Kendi rolünü değiştiremezsin.", `owner/admin rolunu yalniz kurulus sahibi degistirir`
   -> "Sahip/Yönetici rolünü yalnız kuruluş sahibi değiştirebilir.", `son sahip dusurulemez` -> "Son sahip düşürülemez.",
   `kurulus sahibinin rolu degistirilemez` -> "Kuruluş sahibinin rolü değiştirilemez.", yetki -> "Bu işlem için yetkin yok."
   Sayfa sahibe ait oldugu icin tum secenekler aktif; yine de `owner` secenegi secilince kisa onay (`confirm` degil, satir ici
   "Sahip yapılsın mı? Onayla / Vazgeç" — mevcut "Cikar" onay deseni).
3. **Davet formu** (`uye-davet-formu.tsx`, `kurumsal-uye-davet-formu.tsx`): eski rol secimi (Yonetici/Uye) KALIR (davet eski akista);
   altina tek satir not: "Katıldıktan sonra kuruluş rolünü üye kartından inceltebilirsin."
4. **Eski rol rozeti**: kaldirilir (kurulus rolu tek gercek). `getMemberRoleLabel` davet listesinde kalir.
5. Menu/baska sayfa yok.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "rpc('org_member_set_role'" app` → yalniz yeni action (1); `grep -rn "from('organization_memberships')" app/profil` → 2 (iki sayfa).
- `grep -rn "updateMemberRole\|updateTeamMemberRole" app --include=*.tsx` → 0 (eski rol UI'dan degismez).
- `grep -n "ORG_ROLE_LABELS\|ORG_ROLE_SUMMARIES" app/lib/org-roles.ts` → var; 7 rol.
- Sapkali harf 0; yorumlar ASCII; UI Turkce.
- **Canli (Guven):** `guvenyapicioglu@gmail.com` (Sunucu Ajans sahibi) `/profil/ekibim`: fbguvenfb satiri "Satış" (test verisi SQL ile
  verilmisti — ilk kez arayuzde); hotmail satiri "İzleyici" → "Proje yöneticisi" sec → kaydedildi; sayfayi yenile → kaliyor; SQL:
  `select u.email, m.role from organization_memberships m join auth.users u on u.id=m.user_id join organizations o on o.id=m.organization_id
  where o.display_name='Sunucu Ajans'` → project_manager; geri "İzleyici". asama18 K3 0 (eski tablo member ile uyumlu), K4 sayisi.

## Yapilmayacaklar

Migration/RPC YOK. Davet/cikarma akisi degismez. Admin icin ayri uyeler sayfasi YOK (FAZ 10). `org_role_permissions` degismez. Commit ATMA.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
