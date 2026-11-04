# 45 - Claude Code gorevi: FAZ 10c-1 / P1 - saglayici yazma yolu (uygulama)

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/envanter/38-faz10-temizlik.md` bolum 10c, kararlar bolum 4.
On kosul: `20261105120000_faz10c_01_saglayici_sutunlari.sql` + `20261105120100_faz10c_02_yazma_yolu.sql` dalda (ve uretime
P1'den ONCE gider; ikisi de ekleyen, eski uygulama aynen calisir). Kisitlayan `03` (profiles kilidi) P1 uretime ciktiktan sonra.
Kullanim: Claude Code'a "`docs/envanter/45-claude-code-gorevi-10c1-p1-saglayici-yazma.md` dosyasini oku, "---" cizgisinin altindaki
gorevi uygula" denir.

---

## Gorev

Saglayici hesaplarinin (rolu `professional` ya da `agency`, `providers` satiri olan) profil alanlari artik saglayici tarafina
yazilacak. `profiles`'taki ayni alanlar veritabaninda ters aynayla dolan KOPYA olarak kalir; okuyan 80+ dosya DEGISMEZ. Bu gorev
yalniz YAZMA yollarini tasir. Commit ATMA.

### Veritabani (hazir, dokunma)

- `providers`: sahip kendi satirina dogrudan UPDATE yapabilir (RLS `id = auth.uid()`), admin herkesinkine (`is_admin`).
  Yazilabilir sutunlar: `city_id, district, service_radius_km, is_published, attributes, category_attributes,
  approval_status, approval_note, approved_at, suspended_at, suspension_reason, suspended_by`. Sahibin onay alanlarina yazdigi
  deger tetikleyicide SESSIZCE geri alinir; tek istisna `approval_status: 'revision' -> 'pending'` (not otomatik temizlenir).
  `display_name` yazilamaz (ad `profiles.full_name` / `company_name`'den aynalanir).
- `professional_profiles` (sahip): `headline, bio, experience_years, languages, equipment`.
- `organization_profiles` (sahip): `about, team_size_range, can_full_service, subcontracts, min_project_budget, portfolio_scale`.
- RPC `provider_set_primary_category(p_category_id integer)` -> birincil rol (integer) doner; `null` = birincil yok;
  gecersiz kategori 22023, saglayici olmayan 42501.
- `increment_profile_views` ayni adla saglayici sayacini artirir (cagri degismez).
- Hesap alanlari `profiles`'ta KALIR: `full_name, company_name, phone, avatar_url, default_allowed_applicant_roles, premium_*,
  is_admin, last_seen_at, welcome_email_sent_at, kvkk_approved_at, role`.
- Saglayici OLMAYAN hesaplar (musteri, isletme/kurum) icin her sey `profiles`'ta kalir (isletme hesabinin onayi dahil).

### Yapilacaklar

1. **Yardimci** `app/lib/saglayici-yazma.ts` (sunucu): `saglayiciMi(supabase, userId): Promise<boolean>` (`providers` id sorgusu)
   ve tekrar eden yazimlar icin kucuk yardimcilar (ornegin `saglayiciGuncelle(supabase, id, alanlar)`; guncellenen satir sayisi
   `.select('id')` ile dogrulanir, 0 satir = Turkce hata). Kurallar burada ikinci kez yazilmaz (onay gecisleri DB'de).

2. **`app/profil/duzenle/actions.ts`**
   - `updateProfile`: dogrulamalar aynen. Saglayici ise yuk ikiye bolunur:
     `profiles` <- `full_name, phone, company_name` (+ `default_allowed_applicant_roles` form gonderdiyse);
     `providers` <- `city_id, attributes` (+ `approval_status: 'pending'` yalniz mevcut durum `revision` ise; `approval_note`
     GONDERILMEZ, DB temizler); bio -> profesyonelde `professional_profiles.bio`, ajansta `organization_profiles.about`;
     `primary_category_id` degistiyse `rpc('provider_set_primary_category', { p_category_id })`.
     Sira: profiles -> providers -> alt profil -> RPC; herhangi biri hata verirse Turkce hata doner (onceki yazimlar kalir,
     kopyalar tutarli kalir). Saglayici degilse bugunku tek `profiles` yazimi aynen.
   - `togglePublish`: saglayici ise `providers.is_published`; degilse bugunku gibi.
3. **`app/profil/kategori-bilgileri/actions.ts`**: whitelist birlestirmesi aynen; mevcut deger `providers.category_attributes`'tan
   okunur ve `providers`'a yazilir (yalniz saglayici; saglayici olmayan zaten bu sayfayi kullanmaz - degilse hata mesaji).
4. **`app/admin/actions.ts`**: `banUser`, `unbanUser`, `approveProfile`, `rejectProfile`, `requestProfileRevision`:
   hedef saglayici ise ayni alanlar `providers`'a (admin politikasi), degilse bugunku gibi `profiles`'a. `makeAdmin`,
   `removeAdmin`, `grantPremium`, `revokePremium` DEGISMEZ. `unbanUser`'daki `onayli` okumasi aynen kalabilir (kopya esit).
5. **Okumalar DEGISMEZ.** `/profil`, `/profil/duzenle`, `/p/[id]`, Kesfet, admin listeleri `profiles` / `v_providers_public`
   okumaya devam eder (ters ayna ayni istekte kopyayi doldurur). `revalidatePath` cagrilari aynen.

### Kabul olcutleri

- `npx tsc --noEmit`, `npx eslint` (degisen dosyalar), `npm run build` temiz.
- Saglayici hesaplari icin `from('profiles').update(...)` yuklerinde su alanlar KALMAZ: `city_id, bio, primary_category_id,
  attributes, category_attributes, is_published, approval_status, approval_note, approved_at, suspended_at,
  suspension_reason, suspended_by, views_count` (yalniz "saglayici degil" dallarinda kalabilir). Raporunda bu kontrolu
  komutla goster (ornegin ilgili dosyalarda grep).
- Rapor: degisen dosyalar, her yazma yolunun once/sonra tablosu, sapmalar. Smoke icin acik sunucu birakma.

### Onizleme turu (Claude yapacak, sen yapma)

Profesyonel: profil duzenle (bio / sehir / birincil kategori / ozellikler) -> `/p/<id>` ve Kesfet yansir; yayina al / kaldir;
kategori bilgileri kaydet. Revizyon istenen profil duzenlenince "Incelemede" olur ve admin kuyruguna duser. Admin: onay / ret /
revizyon / askiya al / kaldir (profesyonel + ajans + isletme hesabi). Goruntulenme sayaci artar.
