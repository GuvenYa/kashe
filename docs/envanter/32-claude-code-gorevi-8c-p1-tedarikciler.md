# Claude Code gorevi — FAZ 8c / P1: Tedarikciler arayuzu (`/ajans/tedarikciler`, etkinlikte Tedarikciler sekmesi + ic maliyet) ve alici kisa listesi (`/kurumsal/kisa-liste`, Kesfet "Kisa listeye ekle", RFP davetinde kisa liste)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/20-faz8-event-os-modulleri.md` bolum 5 (8c) ve
`supabase/migrations/20261023120000_faz8c_01_tedarikciler.sql` (DB uretimde: `suppliers`, `event_suppliers`, `internal.event_supplier_costs`
+ RPC `internal_event_supplier_costs_list(p_event_id)` / `internal_event_supplier_cost_set(p_event_supplier_id, p_amount, p_note)`,
`supplier_shortlists` + `supplier_shortlist_items`, yetki `suppliers.view` / `suppliers.manage`, moduller `suppliers` (ajansta acik) ve
`supplier_search` (business'ta acik), aktivite `supplier` / `event_supplier` / `shortlist`, `user_has_org_permission`). Dal: `faz8c/p1`
(Guven acar). **Migration/RPC YOK** — defter ve kisa liste yazmalari dogrudan tablolara (RLS; 0 satir = yetki hatasi), tutar YALNIZ iki RPC
ile (8b `crm-actions.ts` + FAZ 6 `internal_crew_commercial*` deseni). Panel dili (DESIGN.md 9): `PanelKabugu`, `PanelBaslik`, `KpiKutu`,
`VeriTablosu`, `PanelKart`.

---

Kashe reposundasin. Once `git status` (temiz; dal `faz8c/p1`). Oku: `CLAUDE.md` (FAZ 5 kurulus/yetki, FAZ 6 ic goruntu, FAZ 7b RFP, FAZ 8a
gorevler, FAZ 8b CRM paragraflari), `DESIGN.md` bolum 9, migration dosyasi (yukarida; CHECK listeleri, tetikleyici 22023 metinleri, RPC
imzalari), `app/lib/org-context.ts` (`CrewOrg`: `crmEnabled` / `canViewCrm` / `canManageCrm` nasil dolduruluyor), `app/lib/panel-menu.ts`
(ajans + kurumsal gruplar), `app/lib/org-roles.ts` (`ORG_ROLE_SUMMARIES*`), `app/lib/crm.ts`, `app/lib/crm-data.ts`, `app/lib/crm-actions.ts`
(hata eslemesi `crmHataMetni`, dogrudan yazma, 0 satir = yetki), `app/ajans/musteriler/page.tsx` + `app/components/crm/*` (KPI, sekme, form,
panel "alandan cikinca kaydet", arama, kapali-modul karti), `app/ajans/musteriler/[id]/page.tsx`, `app/lib/gorev-data.ts` (`aktiviteGetir`
eventId suzgeci), `app/lib/gorevler.ts` (`aktiviteMetni` contact/lead cumleleri), `app/etkinliklerim/[id]/page.tsx` (sekmeler; `ekipKurulusAjans`;
Ekip paneli ic maliyet kapisi `canSeeRates` / `canManageRates`), `app/etkinliklerim/[id]/ekip-maliyet-actions.ts` (RPC cagri kalibi),
`app/kesfet/page.tsx` + `app/kesfet/havuz-kisa-yol.tsx` + `app/kesfet/profile-card.tsx` (kart ustu kisa yol: tek yonetilebilir kurulus
kurali, stretched link icinde tiklama), `app/kurumsal/rfp/[id]/rfp-editoru.tsx` (davet kutusu: `searchAgencies` + `davetEt`),
`app/kurumsal/rfp/rfp-actions.ts` (`searchAgencies`, `rfp_invite`), `app/kurumsal/ayarlar/page.tsx` (modul karti), `app/components/panel/*`.

**Kirmizi cizgi:** migration/RPC YOK; `internal.*` tablolari dogrudan okunmaz/yazilmaz (tutar yalniz iki RPC); tedarikci iletisimi (e-posta,
telefon, yetkili) yalniz kurulus ici yuzeyde; tutar `para.ts` (`formatTL`), tarih `tarih.ts`; sapkali harf yok, yorumlar ASCII, UI Turkce.
Commit ATMA.

## 1) Baglam: `org-context.ts`, menu, rol ozetleri, ayarlar

- `CrewOrg`'a `suppliersEnabled` (`org_module_enabled(org,'suppliers') && accountType === 'agency'`), `canViewSuppliers`
  (`has_org_permission(org,'suppliers.view')`), `canManageSuppliers` (`'suppliers.manage'`), `shortlistEnabled`
  (`org_module_enabled(org,'supplier_search')`; hesap turu suzgeci YOK — ajans da `org_module_set` ile acabilir) — mevcut `Promise.all`
  dizisine eklenir (yeni tur yok).
- `panel-menu.ts` ajans grubu: "Tedarikciler" maddesi (`/ajans/tedarikciler?kurulus=<id>`; "Musteriler"den hemen sonra) yalniz
  `suppliersEnabled && canViewSuppliers`. Kurumsal grup: "Kisa liste" maddesi (`/kurumsal/kisa-liste?kurulus=<id>`; "Teklif talepleri"nden
  sonra) yalniz `shortlistEnabled && canViewEvents`. Ikon: mevcut setten (`havuz`/`rfp` benzeri; yeni ikon gerekiyorsa `panel-yan-menu`
  ikon haritasina ASCII adla eklenir).
- `org-roles.ts` ozetleri (ajans): project_manager ve crew_coordinator → "…tedarikcileri yonetir…"; sales ve finance → "…tedarikcileri
  gorur…"; owner/admin listesine "tedarikciler" eklenir. Kurumsal ozetlerde "kisa liste" events.* ile anlatilir (ayri anahtar yok).
- `/kurumsal/ayarlar` Moduller karti: "Kisa liste" (supplier_search) ac/kapat — Gorevler kartiyla ayni bilesen (`modul-satiri.tsx`) (`org_module_set`,
  `settings.manage`). Ajansta ayar yuzeyi YOK (varsayilan acik; 8b ile ayni).

## 2) Veri + action katmani

- `app/lib/tedarikci.ts` (sunucu/istemci ortak sabitler): `TEDARIKCI_KATEGORILERI` (DB CHECK listesiyle AYNI sira): sound_light "Ses ve
  isik" · stage_technical "Sahne ve teknik" · catering "Catering" · venue "Mekan" · transport "Ulasim" · print_promo "Baski ve promosyon" ·
  decor "Dekor" · security "Guvenlik" · talent "Yetenek" · other "Diger"; `ATAMA_DURUMLARI` planned "Planlandi" · confirmed "Onaylandi" ·
  cancelled "Iptal" (rozet siniflari 8b `ASAMA_SINIFLARI` kalibi); `tedarikciHataMetni` (22023 metinleri: 'suppliers modulu bu kurulusta
  kapali', 'tedarikci kendi kurulusunun saglayicisi olamaz', 'etkinlik bu kurulusa ait degil', 'tedarikci bu kurulusa ait degil',
  'tedarikci arsivde', 'supplier_search modulu bu kurulusta kapali', 'kendi saglayicin kisa listeye eklenemez', 'kurulussuz etkinlikte ic
  goruntu yok', 'tutar 0 veya daha buyuk olmali', 23505 → "Bu tedarikci zaten etkinlikte" / "Bu saglayici zaten listede" / "Bu saglayici
  baska bir tedarikciye bagli", 23503 → "Etkinliklere atanmis tedarikci silinemez; once arsivle", 23514 → alan metni).
- `app/lib/tedarikci-data.ts` (sunucu): `tedarikcileriListele(org, { q, kategori, arsiv })` (ad/yetkili/e-posta arama; etkinlik sayisi alt
  sorgu TEK toplu; sehir adi `turkish_cities` embed), `tedarikciDetay(org, id)` (kayit + bagli saglayici `providers`/`v_providers_public`
  adi + atandigi etkinlikler (`event_suppliers` + `events(title, start_date)`) + aktivite `supplier` ve o tedarikcinin `event_supplier`
  kayitlari), `etkinlikTedarikcileri(org, eventId)` (`event_suppliers` + `suppliers(name, category, phone, email)`), `tedarikciSecenekleri(org)`
  (aktif tedarikciler; atama formu), `kisaListeleriListele(org)` (liste + kalem sayisi + etkinlik basligi), `kisaListeDetay(org, id)`
  (kalemler + `v_providers_public` adi/sehri/turu; **`providers`/`v_providers_public` disinda saglayici PII okunmaz**),
  `kisaListeDurumu(org, providerIds)` (Kesfet kartlari icin: hangi saglayici hangi listede — tek sorgu), `tedarikciSayilari(org)` (KPI).
- `app/lib/tedarikci-actions.ts` (`'use server'`): `tedarikciOlustur`, `tedarikciGuncelle`, `tedarikciArsivle(id, aktif)`, `tedarikciSil`
  (23503 → mesaj), `etkinligeTedarikciEkle(org, eventId, supplierId, service)`, `atamaGuncelle(id, { service, status, notes, sort })`,
  `atamaSil`, `tedarikciMaliyetListele(eventId)` → `rpc('internal_event_supplier_costs_list')` (42501 → `null`: yetki yok, UI tutar
  sutununu gizler), `tedarikciMaliyetYaz(eventSupplierId, amount | null, note)` → `rpc('internal_event_supplier_cost_set')`;
  `kisaListeOlustur(org, name, eventId?)`, `kisaListeGuncelle`, `kisaListeSil`, `kisaListeyeEkle(listId, providerId, note?)`,
  `kisaListedenCikar(itemId)`, `kisaListeyeHizliEkle(org, providerId)` (Kesfet karti: kurulusun "Genel" adli listesi yoksa olusturur,
  kaleme ekler; tek action). Dogrulama: ad 2-200 / 2-120, e-posta basit bicim, puan 1-5, tutar ≥ 0, kategori/durum listeden.
  `revalidatePath` daraltilmis (`/ajans/tedarikciler`, `/etkinliklerim/<id>`, `/kurumsal/kisa-liste`, `/kesfet` yalniz hizli ekle).

## 3) Sayfalar — ajans

- **`/ajans/tedarikciler`** (`app/ajans/tedarikciler/page.tsx`; `PanelKabugu`; `?kurulus=` 8b kalibi; `canViewSuppliers` degilse 8b
  "yetkin yok" karti; modul kapaliysa "Tedarikci modulu bu kurulusta kapali" karti). `PanelBaslik` eyebrow "<kurulus> · Tedarikciler",
  baslik "<em>Tedarikciler</em>", sag "Yeni tedarikci" (`canManageSuppliers`). KPI (`KpiKutu` x4): TEDARIKCI (aktif) · KATEGORI (kullanilan
  farkli kategori) · AKTIF ATAMA (planned+confirmed, gelecek etkinlikler) · ARSIV. Ustte arama kutusu (`?q=`) + kategori secimi
  (`?kategori=`) + "Arsivdekileri goster" (`?arsiv=1`) — URL'ye bagli, 8a filtre deseni.
  **Tablo** (`VeriTablosu`): AD (alt satir kategori · sehir; Kashe bagi varsa kucuk "Kashe" rozeti) · YETKILI · TELEFON (`dar`) · PUAN
  (1-5 yildiz, mono) · ETKINLIK (sayi) · satir → `/ajans/tedarikciler/<id>`. Arsivdeki satir soluk + "Arsiv" rozeti. Telefonda kart
  modu (8b kisiler tablosu kalibi).
  **Form** `?yeni=tedarikci` (`app/components/tedarikci/tedarikci-formu.tsx`; 8b `yeni-kayit-formu` kalibi): ad, kategori (select), yetkili,
  e-posta, telefon, web, sehir (`turkish_cities` select — mevcut sehir secici varsa o), puan (1-5 segment), not, **Kashe saglayicisi**
  (arama kutusu `v_providers_public` display_name ilike, `provider_type` fark etmez; secilince `linked_provider_id`; kendi saglayicisi
  secilemez — DB 22023'u Turkce gosterir).
- **`/ajans/tedarikciler/[id]`** tedarikci sayfasi: `PanelBaslik` (ad; eyebrow kategori · sehir; sag "Duzenle" / "Arsivle|Arsivden cikar" /
  "Sil" onay kapili), bilgi karti (yetkili, e-posta, telefon, web baglantisi, puan, not, Kashe bagi → `/p/<provider id>` baglantisi —
  not: `v_providers_public.id` profil kimligidir, baglanti kalibi Kesfet'teki gibi), "Etkinlikler" (`VeriTablosu`: etkinlik · tarih ·
  hizmet · durum rozeti → `/etkinliklerim/<id>?sekme=tedarikciler`), "Aktivite" (`aktivite-akisi`; `aktiviteGetir({ entityIds: [tedarikci,
  ...atama idleri] })`). PII notu: "E-posta ve telefon kurulus ici bilgidir…" (8b kisi sayfasindaki satir).
- **Etkinlik sayfasi — "Tedarikciler" sekmesi** (`app/etkinliklerim/[id]/page.tsx`): sekme YALNIZ `kurulusEtkinligi && etkinlikKurulusu.accountType
  === 'agency' && suppliersEnabled && canViewSuppliers` (business etkinliginde YOK — tedarikci defteri ajansa ozel); "Gorevler"den once,
  sayi = aktif atama. Icerik `app/components/tedarikci/etkinlik-tedarikcileri.tsx` (istemci): liste satiri = tedarikci adi (→ tedarikci
  sayfasi) · kategori · hizmet (satir ici duzenlenir, alandan cikinca kaydet) · durum (select planned/confirmed/cancelled) · telefon
  (kucuk, `tel:`) · **tutar sutunu** (yalniz `canSeeRates` ise: `tedarikciMaliyetListele` sonucu; `canManageRates` ise satir ici sayi
  girisi + not simgesi; bos → "—"; alandan cikinca `tedarikciMaliyetYaz`; silmek icin bos birak → NULL) · "Kaldir" (onay). Altta toplam
  satiri: "Tedarikci maliyeti toplami: <TL>" (yalniz `canSeeRates`; `cancelled` haric). Ust: "Tedarikci ekle" (`canManageSuppliers`):
  `tedarikciSecenekleri` arama + secim + hizmet alani; "Defterde yok → Yeni tedarikci" baglantisi (`/ajans/tedarikciler?kurulus=…&yeni=tedarikci`).
  Ekip panelindeki ic maliyet gizlilik notu kalibi ("Ic maliyet gizli — yalniz ticari yetkililer") tutar sutununun basliginda.
- **Aktivite:** `aktiviteGetir` eventId suzgeci gorev id'lerine ek olarak o etkinligin `event_suppliers` id'lerini de alir (ayni kalip:
  once id listesi). `gorevler.ts` `aktiviteMetni`: `supplier` ("'<ad>' tedarikcisini ekledi / guncelledi / arsivledi / sildi"; PII diff
  `email/phone/contact_name/website: true` → "iletisim bilgisini guncelledi" deger yazmadan), `event_supplier` ("etkinlige '<tedarikci adi>'
  tedarikcisini ekledi", "tedarikci durumunu degistirdi → Onaylandi", "tedarikciyi kaldirdi"; `supplier_id` adi `adlar` haritasindan —
  `aktiviteAdlari` kapsamina `suppliers.name` eklenir), `shortlist` ("'<ad>' kisa listesini olusturdu", "kisa listeye saglayici ekledi /
  cikardi" — `item_added/item_removed` saglayici adi `adlar`dan; `v_providers_public.display_name`).
- **Gosterge `/ajans`:** KPI satirina "AKTIF TEDARIKCI N" eklemeyin — satir 4 kutu; bunun yerine "Acik isler" blogunun altina kucuk
  baglanti satiri: "Tedarikciler: <aktif> kayit · <aktif atama> atama →" (`suppliersEnabled && canViewSuppliers`).

## 4) Sayfalar — alici (kurumsal)

- **`/kurumsal/kisa-liste`** (`app/kurumsal/kisa-liste/page.tsx`; `PanelKabugu`; `?kurulus=`; `canViewEvents` degilse yetkin yok karti;
  `shortlistEnabled` degilse "Kisa liste modulu kapali → Ayarlar'dan ac" karti (8a `GorevModuluKapali` kalibi, `canManageSettings` ile
  baglanti)). `PanelBaslik` eyebrow "<kurulus> · Kisa liste", baslik "<em>Kisa</em> liste", sag "Yeni liste" (`canManageEvents`). Sol/ust:
  liste secimi (sekme seridi: her liste adi + kalem sayisi; `?liste=<id>`; varsayilan en yeni). Secili liste: baslik satiri (ad, bagli
  etkinlik varsa "Etkinlik: <baslik> →", not; "Duzenle" / "Sil" onayli), kalemler `VeriTablosu`: SAGLAYICI (ad → `/p/<id>`; tur rozeti
  Ajans/Pro) · SEHIR · NOT (satir ici duzenlenir) · "Cikar". Ustte "Saglayici ekle": arama (`v_providers_public` display_name ilike;
  `provider_type` ikisi de) + "Ekle"; kendi saglayicisi DB'den 22023 → Turkce. Alt bilgi: "Kisa listedeki ajanslari teklif talebine davet
  edebilirsin → Teklif talepleri".
- **Kesfet karti — "Kisa listeye ekle":** `app/kesfet/kisa-liste-kisa-yol.tsx` (`havuz-kisa-yol.tsx` kalibi; `preventDefault + stopPropagation`).
  Sunucu (`kesfet/page.tsx`) bu bilgiyi YALNIZ kullanicinin `shortlistEnabled && canManageEvents` olan TEK kurulusu varsa gonderir
  (`getCrewContext` ile; `kisaListeDurumu` tek sorgu); kartta durum 'listede' (rozet "Kisa listede") / 'eklenebilir'
  (dugme "Kisa listeye ekle" → `kisaListeyeHizliEkle`). Havuz kisa yolu ile ayni karta ikisi birden dusebilir mi? Ajans hem `talent_pool`
  hem `supplier_search` acarsa evet — ikisi yan yana sigmiyorsa havuz oncelikli, kisa liste `/p/[id]` panelinde. Kullanicinin kendi
  saglayicisi (`profile.id === user.id` ya da kurulusun kendi saglayicisi) icin kisa yol YOK.
- **`/p/[id]` profil sayfasi:** ajans/profesyonel profilinde `ProfilIslemBaglami` icinde "Kisa listeye ekle" (kurulus secimi varsa select;
  `havuza-ekle.tsx` kalibi). Yalniz `shortlistEnabled && canManageEvents` kurulus varsa.
- **RFP editoru davet kutusu** (`rfp-editoru.tsx`): "Ajans ara" alaninin ustune "Kisa listeden sec" blogu: kurulusun kisa listelerindeki
  `provider_type = 'organization'` saglayicilar (sunucu `page.tsx` tek sorgu → prop), her satir ad + "Davet et" (mevcut `davetEt`); davetli
  ise "Davetli". Liste bossa blok gizli. Profesyonel kalemler burada gosterilmez (RFP yalniz ajansa — 7b karari).

## 5) Yapilmayacaklar

Migration/RPC YOK; `internal.*` dogrudan okunmaz; business kurulusta tedarikci defteri yuzeyi YOK (modul kapali olsa da menu yok);
tedarikciye bildirim/e-posta YOK; `procurement_requests` YOK; Kesfet sorgusu/siralamasi DEGISMEZ; teklif kalemine tedarikci maliyeti
aktarimi YOK (8c-P2 / Finance). Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu (`/ajans/tedarikciler`, `/ajans/tedarikciler/[id]`, `/kurumsal/kisa-liste`) +
  `.next/BUILD_ID`.
- `grep -rn "event_supplier_costs" app --include=*.ts --include=*.tsx` → yalniz `tedarikci-actions.ts` icindeki iki `rpc(` cagrisi;
  `grep -rn "from('suppliers')\|from('event_suppliers')\|from('supplier_shortlist" app -l` → yalniz `tedarikci-data.ts`, `tedarikci-actions.ts`
  (+ Kesfet/RFP sayfasi tek sorgu icin `tedarikci-data.ts` fonksiyonunu kullanir, dogrudan tablo adi yazmaz); `grep -rn "₺" app` → 0;
  sapkali harf 0; yorumlar ASCII.
- Yetki: `canViewSuppliers` olmayan (viewer) `/ajans/tedarikciler` → yetkin yok; `canManageSuppliers` olmayan (sales/finance) dugmeleri
  gormez; `canSeeRates` olmayan (ekip koordinatoru) etkinlik sekmesinde tutar sutununu HIC gormez (RPC cagrilmaz ya da 42501 → gizli).
- **Canli tur (Claude, onizlemede):** gmail (Sunucu Ajans sahibi): menude "Tedarikciler"; Yeni tedarikci ("Deneme Ses Isik", ses ve isik,
  yetkili, telefon, puan 4) → tabloda; lansman etkinligi → Tedarikciler sekmesi → ekle (hizmet "Ses sistemi") → durum Onaylandi → tutar
  12.000 → toplam satiri; aktivite sekmesinde satirlar; tedarikci sayfasi (etkinlik + aktivite); arsivle → yeni atamada secilemez; sil →
  "once arsivle" (atanmisken). hotmail (izleyici): menude Tedarikciler YOK, sayfa yetkin yok. testguven (kurum sahibi): menude "Kisa liste";
  Kesfet'te bir ajans kartinda "Kisa listeye ekle" → "Genel" listesi olustu; `/kurumsal/kisa-liste` kalem + not; RFP taslaginda "Kisa listeden
  sec" → Davet et; Ayarlar'dan Kisa liste kapat → menu kaybolur → ac. 375 px: tablolar kart modu, sekme seridi kaydirilir. Konsol 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
