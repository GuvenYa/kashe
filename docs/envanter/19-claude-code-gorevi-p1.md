# Claude Code gorevi — FAZ 7a / P1: teklif editoru (`/ajans/teklifler`), ekipten teklif, gonderme + e-posta, gizli ic maliyet

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/19-faz7-ticari-katman.md` (bolum 2 kararlar, bolum 3 model/RPC,
bolum 8 P1, bolum 9 kurallar). ON KOSUL: 7a-DB/01 uretimde (commit `6a5be05`).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/19-faz7-ticari-katman.md` (bolum 2, 3, 8-P1, 9),
`supabase/migrations/20261003120000_faz7a_01_teklif_portal.sql` (tablolar, SUTUN YETKILERI — ozellikle `portal_access_links`'te
`token_hash` secilemez, `proposals`/`proposal_versions` INSERT yok; RPC imzalari: `proposal_create`, `proposal_new_version`,
`proposal_send`, `proposal_revoke_link`, `proposal_set_status`, `internal_proposal_items_list`, `internal_proposal_item_upsert`; hata
metinleri), `app/lib/org-context.ts` (`getCrewContext`, `CrewOrg`), `app/etkinliklerim/[id]/ekip-paneli.tsx` + `ekip-actions.ts`
(P2 deseni, ekip durum satiri), `app/ajans/havuz/havuz-actions.ts` (satir 425-450: `havuzDavetEmail` + `sendAccountEmail` deseni),
`app/lib/email/talent-invite-email.ts` (sablon deseni, `SITE_URL`), `app/ajans/ekipler/page.tsx` (liste sayfasi deseni),
`app/components/sections/top-nav.tsx` (menu).

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. Parcalar: (A) kurulus baglami, (B) `/ajans/teklifler` liste,
(C) `/ajans/teklifler/[id]` editor, (D) ekip panelinde "Teklif oluştur", (E) gonderme + e-posta, (F) gizli ic maliyet karti.
Portal sayfasi (`/portal/teklif/[token]`) P2'de — BU ISTE YOK.
Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar (19 bolum 9 + migration)

- `proposals` ve `proposal_versions` tablolarina INSERT YOK (yetki de yok): teklif yalniz `rpc('proposal_create', ...)`, surum yalniz
  `rpc('proposal_new_version')`. `proposals.status` / `current_version_id` dogrudan yazilmaz (yalniz RPC). `proposals` UPDATE yalniz
  `title, client_name, client_email, buyer_user_id, buyer_organization_id, event_id, crew_id`; `proposal_versions` UPDATE yalniz
  `tax_rate, valid_until, notes`; `proposal_items` INSERT/UPDATE/DELETE RLS ile (duzenlenebilir sutunlar). Dondurulmus surumde
  (sent_at dolu) DB 22023 "surum dondurulmus" verir -> UI zaten kilitler, hata gelirse Turkce goster.
- `portal_access_links` SELECT'te `token_hash` SECILMEZ (sutun yetkisi yok; `select *` 42501 verir) — sutunlari acikca yaz.
- Ham jeton yalniz `proposal_send` donusunde bir kez gelir: ekranda baglanti olarak gosterilir (kopyala), e-posta ile gonderilir;
  **veritabanina/loga yazilmaz**, URL'de sunucu loguna dusmesin diye e-posta disinda hicbir yere kaydedilmez.
- Ic maliyet yalniz `internal_proposal_items_list` / `internal_proposal_item_upsert`; `internal` semasina sorgu YOK; kart yalniz
  kurulusta `commercial.view` olana render edilir (DOM'da da yok), yazma yalniz `commercial.manage`. `sales` rolu musteri fiyatini
  girer, marji GORMEZ (02).
- Kritik islemde onay kapisi (05): "Gönder" tek tikla gecilmez — acik onay ekrani (ozet: kalem sayisi, toplam, gecerlilik, alici e-posta).
- Sapkali harf yok; kullaniciya gorunen metinler duzgun Turkce, yorumlar ASCII. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. Kurulus baglami (`app/lib/org-context.ts`)

`CrewOrg`'a `canViewProposals` (proposals.view) ve `canManageProposals` (proposals.manage) ekle (ayni RPC deseni) — ya da ayri
`getProposalContext()`; `getCrewContext`'i kullanan yerler bozulmasin. Menu icin ucuz `hasProposalAccess()` (`hasCrewAccess` gibi).

### B. `/ajans/teklifler` (yeni sayfa; `app/ajans/teklifler/page.tsx`)

`canViewProposals` kurulus yoksa `/profil`. Liste: `proposals` SELECT (`id, title, client_name, client_email, status, current_version_id,
event_id, crew_id, created_at, updated_at`) + gecerli surum (`proposal_versions`: `version_no, total_amount, currency, valid_until, sent_at`)
+ etkinlik basligi (RLS gostermeyebilir -> bos). Sutunlar: baslik, musteri, durum rozeti (draft "Taslak", sent "Gönderildi", viewed
"Görüntülendi", approved "Onaylandı", revision_requested "Revizyon istendi", declined "Reddedildi/Kapatıldı", expired "Süresi doldu"),
surum no, toplam (TL), gecerlilik, tarih; satir -> `/ajans/teklifler/<id>`. Ust: "Yeni teklif" (bos teklif: baslik + musteri adi/e-postasi
formu -> `proposal_create(p_org_id, p_title, null, null, p_client_name, p_client_email, null)` -> editore). Menu: "Teklifler" (ajans
kullanicisi + `hasProposalAccess`).

### C. `/ajans/teklifler/[id]` editor (`page.tsx` sunucu + `teklif-editoru.tsx` istemci + `teklif-actions.ts` + `teklif-data.ts`)

- Sunucu: teklif + tum surumler (`version_no desc`) + gecerli surumun kalemleri (`sort_order`) + portal baglantilari (`id, scope,
  recipient_email, expires_at, max_views, view_count, first_viewed_at, last_viewed_at, revoked_at, created_at` — `token_hash` YOK)
  + kurulus baglami (`canManageProposals`, `canSeeRates`, `canManageRates`). Teklif RLS'te gelmezse 404.
- Baslik satiri: baslik (duzenlenebilir, manage), musteri adi / e-postasi (duzenlenebilir), durum rozeti, "Sürüm N" (eski surumler
  salt okunur acilir liste: tarih, toplam, gonderim, onaylayan).
- **Kalemler** (gecerli surum `draft` ise duzenlenebilir; degilse salt okunur + "Yeni sürüm" dugmesi): satir = aciklama, adet, birim
  fiyat (TL, KDV haric), satir toplami, "Müşteriye görünür" anahtari, sira; "Kalem ekle" / "Sil" (satir ici onay). Yazimlar
  `proposal_items` INSERT/UPDATE/DELETE (RLS). Toplamlar DB'den okunur (`proposal_versions.subtotal/tax_amount/total_amount`) — istemci
  hesaplamaz; her yazimdan sonra `revalidatePath`. Surum alanlari: KDV orani (% olarak girilir, `tax_rate` 0-1), gecerlilik tarihi
  (`valid_until`), musteri notu (`notes`). Gizli kalem satiri soluk + "toplama girmez" notu.
- **Durum islemleri** (manage): `draft` -> **"Gönder"** (bkz. E); `sent/viewed/revision_requested/expired` -> **"Yeni sürüm"**
  (`proposal_new_version` -> yeni surum draft, kalemler kopyali) ve **"Kapat"** (`proposal_set_status(id, 'declined')`, satir ici onay);
  `approved` -> yalniz goruntuleme + rozet "Onaylandı · <approved_by_name> · <tarih>"; `revision_requested` -> musterinin notu
  (`client_note`) sari kutuda.
- **Portal baglantilari**: aktif baglanti varsa "Bağlantı gönderildi: <recipient_email> · <view_count> görüntüleme · son <last_viewed_at>
  · geçerlilik <expires_at>"; "Bağlantıyı iptal et" (`proposal_revoke_link`, satir ici onay). Ham jeton yalniz gonderim aninda gosterilir
  (E); sonra "Bağlantı yalnızca gönderim anında görüntülenir; yeniden göndermek için yeni sürüm aç." notu.
- Hata eslemesi (`error.code`): `42501` "Bu teklif için yetkin yok."; `22023` DB mesajinin Turkce karsiligi ("surum dondurulmus" ->
  "Bu sürüm gönderildi; değişiklik için yeni sürüm aç.", "musteriye gorunen kalem yok" -> "Gönderilecek görünür kalem yok.",
  "fiyati girilmemis kalem" -> "Fiyatı girilmemiş kalem var.", "mevcut surum zaten taslak" -> "Zaten taslak sürümdesin.",
  "onaylanmis teklifte" -> "Onaylanmış teklifte yeni sürüm açılamaz.", "kurulusun saglayici kaydi yok" -> "Kuruluşun sağlayıcı kaydı
  yok."); `P0002` "Teklif bulunamadı."; diger "İşlem yapılamadı, tekrar dene."

### D. Ekip panelinde "Teklif oluştur" (`app/etkinliklerim/[id]/ekip-paneli.tsx`)

Kurulus ekibinde (`ekip.organization_id` dolu) ve kullanici o kurulusta `canManageProposals` ise ekip durum satirinda **"Teklif oluştur"**:
`proposal_create(p_org_id, p_title = etkinlik basligi, p_event_id, p_crew_id, p_client_name = null, p_client_email = null, p_buyer_user_id =
null)` -> `/ajans/teklifler/<id>`'ye yonlendir. Ekipten acilan teklifin kalemleri DB'de uye basina gelir (rol adi, musteri fiyati =
ic goruntudeki `client_price` varsa). Ekipte zaten teklif varsa (`proposals.crew_id = ekip.id`) dugme yerine "Teklif: <baslik> · <durum>"
baglantisi (ilk teklif).

### E. Gonderme + e-posta (`teklif-actions.ts` `sendProposal`, `app/lib/email/proposal-email.ts`)

- "Gönder" -> onay ekrani (kalem sayisi, KDV haric/dahil toplam, gecerlilik gun secimi varsayilan 14, alici e-posta — bos ise uyar:
  "E-posta yoksa bağlantıyı elle iletmen gerekir") -> **Onayla ve gönder** -> `rpc('proposal_send', { p_proposal_id, p_valid_days })`
  -> `{ link_id, token }` -> baglanti `${SITE_URL}/portal/teklif/<token>` (P2 sayfasi; su an 404 vermesi normal — raporla) ->
  `client_email` doluysa `teklifEmail({ aliciAdi, saticiAdi, baslik, toplam, gecerlilik, baglanti })` -> `sendAccountEmail` (hata akisi
  kesmez: baglanti ekranda yine gosterilir; "E-posta gönderilemedi, bağlantıyı elle ilet" uyarisi). Donus: ekranda bir kez **baglanti
  kutusu** (kopyala dugmesi) + "Bu bağlantı bir daha gösterilmez" notu. Ham jeton `console.log`'a YAZILMAZ.
- E-posta sablonu `havuzDavetEmail` desenine uygun (esc, para, duz Turkce, `EMAIL_FROM` env), konu "<Satıcı adı> sana bir teklif gönderdi: <başlık>".

### F. Gizli ic maliyet karti (`teklif-maliyet-actions.ts`)

`canSeeRates` ise editorde kalem tablosunun altinda "İç maliyet ve marj" acilir karti (tembel: acilinca `internal_proposal_items_list(version_id)`):
satir = kalem, musteri toplami, ic maliyet (birim), markup (TL), marj (%), kaynak (crew_snapshot "Ekipten", manual "Elle"), not; ozet
satiri: toplam ic maliyet / toplam marj. `canManageRates` ve surum `draft` ise kalem basina "Maliyeti düzenle" -> `internal_proposal_item_upsert(item_id,
cost, note)`. Dondurulmus surumde salt okunur. Etiket "Gizli — yalnız ticari yetkililer görür". `canSeeRates` degilse kart, dugme ve
action HIC yok. Action'lar sunucuda `has_org_permission` ile yetkiyi ayrica dogrular.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu (`/ajans/teklifler`, `/ajans/teklifler/[id]`) + hata yok + `.next/BUILD_ID`.
- `grep -rn "internal_proposal_item" app` -> yalniz `teklif-maliyet-actions.ts`; `grep -rn "from('internal" app` -> 0;
  `grep -rn "token_hash" app` -> 0 (yorum haric); `grep -rn "from('proposals')" app` -> yalniz sunucu sayfalari/action'lar, `.insert(`
  ile ayni dosyada `proposals`/`proposal_versions` YOK.
- Sapkali harf 0; metinler duzgun Turkce.
- **Canli tur (Guven, Sunucu Ajans):**
  1. Lansman etkinligi -> Ekip -> **Teklif oluştur** -> editor: 4 kalem (DJ, Fotoğrafçı, Koordinatör, Ses & Işık — uye basina), Test
     Pro kaleminde fiyat 10000 (P2 override), digerleri 0; toplam 10000 / KDV 2000 / 12000. Ic maliyet karti: Test Pro 7000 (Ekipten),
     marj %30; digerleri bos.
  2. Fiyatlari doldur (DJ 15000, Koordinatör 8000, Ses & Işık 12000) -> toplam 45000 / 9000 / 54000. Bir kalemi "görünür" kapat ->
     toplam duser; geri ac. KDV %10 yap -> 4500 / 49500; %20'ye dondur. Musteri adi "Deneme Müşteri", e-posta `guvenyapicioglu+portal@gmail.com`.
  3. **Gönder** -> onay ekrani -> Onayla -> baglanti kutusu (kopyala) + e-posta gmail'e geldi (konu ve baglanti). Baglanti su an 404 (P2).
     Editor: durum "Gönderildi", kalemler kilitli, "Yeni sürüm" / "Kapat" dugmeleri, baglanti satiri (0 goruntuleme).
  4. **Yeni sürüm** -> Sürüm 2 taslak, kalemler kopyali -> DJ 14000 -> **Gönder** -> yeni baglanti; eski baglanti satiri "iptal".
  5. `/ajans/teklifler`: 1 teklif, Sürüm 2, Gönderildi, toplam 53000... (hesapla); "Yeni teklif" ile bos teklif ac -> kalem ekle -> sil.
  6. Test Pro (viewer) `/ajans/teklifler` -> `/profil`'e yonlendirme (proposals.view yok).
  SQL (uretim, salt okunur, tek tek):
  ```sql
  select p.title, p.status, v.version_no, v.subtotal, v.tax_amount, v.total_amount, v.sent_at is not null as gonderildi
    from public.proposals p join public.proposal_versions v on v.proposal_id = p.id order by p.created_at, v.version_no;
  select resource_id, recipient_email, view_count, revoked_at is not null as iptal, created_at from public.portal_access_links order by created_at;
  select action, target_table, detail->>'op' as op, created_at from internal.access_audit where target_table in ('proposals','proposal_internal_items') order by created_at desc limit 8;
  ```
  Beklenen: 1 teklif 2 surum (1 gonderildi, 2 gonderildi), toplamlar; 2 baglanti (ilki iptal); denetim `proposal.create`, `proposal.send` x2,
  `proposal.new_version`, ic kalem `read`. `asama15`: K7 0, K9 0, K13 0, K10 >= 102.

## Yapilmayacaklar

- Portal sayfasi (P2). RFP, bookings (7b/7c). Teklif PDF'i. `quotes` akisina dokunma. Ham jetonu saklama/loglama.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, sapma ve nedeni. Commit ATMA.
