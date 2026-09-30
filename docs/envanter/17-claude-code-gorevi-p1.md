# Claude Code gorevi — FAZ 5 / P1: `/ajans/havuz` (yetenek havuzu), harici kisi + davet e-postasi, Ekibim -> havuz kaydi

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/17-faz5-yetenek-havuzu.md` (bolum 2 kararlar, bolum 3
veri modeli ve RPC'ler, bolum 8 P1, bolum 9 kurallar). ON KOSUL: 5-DB/01-02-03 uretimde (asama13 K1-K13 ESIT, K10 = 22).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/17-faz5-yetenek-havuzu.md` (bolum 2, 3, 8-P1, 9),
`supabase/migrations/20260930120000_faz5_01_yetenek_havuzu.sql` (tablolar, sutun bazli GRANT'lar, RPC imzalari),
`20260930130000_faz5_03_ekibim_havuz_rpc.sql`, `app/profil/ekibim/page.tsx` + `ekibim-paneli.tsx` (ajans ekip sayfasi kalibi),
`app/ajans/agency-actions.ts` (`acceptInvitation` / `updateInvitationStatus`), `app/lib/email/account-emails.ts`
(`sendAccountEmail`, sablon kalibi), `app/lib/business-write.ts` (`getTeamContext` kalibi), `app/components/sections/top-nav.tsx`.

Bu is **yalniz uygulama kodu**: migration yok, yeni RPC yok. Amac: ajans kullanicilari `/ajans/havuz`'da uc havuzu tek
listede gorur (Ekibim uyeleri = `talent_id` dolu, harici kisiler = `talent_id` NULL), harici kisi ekler, roller atar,
davet e-postasi gonderir; Ekibim davet kabulu havuz kaydini da yazar. Ic oran karti ve claim sayfasi P2 (bu turda YOK).

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar (17 bolum 9)

- `organization_talent_records` / `_roles` yazimi dogrudan tablo INSERT/UPDATE/DELETE ile (RLS `talent.manage` + modul);
  `invitation_*` alanlari ve `legacy_agency_member_id` istemciden yazilmaz (GRANT yok) — davet yalniz `send_talent_record_invitation` RPC.
- Kimlik esleme yalniz `find_talent_by_contact(p_org_id, p_email, p_phone)`; `profiles`/`talents` e-posta/telefonla TARANMAZ.
- `internal` semasina dogrudan sorgu yok (P2'de oran RPC'leri).
- `visibility` gonderilmez (varsayilan `private`; baska deger CHECK'e takilir).
- Sapkali harf (a/i/u sapkali) yeni kodda yok; yorumlar Turkce ASCII. `npm run build` kaniti: route tablosu + hata yok + `.next/BUILD_ID`.

## Yapilacaklar

### 1. Kurulus baglami: `app/lib/org-context.ts` (yeni)

`getTalentPoolContext()` (sunucu): `organization_memberships` (`organization_id, role, status, organizations(id, display_name, account_type)`)
`user_id = auth.uid()` ve `status = 'active'`; her kurulus icin `rpc('has_org_permission', { p_org_id, p_permission: 'talent.view' })`
ve `'talent.manage'`, `'commercial.view'` (uc RPC cagrisi/kurulus; kurulus sayisi kucuk) + `rpc('org_module_enabled', { p_org_id, p_module_key: 'talent_pool' })`.
Donus: `{ orgs: { id, name, canView, canManage, canSeeRates }[] }` (yalniz modul acik VE canView olanlar). Bos ise sayfa
"Yetenek havuzu ajans hesaplari icindir" der. Birden fazla kurulus varsa `?kurulus=<id>` ile secim (ilk kurulus varsayilan).

### 2. `/ajans/havuz` (yeni: `app/ajans/havuz/page.tsx` + `havuz-paneli.tsx` + `havuz-actions.ts`)

**Sayfa (sunucu):** giris yoksa `redirect('/giris?redirect=/ajans/havuz')`; suspended -> `SuspendedNotice`; `getTalentPoolContext()`;
secili kurulus icin ONCE `rpc('sync_org_talent_pool', { p_org_id })` (kendi kendini onarma; hata loglanir, akis kesilmez; donen
sayi > 0 ise ust bilgi "N Ekibim uyesi havuza eklendi"), SONRA liste:
`from('organization_talent_records').select('id, talent_id, name, email, phone, city_id, instagram, notes, source, relationship_type, status, invitation_status, invitation_sent_at, linked_at, created_at, turkish_cities(name), organization_talent_record_roles(id, role_id, is_primary, service_roles(slug, name_tr))').eq('organization_id', org).order('name')`
(`invitation_token` SECILMEZ — yetki yok; secilirse 42501). `talent_id` dolu satirlar icin saglayici bilgisi:
`from('v_providers_public').select('id, display_name, avatar_url, provider_slug, city_id, is_published').in('id', talentUserIds)` —
DIKKAT: `talents.id` != `profiles.id` olabilir; `talents(user_id)` embed'i ile kullanici id'sini al (`talents!organization_talent_records_talent_id_fkey(user_id)`
veya `talents(user_id)`), sonra `v_providers_public.id = user_id`. Yayinda olmayan uye icin avatar/isim kayittaki `name`.
Roller: `service_roles` aktif liste (`id, slug, name_tr, sort_order`) form icin.

**Panel (istemci):**
- Ust: kurulus adi, sayaclar (Ekibim/Kashe uyesi, harici, davet bekleyen), filtreler: kaynak (Kashe uyesi / harici), rol,
  iliski turu, durum (aktif/pasif/engelli), arama (ad). URL'de degil, yerel state (sayfa tek kurulus, liste kucuk).
- Satir: ad (Kashe uyesi ise `/p/<user_id>` linki + "Kashe uyesi" etiketi; harici ise "Harici" + davet durumu etiketi:
  yok / gonderildi (tarih) / kabul / reddedildi), roller (birincil isaretli), iliski turu, sehir, durum. Satir menusu:
  Duzenle, Roller, Davet gonder (harici + e-posta var + durum none/declined), Pasife al / Aktife al, Engelle, Sil (harici; Kashe
  uyesi Ekibim'den cikarilir — burada silinmez, "Ekibim'den yonetilir" notu).
- **Harici kisi ekle** (canManage): ad (zorunlu), e-posta, telefon, sehir (select), Instagram, iliski turu, roller (coklu +
  birincil), not. E-posta veya telefon girilince (blur) `find_talent_by_contact` cagrilir: eslesme varsa "Bu kisi Kashe uyesi
  olabilir" uyarisi + "Kashe uyesi olarak bagla" secenegi (INSERT'te `talent_id` = donen id, `source: 'marketplace_linked'`);
  secilmezse harici olarak eklenir. Kayit: `insert({ organization_id, talent_id?, name, email, phone, city_id, instagram, notes,
  source, relationship_type, status: 'active' })` + roller INSERT. `created_by` gonderilmez (tetikleyici).
- Duzenle: ad/e-posta/telefon/sehir/Instagram/not/iliski/durum UPDATE; roller ekle/cikar/birincil degistir (once eski birincili
  false yap, sonra yeniyi true — tek birincil indeksi). `talent_id` istemciden degistirilmez (bagli ise alan kilitli).
- Yetkisi olmayan (canView ama canManage degil) yalniz okur; dugmeler gizli.

**Actions (`havuz-actions.ts`, sunucu):** `addTalentRecord`, `updateTalentRecord`, `setTalentRecordRoles`, `deleteTalentRecord`
(yalniz `talent_id` NULL olanlar), `lookupTalentByContact` (RPC sarmalayici), `sendTalentInvitation` (madde 3). Her action: giris
kontrolu, `revalidatePath('/ajans/havuz')`, hata mesajlari Turkce; RLS zaten yetkiyi zorlar, ama `canManage` sunucuda da
kontrol edilir (`has_org_permission` RPC) — kullaniciya duzgun mesaj icin.

### 3. Davet e-postasi (`sendTalentInvitation(recordId)`)

1. `rpc('send_talent_record_invitation', { p_record_id })` -> token (uuid). Hata kodlari: `22023` (e-posta yok / zaten bagli /
   engelli) -> mesaj; `42501` -> yetki.
2. E-posta: `app/lib/email/talent-invite-email.ts` (yeni; `account-emails.ts` kalibi): konu "<Kurulus adi> seni Kashe yetenek
   havuzuna ekledi", metin: kurulus adi, hangi rollerle eklendigi, baglanti `${SITE_URL}/davet/havuz/${token}` ("Kashe'de
   hesabin varsa giris yap, yoksa profesyonel olarak kaydol; kaydin sana baglanir"), 14 gun gecerli notu, `sendAccountEmail` ile.
   `/davet/havuz/[token]` SAYFASI P2'de — P1'de baglanti uretilir, sayfa henuz yok (P2'ye kadar 404 verir; raporda not).
3. Gonderim basarisiz (`sent: false`) olsa da RPC kaydi `sent` yaptigi icin panelde "Gonderildi" gorunur; action hatayi doner
   ("E-posta gonderilemedi, tekrar dene") ve RPC yeniden cagrilabilir (yeni token, eski gecersiz). Raporla.

### 4. Ekibim -> havuz kaydi (`agency-actions.ts`)

`updateInvitationStatus` `'accepted'` ile basarili olduktan sonra: `agency_members` satirini bul (`agency_id`, `professional_id
= user.id` -> `id`), `rpc('ensure_talent_record_for_membership', { p_agency_member_id })` cagir; hata akisi KESMEZ
(`console.error('[havuz] ensure', error)`) — `/ajans/havuz` acilirken `sync_org_talent_pool` zaten tamamlar. `removeMember` /
`leaveAgency`: havuz kaydina DOKUNULMAZ (kisi havuzda kalir; ajans isterse havuzdan siler) — 17 bolum 2 karari; raporda not.

### 5. Menu ve giris noktalari

`top-nav.tsx`: `isAgency` icin `{ href: '/ajans/havuz', label: 'Yetenek Havuzu' }` (Basvurularim'in yanina). `/profil/ekibim`
sayfasina ust bilgi: "Ekibin havuzda: Yetenek havuzu ->" linki (tek satir). `/profil`'de bolum EKLENMEZ.

### 6. Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -rn "from('organization_talent_records')\|from(\"organization_talent_records\")" app` -> yalniz havuz sayfasi/actions.
- `grep -rn "invitation_token" app` -> 0 (istemci/sunucu hic secmez).
- `grep -rn "rpc('send_talent_record_invitation'\|rpc('find_talent_by_contact'\|rpc('ensure_talent_record_for_membership'\|rpc('sync_org_talent_pool'" app` -> her biri tek yer.
- `grep -rn "from('talents')\|from('profiles')" app/ajans/havuz app/lib/org-context.ts` -> e-posta/telefonla arama YOK.
- Sapkali harf: yeni/degisen dosyalarda 0.
- **Onizleme (Sunucu Ajans hesabi = gmail admin; canli tur Guven):**
  1. `/ajans/havuz` acilir: 2 Kashe uyesi (dolumdan; Test Pro + diger), roller `provider_services`'tan, "Kashe uyesi" etiketi.
  2. Harici kisi ekle: "Deneme Harici", e-posta `guvenyapicioglu+harici@gmail.com` (Guven'in kontrolundeki adres), rol DJ birincil
     -> listede "Harici"; e-posta blur'unda esleme uyarisi CIKMAMALI (Kashe uyesi degil).
  3. Harici kisi ekle 2: e-posta Test Pro'nun hotmail adresi -> "Kashe uyesi olabilir" uyarisi -> "bagla" -> `talent_id` dolu,
     source marketplace_linked -> ama ayni kurulusta Test Pro zaten var -> 23505 -> mesaj "bu kisi havuzda zaten var"; kayit olusmaz.
  4. "Deneme Harici" -> Davet gonder -> e-posta gelir (Resend), panelde "Gonderildi (tarih)"; baglanti `/davet/havuz/<token>` (P2'ye kadar 404 — beklenen).
  5. Duzenle: iliski turu `staff`, ikinci rol ekle, birincili degistir -> kaydedilir; Pasife al -> etiket.
  6. Test Pro hesabiyla (professional): `/ajans/havuz` -> "ajans hesaplari icindir" (uyelik var ama `talent.view` rolu? Ekibim
     uyesi FAZ 0 aynasinda `viewer`/`member` -> `talent.view` YOK -> sayfa bos mesaj). Raporla.
  Ardindan (Guven, uretim SQL Editor, salt okunur):
  ```sql
  select r.name, r.source, r.talent_id is not null as bagli, r.relationship_type, r.status, r.invitation_status, r.invitation_sent_at,
         (select string_agg(sr.slug || case when x.is_primary then '*' else '' end, ',') from public.organization_talent_record_roles x join public.service_roles sr on sr.id = x.role_id where x.record_id = r.id) as roller
    from public.organization_talent_records r order by r.created_at;
  ```
  Beklenen: 2 dolum kaydi + "Deneme Harici" (external_manual -> invited, sent, dj*); asama13 K5 0, K14 = 20100.

## Yapilmayacaklar

- Ic oran karti, claim sayfasi (`/davet/havuz/[token]`), "sizi eklemis" bandi: P2. Pazaryerinden "Havuza ekle": P3.
- `agency_members`, Ekibim sayfasi mantigi, davet kabul akisi (RPC cagrisi disinda) degismez. Migration yok.
- `visibility`, `invitation_*`, `legacy_agency_member_id`, `created_by` istemciden yazilmaz.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, onizleme notlari (Claude Code oturumsuz kosabildikleri),
sapma ve nedeni. Commit ATMA.
