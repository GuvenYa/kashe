# Claude Code gorevi — FAZ 8b / P1: CRM arayuzu (`/ajans/musteriler`: kisiler, firsat panosu, teklif onerileri, bildirim, menu, rol ozetleri)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/20-faz8-event-os-modulleri.md` bolum 4 (8b) ve
`supabase/migrations/20261022120000_faz8b_01_crm.sql` (DB uretimde: `contacts`, `crm_leads`, enum `crm_lead_stage` new/contacted/
proposal_sent/won/lost, yetki `crm.view`/`crm.manage`, modul `crm` (ajansta acik), `proposals.buyer_contact_id` FK, gorunum
`crm_contact_suggestions`, aktivite `contact`/`lead`, bildirim tipi `crm` → `/ajans/musteriler?firsat=<id>`). Dal: `faz8b/p1` (Guven
acar). **Migration/RPC YOK** — yazma dogrudan tablolara (RLS `crm.manage`; 0 satir = yetki hatasi), 8a `gorev-actions.ts` deseni.
Panel dili (DESIGN.md 9): `PanelKabugu`, `PanelBaslik`, `KpiKutu`, `VeriTablosu`, `PanelKart`, `OzetSerit`.

---

Kashe reposundasin. Once `git status` (temiz; dal `faz8b/p1`). Oku: `CLAUDE.md` (FAZ 5 kurulus/yetki, FAZ 7a teklif, FAZ 8a gorevler
paragraflari), `DESIGN.md` bolum 9, migration dosyasi (yukarida; tablolar, CHECK'ler, tetikleyici hatalari 22023 metinleri),
`app/lib/org-context.ts` (`CrewOrg`: `tasksEnabled`, `canManageSettings` nasil dolduruluyor — `has_org_permission` / `org_module_enabled`
RPC'leri), `app/lib/panel-menu.ts` (ajans grubu maddeleri; `tasksEnabled` kapisi), `app/lib/org-roles.ts` (`ORG_ROLE_SUMMARIES*`),
`app/lib/gorev-data.ts`, `app/lib/gorev-actions.ts` (dogrudan yazma + 0 satir = yetki; `revalidatePath` daraltma), `app/kurulus/gorevler/page.tsx`,
`app/components/gorevler/*` (form, liste, satir, aktivite akisi — `aktivite-akisi.tsx` entity/action cumleleri), `app/ajans/page.tsx`
(gosterge KPI'lari), `app/ajans/teklifler/[id]/teklif-baslik.tsx` (alici satiri), `app/bildirimler/page.tsx`, `app/components/panel/*`.

**Kirmizi cizgi:** migration/RPC YOK; `contacts.email/phone` yalniz kurulus ici yuzeylerde gosterilir (RLS zaten sinirlar; UI baska
kurulusa tasimaz); fiyat/tutar `para.ts`; tarih `tarih.ts`; sapkali harf yok, yorumlar ASCII, UI Turkce. Commit ATMA.

## 1) Baglam: `org-context.ts`, menu, rol ozetleri

- `CrewOrg`'a `crmEnabled` (`org_module_enabled(org,'crm')`), `canViewCrm` (`has_org_permission(org,'crm.view')`), `canManageCrm`
  (`'crm.manage'`) — mevcut `Promise.all` dizisine eklenir (yeni tur yok).
- `panel-menu.ts` ajans grubu: "Musteriler" maddesi (`/ajans/musteriler?kurulus=<id>`, ikon `kisiler`/mevcut ikon setinden) yalniz
  `accountType === 'agency' && crmEnabled && canViewCrm`. Kurumsal grupta YOK (karar: CRM ajansa ozel).
- `org-roles.ts` ozetleri (ajans): sales → "…teklif acar ve gonderir, musteri ve firsatlari yonetir…"; project_manager / finance →
  "…musterileri gorur…"; owner/admin listesine "musteriler" eklenir. Kurumsal ozetler DEGISMEZ (CRM yok).

## 2) Veri + action katmani

- `app/lib/crm-data.ts` (sunucu): tipler (`Kisi`, `Firsat`, `FirsatAsamasi`, `ASAMA_ETIKETLERI`: new "Yeni" · contacted "Iletisimde" ·
  proposal_sent "Teklif verildi" · won "Kazanildi" · lost "Kaybedildi"), `kisileriListele(org, { q })` (ad/firma/e-posta arama; acik firsat
  sayisi ve son aktivite alt sorgusu TEK toplu), `firsatlariListele(org, { asama?, sahip? })` (kisi adi + sahip adi embed: `contacts(full_name,
  company_name)`, `profiles!crm_leads_owner_user_id_fkey(full_name)`; etkinlik/teklif basliklari embed), `kisiDetay(org, id)` (kisi + firsatlari
  + bagli teklifler `proposals.buyer_contact_id = id` + aktivite `activity_logs` entity contact/lead), `teklifOnerileri(org)`
  (`crm_contact_suggestions`), `uyeSecenekleri(org)` (aktif uyeler — gorevlerdeki `atanabilirler` kalibi).
- `app/lib/crm-actions.ts` (`'use server'`): `kisiOlustur`, `kisiGuncelle`, `kisiSil` (firsatliyken 23503 → "Once firsatlari sil ya da
  tasi"), `firsatOlustur`, `firsatGuncelle` (asama, deger, tarih, sahip, sonraki adim, etkinlik, teklif, kaybedilme nedeni), `firsatSil`,
  `teklifMusterisiniKisiYap(org, proposalId)` (oneriden: kisi olusturur `full_name = client_name`, `email = client_email`; sonra
  `proposals.buyer_contact_id` guncellenir — sutun izni var; kisi zaten varsa (23505) o kisiye baglar). Dogrulama: ad 2-200, e-posta
  basit bicim, tutar ≥ 0, tarih; 22023 tetikleyici metinleri kullaniciya Turkce ("Kisi bu kurulusa ait degil" vb. — kod metnini
  eslestirip cevir, bilinmeyen hata icin genel metin). `revalidatePath('/ajans/musteriler')` (+ kisi sayfasi).

## 3) Sayfalar

- **`/ajans/musteriler`** (`app/ajans/musteriler/page.tsx`; `PanelKabugu`; `?kurulus=` secimi 8a `kurulus/gorevler` kalibi; `canViewCrm`
  degilse 403 sayfasi / yonlendirme; modul kapaliysa 8a `GorevModuluKapali` benzeri kart "Musteri modulu bu kurulusta kapali").
  `PanelBaslik` eyebrow kurulus adi, baslik "<em>Musteriler</em> ve firsatlar", sag: "Yeni kisi" + "Yeni firsat" (`canManageCrm`).
  KPI satiri (`KpiKutu` x4): ACIK FIRSAT (new+contacted+proposal_sent) · BEKLENEN TUTAR (acik firsatlarin `estimated_value` toplami,
  `formatTL`; `vurgu='accent'`) · BU AY KAZANILAN (won_at bu ay, adet + tutar) · KISI (toplam).
  Sekmeler `?sekme=firsatlar|kisiler` (varsayilan firsatlar):
  - **Firsatlar — pano:** 5 sutun (`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4`), sutun basi eyebrow asama + adet + toplam tutar;
    kart: baslik, kisi (firma varsa " · firma"), tutar, beklenen tarih, sahip avatar/ad, sonraki adim (tarih gecmisse `danger` rozet
    "gecikti"), bagli teklif rozeti ("Teklif · Onaylandi" vb.). Kart tiklaninca **firsat paneli** (`?firsat=<id>`; sag cekmece `lg`+,
    tam ekran `lg` alti): tum alanlar duzenlenir (alandan cikinca kaydet — 8a deseni), asama secimi (segment/select), "Kaybedildi" secilince
    neden alani, etkinlik/teklif secicileri (kurulusun etkinlikleri `events.organization_id`, teklifleri `proposals.seller_organization_id`;
    sunucu listeleri), aktivite listesi (lead), "Kisi sayfasi →", "Teklife git →", "Etkinlige git →", "Sil" (onay kapisi). Surukle-birak YOK
    (asama select ile).
  - **Kisiler — tablo:** `VeriTablosu`: AD (alt satir firma/tur) · E-POSTA · TELEFON (`dar`) · ACIK FIRSAT · SON AKTIVITE · satir →
    `/ajans/musteriler/<id>`; ustte arama kutusu (`?q=`, URL'ye bagli, 8a filtre deseni).
  - **Oneriler seridi** (tablonun ustunde, `teklifOnerileri` bos degilse): "Teklif musterileri kisi olarak eklenebilir: <N>" + her satir
    "<client_name> · <e-posta> · <teklif basligi>" + "Kisi olarak ekle" dugmesi (`teklifMusterisiniKisiYap`; iyimser: satir kaybolur).
- **`/ajans/musteriler/[id]`** kisi sayfasi: `PanelBaslik` (ad; eyebrow tur/firma; sag "Duzenle"/"Sil"), bilgi karti (e-posta, telefon,
  not, bagli Kashe kullanicisi/kurulusu varsa), "Firsatlar" (`VeriTablosu`: baslik · asama rozeti · tutar · beklenen · sahip; "+ Yeni
  firsat" bu kisiye), "Teklifler" (`buyer_contact_id` eslesen: baslik · durum · tutar → `/ajans/teklifler/<id>`), "Aktivite"
  (`aktivite-akisi` — entity `contact`/`lead` cumleleri: "kisiyi olusturdu", "firsatin asamasini degistirdi → Teklif verildi", "firsatin
  sahibini degistirdi → Ad", PII diff icin "e-postayi guncelledi" (deger yazmadan)).
- **Formlar** (`app/components/crm/kisi-formu.tsx`, `firsat-formu.tsx`; istemci; `useActionState`/`useTransition` 8a kalibi): kisi — tur
  (kisi/firma), ad, firma, e-posta, telefon, not; firsat — kisi (arama + secim; "Yeni kisi" kisa yolu), baslik, asama, tahmini deger,
  beklenen tarih, sahip (uye secimi; varsayilan ben), sonraki adim + tarih, etkinlik, teklif.
- **Bildirim:** `bildirimler/page.tsx` tip `crm` simgesi/etiketi ("Firsat"); baglanti `/ajans/musteriler?firsat=<id>` paneli acar.
- **Teklif editoru basligi:** alici satirina kisi baglantisi: `buyer_contact_id` doluysa "Kisi: <ad> →" (`/ajans/musteriler/<id>`); bos ve
  `client_email` doluysa `canManageCrm` icin "Kisi olarak ekle" (ayni action). RFP yanitinda (alici kurulus) gosterilmez.
- **Gosterge `/ajans`:** KPI satirina "ACIK FIRSAT N" (crmEnabled && canViewCrm iken; sorgu tek `count`).

## 4) Yapilmayacaklar

Migration/RPC YOK; kurumsal (business) kurulusta CRM yuzeyi/menusu YOK; e-posta gonderimi/otomasyon YOK; surukle-birak YOK; disa/ice
aktarma YOK; `internal.*` okunmaz. Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu (`/ajans/musteriler`, `/ajans/musteriler/[id]`) + `.next/BUILD_ID`.
- `grep -rn "crm_leads\|contacts" app --include=*.ts --include=*.tsx -l` → yalniz `crm-data.ts`, `crm-actions.ts` (+ teklif basligi
  baglantisi icin veri `page.tsx`); `grep -rn "₺" app` → 0; sapkali harf 0; yorumlar ASCII.
- Yetki: `canViewCrm` olmayan uye `/ajans/musteriler` → 403; `canManageCrm` olmayan (finance) formlari gormez (dugmeler yok), action 0
  satir → "Bu islem icin yetkin yok".
- **Canli tur (Claude, uretimde — DB uretimde; UI main'e girince):** gmail (Sunucu Ajans sahibi): menude "Musteriler"; Yeni kisi
  ("Deneme Musteri", e-posta) → tabloda; Yeni firsat (kisi, 45.000 TL, beklenen tarih, sahip Test Pro → hotmail'e bildirim) → panoda "Yeni"
  sutununda; panelde asama "Teklif verildi" → sutun degisir, aktivite satiri; teklif `8ba431e9…` (lansman; client_email dolu) onerilerde →
  "Kisi olarak ekle" → kisi + teklif basliginda "Kisi: … →"; kisi sayfasi: firsat + teklif + aktivite; hotmail (izleyici): menude Musteriler
  YOK, `/ajans/musteriler?kurulus=…` 403; bildirimde "Sana firsat atandi" (hotmail). 375 px: pano tek sutun, panel tam ekran. Konsol 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
