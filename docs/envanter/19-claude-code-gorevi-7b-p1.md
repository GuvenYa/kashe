# Claude Code gorevi — FAZ 7b / P1: RFP (teklif talebi) — alici olusturma/davet/gonderme, satici gelen talepler/yanit

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/19-faz7-ticari-katman.md` (bolum 2 kararlar, bolum 12 7b). ON KOSUL: 7b-DB/01
(`20261009120000_faz7b_01_rfp.sql`) uretimde; 7a/7c uygulamasi deploy'da. Karsilastirma / secim / revizyon ekrani **7b-P2**'de (bu iste YOK).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/19-faz7-ticari-katman.md` (bolum 12), `supabase/migrations/20261009120000_faz7b_01_rfp.sql`
(tablolar, yetki/RLS, RPC imzalari ve hata metinleri, `rfp_detail` JSON alanlari, `proposal_send` RFP dali), `app/ajans/teklifler/*` (7a editor
ve liste; `teklif-data.ts`, `teklif-actions.ts`, `[id]/page.tsx`, `[id]/teklif-editoru.tsx`), `app/lib/org-context.ts` (`getCrewContext`, `CrewOrg`,
`tekIzinVarMi`), `app/components/sections/top-nav.tsx` (menu kurallari), `app/bildirimler/bildirim-listesi.tsx` (tip etiketleri),
`app/kurumsal/business-data.ts` (kurum sayfalari deseni), `app/lib/tarih.ts`, `CLAUDE.md`.

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. Baslamadan `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar

- RFP, davet ve yanit YALNIZ RPC ile acilir/gonderilir (`rfp_create`, `rfp_invite`, `rfp_send`, `rfp_cancel`, `rfp_mark_viewed`, `rfp_invite_decline`,
  `proposal_create_from_rfp`, `proposal_send`); `rfps`/`rfp_invites` tablolarina INSERT yok (yetki de yok). Taslak RFP'de `rfps` (title,
  description, deadline) ve `rfp_items` (ipucu dahil) RLS ile dogrudan yazilir — 7a kalem editoru deseni.
- **Butce ipucu** (`budget_hint_min/max`) yalniz alici ekraninda; `rfp_items` tablosundan bu sutunlar SELECT edilmez (yetki yok) — alici degerleri
  `rfp_detail` JSON'undan okur; satici ekraninda bu alanlar HIC render edilmez (`rfp_detail` saticiya gondermez).
- RFP yanitinda portal baglantisi YOKTUR: editorde "Gönder" -> `proposal_send` NULL doner -> "Teklif alıcıya iletildi" (baglanti/kopyala/e-posta
  yok). Musteri adi/e-postasi alanlari RFP yanitinda duzenlenmez (alici kurulus).
- Alici kurulus teklifi RLS ile okur (7b politikasi): P1'de yalniz yanit LISTESI (ozet `rfp_detail.invites`); kalem karsilastirma P2.
- Oturum: alici = kurulusta `events.view` (okuma) / `events.manage` (yazma); satici = ajans kurulusunda `proposals.view` / `proposals.manage`.
  `CrewOrg`'a `canViewEvents` / `canManageEvents` ekle (`has_org_permission` ile, `getCrewContext` icinde; 7a `canViewProposals` gibi).
- Sapkali harf yok; UI metinleri duzgun Turkce, yorumlar ASCII; tarih/saat `app/lib/tarih.ts`. Build kaniti: route tablosu + `.next/BUILD_ID`.
- Adlandirma: eski `/teklif-taleplerim` (pazaryeri teklif talepleri) ile karismasin — bu ozellik kullaniciya **"RFP"** diye gorunur:
  alici menusu **"RFP Talepleri"** (`/kurumsal/rfp`), satici menusu **"Gelen RFP'ler"** (`/ajans/rfp`); sayfa basliklari "Teklif talebi (RFP)".

## Yapilacaklar

### A. Alici — liste ve olusturma (`app/kurumsal/rfp/page.tsx`, `rfp-data.ts`, `rfp-actions.ts`, `yeni-rfp.tsx`)

- `/kurumsal/rfp`: kullanicinin `canViewEvents` olan kuruluslarinin RFP'leri (`from('rfps')` RLS; `select('id, title, status, deadline, created_at,
  organization_id, event:events(id, title, start_date)')`), durum rozeti (Taslak / Gönderildi / Yanıt toplanıyor / Değerlendiriliyor / Seçim yapıldı /
  İptal), davet/yanit sayilari (`rfp_invites` tek sorgu: `select('rfp_id, status')`), son tarih. Kurulusu yoksa `/profil`'e yonlendir.
- **"Yeni teklif talebi"** (`canManageEvents`): kurulus secimi (birden fazlaysa) + o kurulusun etkinlikleri (`from('events').eq('organization_id', org)`,
  iptal olmayanlar; yoksa "Önce bir etkinlik oluştur" + `/etkinlik-sihirbazi` baglantisi) + baslik (varsayilan etkinlik basligi) + son tarih
  (`<input type="datetime-local">`, varsayilan +7 gun) -> `createRfp(orgId, eventId, title, deadline)` -> `rpc('rfp_create', { p_org_id, p_event_id,
  p_title, p_description: null, p_deadline })` -> `/kurumsal/rfp/[id]`. Hata eslemesi: 22023 'etkinlik bu kurulusa ait degil' -> "Etkinlik bu
  kuruluşa ait değil.", 'baslik' -> "Başlık 2-200 karakter olmalı.", 'son tarih' -> "Son tarih gelecekte olmalı.", 42501 -> "Bu işlem için yetkin yok."
- Etkinlik sayfasinda (`app/etkinliklerim/[id]/page.tsx`) etkinlik bir kurulusa aitse ve kullanici `canManageEvents` ise ust bilgi satirina
  **"Teklif talebi aç"** baglantisi (`/kurumsal/rfp?etkinlik=<id>` -> yeni formu o etkinlikle acilir). Kucuk dokunus; sayfa yapisi degismez.

### B. Alici — talep sayfasi (`app/kurumsal/rfp/[id]/page.tsx`, `rfp-editoru.tsx`, `rfp-actions.ts`)

- Sunucu: `rpc('rfp_detail', { p_rfp_id })` (tek cagri; JSON: id, title, description, status, deadline, buyer_name, event{...}, items[{id, role_id,
  role, quantity, is_required, notes, sort_order, budget_hint_min, budget_hint_max}], invites[{id, provider_id, seller_name, status, proposal_id,
  viewed_at, responded_at, proposal_status, version_no, total_amount, valid_until, sent_at}], awarded_proposal_id, is_buyer). `is_buyer` false ise
  (satici bu rotaya geldi) `/ajans/rfp/[id]`'ye yonlendir. P0002/42501 -> `notFound()`.
- Ust blok: baslik, durum rozeti, etkinlik ozeti (ad, tur, tarih, sehir, katilimci), son tarih (`tarih.ts`), aciklama.
- **Taslak** (`status = draft`, `canManageEvents`): baslik/aciklama/son tarih `onBlur` ile `rfps` UPDATE (RLS; "Kaydedildi" geri bildirimi 7a gibi);
  **kalemler**: rol (`service_roles` aktif liste: `select('id, name_tr').eq('is_active', true)`), adet, zorunlu, butce ipucu min/max, not — satir
  ekle (`rfp_items` INSERT), duzenle (UPDATE), sil (DELETE) RLS ile; sutun basliklari 7a kalem satiri gibi (P2-cila deseni). Ipucu alanlarinin
  yaninda "Yalnız size görünür" ipucu metni.
- **Davetler** (taslak + gonderilmis iken, `canManageEvents`): ajans arama kutusu — `from('v_providers_public').select('id, display_name, city_name')
  .eq('provider_type', 'organization').ilike('display_name', '%q%').limit(10)` (gorunum sutun adlari `app/lib/types.ts`'ten; `organization` tipi
  = ajans kurulusu) -> **"Davet et"** -> `inviteRfp(rfpId, providerId)` -> `rpc('rfp_invite', ...)`. Hata: 'yalniz ajans kuruluslari' -> "Yalnızca
  ajans kuruluşları davet edilebilir.", 'kendini' -> "Kuruluş kendini davet edemez.", 'bu durumda davet eklenemez' -> "Bu durumda davet eklenemez."
  Davetli listesi: ajans adi, durum rozeti (Davet edildi / Görüntüledi / Yanıtladı / Reddetti / Seçilmedi), yanit varsa "Sürüm N · <toplam> TL ·
  gönderim <tarih>" (P1'de ozet; "Karşılaştır" P2).
- **"Gönder"** (taslak; onay kapisi: "<N> ajansa gönderilecek; gönderildikten sonra kalemler değişmez. Emin misin?") -> `sendRfp(id)` ->
  `rpc('rfp_send')`. Hata: 'kalem yok' -> "Talepte kalem yok.", 'davetli ajans yok' -> "En az bir ajans davet et.", 'son tarih' -> "Son tarih gerekir
  ve gelecekte olmalı." Basari -> `router.refresh()`; rozet "Gönderildi".
- **"İptal et"** (draft/sent/collecting/evaluating; onay kapisi) -> `rpc('rfp_cancel')`. P2'de gelecekler (Karşılaştır / Seç / Revizyon iste /
  Değerlendirmeye al) icin yer birakma, dugme KOYMA.

### C. Satici — gelen talepler (`app/ajans/rfp/page.tsx`, `[id]/page.tsx`, `rfp-satici-islemleri.tsx`, `rfp-satici-actions.ts`)

- `/ajans/rfp`: kullanicinin `canViewProposals` olan ajans kuruluslarina gelen davetler: `from('rfp_invites').select('id, status, rfp_id, proposal_id,
  created_at, rfp:rfps(id, title, status, deadline, organization_id, buyer:organizations!rfps_organization_id_fkey(display_name), event:events(title,
  start_date))')` (RLS: kendi davetleri). Rozet: davet durumu + talep durumu; son tarih; "Yanıtlandı" ise teklif baglantisi. Kurulusu yoksa `/profil`.
- `/ajans/rfp/[id]`: sunucu `rpc('rfp_detail')` (`is_buyer` true gelirse `/kurumsal/rfp/[id]`'ye yonlendir) + `rpc('rfp_mark_viewed')` (sessiz;
  hata yutulur). Ust blok: alici kurulus adi (`buyer_name`), baslik, durum, son tarih, etkinlik ozeti, aciklama; **kalem tablosu** rol / adet /
  zorunlu / not (ipucu alanlari JSON'da YOK — render etme). `my_invite.status`'e gore islemler:
  - sent/viewed ve talep sent/collecting ve son tarih gecmemis: **"Teklif hazırla"** -> `respondRfp(rfpId, orgId)` -> `rpc('proposal_create_from_rfp',
    { p_rfp_id, p_org_id })` -> `/ajans/teklifler/[proposalId]`; **"Daveti reddet"** (onay) -> `rpc('rfp_invite_decline')`.
  - responded: "Teklifin gönderildi" + teklife baglanti; declined: "Daveti reddettin"; not_selected: "Talep başka bir teklife verildi";
    talep awarded ve `my_invite.proposal_id = awarded_proposal_id`: "Teklifin seçildi" (yesil) + teklife baglanti.
  Hata eslemesi: 'teklif talebi kapali' -> "Teklif talebi kapalı.", 'davetli degil' -> "Bu kuruluş davetli değil.", 'davet bu durumda' -> "Davet bu
  durumda yanıtlanamaz."

### D. Teklif editoru — RFP yaniti modu (`app/ajans/teklifler/[id]/page.tsx`, `teklif-editoru.tsx`, `teklif-data.ts`, `teklif-actions.ts`)

- Sayfa `rfp_id` dolu teklif icin talebi okur (`from('rfps').select('id, title, status, deadline, buyer:organizations!rfps_organization_id_fkey
  (display_name)')` RLS) ve editore `rfpBaglami` prop'u gecer.
- Editorde RFP yanitiysa: ustte band "Teklif talebine yanıt: <rfp.title> · <buyer_name> · son tarih <tarih>" + `/ajans/rfp/[id]` baglantisi;
  musteri adi/e-postasi alanlari **salt okunur** (alici kurulus); **Gönder** onay kapisi metni "Teklif alıcı kuruluşa iletilecek"; basari sonrasi
  baglanti/kopyala/e-posta blogu YERINE "Teklif alıcıya iletildi." (action `proposal_send` donusunde `link_id` null ise). "Müşteri bağlantıları"
  bolumu gizli. Yeni surum / revizyon notu / rezervasyon (7c) aynen calisir.
- Listede (`/ajans/teklifler`) RFP yaniti satirinda kucuk "RFP yanıtı" etiketi.

### E. Menu + bildirim

- `top-nav.tsx`: **"RFP Talepleri"** (`/kurumsal/rfp`) — kullanicinin `events.view` olan kurulusu varsa (`tekIzinVarMi('events.view', 'rfp')`;
  kurum ve ajans); **"Gelen RFP'ler"** (`/ajans/rfp`) — `hasProposalAccess()` (ajans). Mobil hamburger paritesi.
- `bildirim-listesi.tsx`: tip `rfp` -> etiket "Teklif talebi"; `proposal` -> "Teklif" (ileride). Bilinmeyen tip genel etiket.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu (`/kurumsal/rfp`, `/kurumsal/rfp/[id]`, `/ajans/rfp`, `/ajans/rfp/[id]`) + hata yok +
  `.next/BUILD_ID`.
- `grep -rn "from('rfps')\|from('rfp_invites')" app | grep -i "insert(" ` -> 0; `grep -rn "budget_hint" app/ajans` -> 0 (satici tarafi ipucu
  bilmez); `grep -rn "rpc('rfp_\|rpc('proposal_create_from_rfp" app` -> yalniz action dosyalari.
- Sapkali harf 0.
- **Canli (Guven):** (1) Test Guven (kurum, Test Pro admin) ile: menu "RFP Talepleri" -> Yeni teklif talebi -> kurulusun etkinligi (yoksa
  sihirbazdan bir etkinlik olustur) -> taslak: kalemler, ipucu, son tarih; "Sunucu Ajans" ara -> Davet et -> Gönder. (2) Sunucu Ajans: menu
  "Gelen RFP'ler" -> talep (ipucu gorunmez) -> Teklif hazırla -> editorde RFP bandi, kalemler rol adlariyla fiyatsiz -> fiyatlar -> Gönder ->
  "Teklif alıcıya iletildi", baglanti yok. (3) Test Guven: talep sayfasinda davet "Yanıtladı · Sürüm 1 · <toplam> TL"; bildirimlerde "Teklif talebi".
  (4) Test Pro (viewer) `/ajans/rfp` -> kurulus bolumu yok / yonlendirme. SQL + `asama17`: K8-K11 0, K12 101, K13 1.

## Yapilmayacaklar

- Karsilastirma/secim/revizyon (P2). E-posta bildirimi. Kashe disi ajans daveti. Migration/RPC. Commit ATMA.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, sapma ve nedeni. Commit ATMA.
