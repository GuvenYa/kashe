# Claude Code gorevi — FAZ 7a / P2: musteri portali (`/portal/teklif/[token]`) + taslak silme

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/19-faz7-ticari-katman.md` (bolum 2 kararlar, bolum 3 portal RPC'leri,
bolum 8 P2, bolum 9 kurallar). ON KOSUL: 7a-DB/01-02 uretimde, P1 deploy'da (teklif gonderimi calisiyor, baglanti 404 veriyor).

---

Kashe reposundasin. Su dosyalari oku: `docs/envanter/19-faz7-ticari-katman.md` (bolum 2, 3, 8-P2, 9),
`supabase/migrations/20261003120000_faz7a_01_teklif_portal.sql` (bolum 7: `portal_proposal_view(p_token)` donus JSON alanlari,
`portal_proposal_approve(p_token, p_name)`, `portal_proposal_request_revision(p_token, p_note)`; hata metinleri: "baglanti gecersiz"
P0002, "baglanti iptal edilmis" / "baglantinin suresi dolmus" / "baglantinin goruntuleme hakki bitmis" / "teklif zaten onaylanmis" /
"teklif bu durumda onaylanamaz" / "teklifin gecerlilik suresi dolmus" / "onaylayan ad soyad gerekir" / "revizyon notu gerekir" 22023,
scope eksikse 42501), `20261003130000_faz7a_02_taslak_sil.sql` (taslak DELETE politikasi), `app/davet/havuz/[token]/page.tsx` +
`davet-paneli.tsx` (oturumsuz sayfa deseni, noindex, uuid kontrolu), `app/ajans/teklifler/[id]/teklif-editoru.tsx` + `teklif-actions.ts`
(P1), `app/ajans/teklifler/page.tsx`, `app/components/legal-page-shell.tsx` (sade kabuk ornegi), `app/lib/supabase-server.ts`.

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. Parcalar: (A) portal sayfasi, (B) portal islemleri, (C) taslak silme (P1 eksigi),
(D) satici yuzeyi yalniz ajans kurulusuna (P1 canli turunda cikti).
Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

## Kesin kurallar (19 bolum 9 + 02 bolum 6)

- Portal **ayri yuzey**: sayfa ve action'lari yalniz 3 anon RPC'yi cagirir (`portal_proposal_view`, `portal_proposal_approve`,
  `portal_proposal_request_revision`). `proposals`/`proposal_versions`/`proposal_items`/`portal_access_links` tablolarina SORGU YOK,
  `internal` YOK, `has_org_permission` YOK. Istemciye yalniz RPC'nin dondurdugu alanlar gider (kurulus/kullanici kimligi zaten donmez).
- Jeton yalniz URL'den gelir ve yalniz RPC'ye verilir; hicbir yere yazilmaz (`console.*`, DB, baska URL). Sayfa `robots: noindex,
  nofollow`; `<meta name="referrer" content="no-referrer">` (jeton Referer ile sizmasin); `export const dynamic = 'force-dynamic'`
  (onbellek yok — her acilis goruntuleme sayar).
- Jeton bicimi 64 hex degilse `notFound()` (RPC'ye gitmez).
- Onay **kritik islem** (05): acik onay ekrani — ad soyad + "Teklifi okudum, kabul ediyorum" kutusu + ozet (toplam, gecerlilik);
  tek tikla gecilmez. Revizyon istegi not zorunlu.
- Oturum gerekmez; oturumlu kullanici da ayni sayfayi gorur (RLS devrede degil, RPC SECURITY DEFINER).
- Sapkali harf yok; kullaniciya gorunen metinler duzgun Turkce, yorumlar ASCII. Build kaniti: route tablosu + `.next/BUILD_ID`.

## Yapilacaklar

### A. `/portal/teklif/[token]` (yeni: `app/portal/layout.tsx`, `app/portal/teklif/[token]/page.tsx`, `portal-data.ts`)

- `app/portal/layout.tsx`: TopNav/footer YOK; sade kabuk (Kashe logosu/adi, alt satirda "Bu sayfa Kashe üzerinden size iletilen bir
  teklifi gösterir." + gizlilik/KVKK baglantisi mevcut sayfaya). Referrer meta burada.
- `page.tsx` (sunucu): jeton kontrolu -> `rpc('portal_proposal_view', { p_token })`. Hata eslemesi -> **durum sayfalari** (ayni rota,
  farkli icerik; 200 degil anlamli metin): P0002 "Bu bağlantı geçersiz." ; 22023 mesaj 'iptal' iceriyorsa "Bu bağlantı iptal edilmiş;
  kuruluştan yeni bağlantı iste.", 'suresi dolmus' -> "Bağlantının süresi dolmuş.", 'goruntuleme hakki' -> "Bağlantının görüntüleme hakkı
  bitmiş.", 'gonderilmis surum yok' -> "Teklif henüz gönderilmemiş."; diger -> "Teklif şu an görüntülenemiyor, tekrar dene."
- Basari: ust blok — satici adi (`seller_name`), "Sayın <client_name>," (varsa), teklif basligi, "Sürüm N · gönderim <sent_at>";
  etkinlik ozeti (varsa: ad, tur, tarih, sehir, katilimci); **kalem tablosu**: aciklama (+ rol), adet, birim fiyat, toplam (TL,
  `Intl.NumberFormat('tr-TR')`); alt toplam / KDV (%) / genel toplam; gecerlilik (`valid_until`, gecmisse kirmizi "süresi doldu");
  satici notu (`notes`). **Durum bandi**: `approved` -> yesil "Onaylandı · <approved_by_name> · <approved_at>"; `revision_requested` ->
  sari "Revizyon talebin iletildi: <client_note>"; `expired` -> gri "Bu teklifin geçerlilik süresi doldu; kuruluştan güncel teklif
  iste."; `declined` -> gri "Bu teklif kapatıldı."; `sent`/`viewed` -> islem dugmeleri (B).
- `portal-data.ts`: RPC donus tipi, etiketler, para/tarih bicimleyiciler (`'use client'` yok).

### B. Portal islemleri (`portal-islemleri.tsx` istemci + `portal-actions.ts`)

- Yalniz durum `sent`/`viewed` ve `scope` izin veriyorsa: **"Teklifi onayla"** (scope `approve`) ve **"Revizyon iste"** (scope `request_revision`).
- Onay akisi: dugme -> onay paneli: ozet (toplam KDV dahil, gecerlilik), "Ad Soyad" (zorunlu, 2-120), kutu "Teklifi okudum, kabul
  ediyorum" (zorunlu), **"Onaylıyorum"** -> `approveProposal(token, name)` -> `rpc('portal_proposal_approve', { p_token, p_name })`
  -> basari: sayfa yenilenir (`router.refresh()`), yesil band. Hata eslemesi: 22023 'zaten onaylanmis' -> "Bu teklif zaten onaylanmış.",
  'gecerlilik suresi dolmus' -> "Teklifin geçerlilik süresi dolmuş.", 'bu durumda onaylanamaz' -> "Teklif bu durumda onaylanamaz.",
  'ad soyad' -> "Ad soyad 2-120 karakter olmalı."; 42501 -> "Bu bağlantı onay yetkisi taşımıyor."; P0002 -> "Bağlantı geçersiz.";
  diger -> "İşlem yapılamadı, tekrar dene."
- Revizyon akisi: dugme -> not alani (zorunlu, 2-4000) -> **"Gönder"** -> `requestRevision(token, note)` -> `rpc('portal_proposal_request_revision',
  { p_token, p_note })` -> sari band. Hata eslemesi benzer.
- `pending` iken dugmeler pasif; action'lar jetonu loglamaz.

### C. Taslak silme (7a-DB/02; `teklif-editoru.tsx`, `teklif-actions.ts`, `teklifler/page.tsx`)

- Editorde teklif `draft` ve hicbir surumu gonderilmemisse (tum surumlerin `sent_at` NULL; pratikte yalniz surum 1) **"Taslağı sil"**
  (satir ici onay "<Başlık> silinecek. Emin misin?") -> `deleteDraftProposal(id)` -> `proposals` DELETE (RLS) -> `/ajans/teklifler`'e
  yonlendir. Gonderilmis teklifte dugme yok (DB zaten 0 satir siler; mesaj "Gönderilmiş teklif silinemez; kapatabilirsin.").
- Listede taslak satirlarinda da "Sil" (ayni onay).

### D. Satici yuzeyi yalniz ajans kurulusuna (`app/lib/org-context.ts`, `teklifler/page.tsx`, `[id]/page.tsx`, `etkinliklerim/[id]/page.tsx`)

- Kural (19 bolum 2): teklif saticisi **ajans** kurulusudur (`organizations.account_type = 'agency'`; kurum/`business` kurulusunun
  saglayici kaydi yoktur, `proposal_create` zaten 'kurulusun saglayici kaydi yok' ile reddeder). Canli turda: Test Pro, "Test Guven"
  adli `business` kurulusunda admin oldugu icin Teklifler menusunu ve bos listeyi gordu; "Yeni teklif" DB'de patlayacakti.
- `CrewOrg`'a `accountType: string` ekle (uyelik sorgusunda `organizations(account_type)` zaten geliyor). `canViewProposals` ve
  `canManageProposals` **yalniz `account_type = 'agency'` ise** true olsun (hesaplamada `&& org.account_type === 'agency'`); boylece
  liste sayfasi, `[id]` sayfasi, "Yeni teklif" kurulus secimi ve ekip panelindeki "Teklif oluştur" tek noktadan duzelir.
- `hasProposalAccess` (menu): `tekIzinVarMi`'ye secimlik `yalnizAjans` parametresi — uyelik sorgusu `organization_id,
  organizations(account_type)` ceker, ajans olmayan kuruluslari RPC'ye gitmeden eler. `hasCrewAccess` degismez (kurum ekibi vardir).
- Kurum kurulusu uyesi `/ajans/teklifler`'e dogrudan gelirse `/profil`'e yonlenir (mevcut kapi). Alici tarafi (`/tekliflerim`) bu
  parcanin disinda (7a kapsami disi).

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu (`/portal/teklif/[token]`) + hata yok + `.next/BUILD_ID`.
- `grep -rn "from('" app/portal` -> 0 (tablo sorgusu yok); `grep -rn "rpc('" app/portal` -> yalniz 3 portal RPC'si;
  `grep -rn "internal\|has_org_permission" app/portal` -> 0 (yorum haric); `grep -rn "console" app/portal` -> jeton iceren satir yok.
- Sapkali harf 0; metinler duzgun Turkce.
- **Canli tur (Guven):**
  1. Gizli pencere (+ `?onizleme=`): P1'de not ettigin **ilk** (iptal edilmis) baglanti -> "Bu bağlantı iptal edilmiş…" sayfasi.
  2. **Ikinci** baglanti -> teklif: Sunucu Ajans, "İstanbul'da 100 kişilik kurumsal lansman", Sürüm 2, 4 kalem, 44.000 / KDV 8.800 /
     52.800, gecerlilik; dugmeler "Teklifi onayla" / "Revizyon iste". **Revizyon iste** -> not "Ses & Işık kalemi için indirim rica
     ederiz" -> sari band. Sayfayi yenile -> band kaliyor, dugmeler yok.
  3. Sunucu Ajans editor: durum "Revizyon istendi", musteri notu sari kutuda; **Yeni sürüm** -> Ses & Işık 10.000 -> **Gönder** -> yeni
     baglanti (not et). Portal: eski (ikinci) baglanti -> "iptal edilmiş".
  4. Yeni baglanti -> Sürüm 3, 42.000 / 8.400 / 50.400 -> **Teklifi onayla** -> ad soyad bos -> hata; "Deneme Müşteri" + kutu ->
     Onaylıyorum -> yesil "Onaylandı · Deneme Müşteri · <tarih>". Yenile -> ayni. Editor: "Onaylandı · Deneme Müşteri", kalemler kilitli,
     "Yeni sürüm" yok.
  5. Sunucu Ajans listesinde "Yeni teklif" -> bos taslak acilir -> editorde **Taslağı sil** -> onay -> listeden gitti. Bir bos taslak
     daha ac, bu kez listeden **Sil**. Kapatilmis "qas" teklifinde Sil YOK (gonderilmis).
  6. Lansman editorunde **ic maliyet kartini ac** (tembel yuklenir) -> kalem basina maliyet/markup/marj gorunur (denetim `read` satiri).
  7. **Test Pro** ile giris: menude "Teklifler" YOK; `/ajans/teklifler` -> `/profil`'e yonlenir (Test Guven `business`). Sunucu Ajans
     ile menu ve liste eskisi gibi.
  SQL (uretim, salt okunur, tek tek):
  ```sql
  select p.title, p.status, v.version_no, v.total_amount, v.sent_at is not null as gonderildi, v.approved_by_name, v.client_note
    from public.proposals p join public.proposal_versions v on v.proposal_id = p.id order by p.created_at, v.version_no;
  select recipient_email, view_count, first_viewed_at is not null as goruldu, revoked_at is not null as iptal
    from public.portal_access_links order by created_at;
  select action, target_table, detail->>'op' as op, created_at from internal.access_audit
    where target_table in ('proposals','proposal_internal_items') order by created_at desc limit 6;
  ```
  Beklenen: lansman teklifi `approved` (surum 1-2 gonderildi, surum 2 `client_note` dolu, surum 3 `approved_by_name = Deneme Müşteri`);
  "qas" `declined` degismedi; bos taslak YOK (2 teklif). 4 baglanti: lansman ilk iki iptal, ucuncu `view_count >= 2` + goruldu, "qas"
  baglantisi iptal. Denetimde `proposal_internal_items` `read` satiri var. `asama15`: K7 0, K9 0, K11 0, K13 0, K10 **204**.

## Yapilmayacaklar

- Portalda PDF/indirme, belge seti, mesajlasma (05 ileride). RFP / bookings (7b/7c). Oturum acma zorunlulugu. Tabloya dogrudan sorgu.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep ciktilari, sapma ve nedeni. Commit ATMA.
