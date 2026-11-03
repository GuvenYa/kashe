# Claude Code gorevi — FAZ 10b / P1: Etkinlik turu tek kaynak (`EVENT_TYPES` sabiti silinir; liste `event_types` tablosundan okunur)

**BEKLEYEN GOREV:** `supabase/migrations/20261031120000_faz10b_01_etkinlik_turu_fk.sql` dala uygulandiktan sonra verilir (10a +
Duzeltme 01 uretime ciktiktan sonra). Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/38-faz10-temizlik.md`
bolum 10b. Dal: `faz10b/p1` (Guven acar). **Migration YOK.** DB tarafi: `conversations`, `listings`, `bookings`, `quote_requests`
`event_type` sutunlari `event_types(key)` tablosuna FK ile bagli (ON UPDATE CASCADE); eski CHECK listeleri yok; anahtar disi deger
23503. `event_types` anon + authenticated SELECT (sutunlar: `key, name_tr, group_key, sort_order, is_active`).

---

Kashe reposundasin. Once `git status` (temiz; dal `faz10b/p1`). Oku: `CLAUDE.md`, `app/mesajlar/data.ts` (`EVENT_TYPES`, `EventTypeKey`,
`EVENT_TYPE_KEYS`, `getEventTypeLabel`), `app/lib/etkinlik-turu.ts` (`etkinlikTuruEtiketi`: EVENT_TYPES -> filter-config -> ham deger
zinciri), `grep -rln "EVENT_TYPES\|EventTypeKey\|EVENT_TYPE_KEYS\|getEventTypeLabel" app` (17 dosya; 6'si `'use client'`:
`ilanlar/ilanlar-listesi.tsx`, `ilanlar/yeni/yeni-ilan-formu.tsx`, `ilanlar/[id]/ilan-detay.tsx`, `kesfet/kesfet-filters.tsx`,
`profil/kategori-bilgileri/kategori-form.tsx`, `teklif-topla/teklif-topla-formu.tsx`), `app/lib/brief-config.ts` (modul duzeyi
`EVENT_TYPE_OPTIONS`), `app/kesfet/page.tsx` (URL parametresi dogrulamasi `EVENT_TYPE_KEYS`), `app/mesajlar/actions.ts` ve
`app/profil/kategori-bilgileri/actions.ts` (deger dogrulamasi), `app/layout.tsx`, `app/lib/supabase-server.ts`.

**Kirmizi cizgi:** migration/RPC YOK; is bitince `grep -rn "EVENT_TYPES\b\|EVENT_TYPE_KEYS\|EventTypeKey" app` BOS (yorum satirlari
dahil — "eski EVENT_TYPES" diye aciklama da kalmaz); etiketler UYDURULMAZ (tabloda olmayan anahtar ham haliyle, ilk harf buyuk);
yerel etkinlik turu sozlugu/kopyasi acilmaz; `BUDGET_RANGES` ve diger sabitler `data.ts`'te kalir; sapkali harf yok, yorumlar ASCII,
UI Turkce. Commit ATMA.

## 1) Tek kaynak katmani

- `app/lib/etkinlik-turleri.ts` (sunucu; `'use client'` YOK): `etkinlikTurleri(): Promise<EtkinlikTuru[]>` — `event_types`
  `is_active = true` `order sort_order` -> `{ key, label (name_tr), group (group_key), sortOrder }[]`; `unstable_cache` ile 1 saat
  (`tags: ['event-types']`), istemci olusturma `createClient` ile (anon okur; oturum gerekmez — cache icinde `cookies()` kullanilmaz,
  bu yuzden cache disinda olusturulan ya da anon anahtarli bir istemci gecir). Hata -> bos dizi + `console.error` (sayfa kirilmaz;
  secim kutulari bos kalir, etiket ham deger gorunur).
- `app/lib/etkinlik-turu.ts` (`etkinlikTuruEtiketi`): 1. kaynak artik parametre olarak verilen liste (`etiketle(turler, key)`) ya da
  istemcide context; 2. kaynak filter-config seceneklerinin event_types alanlari AYNEN; 3. ham deger. `EVENT_TYPES` importu kalkar.
- Istemci tarafi: `app/components/etkinlik-turleri-provider.tsx` (`'use client'`): `EtkinlikTurleriProvider({ turler, children })` +
  `useEtkinlikTurleri()` (liste) + `useEtkinlikTuruEtiketi()` (key -> label; yoksa `etkinlikTuruEtiketi` 2./3. kaynak). `app/layout.tsx`
  sunucuda `etkinlikTurleri()` okur ve saglayiciyi `children` etrafina sarar (tek sorgu, 1 saat cache). Alti istemci bilesen listeyi/etiketi
  buradan alir; sayfa prop'u ile de gecilebilir (ikisini birden yapma).

## 2) Dosya dosya

- `app/mesajlar/data.ts`: `EVENT_TYPES`, `EventTypeKey`, `EVENT_TYPE_KEYS`, `getEventTypeLabel` SILINIR. `BUDGET_RANGES` vb. kalir.
  `getEventTypeLabel` cagiran sunucu dosyalari `etkinlikTurleri()` + `etiketle`, istemciler `useEtkinlikTuruEtiketi`.
- `app/ilanlar/listings-data.ts`: `EventTypeKey` -> `string`; dogrulama DB'de (FK) — action katmaninda 23503 -> "Geçersiz etkinlik türü."
- `app/ilanlar/ilanlar-listesi.tsx`, `yeni/yeni-ilan-formu.tsx`, `[id]/ilan-detay.tsx`: secenekler/etiketler saglayicidan.
- `app/kesfet/page.tsx`: URL `tur` parametresi dogrulamasi `etkinlikTurleri()` anahtarlariyla; `kesfet-filters.tsx` listeyi prop
  (`turler`) ya da saglayicidan alir.
- `app/lib/brief-config.ts`: modul duzeyi `EVENT_TYPE_OPTIONS` KALKAR; `event_type` alaninin secenekleri calisma zamaninda doldurulur
  (`briefAlanlari(turler)` benzeri bir fonksiyon ya da `options` bos + `source: 'event_types'` isareti; brief'i okuyan yerler —
  sihirbaz, teklif-topla, portal/teklif karti, AI brief — listeyi `etkinlikTurleri()`'nden gecirir). Hangi yolu sectigini raporda yaz.
- `app/lib/category-fields.ts`, `app/lib/filter-config.ts`: yalniz yorum (eski sabit adi gecmez; "tek kaynak event_types tablosu").
- `app/profil/kategori-bilgileri/kategori-form.tsx` (ortak `etkinlik_turleri` alani secenekleri) + `actions.ts` (deger dogrulamasi:
  tablodan anahtar kumesi; `category_attributes.etkinlik_turleri` jsonb'dir, FK yok — dogrulama burada kalir, kaynak tablo).
- `app/mesajlar/actions.ts`: `startConversation` vb. `event_type` dogrulamasi tablodan (ya da DB 23503 -> Turkce mesaj); eski kume
  kontrolu kalkar.
- `app/teklif-topla/page.tsx` + `teklif-topla-formu.tsx`: tur secenekleri sunucudan prop.
- `app/p/[id]/professional-profile.tsx`: etiket yolu saglayici/etiketle.
- Portal (`app/portal/*`) ve e-posta sablonlari `event_type` etiketi gosteriyorsa ayni yoldan (anon portalda saglayici yoksa sunucu
  tarafinda `etiketle`).

## 3) Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`; `npx eslint <degisen dosyalar>`; `npm run build`.
- `grep -rn "EVENT_TYPES\b\|EVENT_TYPE_KEYS\|EventTypeKey\|getEventTypeLabel" app` BOS. `grep -rn "from('event_types')" app` yalniz
  `app/lib/etkinlik-turleri.ts`. `grep -rnP '[âîûÂÎÛ]' <degisen dosyalar>` bos.
- Onizleme (Sahne): ilan formu tur listesi 15 tur (sirali, `event_types.sort_order`); Kesfet "Etkinlik türü" suzgeci ayni liste,
  `?tur=olmayan` 404 degil, suzgec yok sayilir; teklif-topla formu; kategori bilgileri formu ortak alan; konusma kartinda tur etiketi
  ("Kurumsal"); `/p/[id]` etiketleri. Dalda `event_types`'a `is_active = false` yapilan bir tur (ornek `graduation`) listelerden duser
  ama mevcut kayitlarda etiketi gorunmeye devam eder (etiketleme `is_active` suzmez — kontrol et; gerekirse `etkinlikTurleri({ hepsi:
  true })` etiket icin).

## 4) Rapor

Bitince kisa rapor: degisen dosyalar, brief-config icin secilen yol, saglayici/prop karari, sapmalar. Commit ATMA.
