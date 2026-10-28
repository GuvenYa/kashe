# Claude Code gorevi — FAZ 10a / P1: Uyelik tek tablo (davet/uyelik akislari RPC'lere, eski tablo okumalari `organization_memberships` / `organization_invitations` / `organization_team_public`'a; eski tablo adi uygulamada 0)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/38-faz10-temizlik.md` bolum 3 (10a) ve bolum 6 (10a-DB/01 kapanis
notu) + `supabase/migrations/20261028120000_faz10a_01_uyelik_tek_tablo.sql` (dalda uygulanmis; uretime P1 ile birlikte gider). Dal:
`faz10a/p1` (Guven acar, `faz10a/db` uzerinden). **Migration YOK.** Eski tablolar (`agency_members`, `business_members`, `agency_invitations`,
`business_invitations`) dalda SALT OKUNUR: `authenticated` yazma yetkisi yok (42501), ayna tetikleyicileri yok — bu yuzden eski yazma
akislari ZATEN kirik; P1 bunlari RPC'lere tasir ve tum okumalari yeni tablolara cevirir.

---

Kashe reposundasin. Once `git status` (temiz; dal `faz10a/p1`). Oku: `CLAUDE.md`, migration dosyasinin baslik yorumu (1-9 maddeler) ve
RPC govdeleri (hata metinleri ASCII; kodlar asagida), `app/lib/org-actions.ts` (`setOrgMemberRole` + `rolHataMesaji` deseni: DB ASCII
metin -> Turkce UI), `app/lib/org-roles.ts` (`ORG_ROLES`, `ORG_ROLE_LABELS`), `app/ajans/agency-actions.ts`, `app/ajans/agency-data.ts`,
`app/kurumsal/business-actions.ts`, `app/kurumsal/business-data.ts`, `app/lib/business-write.ts`, `app/profil/ekibim/*`,
`app/profil/kurumsal-ekip/*`, `app/davetlerim/*`, `app/ajans/havuz/{page.tsx,havuz-actions.ts}`, `app/mesajlar/{[id]/page.tsx,actions.ts}`,
`app/p/[id]/page.tsx`, `app/profil/page.tsx`, `app/lib/panel-menu.ts` (yalniz yorum), `app/bildirimler/bildirim-listesi.tsx`.

**Kirmizi cizgi:** migration/RPC YOK; is bitince `grep -rn "agency_members\|business_members\|agency_invitations\|business_invitations" app`
yalniz YORUM satirlarinda ("eski ..." aciklamasi) kalabilir, `from('...')`/embed/tip adi olarak 0; `organization_memberships` ve
`organization_invitations`'a uygulamadan INSERT/UPDATE/DELETE YOK (yalniz SELECT; yazma tek yol RPC); `v_agency_members` /
`v_business_members` uyumluluk gorunumleri KULLANILMAZ (Hijyen 05'te dusecek); kurallar DB'de — uygulamadaki kontroller yalniz anlasilir
mesaj icin, DB'nin reddettigini "bir daha" dogrulamaya calisma; sapkali harf yok, yorumlar ASCII, UI Turkce. Commit ATMA.

## 0) DB sozlesmesi (dalda var)

RPC'ler (hepsi `authenticated`; hata kodlari: 42501 yetki/oturum, 22023 kural, 23505 bekleyen cift davet, P0002 satir yok):

- `org_invitation_create(p_org uuid, p_email text, p_role organization_member_role = 'viewer', p_message text = null) -> uuid` (davet id).
  `members.manage` gerekir (owner/admin). Kurallar: e-posta normalize edilir (lower/trim) ve regex ile dogrulanir ('gecersiz e-posta
  adresi'), `owner` verilemez ('sahip rolu davetle verilemez'), mesaj <= 1000 ('davet mesaji en fazla 1000 karakter'), kendine ('kendine
  davet gonderemezsin'), kurulusun kendi hesabina ('kurulusun kendi hesabi davet edilemez'), zaten uyeye ('bu kullanici zaten uye') 22023;
  ayni e-postaya bekleyen davet 23505 ('Bu e-postaya zaten bekleyen bir davet var'). Kayitli davetliye `team` bildirimi tetikleyiciyle gider.
- `org_invitation_cancel(p_id uuid) -> boolean` — `members.manage`; bekleyen -> `cancelled`; zaten iptalse true (idempotan); kabul/ret
  edilmise 22023 ('davet artik beklemede degil (...)').
- `org_invitation_respond(p_id uuid, p_accept boolean) -> uuid` — davetli (`invited_user_id = auth.uid()` ya da e-posta eslesmesi) degilse
  42501 ('bu davet sana ait degil'); beklemede degilse 22023; suresi dolmussa 22023 ('davetin suresi dolmus'; durum `pending` KALIR — liste
  `expires_at < now()` olani "Süresi doldu" gosterir ve dugmeleri gizler); kabulde ajans kurulusuna yalniz `professional` hesap 22023
  ('ajansa katilmak icin profesyonel hesap gerekir'), kurulusun kendi hesabi 22023; kabul -> `organization_memberships` satiri (uyelik id
  doner; rol = davet rolu, `invited_by` davet eden), davet `accepted`, kurulus sahibine `team` bildirimi, FAZ 5 havuz kaydi DB'de acilir
  (`ensure_talent_record_for_membership` cagrisi ARTIK GEREKMEZ). Ret -> `declined`, NULL doner.
- `org_member_remove(p_org uuid, p_user uuid) -> boolean` — `members.manage`; kendini 22023 ('kendini cikaramazsin ...'), kurulus sahibi
  22023 ('kurulus sahibi cikarilamaz'), owner/admin uyeyi yalniz owner 42501 ('owner/admin uyeyi yalniz kurulus sahibi cikarir'), son sahip
  22023, uye degil P0002 ('uyelik yok'). Silme kurulusun sohbet atamalarini (`conversation_assignees`) DB'de temizler.
- `org_member_leave(p_org uuid) -> boolean` — kendi uyeligi; uye degil P0002 ('bu kurulusun uyesi degilsin'); kurulus sahibi 22023
  ('kurulus sahibi ayrilamaz'); son sahip 22023.
- Rol degisimi: mevcut `org_member_set_role(p_membership_id, p_role)` (`app/lib/org-actions.ts`, degismez).
- `ensure_talent_record_for_membership(p_membership_id uuid)` — parametre adi degisti (eski `p_agency_member_id`); P1'de tek cagri
  (`agency-actions.ts` kabul akisi) KALKAR (DB kabulde yapiyor).

Okuma sozlesmesi:

- `organization_memberships` (SELECT: kendi satirin + uyesi oldugun kuruluslarin tum uyelikleri + admin): `id, organization_id, user_id,
  role (organization_member_role), permissions, status ('invited'|'active'|'suspended'), invited_by, joined_at, legacy_source
  ('agency_members'|'business_members'|'owner_seed'|null)`. **Kurulusun kendi hesabi** = `legacy_source = 'owner_seed'` (ayni zamanda
  `user_id = organizations.legacy_profile_id`); Ekibim/kurumsal ekip listelerinde GOSTERILMEZ (eski tablolarda yoktu). Embed:
  `organizations!organization_memberships_organization_id_fkey (id, legacy_profile_id, account_type, display_name)` ve
  `profiles!organization_memberships_user_id_fkey (...)`.
- `organization_invitations` (SELECT: davetli [`invited_user_id` ya da `invited_email = auth.email()`] + `members.manage` + admin): `id,
  organization_id, invited_email, invited_user_id, invited_by_id, role, status ('pending'|'accepted'|'declined'|'cancelled'|'expired'),
  invitation_message, created_at, responded_at, expires_at`. Davet eden kurulusun adi/avatari: `organizations_public` (`id, slug,
  display_name, account_type, legacy_profile_id`; herkese acik) + `profiles` (`legacy_profile_id` -> `avatar_url`). Iki adimli sorgu (davetler ->
  `organizations_public.in('id', ...)` -> `profiles.in('id', legacy ids)`), embed denemek yerine.
- `organization_team_public` (anon/authenticated; `membership_id, organization_id, agency_id [= ajansin profil id'si], user_id, joined_at`):
  ajansin YAYINDAKI ekip uyeleri (ajans ve uye saglayici olarak yayinda+onayli). `/p/[id]` ekip listesi ve profesyonelin "temsil eden
  ajanslar" listesi yalniz bunu okur. Rol sutunu yok (acik yuzeyde rol gosterilmez).
- Kurulus id'si: `organizations` (`legacy_profile_id = user.id`; uye RLS ile okur) — ajans/kurum sahibi kendi kurulusunu boyle bulur.
  `app/lib/org-context.ts` zaten bir kurulus baglami tasiyor; varsa onu kullan, yoksa kucuk yardimci.

## 1) Ortak katman — `app/lib/uyelik.ts` (yeni; sunucu)

- `kurulusumunId(supabase, userId): Promise<string | null>` — `organizations` `legacy_profile_id = userId` -> id.
- `uyeliklerim(supabase, userId)` -> `{ membershipId, organizationId, legacyProfileId, accountType ('agency'|'business'), displayName,
  role, status, legacySource }[]` (yalniz `status = 'active'`, embed ile tek sorgu).
- `eskiKurumRolu(role, legacySource)`: `owner_seed` ya da `owner` -> `'owner'`, `admin` -> `'manager'`, digerleri -> `'member'` — eski
  `business_members.member_role` semantigi (yazma = owner+manager; pasif = member). `map_org_role_to_legacy` ile ayni eslem; yorumda belirt.
- `uyelikHataMesaji(error)` — `org-actions.ts`'teki `rolHataMesaji` deseni: ASCII DB metinlerini Turkce UI'ya cevirir (yukaridaki tum
  metinler + 23505 "Bu e-postaya zaten bekleyen bir davet var." + 42501 "Bu işlem için yetkin yok." + P0002 "Kayıt bulunamadı." + varsayilan
  "İşlem yapılamadı, tekrar dene."). `rolHataMesaji`'ni da buraya tasiyip `org-actions.ts`'in buradan okumasi serbest (tek kaynak).

## 2) `app/ajans/agency-actions.ts` + `app/ajans/agency-data.ts`

- `inviteProfessional({ email, role, message })` -> `rpc('org_invitation_create', { p_org: kurulusumunId, p_email, p_role: role, p_message })`.
  Rol: `OrgRole` (`ORG_ROLES` eksi `owner`); varsayilan `viewer`. Eski `AgencyMemberRole` ('owner'|'manager'|'member') ve `MEMBER_ROLE_OPTIONS`
  kalkar; form (`profil/ekibim/uye-davet-formu.tsx`) secenekleri `ORG_ROLE_LABELS`'tan (owner haric), kisa ozet `ORG_ROLE_SUMMARIES`
  (varsa tooltip/alt yazi). Uygulama tarafi on kontrol: e-posta bos/kalip, kendi e-postasi (anlasilir mesaj); gerisi DB.
- `cancelInvitation(id)` -> `org_invitation_cancel`. `acceptInvitation(id)` / `declineInvitation(id)` -> `org_invitation_respond(id, true/false)`;
  `updateInvitationStatus` yardimcisi, `canAccept/canDecline/canCancel` on kontrolleri (UI dugme gorunurlugu icin kalabilir) ve kabul
  sonrasi `ensure_talent_record_for_membership` blogu KALKAR.
- `removeMember(membershipId)` -> satiri `organization_memberships`'ten oku (`organization_id, user_id`) -> `org_member_remove(p_org, p_user)`.
  `leaveAgency(membershipId)` -> `org_member_leave(p_org)`. `updateMemberRole` SILINIR (rol kutusu zaten `setOrgMemberRole`).
- `agency-data.ts` tipleri: `AgencyMember` -> `{ id, organization_id, user_id, role: OrgRole, status, joined_at, legacy_source }`;
  `AgencyInvitation` -> yeni sutunlar (`role: OrgRole`, `invited_by_id`); `AgencyInvitationWithRelations.agency` -> `{ id [= legacy_profile_id],
  display_name, avatar_url }`. `getMemberRoleLabel` -> `ORG_ROLE_LABELS`. Davet durumu etiketleri/tonlari aynen; `expires_at < now()` ve
  `pending` -> "Süresi doldu" tonu `neutral`, dugmeler gizli.
- `revalidatePath`: `/profil/ekibim`, `/davetlerim`, `/profil`, `/ajans/havuz` (kabulde havuz kaydi dogar).

## 3) `app/kurumsal/business-actions.ts` + `business-data.ts`

Ajansla birebir: `inviteUserToTeam` -> `org_invitation_create` (kurum kurulusu; roller `ORG_ROLES` eksi owner, varsayilan `viewer`);
`cancelTeamInvitation` -> cancel; `acceptTeamInvitation`/`declineTeamInvitation` -> respond; `removeTeamMember` -> `org_member_remove`;
`leaveTeam` -> `org_member_leave`; `updateTeamMemberRole` silinir. Tipler `BusinessMember`/`BusinessInvitation` yeni sutunlara.
`revalidatePath`: `/profil/kurumsal-ekip`, `/davetlerim`, `/profil`.

## 4) Okumalar (eski tablo adi 0)

- `app/lib/business-write.ts` (5 fonksiyon): `uyeliklerim` + `eskiKurumRolu` ile. `getWritableBusinesses`: `accountType = 'business'` ve eski
  rol owner/manager (sahibin kendi kurulusu `owner_seed` DAHIL mi? Eskiden `business_members` sahibi icermiyordu; sahip zaten kendi profil
  id'siyle yazar — bugunku davranisi koru: `owner_seed` HARIC); `business_id` = `legacyProfileId`, `business_name` = `displayName`.
  `canWriteForBusiness(businessId)`: o kurulusta eski rol owner/manager; `canOwnForBusiness`: owner; `getOwnedBusinessIds`;
  `getTeamContext`: `teamBusinessIds` = uyesi olunan business kuruluslarin `legacyProfileId`'leri (owner_seed haric), setler ayni kural.
- `app/mesajlar/actions.ts`: `sendMessage` kurumsal ekip erisimi (owner/manager -> eski rol), `getTeamConversationIds` (pasif = eski rol
  `member`), `assignConversation` ("ekibinde mi": `organization_memberships` — ajansin kurulusu + `user_id = professionalId` + `status =
  'active'` + `legacy_source <> 'owner_seed'`).
- `app/mesajlar/[id]/page.tsx` `teamMembers`: ajansin aktif uyeleri (owner_seed haric) icinden `profiles.role = 'professional'` olanlar.
- `app/profil/ekibim/page.tsx`: TEK sorgu `organization_memberships` (kurulusum, `status = 'active'`, owner_seed haric, embed `profiles`
  + `service_categories`), `joined_at` desc; `kurulusRolleri` ikinci sorgusu KALKAR (rol satirda). Davetler: `organization_invitations`
  (`organization_id = kurulusum`, `created_at` desc). `uye-listesi.tsx` membershipId = satir id (ayni). Bos durum metinleri aynen.
- `app/profil/kurumsal-ekip/page.tsx`: ayni (business; uye herhangi bir hesap olabilir — kategori join yok).
- `app/davetlerim/page.tsx`: tek sorgu `organization_invitations` (RLS zaten davetliye gore suzer; `.or(invited_user_id/invited_email)` filtresi
  kalabilir), sonra `organizations_public` + `profiles` (ad/avatar); `account_type`'a gore iki listeye (`davetlerim-listesi.tsx` ajans,
  `kurumsal-davetler-listesi.tsx` kurum) dagit; `href` `/p/${legacy_profile_id}`; rol etiketi `ORG_ROLE_LABELS`. Ilan davetleri
  (`listing_invitations`) DEGISMEZ.
- `app/ajans/havuz/page.tsx` (`legacyIdler` -> `organization_memberships.in('id', ...)`, `status = 'active'`) ve `havuz-actions.ts`
  `deleteTalentRecord` ("aktif Ekibim uyesi" kontrolu ayni tabloyla). Yorumlardaki "agency_members" ifadeleri "Ekibim uyeligi
  (organization_memberships)" olur. `legacy_agency_member_id` sutun ADI degismez (uyelik id'si tasir; Hijyen 05).
- `app/p/[id]/page.tsx`: ajans profili ekip listesi -> `organization_team_public` (`agency_id = profile.id`) + `profiles` (id, full_name,
  avatar_url, bio, kategori) — `member_role` rozeti KALKAR (acik yuzeyde rol yok; varsa "Üye" sabit metni de koyma, sadece kart);
  profesyonelin "temsil eden ajans" listesi -> `organization_team_public` (`user_id = profile.id`) + `profiles` (ajans ad/avatar).
  `canReview` kurum sahibi kontrolu: `uyeliklerim` icinde `accountType = 'business'` ve `legacySource = 'owner_seed'` (ya da rol owner) ->
  `legacyProfileId`'ler. Siralama/gorunum aynen; Kesfet/portal DOKUNULMAZ.
- `app/profil/page.tsx`: ajans uye sayisi (owner_seed haric aktif uyelik), bekleyen davet sayisi (`organization_invitations`, `pending`,
  `expires_at > now()`), kurum uye sayisi ayni; profesyonelin ajanslari (`uyeliklerim` `accountType = 'agency'`, owner_seed haric;
  `agency.id` = `legacyProfileId`, ad `displayName`, avatar `profiles`).
- `app/lib/panel-menu.ts` yorumu guncellenir (eski tablo adi kalmasin).
- `app/bildirimler/bildirim-listesi.tsx`: `TYPE_LABELS`'a `team: 'Ekip'` (FAZ 10a yorumu).

## 5) Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`; degisen dosyalarda `npx eslint`; `npm run build`.
- `grep -rn "agency_members\|business_members\|agency_invitations\|business_invitations" app` -> yalniz ASCII yorum satirlari (eski adi
  aciklayan), kod 0. `grep -rn "v_agency_members\|v_business_members" app` BOS. `grep -rn "from('organization_memberships')\|from('organization_invitations')" app`
  yalniz `.select(` ile (insert/update/delete yok). `grep -rn "ensure_talent_record_for_membership" app` BOS.
- `grep -rnP '[âîûÂÎÛ]' <degisen dosyalar>` bos.
- Onizleme (Sahne; dal projesi): ajans `sahne+nova-ajans@kashe.net` (ya da `docs/sahne/hesaplar.md`'den bir ajans sahibi) ->
  `/profil/ekibim` uyeler ve davetler listelenir (roller ince rol etiketiyle); yeni davet (Sahne'de uye olmayan bir profesyonel e-postasi)
  -> davetlinin `/davetlerim`'inde gorunur (ad + avatar) ve `/bildirimler`'de "Ekip" bildirimi -> kabul -> ekipte gorunur, ajans
  bildirim alir, `/ajans/havuz`'da kayit var -> rol degistir -> cikar (havuz kaydi "ayrildi"). Ayni e-postaya ikinci davet -> "Bu e-postaya
  zaten bekleyen bir davet var." Kurum sahibi (`docs/sahne/hesaplar.md`) ayni akis `/profil/kurumsal-ekip` ile. `/p/<ajans id>` ekip
  listesi (yalniz yayindaki uyeler), `/p/<pro id>` "temsil eden ajans".

## 6) Rapor

Bitince kisa rapor: degisen dosyalar, kalan grep sonuclari (yorum satirlari), `uyelik.ts` imzalari, sapmalar (gerekcesiyle). Commit ATMA.
