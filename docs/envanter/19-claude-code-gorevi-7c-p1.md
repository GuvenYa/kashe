# Claude Code gorevi — FAZ 7c / P1: onayli tekliften rezervasyon (editor, /rezervasyonlarim Kurulus bolumu, detay, portal bandi)

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/19-faz7-ticari-katman.md` (bolum 2 "7c bookings" + bakim/iletisim kararlari,
bolum 11 7c plani). ON KOSUL: 7c-DB/01 (`20261008120000_faz7c_01_bookings_genisleme.sql`) uretimde; 7a P1-P2 deploy'da.

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/19-faz7-ticari-katman.md` (bolum 11), `supabase/migrations/20261008120000_faz7c_01_bookings_genisleme.sql`
(sutunlar, sekil kisiti, yetki, `can_access_booking_row`, `booking_from_proposal(p_proposal_id) RETURNS uuid`, `portal_proposal_view` -> `has_booking`),
`app/ajans/teklifler/[id]/page.tsx` + `teklif-editoru.tsx` + `teklif-actions.ts` + `teklif-data.ts` (7a), `app/rezervasyonlarim/page.tsx`,
`app/rezervasyon/[id]/page.tsx` + `actions.ts`, `app/portal/teklif/[token]/page.tsx` + `portal-data.ts`, `app/lib/org-context.ts` (`getCrewContext`,
`CrewOrg.canViewProposals/canManageProposals`), `CLAUDE.md` (FAZ 7a paragrafi ve calisma kisitlari).

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. Baslamadan `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar

- Rezervasyon YALNIZ `booking_from_proposal` RPC'siyle acilir; uygulama `bookings`'e INSERT yapmaz (yetki de yok). `bookings` UPDATE yalniz
  `status, cancelled_at, cancelled_by, cancellation_reason, completed_at` (sutun yetkisi); baska sutun yazilmaz.
- Iki rezervasyon sekli vardir ve ayni listede gosterilir: **eski** (quote + sohbet + musteri + profesyonel profilleri) ve **teklif**
  (`proposal_version_id` + `seller_provider_id`; `customer_id` yalniz alici Kashe kullanicisiysa dolu, misafirde NULL; `quote_id`/`conversation_id`/
  `professional_id` NULL). Kod `null` olasiliklarini acikca ele alir; eski sekil icin DAVRANIS DEGISMEZ.
- Portal ayri yuzey kurali aynen (yalniz 3 anon RPC; tabloya sorgu yok).
- Sapkali harf yok; UI metinleri duzgun Turkce, yorumlar ASCII; tarih/saat `KASHE_SAAT_DILIMI`. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. Teklif editoru — "Rezervasyon oluştur" (`[id]/page.tsx`, `teklif-editoru.tsx`, `teklif-actions.ts`, `teklif-data.ts`)

- Sayfa (sunucu) gecerli surumun rezervasyonunu okur: `from('bookings').select('id, status, created_at').eq('proposal_version_id', <current_version_id>)
  .maybeSingle()` (RLS kurulus politikasi gosterir). Editore `rezervasyon` prop'u.
- Teklif `approved` ve rezervasyon yoksa, `canManageProposals` ise: durum rozetinin yanina **"Rezervasyon oluştur"** -> satir ici onay
  ("<Başlık> için <toplam KDV dahil> tutarında rezervasyon oluşturulacak. Emin misin?") -> `createBookingFromProposal(proposalId)` ->
  `rpc('booking_from_proposal', { p_proposal_id })` -> basari: `router.refresh()`; mesaj "Rezervasyon oluşturuldu."
- Rezervasyon varsa: rozet "Rezervasyon: Onaylı / İptal / Tamamlandı" + **"Rezervasyona git"** -> `/rezervasyon/[id]`.
- Hata eslemesi: 22023 'onayli degil' -> "Teklif onaylı değil."; 42501 -> "Bu işlem için yetkin yok."; diger -> "İşlem yapılamadı, tekrar dene."
- Listede (`teklifler/page.tsx`) `approved` satirlarda rezervasyon varsa kucuk "Rezervasyon var" etiketi (tek sorgu: `proposal_version_id in (...)`).

### B. `/rezervasyonlarim` — ucuncu bolum "Kuruluş" (`app/rezervasyonlarim/page.tsx`)

- Mevcut iki bolum (aldiklarim / verdiklerim) ve sorgusu AYNEN. Ek sorgu: kullanicinin `canViewProposals` olan ajans kurulusu varsa
  `from('bookings').select('id, status, event_date, start_time, end_time, event_type, location, guest_count, total_amount, currency, created_at,
  completed_at, cancelled_at, customer_id, proposal_version_id, surum:proposal_versions!bookings_proposal_version_id_fkey (version_no, proposal:proposals!proposal_versions_proposal_id_fkey (id, title,
  client_name, seller_organization_id, seller:organizations!proposals_seller_organization_id_fkey (display_name)))').not('proposal_version_id', 'is', null)`
  (RLS: kurulus politikasi; kullanici ayni zamanda aliciysa satir ilk bolumde de cikar -> `id` ile tekillestir, Kurulus bolumunde goster).
  FK adlari: `bookings_proposal_version_id_fkey`, `proposal_versions_proposal_id_fkey`, `proposals_seller_organization_id_fkey` (dogrulanmis).
- Bolum basligi "Kuruluş rezervasyonları" + alt metin "Onaylanan tekliflerden açılan rezervasyonlar."; kart: teklif basligi, musteri adi
  (`client_name`; aliciya kurulus adi), "Sürüm N", etkinlik tarihi/sehir, tutar (KDV dahil), durum rozeti; tiklaninca `/rezervasyon/[id]`.
- Bolum yalniz ajans kurulusu uyesine gorunur (kurulusu yoksa hic render edilmez). Eski kart bileseni teklif sekline ZORLANMAZ; gerekirse
  kucuk ayri kart.

### C. `/rezervasyon/[id]` — teklif sekli (`page.tsx`, `actions.ts`)

- Sorguya `proposal_version_id, seller_provider_id, buyer_organization_id, event_id` + `surum:proposal_versions!...(version_no, total_amount,
  approved_by_name, approved_at, proposal:proposals!proposal_versions_proposal_id_fkey (id, title, client_name, client_email, seller_organization_id,
  seller:organizations!proposals_seller_organization_id_fkey (display_name)))` — `proposals` <-> `proposal_versions` arasinda IKI iliski var
  (`proposal_id` ve `current_version_id`), embed ipucu ZORUNLU
  eklenir; `quote:quotes!...` ve profil embed'leri LEFT kalir (null olabilir).
- Taraf tespiti: `isCustomer` (customer_id = user) / `isProfessional` aynen; **teklif seklinde** ek: `isSellerOrg` = `getCrewContext()` ile
  `seller_organization_id` kullanicinin `canViewProposals` kurulusu mu (`canManageProposals` -> iptal/tamamlama yetkisi). Hicbiri degilse
  `notFound()` (eski davranis).
- Teklif seklinde gosterim: baslik = teklif basligi; karsi taraf: satici icin "Müşteri: <client_name>" (+ e-posta yalniz kurulus uyesine),
  alici icin "Kuruluş: <display_name>"; "Sürüm N · Onaylandı · <approved_by_name> · <tarih>"; tutar KDV dahil; etkinlik satiri; **"Teklife git"**
  (`/ajans/teklifler/[proposal id]`, yalniz kurulus uyesine). Sohbet/teklif metni (quotes) bolumleri teklif seklinde gizlenir.
- `cancelBooking` / `completeBooking`: taraf kontrolune teklif dali eklenir — iptal: musteri (customer_id) veya satici kurulus `proposals.manage`;
  tamamlama: yalniz satici kurulus `proposals.manage` (eski sekilde profesyonel). Yetki yoksa mevcut hata metni. RLS zaten suzer; action
  yalnizca mesaj icin kontrol eder. Bildirim/sistem mesaji gonderen eski kod teklif seklinde `conversation_id` NULL oldugundan atlanir (guard).

### D. Portal bandi (`app/portal/teklif/[token]/page.tsx`, `portal-data.ts`)

- RPC donusundeki `has_booking` (boolean) tipe eklenir; `approved` durumunda yesil bandin altina ikinci satir:
  "Rezervasyon oluşturuldu; kuruluş sizinle iletişime geçecek." (`has_booking` true). False ise hicbir sey.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -rn "from('bookings')" app | grep -i insert` -> 0; `grep -rn "rpc('booking_from_proposal'" app` -> yalniz teklif action'i;
  portal grep'leri (7a) degismedi. Sapkali harf 0.
- **Canli (Guven):** (1) Sunucu Ajans, lansman teklifi (onayli) -> "Rezervasyon oluştur" -> onay -> "Rezervasyon oluşturuldu", rozet + "Rezervasyona
  git". (2) `/rezervasyon/[id]`: teklif basligi, "Müşteri: Deneme Müşteri" + e-posta, Sürüm 3 · Onaylandı · Deneme Müşteri, 50.400 TL, etkinlik
  satiri, "Teklife git". (3) `/rezervasyonlarim` -> "Kuruluş rezervasyonları" bolumunde ayni kart; kisisel bolumler eskisi gibi. (4) Portal (3.
  baglanti) -> yesil bandin altinda "Rezervasyon oluşturuldu…". (5) Test Pro (Sunucu Ajans viewer, proposals.view YOK): `/rezervasyonlarim`'da
  Kurulus bolumu yok; rezervasyon URL'si -> 404. (6) Ikinci kez "Rezervasyon oluştur" gorunmez (idempotan). (7) Eski akis: mevcut bir eski
  rezervasyon sayfasi (quote kaynakli) aynen aciliyor.
  SQL (uretim, salt okunur): `select id, status, total_amount, customer_id is null as misafir, proposal_version_id is not null as teklif, event_date,
  location from public.bookings order by created_at desc limit 5;` -> yeni satir: confirmed, 50400, misafir true, teklif true, 20 Kasim 2026, "İstanbul".
  `asama16`: K10 = eski*1000 + 1, K11 0, digerleri ESIT.

## Yapilmayacaklar

- Ekip uyesi basina rezervasyon / gorevlendirme (FAZ 8). Kazanc/odeme sayfalarinda kurulus geliri (finance; ayri kalem). Alici Kashe kullanicisina
  bildirim (acik kalem). Migration/RPC. Commit ATMA.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, sapma ve nedeni. Commit ATMA.
