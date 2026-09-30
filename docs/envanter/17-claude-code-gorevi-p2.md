# Claude Code gorevi — FAZ 5 / P2: davet sayfasi (`/davet/havuz/[token]`), "sizi eklemis" bandi, gizli ic oran karti

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/17-faz5-yetenek-havuzu.md` (bolum 3 RPC'ler, bolum 8 P2,
bolum 9 kurallar). ON KOSUL: P1 deploy'da ve davet e-postasi gidiyor (Resend `EMAIL_FROM` duzeltildi).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/17-faz5-yetenek-havuzu.md` (bolum 3, 8-P2, 9),
`supabase/migrations/20260930120000_faz5_01_yetenek_havuzu.sql` (RPC imzalari ve hata kodlari: `claim_talent_record`,
`claim_talent_record_by_id`, `decline_talent_record_invitation`, `claimable_talent_records_for_me`,
`internal_talent_rates_list`, `internal_talent_rate_upsert`, `internal_talent_rate_close`), `app/ajans/havuz/*` (P1),
`app/lib/org-context.ts`, `app/profil/page.tsx`, `app/giris/page.tsx` ve `app/uye-ol` (redirect parametresi destegi var mi?).

Bu is **yalniz uygulama kodu**: migration yok, yeni RPC yok. Uc parca: (A) davet baglantisi sayfasi, (B) giris sonrasi
"sizi havuzuna eklemis" bandi, (C) `/ajans/havuz`'da gizli ic oran karti.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar (17 bolum 9)

- Davet tokeni yalniz URL'den gelir ve yalniz RPC'ye verilir; token ile tablo SORGUSU yok (sutun kapali). Oturumsuz ziyaretci
  icin kurulus adi/kayit bilgisi GOSTERILMEZ (token'i dogrulayacak acik RPC yok; genel metin yeterli).
- Claim yalniz `claim_talent_record` / `claim_talent_record_by_id` ile; e-posta eslesmesini DB dogrular, istemci karar vermez.
- Ic oranlar yalniz `internal_talent_rate_*` RPC'leri; `internal` semasina dogrudan sorgu yok; kart yalniz `commercial.view`
  olan kullaniciya render edilir (sunucuda `has_org_permission` ile), yazma dugmeleri yalniz `commercial.manage`.
- Sapkali harf yok; kullaniciya gorunen metinler duzgun Turkce (ğ ş ı ü ö ç), yorumlar ASCII. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. `/davet/havuz/[token]` (yeni: `app/davet/havuz/[token]/page.tsx` + `davet-paneli.tsx` + `actions.ts`)

- Token uuid bicimi degilse `notFound()`.
- **Oturumsuz:** baslik "Bir kuruluş seni Kashe yetenek havuzuna ekledi", aciklama (Kashe'de profesyonel/ajans hesabi olan
  kisi kaydi sahiplenebilir; hesabin yoksa profesyonel olarak kaydol), iki dugme: "Giriş yap" ->
  `/giris?redirect=/davet/havuz/<token>`, "Profesyonel olarak kaydol" -> `/uye-ol?rol=professional&redirect=/davet/havuz/<token>`
  (uye-ol `redirect`/`rol` parametrelerini desteklemiyorsa YALNIZ redirect'i giris akisinda kullan ve raporla; kayit sonrasi
  B bandi zaten yakalar). `sanitizeReturnPath` ile.
- **Oturumlu:** profil rolu `professional`/`agency` degilse: "Bu davet profesyonel ve ajans hesapları için. Hesabın müşteri
  hesabı." + `/profil` linki (RPC de `no_data_found` verirdi; onceden anlat). Rol uygunsa iki dugme: **"Kaydı sahiplen"** ->
  `claimTalentInvitation(token)` -> `rpc('claim_talent_record', { p_token })`; **"Reddet"** -> `declineTalentInvitation(token)`.
  Hata eslemesi (`error.code`): `42501` -> "Bu davet başka bir e-posta adresine gönderilmiş; hesabının e-postası eşleşmiyor."
  (`message` 'giris gerekir' iceriyorsa giris sayfasina); `P0002` (no_data_found): `message` 'profesyonel' iceriyorsa "Sahiplenmek
  için profesyonel veya ajans profili gerekir", degilse "Davet bulunamadı ya da daha önce kullanılmış."; `22023` -> "Davetin
  süresi dolmuş; kuruluştan yeni davet iste." (message 'zaten sahiplenilmis' iceriyorsa onu yaz); `23505` -> "Bu kuruluşta sana
  bağlı bir kayıt zaten var." Basari: kutlama metni "Kayıt profiline bağlandı. Kuruluş artık seni havuzunda Kashe üyesi olarak
  görüyor." + `/profil` dugmesi; `revalidatePath('/profil')`.
- Metadata `robots: noindex`.

### B. "Sizi havuzuna eklemis" bandi (`app/profil/page.tsx`)

Profil sayfasi yuklenirken (rol `professional`/`agency`) `rpc('claimable_talent_records_for_me')` -> satir varsa ustte band:
"**<organization_name>** seni yetenek havuzuna ekledi" + "Sahiplen" (`claim_talent_record_by_id(record_id)`, ayni hata eslemesi)
+ "Şimdi değil" (yerel gizleme; `localStorage` anahtari `havuz-band-<record_id>`; sunucu kaydi yok). Birden fazla satir ->
liste. Client bileseni `app/profil/havuz-bandi.tsx`; action'lar A'daki `actions.ts`'ten paylasilir (ortak `app/lib/havuz-claim-actions.ts`
olabilir). Client rolunde RPC cagrilmaz (satir donse de sahiplenemez).

### C. Gizli ic oran karti (`app/ajans/havuz`)

- `getTalentPoolContext()` -> `canSeeRates` zaten var; `canManageRates` (`commercial.manage`) ekle.
- Panelde her kayit satirinda `canSeeRates` ise "İç oran" dugmesi -> satir altinda kart (istemci; veri action ile):
  `listTalentRates(orgId, recordId)` -> `rpc('internal_talent_rates_list', { p_org_id, p_record_id })`; tablo: rol, tutar (TL,
  `Intl.NumberFormat('tr-TR')`), birim (per_job "iş başı", per_hour "saatlik", per_day "günlük"), geçerlilik (`valid_from` – `valid_to`
  ya da "açık"), not; kapali satirlar soluk. Gorunen etiket: "Gizli — yalnız ticari yetkililer görür".
- `canManageRates` ise: "Oran ekle/güncelle" formu — rol (kaydin rolleri; rol yoksa uyari "önce rol ata"), tutar (>= 0), birim,
  geçerlilik başlangıcı (varsayilan bugun), not -> `upsertTalentRate(...)` -> `rpc('internal_talent_rate_upsert', { p_org_id,
  p_record_id, p_role_id, p_cost, p_basis, p_currency: 'TRY', p_valid_from, p_note })`; acik satirda "Kapat" ->
  `rpc('internal_talent_rate_close', { p_org_id, p_rate_id, p_valid_to: bugun })`. Hata: `42501` -> "Bu bilgiye erişim yetkin yok."
  (kart yine gizlenir), `22023` -> mesajdaki neden.
- `canSeeRates` degilse kart, dugme ve action cagrisi HIC yok (DOM'da da yok). Action'lar sunucuda `has_org_permission` RPC ile
  yetkiyi ayrica dogrular (duzgun mesaj icin; asil kapi DB).
- Ic oran verisi istemciye yalniz karti acan istek aninda gider; sayfa ilk yuklemesinde TOPLU oran cekilmez.

### C2. Davet: "Yeniden gönder" (P1 eksigi)

`havuz-paneli.tsx`: `invitation_status = 'sent'` satirlarda da davet dugmesi gorunur, etiketi **"Yeniden gönder"**; ayni
`sendTalentInvitation` action'i (RPC yeni token uretir, eskisini gecersiz kilar, `invitation_sent_at` yenilenir). `accepted`
durumunda dugme yok. Onay penceresi: "Önceki bağlantı geçersiz olacak. Yeniden gönderilsin mi?"

### C3. Yikici islemlerde onay (Guven istegi)

`havuz-paneli.tsx`: **Sil** ve **Engelle** dugmeleri once satir ici onay ister (tarayici `confirm()` DEGIL; panel icinde
kucuk onay kutusu): Sil -> "<Ad> havuzdan silinecek. Emin misin?" [Sil] [Vazgeç]; Engelle -> "<Ad> engellenecek; ekip
onerilerinde gorunmez. Emin misin?" [Engelle] [Vazgeç]. Pasife al / Aktife al onay istemez (geri alinabilir).

### D. Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu (`/davet/havuz/[token]`) + hata yok + `.next/BUILD_ID`.
- `grep -rn "internal_talent_rate" app` -> yalniz havuz action dosyasi (3 RPC, tek yer); `grep -rn "from('internal\|internal\." app` -> 0
  (yorum haric).
- `grep -rn "claim_talent_record\|decline_talent_record_invitation\|claimable_talent_records_for_me" app` -> ortak action dosyasi.
- `grep -rn "invitation_token" app` -> 0 (yorum haric).
- Sapkali harf 0; kullaniciya gorunen metinler duzgun Turkce.
- **Canli tur (Guven):**
  1. Oturumsuz: e-postadaki baglanti -> genel metin + iki dugme; "Giriş yap" -> giris -> ayni sayfaya donus.
  2. Test Musteri (client) ile baglanti -> "profesyonel ve ajans hesapları için" mesaji; RPC cagrilmadi.
  3. `guvenyapicioglu+harici@gmail.com` ile **profesyonel** kaydol (dogrulama e-postasi aliasa gelir) -> giris -> `/profil`'de
     "Sunucu Ajans seni yetenek havuzuna ekledi" bandi -> "Sahiplen" -> basari; `/ajans/havuz`'da "Deneme Harici" artik
     "Kashe üyesi" (talent bagli, source marketplace_linked, invitation accepted).
  4. Ayni baglanti tekrar -> "Davet bulunamadı ya da daha önce kullanılmış."
  4b. Baska bir harici kayitta "Yeniden gönder" -> yeni e-posta, eski baglanti "kullanılmış" verir.
  5. Sunucu Ajans (owner: commercial.manage): Test Pro satirinda "İç oran" -> kart bos -> oran ekle (Fotoğrafçı, 5000, günlük)
     -> listede; ikinci oran (6000, bugun) -> ilki kapandi (valid_to = bugun-1), yenisi acik; "Kapat" -> valid_to bugun.
  6. Test Pro (Ekibim uyesi, viewer) `/ajans/havuz`'a giremez (P1'den); kart testi icin yetkili olmayan ikinci bir ajans uyesi
     yoksa bu madde atlanir, raporla.
  SQL (uretim, salt okunur):
  ```sql
  select r.name, r.source, r.talent_id is not null as bagli, r.invitation_status, r.linked_at
    from public.organization_talent_records r where r.name like 'Deneme%';
  select action, target_table, detail->>'op' as op, created_at from internal.access_audit
   order by created_at desc limit 8;
  ```
  Beklenen: Deneme Harici `marketplace_linked / bagli true / accepted / linked_at dolu`; denetimde `write organization_talent_records
  talent.claim`, `write organization_talent_rates` x3, `read organization_talent_rates` >= 1. `asama13` K5 0, K13 0, K14 = 30000.

## Yapilmayacaklar

- Pazaryerinden "Havuza ekle" (P3). Mukerrer birlestirme (FAZ 8). `visibility` degismez.
- `internal` semasina dogrudan sorgu, token ile tablo sorgusu, e-posta eslesmesini istemcide yapma: YOK.
- Migration yok; RPC imzalari degismez.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, uye-ol redirect destegi durumu, sapma ve nedeni. Commit ATMA.
